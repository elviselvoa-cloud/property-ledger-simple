import { supabase } from "@/integrations/supabase/client";

export async function signUp(email: string, password: string, fullName?: string) {
  const redirectUrl = getRedirectUrl("/dashboard");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: redirectUrl,
    },
  });
  return { data, error };
}
...
export async function signInWithGoogle() {
  const redirectUrl = getRedirectUrl("/dashboard");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl },
  });
  return { data, error };
}

function getRedirectUrl(path: string = "/") {
  // Use Vercel production URL if available, otherwise current origin
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}
