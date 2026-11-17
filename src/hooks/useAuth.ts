import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export interface CaretakerInfo {
  id: number;
  landlord_id: number;
  name: string;
  email: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [caretaker, setCaretaker] = useState<CaretakerInfo | null>(null);

  useEffect(() => {
    // Set up listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadCaretaker(session.user.id);
        } else {
          setCaretaker(null);
        }
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCaretaker(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCaretaker = async (authUserId: string) => {
    const { data, error } = await supabase
      .from("caretakers")
      .select("id, landlord_id, name, email")
      .eq("auth_user_id", authUserId)
      .eq("is_active", true)
      .maybeSingle();
    if (!error && data) {
      setCaretaker(data as CaretakerInfo);
    } else {
      setCaretaker(null);
    }
  };

  return { user, session, loading, caretaker };
}
