// Supabase Edge Function: send-sms
// POST /functions/v1/send-sms
//
// Accepts landlord SMS credentials and batches recipients through Africa's Talking API.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonError({ error: "Method not allowed" }, 405);
  }

  const auth = req.headers.get("authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return jsonError({ error: "Missing Supabase config" }, 500);
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Auth validation
  const { data: user, error: authErr } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (authErr || !user.user) return jsonError({ error: "Unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError({ error: "Invalid JSON payload" }, 400);
  }

  const {
    landlordId,
    recipients,
    message,
    messageType,
    smsUsername,
    smsApiKey,
    smsSenderId,
  } = body;

  if (!landlordId || !Array.isArray(recipients) || recipients.length === 0 || !message) {
    return jsonError({ error: "Missing required fields: landlordId, recipients, message" }, 400);
  }

  const VALID_TYPES = ["rent_reminder", "payment_receipt", "estate_broadcast", "custom", "overdue_notice"];
  if (!VALID_TYPES.includes(messageType)) {
    return jsonError({ error: "Invalid messageType" }, 400);
  }

  // Fetch landlord with SMS credentials
  const { data: landlord, error: landlordErr } = await sb
    .from("landlords")
    .select("id, sms_username, sms_api_key, sms_sender_id, user_id")
    .eq("id", landlordId)
    .maybeSingle();

  if (landlordErr) throw landlordErr;
  if (!landlord) return jsonError({ error: "Landlord not found" }, 404);
  if (String(landlord.user_id) !== String(user.user.id)) {
    return jsonError({ error: "Forbidden" }, 403);
  }

  const username = smsUsername || landlord.sms_username || Deno.env.get("AT_USERNAME");
  const apiKey = smsApiKey || landlord.sms_api_key || Deno.env.get("AT_API_KEY");
  const senderId = smsSenderId || landlord.sms_sender_id || "PROPLEDGER";

  if (!username || !apiKey) {
    return jsonError({ error: "SMS credentials not configured. Set sms_username and sms_api_key on the landlord record." }, 400);
  }

  // Build logs accumulator
  const results = { totalSent: 0, failed: 0, segments: 0, costKes: 0, logs: [] as any[] };
  const AT_ENDPOINT = "https://api.africastalking.com/version1/messaging";

  try {
    const resp = await fetch(AT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        username,
        message,
        from: senderId,
        recipients: recipients.map((r: any) => ({
          phoneNumber: normalizePhone(r.phone),
          contactName: r.name,
        })),
      }),
    });

    const respBody: any = await resp.json();
    const sentMessages = respBody.sentMessages ?? [];
    const failedMessages = respBody.failedMessages ?? [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const normalizedPhone = normalizePhone(r.phone);
      const sentMsg = sentMessages.find((m: any) => m.phoneNumber === normalizedPhone);
      const failedMsg = failedMessages.find((m: any) => m.phoneNumber === normalizedPhone);
      const now = new Date().toISOString();

      const logEntry: any = {
        landlord_id: landlordId,
        tenant_id: r.tenantId ?? null,
        property_id: r.propertyId ?? null,
        recipient_name: r.name,
        recipient_phone: r.phone,
        message_type: messageType,
        message_body: message,
        segments_count: 1,
        status: "pending" as const,
        provider_message_id: null,
        cost_kes: 0,
        error_message: null,
        sent_at: null,
        created_at: now,
        updated_at: now,
      };

      if (sentMsg) {
        logEntry.status = "sent";
        logEntry.provider_message_id = sentMsg.id ?? null;
        logEntry.cost_kes = Number(sentMsg.cost ?? 0.5);
        results.totalSent++;
      } else if (failedMsg) {
        logEntry.status = "failed";
        logEntry.error_message = failedMsg.status ?? "Unknown error";
        results.failed++;
      }

      const { data: inserted, error: insertErr } = await sb
        .from("sms_logs")
        .insert(logEntry)
        .select("*")
        .single();
      if (insertErr) console.error("Insert error:", insertErr);
      else results.logs.push(inserted);
    }
  } catch (err: any) {
    console.error("SMS API error:", err.message);
    // Insert failure entries for each recipient
    for (const r of recipients) {
      const now = new Date().toISOString();
      const logEntry: any = {
        landlord_id: landlordId,
        tenant_id: r.tenantId ?? null,
        property_id: r.propertyId ?? null,
        recipient_name: r.name,
        recipient_phone: r.phone,
        message_type: messageType,
        message_body: message,
        segments_count: 1,
        status: "failed",
        provider_message_id: null,
        cost_kes: 0,
        error_message: err.message,
        sent_at: null,
        created_at: now,
        updated_at: now,
      };
      const { data: inserted } = await sb.from("sms_logs").insert(logEntry).select("*").single();
      if (inserted) results.logs.push(inserted);
    }
    results.failed = recipients.length;
  }

  return jsonResponse({ success: true, ...results });
});

// ─── Helpers ───────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  if (digits.startsWith("254")) return "+" + digits;
  return phone;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, api-key, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function jsonError(body: Record<string, string>, status = 400): Response {
  return jsonResponse(body, status);
}
