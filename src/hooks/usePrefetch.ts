import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLandlord } from "./useLandlord";

export function usePrefetchOnHover() {
  const queryClient = useQueryClient();
  const { landlordId } = useLandlord();

  const prefetchPageData = useMemo(() => {
    return (pageKey: string) => {
      if (!landlordId) return;

      // Prefetch data for different pages - data will be cached by React Query
      const prefetchQueries = async () => {
        switch (pageKey) {
          case "properties":
            await queryClient.prefetchQuery({
              queryKey: ["properties", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("properties").select("*").eq("landlord_id", landlordId).order("name", { ascending: false });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
          case "units":
            await queryClient.prefetchQuery({
              queryKey: ["units", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("units").select("*").eq("landlord_id", landlordId).order("unit_number", { ascending: true });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
          case "tenants":
            await queryClient.prefetchQuery({
              queryKey: ["tenants", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("tenants").select("*").eq("landlord_id", landlordId).order("last_name", { ascending: true });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
          case "leases":
            await queryClient.prefetchQuery({
              queryKey: ["leases", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("leases").select("*").eq("landlord_id", landlordId).order("start_date", { ascending: false });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
          case "invoices":
            await queryClient.prefetchQuery({
              queryKey: ["invoices", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("rent_invoices").select("*").eq("landlord_id", landlordId).order("created_at", { ascending: false });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
          case "payments":
            await queryClient.prefetchQuery({
              queryKey: ["payments", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("payments").select("*").eq("landlord_id", landlordId).order("payment_date", { ascending: false });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
          case "caretakers":
            await queryClient.prefetchQuery({
              queryKey: ["caretakers", landlordId],
              queryFn: async () => {
                const { data, error } = await supabase.from("caretakers").select("*").eq("landlord_id", landlordId).order("created_at", { ascending: false });
                if (error) throw error;
                return data ?? [];
              },
              staleTime: 5 * 60 * 1000,
            });
            break;
        }
      };

      // Fire and forget - don't await
      prefetchQueries().catch(() => {
        // Ignore prefetch errors - data will still load normally when route is visited
      });
    };
  }, [queryClient, landlordId]);

  return prefetchPageData;
}

export function useNavPrefetch() {
  const prefetch = usePrefetchOnHover();

  const getPageKey = (href: string): string | null => {
    const match = href.match(/\/([a-z]+)/);
    return match ? match[1] : null;
  };

  const handleMouseEnter = (href: string) => {
    const key = getPageKey(href);
    if (key) prefetch(key);
  };

  return { handleMouseEnter };
}