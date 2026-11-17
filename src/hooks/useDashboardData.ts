import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase, type Landlord, type Property, type Unit, type Tenant, type Lease, type RentInvoice, type Payment } from "@/integrations/supabase/client";
import { useLandlord } from "./useLandlord";

export function useDashboardData() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();

  const {
    data: landlordData,
    isLoading: loadingLandlord,
    error: landlordDataError,
  } = useQuery({
    queryKey: ["landlord", landlordId],
    queryFn: async () => {
      if (!landlordId) return null;
      const { data, error } = await supabase.from("landlords").select("*").eq("id", landlordId).single();
      if (error) throw error;
      return data as Landlord;
    },
    enabled: !!landlordId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const {
    data: properties,
    isLoading: loadingProperties,
    error: propertiesError,
  } = useQuery({
    queryKey: ["properties", landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const { data, error } = await supabase.from("properties").select("*").eq("landlord_id", landlordId).order("name", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Property[];
    },
    enabled: !!landlordId,
  });

  const {
    data: units,
    isLoading: loadingUnits,
    error: unitsError,
  } = useQuery({
    queryKey: ["units", landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const { data, error } = await supabase.from("units").select("*").eq("landlord_id", landlordId).order("unit_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Unit[];
    },
    enabled: !!landlordId,
  });

  const {
    data: tenants,
    isLoading: loadingTenants,
    error: tenantsError,
  } = useQuery({
    queryKey: ["tenants", landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const { data, error } = await supabase.from("tenants").select("*").eq("landlord_id", landlordId).order("last_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
    enabled: !!landlordId,
  });

  const {
    data: leases,
    isLoading: loadingLeases,
    error: leasesError,
  } = useQuery({
    queryKey: ["leases", landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const { data, error } = await supabase.from("leases").select("*").eq("landlord_id", landlordId).order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lease[];
    },
    enabled: !!landlordId,
  });

  const {
    data: invoices,
    isLoading: loadingInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ["invoices", landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const { data, error } = await supabase.from("rent_invoices").select("*").eq("landlord_id", landlordId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RentInvoice[];
    },
    enabled: !!landlordId,
  });

  const {
    data: payments,
    isLoading: loadingPayments,
    error: paymentsError,
  } = useQuery({
    queryKey: ["payments", landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const { data, error } = await supabase.from("payments").select("*").eq("landlord_id", landlordId).order("payment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
    enabled: !!landlordId,
  });

  // Memoized lookup functions
  const tenantName = useMemo(() => {
    const map = new Map(tenants?.map((t) => [t.id, `${t.first_name} ${t.last_name}`]) ?? []);
    return (id: number) => map.get(id) ?? "—";
  }, [tenants]);

  const tenantEmail = useMemo(() => {
    const map = new Map(tenants?.map((t) => [t.id, t.email]) ?? []);
    return (id: number) => map.get(id) ?? "—";
  }, [tenants]);

  const unitLabel = useMemo(() => {
    return (id: number) => {
      const unit = units?.find((u) => u.id === id);
      if (!unit) return "—";
      const property = properties?.find((p) => p.id === unit.property_id);
      return property ? `${property.name} · ${unit.unit_number}` : unit.unit_number;
    };
  }, [units, properties]);

  const propertyName = useMemo(() => {
    const map = new Map(properties?.map((p) => [p.id, p.name]) ?? []);
    return (id: number) => map.get(id) ?? "—";
  }, [properties]);

  const activeLease = useMemo(() => {
    return (unitId: number) => leases?.find((l) => l.unit_id === unitId && l.status === "active");
  }, [leases]);

  const loading = landlordLoading || loadingProperties || loadingUnits || loadingTenants || loadingLeases || loadingInvoices || loadingPayments;
  const error = landlordError || landlordDataError || propertiesError || unitsError || tenantsError || leasesError || invoicesError || paymentsError;

  return {
    landlordId,
    landlord: landlordData,
    properties,
    units,
    tenants,
    leases,
    invoices,
    payments,
    loading,
    error,
    tenantName,
    tenantEmail,
    unitLabel,
    propertyName,
    activeLease,
  };
}