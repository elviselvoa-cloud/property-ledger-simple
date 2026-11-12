import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

/**
 * Resolves the internal landlord record for the signed-in auth user.
 * Falls back to creating the user/landlord rows if the DB trigger did not.
 */
export function useLandlord() {
  const { user, loading: authLoading } = useAuth();
  const [landlordId, setLandlordId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLandlordId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        let { data: userRow, error: userErr } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (userErr) throw userErr;

        if (!userRow) {
          const { data: created, error: createErr } = await supabase
            .from("users")
            .insert({
              auth_id: user.id,
              email: user.email,
              name: user.user_metadata?.full_name ?? user.email?.split("@")[0],
              phone: user.user_metadata?.phone ?? null,
            })
            .select("id")
            .single();
          if (createErr) throw createErr;
          userRow = created;
        }

        let { data: landlord, error: llErr } = await supabase
          .from("landlords")
          .select("id")
          .eq("user_id", userRow!.id)
          .maybeSingle();
        if (llErr) throw llErr;

        if (!landlord) {
          const { data: createdLl, error: createLlErr } = await supabase
            .from("landlords")
            .insert({
              user_id: userRow!.id,
              business_name:
                user.user_metadata?.business_name ||
                user.user_metadata?.full_name ||
                "My Properties",
              phone: user.user_metadata?.phone ?? null,
              onboarding_status: "pending",
            })
            .select("id")
            .single();
          if (createLlErr) throw createLlErr;
          landlord = createdLl;
        }

        if (!cancelled) setLandlordId(landlord!.id as number);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { landlordId, loading: loading || authLoading, error };
}
