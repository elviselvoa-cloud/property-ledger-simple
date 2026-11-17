// Supabase Edge Function: send-caretaker-invite
// POST /functions/v1/send-caretaker-invite
// Authenticated request: landlord creates an invite for a caretaker
// Body: { caretakerId: number, baseUrl: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

const jsonError = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) return jsonError("Missing Supabase config", 500);

  const sb = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.get("authorization")! } },
  });

  // Verify requester is authenticated
  const authHeader = req.headers.get("authorization") ?? "";
  const { data: authUser, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !authUser.user) return jsonError("Unauthorized", 401);

  let body: any;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON payload", 400); }

  const { caretakerId, baseUrl } = body;
  if (!caretakerId) return jsonError("caretakerId is required", 400);

  // Fetch caretaker to verify ownership and existing account
  const { data: caretaker, error: ctErr } = await sb
    .from("caretakers")
    .select("id, email, name, auth_user_id, is_active, landlord_id")
    .eq("id", caretakerId)
    .single();

  if (ctErr || !caretaker) return jsonError("Caretaker not found", 404);

  // Verify the caller owns this caretaker
  const { data: landlord } = await sb
    .from("landlords")
    .select("id")
    .eq("user_id", authUser.user.id)
    .maybeSingle();

  if (!landlord || landlord.id !== caretaker.landlord_id) {
    return jsonError("Forbidden: you do not own this caretaker", 403);
  }

  // If account already exists, resend confirmation link instead of creating new invite
  if (caretaker.auth_user_id) {
    const { error: pwErr } = await sb.auth.admin.resetPasswordForEmail(caretaker.auth_user_id, {
      redirectTo: `${baseUrl}/reset-password`,
    });
    if (pwErr) return jsonError(pwErr.message, 500);
    return new Response(JSON.stringify({ success: true, message: "Reset password email sent" }), {
      status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  // Generate a random invite token (40-char hex)
  const inviteToken = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  // Create an unconfirmed auth user for the caretaker
  const { data: authData, error: signUpErr } = await sb.auth.admin.createUser({
    email: caretaker.email!,
    emailConfirm: false,
    user_metadata: { full_name: caretaker.name, role: "caretaker" },
    app_metadata: { role: "caretaker" },
  });

  if (signUpErr) return jsonError(`Auth user creation failed: ${signUpErr.message}`, 500);

  // Link the auth user to the caretaker record
  const { error: updateErr } = await sb
    .from("caretakers")
    .update({
      auth_user_id: authData.user.id,
      invite_token: inviteToken,
      invite_sent_at: new Date().toISOString(),
    })
    .eq("id", caretakerId);

  if (updateErr) return jsonError(`Failed to link auth account: ${updateErr.message}`, 500);

  // Send invite email with Set Password link
  const { error: resetErr } = await sb.auth.admin.resetPasswordForEmail(authData.user.id, {
    redirectTo: `${baseUrl}/caretaker-set-password?token=${inviteToken}`,
  });

  if (resetErr) return jsonError(`Failed to send invite email: ${resetErr.message}`, 500);

  return new Response(JSON.stringify({ success: true, email: caretaker.email }), {
    status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
});
