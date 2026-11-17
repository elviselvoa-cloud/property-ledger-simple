import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// WhatsApp Cloud API
const WA_API_URL = "https://graph.facebook.com/v20.0";

// Normalize Kenyan phone number to international format (254...)
function normalizeKenyanPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  const cleaned = input.trim().replace(/[\s\-()]/g, "");

  // Already in international format starting with 254
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Starting with 07... (traditional Kenyan mobile format)
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return "254" + cleaned.slice(1);
  }

  // Starting with 01... (Safaricom prefix)
  if (/^01\d{9}$/.test(cleaned)) {
    return "254" + cleaned.slice(1);
  }

  // Starting with +254
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    return cleaned.slice(1);
  }

  return null;
}

serve(async (req) => {
  const url = new URL(req.url);
  const method = req.method;

  // GET - Webhook verification
  if (method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST - Incoming webhook message
  if (method === "POST") {
    const body = await req.json();

    // Validate webhook structure
    if (!body.entry?.[0]?.changes?.[0]?.value) {
      return new Response("Bad request", { status: 400 });
    }

    const change = body.entry[0].changes[0];
    const value = change.value;
    const metadata = value.metadata || {};

    // Determine landlord context based on phone number architecture
    const senderPhone = value.messages?.[0]?.from;
    const recipientPhoneNumberId = metadata.phone_number_id;

    if (!senderPhone) {
      return new Response("No message", { status: 200 });
    }

    const normalizedSender = normalizeKenyanPhone(senderPhone);
    if (!normalizedSender) {
      return new Response("Invalid phone", { status: 400 });
    }

    let landlordId: string | null = null;
    let tenant = null;
    let lease = null;

    // Determine phone mode and find context
    const phoneMode = Deno.env.get("WA_PLATFORM_MODE") ?? "shared"; // 'shared' or 'custom'

    if (phoneMode === "custom") {
      // Custom mode: Match by WhatsApp phone number ID
      const { data: land } = await supabase
        .from("landlords")
        .select("id")
        .eq("whatsapp_phone_number_id", recipientPhoneNumberId)
        .single();
      landlordId = land?.id ?? null;
    } else {
      // Shared mode: Match by tenant phone number to active lease
      const { data: t } = await supabase
        .from("tenants")
        .select("id, first_name, phone")
        .eq("phone", normalizedSender)
        .single();

      tenant = t;

      if (t) {
        const { data: l } = await supabase
          .from("leases")
          .select("id, unit_id, status, landlord_id")
          .eq("tenant_id", t.id)
          .eq("status", "active")
          .single();
        lease = l;
        landlordId = lease?.landlord_id?.toString() ?? null;
      }
    }

    // Get message text
    const messageText = value.messages?.[0]?.text?.body;
    const messageType = value.messages?.[0]?.type;

    // Log the inbound message
    if (landlordId) {
      await supabase.from("whatsapp_messages").insert({
        landlord_id: landlordId,
        tenant_id: tenant?.id ?? null,
        direction: "inbound",
        sender_phone: normalizedSender,
        recipient_phone: metadata.display_phone_number || metadata.phone_number_id || recipientPhoneNumberId,
        message_text: messageText || "",
        message_type: messageType || "text",
      });
    }

    // Process command if valid context found
    if (messageText && landlordId) {
      const response = await processCommand(messageText, normalizedSender, tenant, lease, landlordId);

      // Log outbound message
      await supabase.from("whatsapp_messages").insert({
        landlord_id: landlordId,
        tenant_id: tenant?.id ?? null,
        direction: "outbound",
        sender_phone: normalizedSender,
        recipient_phone: value.contacts?.[0]?.wa_id || normalizedSender,
        message_text: response,
        message_type: "text",
      });

      // Send reply via WhatsApp Cloud API
      await sendWhatsAppMessage(value.contacts?.[0]?.wa_id || normalizedSender, response);
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});

async function processCommand(
  text: string,
  phone: string,
  tenant: any,
  lease: any,
  landlordId: string
): Promise<string> {
  const cmd = text.trim().toLowerCase();

  // Get tenant name
  const tenantName = tenant?.first_name ? tenant.first_name.split(" ")[0] : "Friend";

  // Handle commands
  if (["balance", "rent", "deni"].includes(cmd)) {
    const { data: invoices } = await (supabase as any)
      .from("rent_invoices")
      .select("amount, due_date, status, period_month")
      .eq("tenant_id", tenant?.id)
      .in("status", ["pending", "partial", "overdue"]);

    const outstanding = invoices?.reduce((sum: number, inv: any) =>
      sum + (Number(inv.amount) - Number(inv.paid_amount || 0)), 0) || 0;

    const pendingInvoice = invoices?.find((inv: any) => inv.status === "pending");
    const nextDue = pendingInvoice?.due_date;

    if (outstanding <= 0) {
      return `Hello ${tenantName}, your rent is all caught up! 🎉\nReply *PAY* when you're ready to make a payment.`;
    }

    const dueDate = nextDue ? new Date(nextDue).toLocaleDateString() : "soon";
    return `Hello ${tenantName},\nYour outstanding rent balance is KES ${outstanding.toLocaleString()}.\nNext due: ${dueDate}.\n\nReply *PAY* to pay via M-Pesa.`;
  }

  if (["pay", "lipa"].includes(cmd)) {
    if (!lease) {
      return "You don't have an active lease. Contact your landlord for assistance.";
    }

    const { data: invoice } = await (supabase as any)
      .from("rent_invoices")
      .select("id, amount, status, due_date")
      .eq("lease_id", lease.id)
      .eq("status", "pending")
      .single();

    if (!invoice) {
      return "No outstanding invoices found for your unit. Thank you!";
    }

    // Create STK push request
    const amount = Number(invoice.amount);
    await initiateSTKPush(phone, amount, landlordId, invoice.id, String(lease.unit_id));

    return `An M-Pesa STK push for KES ${amount.toLocaleString()} has been sent to your phone.\nPlease enter your M-Pesa PIN to complete payment.`;
  }

  if (["caretaker", "help"].includes(cmd)) {
    if (!lease) {
      return "You don't have an active lease. Contact your landlord for assistance.";
    }

    const { data: property } = await (supabase as any)
      .from("units")
      .select("property_id")
      .eq("id", lease.unit_id)
      .single();

    const { data: caretakerLink } = await (supabase as any)
      .from("caretaker_properties")
      .select("caretaker_id")
      .eq("property_id", property?.property_id)
      .single();

    const { data: caretaker } = await (supabase as any)
      .from("caretakers")
      .select("name, phone, is_active")
      .eq("id", caretakerLink?.caretaker_id)
      .eq("is_active", true)
      .single();

    if (caretaker) {
      return `Caretaker for your property: ${caretaker.name}\nPhone: ${caretaker.phone}\nAvailable Mon–Sat 8am–5pm.`;
    }
    return "No caretaker assigned to your property yet. You can contact your landlord for assistance.";
  }

  if (cmd === "receipt") {
    const { data: payment } = await (supabase as any)
      .from("payments")
      .select("payment_date, amount, receipt_number")
      .eq("tenant_id", tenant?.id)
      .order("payment_date", { ascending: false })
      .limit(1)
      .single();

    if (payment) {
      const date = new Date(payment.payment_date).toLocaleDateString();
      return `Payment Receipt:\nDate: ${date}\nAmount: KES ${Number(payment.amount).toLocaleString()}\nReference: ${payment.receipt_number}\n\nThis confirms your payment was received.`;
    }
    return "No payment records found yet.";
  }

  // Unknown command - show menu
  return `Hi ${tenantName}! Reply with:\n1. Balance - Check outstanding rent\n2. Pay - Pay via M-Pesa\n3. Caretaker - Contact your property caretaker\n4. Receipt - Get your latest payment receipt`;
}

async function initiateSTKPush(
  phone: string,
  amount: number,
  landlordId: string,
  invoiceId: string,
  unitNumber: string
) {
  const { data: landlord } = await supabase
    .from("landlords")
    .select("mpesa_shortcode, mpesa_passkey, mpesa_environment, mpesa_paybill")
    .eq("id", landlordId)
    .single();

  if (!landlord?.mpesa_passkey || !landlord?.mpesa_shortcode) {
    throw new Error("Landlord M-Pesa credentials not configured");
  }

  const shortcode = landlord.mpesa_shortcode;
  const passkey = landlord.mpesa_passkey;
  const environment = landlord.mpesa_environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
  const password = btoa(`${shortcode}${passkey}${timestamp}`);

  const response = await fetch(`${environment}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${await getMpesaAccessToken(landlordId)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14),
      Amount: Math.round(amount),
      PartyA: parseInt(phone),
      PartyB: landlord.mpesa_paybill || shortcode,
      PhoneNumber: parseInt(phone),
      CallBackURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`,
      AccountReference: `Unit-${unitNumber}`,
      TransactionDesc: `Rent payment for ${unitNumber}`,
    }),
  });

  return response.json();
}

async function getMpesaAccessToken(landlordId: string): Promise<string> {
  const { data: landlord } = await supabase
    .from("landlords")
    .select("mpesa_consumer_key, mpesa_consumer_secret, mpesa_environment")
    .eq("id", landlordId)
    .single();

  const consumerKey = landlord?.mpesa_consumer_key;
  const consumerSecret = landlord?.mpesa_consumer_secret;

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa credentials not configured");
  }

  const environment = landlord?.mpesa_environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  const authResponse = await fetch(`${environment}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      "Authorization": "Basic " + btoa(`${consumerKey}:${consumerSecret}`),
    },
  });

  const authData = await authResponse.json();
  return authData.access_token;
}

async function sendWhatsAppMessage(to: string, text: string) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!token || !phoneNumberId) return;

  await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      text: { body: text },
    }),
  });
}