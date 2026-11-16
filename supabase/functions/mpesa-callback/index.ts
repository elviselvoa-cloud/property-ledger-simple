import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// WhatsApp Cloud API
const WA_API_URL = "https://graph.facebook.com/v20.0";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();

  // Parse Daraja callback structure
  const callbackData = body.Body?.CopeBackRequest || body.Body?.CallbackRequest || body;
  const result = callbackData?.Result || body.Result;

  const checkoutRequestId = result?.CheckoutRequestID || body.CheckoutRequestID;
  const resultCode = result?.ResultCode;
  const resultDesc = result?.ResultDesc;
  const mpesaReceipt = result?.MpesaReceiptNumber;
  const amount = result?.Amount;

  if (!checkoutRequestId) {
    return new Response(JSON.stringify({ error: "Missing CheckoutRequestID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Find the pending transaction
    const { data: transaction, error: txError } = await supabase
      .from("mpesa_transactions")
      .select("id, landlord_id, tenant_id, invoice_id, phone, status")
      .eq("checkout_request_id", checkoutRequestId)
      .single();

    if (txError || !transaction) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If already processed, return success
    if (transaction.status === "completed" || transaction.status === "failed") {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (resultCode === 0) {
      // Success path
      const mpesaTxnId = `mpesa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Update payment
      const { error: paymentErr } = await supabase.from("payments").insert({
        landlord_id: transaction.landlord_id,
        invoice_id: transaction.invoice_id,
        tenant_id: transaction.tenant_id,
        amount: amount,
        payment_method: "mpesa",
        mpesa_transaction_id: mpesaTxnId,
        receipt_number: mpesaReceipt || "N/A",
        payment_date: new Date().toISOString(),
        notes: "Paid via M-Pesa STK push",
      });

      if (paymentErr) {
        console.error("Payment insert error:", paymentErr);
      }

      // Recompute invoice status
      if (transaction.invoice_id) {
        const { data: invoice } = await supabase
          .from("rent_invoices")
          .select("amount, paid_amount")
          .eq("id", transaction.invoice_id)
          .single();

        const totalAmount = Number(invoice?.amount || 0);
        const paidAmount = (Number(invoice?.paid_amount || 0)) + Number(amount);
        const newStatus = paidAmount >= totalAmount ? "paid" : "partial";

        await supabase
          .from("rent_invoices")
          .update({
            paid_amount: paidAmount,
            status: newStatus,
            paid_at: new Date().toISOString(),
          })
          .eq("id", transaction.invoice_id);
      }

      // Update transaction status
      await supabase
        .from("mpesa_transactions")
        .update({
          status: "completed",
          result_code: 0,
          result_desc: "Success",
          mpesa_receipt_number: mpesaReceipt,
          transaction_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Send WhatsApp confirmation
      await sendWhatsAppConfirmation(transaction, amount, paidAmount);

    } else {
      // Failed/Cancelled path
      await supabase
        .from("mpesa_transactions")
        .update({
          status: "failed",
          result_code: resultCode || -1,
          result_desc: resultDesc || "Transaction failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Notify tenant of failure
      if (transaction.phone) {
        await sendWhatsAppFailureMessage(transaction.phone, resultDesc);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error("Callback processing error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsAppConfirmation(
  transaction: any,
  amount: number,
  paidBalance: number
) {
  const tenant = await getTenant(transaction.tenant_id);
  if (!tenant) return;

  const invoice = await getInvoice(transaction.invoice_id);
  const unit = await getUnitForTenant(tenant.id);

  const message = `✅ Payment Received!

KES ${Number(amount).toLocaleString()} received via M-Pesa.
Receipt: ${transaction.mpesa_receipt_number || "N/A"}

Unit: ${unit?.unit_number || "—"}
Remaining Balance: KES ${Number(paidBalance).toLocaleString()}

Thank you for paying rent on time!`;

  await sendWhatsAppMessage(tenant.phone, message);
}

async function sendWhatsAppFailureMessage(phone: string, reason: string) {
  const message = `💸 Payment Status Update

${reason || "Your payment was not completed."}\n\nReply *PAY* to try again, or contact your landlord for assistance.`;

  await sendWhatsAppMessage(phone, message);
}

async function getTenant(tenantId: string | null) {
  if (!tenantId) return null;
  const { data } = await supabase
    .from("tenants")
    .select("id, first_name, phone")
    .eq("id", tenantId)
    .single();
  return data;
}

async function getInvoice(invoiceId: string | null) {
  if (!invoiceId) return null;
  const { data } = await supabase
    .from("rent_invoices")
    .select("amount, paid_amount, status")
    .eq("id", invoiceId)
    .single();
  return data;
}

async function getUnitForTenant(tenantId: string | null) {
  if (!tenantId) return null;
  const { data } = await supabase
    .from("leases")
    .select(`
      unit_id,
      units: unit_id (
        unit_number,
        property_id
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .single();
  return data?.units;
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