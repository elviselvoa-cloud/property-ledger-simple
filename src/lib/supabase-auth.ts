import { supabase } from "@/integrations/supabase/client";

export async function signUp(
  email: string,
  password: string,
  metadata?: { full_name?: string; business_name?: string; phone?: string }
) {
  const redirectUrl = getRedirectUrl("/dashboard");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: redirectUrl,
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string) {
  const redirectUrl = getRedirectUrl("/reset-password");
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

export async function signInWithGoogle() {
  const redirectUrl = getRedirectUrl("/dashboard");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl },
  });
  return { data, error };
}

function getRedirectUrl(path: string = "/") {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

