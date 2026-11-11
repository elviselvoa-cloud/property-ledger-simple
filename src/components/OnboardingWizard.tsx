import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase, type Landlord, type Property, type Unit } from "@/integrations/supabase/client";
import { generateFromRule, parseUnitList, type GeneratedUnit } from "@/lib/units-generator";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────

type Step1Form = {
  business_name: string;
  phone: string;
  mpesa_paybill: string;
  payment_instructions: string;
  rent_due_day: string;
};

type Step2Form = {
  property_name: string;
  address: string;
  city: string;
  unit_input: string;
  unit_mode: "rule" | "paste";
  rule_prefix: string;
  rule_start: string;
  rule_end: string;
  generated_units: GeneratedUnit[];
};

type Step3Form = {
  first_name: string;
  last_name: string;
  phone: string;
  national_id: string;
  selected_unit_id: string;
  rent_amount: string;
  lease_start_date: string;
};

type Step4Form = {
  caretaker_name: string;
  caretaker_phone: string;
  selected_property_id: string;
};

type WizardState = {
  step: number;
  saving: boolean;
  error: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────

const LANDLORD_FIELDS = ["business_name", "phone", "mpesa_paybill", "payment_instructions"] as const;

async function refreshLandlord(landlordId: number): Promise<Landlord | null> {
  const { data, error } = await supabase
    .from("landlords")
    .select("*")
    .eq("id", landlordId)
    .maybeSingle();
  if (error) throw error;
  return data as Landlord | null;
}

// ─── Component ──────────────────────────────────────────────────

export default function OnboardingWizard({
  landlordId,
  onComplete,
}: {
  landlordId: number;
  onComplete: () => void;
}) {
  const [state, setState] = useState<WizardState>({ step: 0, saving: false, error: null });
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);

  // Step 1
  const [s1, setS1] = useState<Step1Form>({
    business_name: "",
    phone: "",
    mpesa_paybill: "",
    payment_instructions: "",
    rent_due_day: "1",
  });

  // Step 2
  const [s2, setS2] = useState<Step2Form>({
    property_name: "",
    address: "",
    city: "",
    unit_input: "A1",
    unit_mode: "rule",
    rule_prefix: "A",
    rule_start: "1",
    rule_end: "5",
    generated_units: [],
  });

  // Step 3
  const [s3, setS3] = useState<Step3Form>({
    first_name: "",
    last_name: "",
    phone: "",
    national_id: "",
    selected_unit_id: "",
    rent_amount: "",
    lease_start_date: new Date().toISOString().slice(0, 10),
  });

  // Step 4
  const [s4, setS4] = useState<Step4Form>({
    caretaker_name: "",
    caretaker_phone: "",
    selected_property_id: "",
  });

  // Derived
  const availableUnits = allUnits.filter((u) => u.status === "vacant");
  const stepLabels = [
    "Business profile",
    "Property & units",
    "First tenant",
    "Caretaker",
  ];
  const hasCompleted = landlord?.onboarding_status === "completed";

  // Load initial landlord data
  useEffect(() => {
    if (!landlordId) return;
    refreshLandlord(landlordId).then((l) => setLandlord(l));
    if (!hasCompleted) {
      supabase
        .from("properties")
        .select("id, name")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: true })
        .then(({ data }) => setProperties((data ?? []) as Property[]));
      supabase
        .from("units")
        .select("id, unit_number, property_id, status")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: true })
        .then(({ data }) => setAllUnits((data ?? []) as Unit[]));
    }
  }, [landlordId, hasCompleted]);

  const setLoading = (saving: boolean) =>
    setState((prev) => ({ ...prev, saving, error: null }));

  const setError = (msg: string) =>
    setState((prev) => ({ ...prev, error: msg }));

  // Preview generated units live
  const previewUnits = useCallback(() => {
    if (s2.unit_mode === "paste") {
      const units = parseUnitList(s2.unit_input);
      setS2((p) => ({ ...p, generated_units: units }));
    } else {
      const start = parseInt(s2.rule_start, 10);
      const end = parseInt(s2.rule_end, 10);
      const units = generateFromRule(s2.rule_prefix, isNaN(start) ? 1 : start, isNaN(end) ? 5 : end);
      setS2((p) => ({ ...p, generated_units: units }));
    }
  }, [s2.unit_input, s2.unit_mode, s2.rule_prefix, s2.rule_start, s2.rule_end]);

  useEffect(() => {
    previewUnits();
  }, [previewUnits]);

  const canProceed = () => {
    switch (state.step) {
      case 0:
        return s1.business_name.trim().length > 0;
      case 1:
        return s2.property_name.trim().length > 0 && s2.generated_units.length > 0;
      case 2:
        return s3.first_name.trim().length > 0 && s3.selected_unit_id !== "";
      case 3:
        return true;
      default:
        return false;
    }
  };

  const nextStep = async () => {
    if (state.saving || !canProceed()) return;
    setLoading(true);
    try {
      switch (state.step) {
        case 0: {
          const updateFields: Record<string, unknown> = {
            business_name: s1.business_name.trim(),
            phone: s1.phone.trim() || null,
            rent_due_day: s1.rent_due_day ? parseInt(s1.rent_due_day, 10) : 1,
          };
          if (s1.mpesa_paybill.trim()) updateFields.mpesa_paybill = s1.mpesa_paybill.trim();
          if (s1.payment_instructions.trim()) updateFields.payment_instructions = s1.payment_instructions.trim();
          const { error } = await supabase
            .from("landlords")
            .update(updateFields)
            .eq("id", landlordId);
          if (error) throw error;
          break;
        }
        case 1: {
          const propRes = await supabase
            .from("properties")
            .insert({
              landlord_id: landlordId,
              name: s2.property_name.trim(),
              address: s2.address.trim() || null,
              city: s2.city.trim() || null,
              total_units: s2.generated_units.length,
              is_active: true,
            })
            .select("id")
            .single();
          if (propRes.error) throw propRes.error;
          const propertyId = propRes.data!.id as number;
          if (s2.generated_units.length > 0) {
            const unitInserts = s2.generated_units.map((u) => ({
              landlord_id: landlordId,
              property_id: propertyId,
              unit_number: u.unit_number,
              floor: u.floor,
              bedrooms: 1,
              bathrooms: 1,
              rent_amount: 10000,
              deposit_amount: 20000,
              status: "vacant" as const,
              is_active: true,
            }));
            const { error: unitErr } = await supabase.from("units").insert(unitInserts);
            if (unitErr) throw unitErr;
          }
          // Refresh units list for step 3
          const { data } = await supabase
            .from("units")
            .select("id, unit_number, property_id, status")
            .eq("landlord_id", landlordId)
            .order("created_at", { ascending: true });
          if (data) setAllUnits(data as Unit[]);
          break;
        }
        case 2: {
          // Insert tenant
          const tenantRes = await supabase
            .from("tenants")
            .insert({
              landlord_id: landlordId,
              first_name: s3.first_name.trim(),
              last_name: s3.last_name.trim(),
              phone: s3.phone.trim() || null,
              national_id: s3.national_id.trim() || null,
              is_active: true,
            })
            .select("id")
            .single();
          if (tenantRes.error) throw tenantRes.error;
          const tenantId = tenantRes.data!.id as number;
          const unitId = Number(s3.selected_unit_id);
          const startDate = s3.lease_start_date || new Date().toISOString().slice(0, 10);
          const leaseRes = await supabase
            .from("leases")
            .insert({
              landlord_id: landlordId,
              tenant_id: tenantId,
              unit_id: unitId,
              rent_amount: Number(s3.rent_amount) || 10000,
              rent_due_day: Number(s1.rent_due_day) || 1,
              start_date: startDate,
              end_date: null,
              status: "active" as const,
              is_roommate: false,
              billing_mode: "separate" as const,
            })
            .select("id")
            .single();
          if (leaseRes.error) throw leaseRes.error;
          // Mark unit occupied
          const { error: unitUpdateErr } = await supabase
            .from("units")
            .update({ status: "occupied" })
            .eq("id", unitId);
          if (unitUpdateErr) throw unitUpdateErr;
          break;
        }
        case 3: {
          if (s4.caretaker_name.trim()) {
            const caretakerRes = await supabase
              .from("caretakers")
              .insert({
                landlord_id: landlordId,
                name: s4.caretaker_name.trim(),
                phone: s4.caretaker_phone.trim() || null,
                is_active: true,
              })
              .select("id")
              .single();
            if (caretakerRes.error) throw caretakerRes.error;
            // TODO: assign caretaker to property via junction table if it exists
          }
          break;
        }
      }

      const { error: doneErr } = await supabase
        .from("landlords")
        .update({ onboarding_status: "completed" })
        .eq("id", landlordId);
      if (doneErr) throw doneErr;

      const refreshed = await refreshLandlord(landlordId);
      setLandlord(refreshed);
      toast.success("Setup complete!");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const goNext = () => {
    if (!canProceed()) return;
    if (state.step < 3) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    } else {
      nextStep();
    }
  };

  const goBack = () => {
    setState((prev) => ({ ...prev, step: Math.max(0, prev.step - 1), error: null }));
  };

  const markSkip = async (stepIndex: number) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("landlords")
        .update({ onboarding_status: "completed" })
        .eq("id", landlordId);
      if (error) throw error;
      toast.info("Onboarding skipped — you can always edit settings later.");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast.error("Failed to save");
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  if (hasCompleted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl bg-card rounded-xl shadow-lg border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Welcome to Property Ledger</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Complete your setup in {Math.min(4, 4 - state.step)} simple step{Math.min(4, 4 - state.step) > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-1">
            {stepLabels.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  i < state.step ? "bg-primary" : i === state.step ? "bg-primary/60" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {state.error && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Step 0: Business Profile */}
          {state.step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="ob-business">Business name *</Label>
                <Input
                  id="ob-business"
                  value={s1.business_name}
                  onChange={(e) => setS1({ ...s1, business_name: e.target.value })}
                  placeholder="e.g. Acme Properties Ltd"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-phone">Phone</Label>
                <Input
                  id="ob-phone"
                  value={s1.phone}
                  onChange={(e) => setS1({ ...s1, phone: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-paybill">M-Pesa Paybill / Till number</Label>
                <Input
                  id="ob-paybill"
                  value={s1.mpesa_paybill}
                  onChange={(e) => setS1({ ...s1, mpesa_paybill: e.target.value })}
                  placeholder="e.g. 123456"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-instructions">Payment instructions</Label>
                <Textarea
                  id="ob-instructions"
                  value={s1.payment_instructions}
                  onChange={(e) => setS1({ ...s1, payment_instructions: e.target.value })}
                  placeholder="e.g. Pay via M-Pesa Paybill 123456, account number = invoice number."
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-due-day">Rent due day of month</Label>
                <Select
                  value={s1.rent_due_day}
                  onValueChange={(v) => setS1({ ...s1, rent_due_day: v })}
                >
                  <SelectTrigger id="ob-due-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 1: Property & Units */}
          {state.step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="ob-prop-name">Property name *</Label>
                <Input
                  id="ob-prop-name"
                  value={s2.property_name}
                  onChange={(e) => setS2({ ...s2, property_name: e.target.value })}
                  placeholder="e.g. Westlands Apartments"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-address">Address</Label>
                  <Input
                    id="ob-address"
                    value={s2.address}
                    onChange={(e) => setS2({ ...s2, address: e.target.value })}
                    placeholder="Street / estate"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-city">City</Label>
                  <Input
                    id="ob-city"
                    value={s2.city}
                    onChange={(e) => setS2({ ...s2, city: e.target.value })}
                    placeholder="e.g. Nairobi"
                  />
                </div>
              </div>

              <div className="border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="!mt-0">Units</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={s2.unit_mode === "rule" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setS2((p) => ({ ...p, unit_mode: "rule" }))}
                    >
                      Rule builder
                    </Button>
                    <Button
                      type="button"
                      variant={s2.unit_mode === "paste" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setS2((p) => ({ ...p, unit_mode: "paste" }))}
                    >
                      Paste list
                    </Button>
                  </div>
                </div>

                {s2.unit_mode === "rule" ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="grid gap-1">
                      <Label className="text-xs">Prefix</Label>
                      <Input
                        value={s2.rule_prefix}
                        onChange={(e) => setS2((p) => ({ ...p, rule_prefix: e.target.value }))}
                        className="w-20"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="number"
                        value={s2.rule_start}
                        onChange={(e) => setS2((p) => ({ ...p, rule_start: e.target.value }))}
                        className="w-20"
                      />
                    </div>
                    <span className="pb-2 text-muted-foreground">to</span>
                    <div className="grid gap-1">
                      <Label className="text-xs">End</Label>
                      <Input
                        type="number"
                        value={s2.rule_end}
                        onChange={(e) => setS2((p) => ({ ...p, rule_end: e.target.value }))}
                        className="w-20"
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={previewUnits}>
                      Generate
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    value={s2.unit_input}
                    onChange={(e) => setS2((p) => ({ ...p, unit_input: e.target.value }))}
                    placeholder={"A1\nA2\nA3\nB1\nB2"}
                    rows={3}
                  />
                )}

                {s2.generated_units.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {s2.generated_units.map((u, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        {u.unit_number}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground self-center ml-1">
                      {s2.generated_units.length} unit{s2.generated_units.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: First Tenant (Optional) */}
          {state.step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add your first tenant and assign them to one of the units above. This step is optional —
                you can skip and add tenants from the Tenants page later.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-tenant-first">First name *</Label>
                  <Input
                    id="ob-tenant-first"
                    value={s3.first_name}
                    onChange={(e) => setS3({ ...s3, first_name: e.target.value })}
                    placeholder="Jane"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-tenant-last">Last name</Label>
                  <Input
                    id="ob-tenant-last"
                    value={s3.last_name}
                    onChange={(e) => setS3({ ...s3, last_name: e.target.value })}
                    placeholder="Wanjiku"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-tenant-phone">Phone</Label>
                  <Input
                    id="ob-tenant-phone"
                    value={s3.phone}
                    onChange={(e) => setS3({ ...s3, phone: e.target.value })}
                    placeholder="+254 7XX XXX XXX"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-nid">National ID</Label>
                  <Input
                    id="ob-nid"
                    value={s3.national_id}
                    onChange={(e) => setS3({ ...s3, national_id: e.target.value })}
                    placeholder="e.g. 12345678"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-unit-select">Assign unit *</Label>
                  <Select
                    value={s3.selected_unit_id}
                    onValueChange={(v) => setS3({ ...s3, selected_unit_id: v })}
                  >
                    <SelectTrigger id="ob-unit-select">
                      <SelectValue placeholder="Select a vacant unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.length === 0 ? (
                        <SelectItem value="-1" disabled>No vacant units yet</SelectItem>
                      ) : (
                        availableUnits.map((u) => {
                          const prop = properties.find((p) => p.id === u.property_id);
                          return (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {prop ? `${prop.name} · ` : ""}{u.unit_number}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-rent">Monthly rent (KES)</Label>
                  <Input
                    id="ob-rent"
                    type="number"
                    min={0}
                    value={s3.rent_amount}
                    onChange={(e) => setS3({ ...s3, rent_amount: e.target.value })}
                    placeholder="e.g. 25000"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-start-date">Lease start date</Label>
                <Input
                  id="ob-start-date"
                  type="date"
                  value={s3.lease_start_date}
                  onChange={(e) => setS3({ ...s3, lease_start_date: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Step 3: Caretaker (Optional) */}
          {state.step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Optionally register a caretaker to help manage your property. You can always add caretakers
                from the Caretakers page later.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="ob-caretaker-name">Caretaker name</Label>
                <Input
                  id="ob-caretaker-name"
                  value={s4.caretaker_name}
                  onChange={(e) => setS4({ ...s4, caretaker_name: e.target.value })}
                  placeholder="e.g. James Ochieng"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-caretaker-phone">Phone</Label>
                <Input
                  id="ob-caretaker-phone"
                  value={s4.caretaker_phone}
                  onChange={(e) => setS4({ ...s4, caretaker_phone: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
              {properties.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="ob-caretaker-prop">Assign to property</Label>
                  <Select
                    value={s4.selected_property_id}
                    onValueChange={(v) => setS4({ ...s4, selected_property_id: v })}
                  >
                    <SelectTrigger id="ob-caretaker-prop">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {state.step > 0 && (
              <Button variant="outline" onClick={goBack} disabled={state.saving}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {state.step > 0 && state.step < 3 && (
              <Button variant="ghost" size="sm" onClick={() => markSkip(state.step + 1)} disabled={state.saving}>
                Skip ahead
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {state.step < 3 ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => markSkip(state.step + 1)} disabled={state.saving}>
                  Skip rest
                </Button>
                <Button onClick={goNext} disabled={!canProceed() || state.saving}>
                  {state.saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={goNext} disabled={!canProceed() || state.saving}>
                {state.saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Finishing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Complete setup
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
