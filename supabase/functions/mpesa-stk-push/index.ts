import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const url = new URL(req.url);
  const method = req.method;

  if (method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const { phone, amount, landlord_id, invoice_id, unit_number } = body;

  if (!phone || !amount || !landlord_id) {
    return new Response(JSON.stringify({ error: "Missing required fields: phone, amount, landlord_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get landlord M-Pesa credentials
    const { data: landlord, error: landlordErr } = await supabase
      .from("landlords")
      .select("mpesa_shortcode, mpesa_passkey, mpesa_environment, mpesa_paybill, mpesa_consumer_key, mpesa_consumer_secret")
      .eq("id", landlord_id)
      .single();

    if (landlordErr || !landlord?.mpesa_passkey || !landlord?.mpesa_shortcode) {
      throw new Error("Landlord M-Pesa credentials not configured");
    }

    const shortcode = landlord.mpesa_shortcode;
    const passkey = landlord.mpesa_passkey;
    const environment = landlord.mpesa_environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
    const paybill = landlord.mpesa_paybill || shortcode;

    // Normalize phone number
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      throw new Error("Invalid phone number");
    }

    // Generate STK push credentials
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Save pending transaction
    const checkoutRequestId = `CHCK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { error: txInsertErr } = await supabase.from("mpesa_transactions").insert({
      landlord_id,
      tenant_id: null, // Will be updated via callback
      invoice_id,
      phone: cleanPhone,
      amount,
      merchant_request_id: null,
      checkout_request_id: checkoutRequestId,
      status: "pending",
    });

    if (txInsertErr) {
      throw new Error(`Failed to create transaction: ${txInsertErr.message}`);
    }

    // Make STK push request
    const accessToken = await getAccessToken(landlord);

    const stkResponse = await fetch(`${environment}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        Amount: Math.round(Number(amount)),
        PartyA: parseInt(cleanPhone),
        PartyB: paybill,
        PhoneNumber: parseInt(cleanPhone),
        CallBackURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`,
        AccountReference: unit_number || `Unit-${Date.now()}`,
        TransactionDesc: "Rent payment",
      }),
    });

    const stkResult = await stkResponse.json();

    if (stkResult.resultCode !== 0) {
      // Update transaction status to failed
      await supabase
        .from("mpesa_transactions")
        .update({ status: "failed", result_desc: stkResult.resultDesc })
        .eq("checkout_request_id", checkoutRequestId);

      throw new Error(stkResult.resultDesc || "STK push failed");
    }

    // Update transaction with merchant request ID
    await supabase
      .from("mpesa_transactions")
      .update({
        merchant_request_id: stkResult?.MerchantRequestId,
        checkout_request_id: stkResult?.CheckoutRequestId || checkoutRequestId,
      })
      .eq("checkout_request_id", checkoutRequestId);

    return new Response(JSON.stringify({
      success: true,
      CheckoutRequestID: stkResult?.CheckoutRequestId || checkoutRequestId,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function normalizePhone(input: string): string | null {
  if (!input) return null;

  const cleaned = input.trim().replace(/[\s\-()]/g, "");

  if (/^254[17]\d{8}$/.test(cleaned)) return cleaned;
  if (/^0[17]\d{8}$/.test(cleaned)) return "254" + cleaned.slice(1);
  if (/^01\d{9}$/.test(cleaned)) return "254" + cleaned.slice(1);
  if (/^\+254[17]\d{8}$/.test(cleaned)) return cleaned.slice(1);

  return null;
}

async function getAccessToken(landlord: { mpesa_consumer_key: string; mpesa_consumer_secret: string; mpesa_environment: string }): Promise<string> {
  const environment = landlord.mpesa_environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  const authResponse = await fetch(`${environment}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      "Authorization": "Basic " + btoa(`${landlord.mpesa_consumer_key}:${landlord.mpesa_consumer_secret}`),
    },
  });

  const authData = await authResponse.json();
  return authData.access_token;
}