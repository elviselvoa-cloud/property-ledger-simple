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
  Settings,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  default_rent: string;
  default_deposit: string;
  unit_input: string;
  unit_mode: "rule" | "paste";
  rule_prefix: string;
  rule_start: string;
  rule_end: string;
  generated_units: GeneratedUnit[];
};

type Step3Form = {
  caretaker_name: string;
  caretaker_phone: string;
  selected_property_id: string;
};

type WizardState = {
  step: number;
  saving: boolean;
  error: string | null;
};

interface OnboardingWizardProps {
  landlordId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────

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
  open,
  onOpenChange,
  onComplete,
}: OnboardingWizardProps) {
  const [state, setState] = useState<WizardState>({ step: 0, saving: false, error: null });
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [createdPropertyId, setCreatedPropertyId] = useState<number | null>(null);
  const [createdPropertyName, setCreatedPropertyName] = useState<string>("");

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
    default_rent: "15000",
    default_deposit: "15000",
    unit_input: "A1",
    unit_mode: "rule",
    rule_prefix: "A",
    rule_start: "1",
    rule_end: "5",
    generated_units: [],
  });

  // Step 3 (Caretaker - optional)
  const [s3, setS3] = useState<Step3Form>({
    caretaker_name: "",
    caretaker_phone: "",
    selected_property_id: "",
  });

  // Derived
  const stepLabels = ["Business profile", "Property & units", "Caretaker", "Ready!"];
  const hasCompleted = landlord?.onboarding_status === "completed";
  const isLastStep = state.step === 3;

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
        .then(({ data }) => setProperties(data as Property[] ?? []));
      supabase
        .from("units")
        .select("id, unit_number, property_id, status")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: true })
        .then(({ data }) => setAllUnits(data as Unit[] ?? []));
    }
  }, [landlordId, hasCompleted]);

  // Reset wizard state when modal opens/closes
  useEffect(() => {
    if (open && !hasCompleted) {
      setState({ step: 0, saving: false, error: null });
      setCreatedPropertyId(null);
      setCreatedPropertyName("");
    }
  }, [open, hasCompleted]);

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
        return true; // caretaker is optional
      case 3:
        return true; // celebration step
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
          setCreatedPropertyId(propertyId);
          setCreatedPropertyName(s2.property_name.trim());
          if (s2.generated_units.length > 0) {
            const unitInserts = s2.generated_units.map((u) => ({
              landlord_id: landlordId,
              property_id: propertyId,
              unit_number: u.unit_number,
              floor: u.floor,
              bedrooms: 1,
              bathrooms: 1,
              rent_amount: Number(s2.default_rent) || 10000,
              deposit_amount: Number(s2.default_deposit) || 10000,
              status: "vacant" as const,
              is_active: true,
            }));
            const { error: unitErr } = await supabase.from("units").insert(unitInserts);
            if (unitErr) throw unitErr;
          }
          // Refresh units list for caretaker assignment
          const { data } = await supabase
            .from("units")
            .select("id, unit_number, property_id, status")
            .eq("landlord_id", landlordId)
            .order("created_at", { ascending: true });
          if (data) setAllUnits(data as Unit[]);
          break;
        }
        case 2: {
          // Caretaker assignment (optional)
          if (s3.caretaker_name.trim()) {
            const caretakerRes = await supabase
              .from("caretakers")
              .insert({
                landlord_id: landlordId,
                name: s3.caretaker_name.trim(),
                phone: s3.caretaker_phone.trim() || null,
                is_active: true,
              })
              .select("id")
              .single();
            if (caretakerRes.error) throw caretakerRes.error;
            const caretakerId = caretakerRes.data!.id as number;
            if (s3.selected_property_id) {
              const { error: linkErr } = await supabase.from("caretaker_properties").insert({
                caretaker_id: caretakerId,
                property_id: Number(s3.selected_property_id),
                landlord_id: landlordId,
              });
              if (linkErr) throw linkErr;
            }
          }
          break;
        }
      }

      // Only mark complete on the celebration step (step 3)
      if (state.step === 3) {
        const { error: doneErr } = await supabase
          .from("landlords")
          .update({ onboarding_status: "completed" })
          .eq("id", landlordId);
        if (doneErr) throw doneErr;

        const refreshed = await refreshLandlord(landlordId);
        setLandlord(refreshed);
        toast.success("Setup complete!");
        onComplete();
      }
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

  const markSkip = async () => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Welcome to Property Ledger</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 pt-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-4">
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

          {state.error && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Step 0: Business Profile & Payment Instructions */}
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

          {/* Step 1: Property & Units Setup */}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-rent">Default monthly rent (KES)</Label>
                  <Input
                    id="ob-rent"
                    type="number"
                    min={0}
                    value={s2.default_rent}
                    onChange={(e) => setS2({ ...s2, default_rent: e.target.value })}
                    placeholder="e.g. 15000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-deposit">Default deposit (KES)</Label>
                  <Input
                    id="ob-deposit"
                    type="number"
                    min={0}
                    value={s2.default_deposit}
                    onChange={(e) => setS2({ ...s2, default_deposit: e.target.value })}
                    placeholder="e.g. 15000"
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

          {/* Step 2: Caretaker Assignment (Optional) */}
          {state.step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Optionally register a caretaker to help manage your property. You can always add caretakers
                from the Caretakers page later.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="ob-caretaker-name">Caretaker name</Label>
                <Input
                  id="ob-caretaker-name"
                  value={s3.caretaker_name}
                  onChange={(e) => setS3({ ...s3, caretaker_name: e.target.value })}
                  placeholder="e.g. James Ochieng"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-caretaker-phone">Phone</Label>
                <Input
                  id="ob-caretaker-phone"
                  value={s3.caretaker_phone}
                  onChange={(e) => setS3({ ...s3, caretaker_phone: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
              {(properties.length > 0 || createdPropertyId) && (
                <div className="grid gap-2">
                  <Label htmlFor="ob-caretaker-prop">Assign to property</Label>
                  <Select
                    value={s3.selected_property_id}
                    onValueChange={(v) => setS3({ ...s3, selected_property_id: v })}
                  >
                    <SelectTrigger id="ob-caretaker-prop">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...properties, ...(createdPropertyId ? [{ id: createdPropertyId, name: createdPropertyName }] : [])].map((p) => (
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

          {/* Step 3: Celebration & Completion Summary */}
          {state.step === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">You're all set up!</h3>
                  <p className="text-sm text-muted-foreground">Your property ledger is ready to use.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Setup Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property:</span>
                    <span className="font-medium">{createdPropertyName || "—"} ({allUnits.length} units created)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rent Due Day:</span>
                    <span className="font-medium">{s1.rent_due_day}{s1.rent_due_day === "1" ? "st" : s1.rent_due_day === "2" ? "nd" : s1.rent_due_day === "3" ? "rd" : "th"} of every month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Info:</span>
                    <span className="font-medium text-right max-w-[60%] truncate">
                      {s1.mpesa_paybill || s1.payment_instructions || "Not configured"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm text-blue-800">
                  Your property and units are ready. When you&apos;re ready to onboard your tenants, navigate to{" "}
                  <strong>Leases</strong> or <strong>Tenants</strong> to add them and assign units.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-0 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {state.step > 0 && state.step < 3 && (
              <>
                <Button variant="outline" onClick={goBack} disabled={state.saving}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button variant="ghost" size="sm" onClick={markSkip} disabled={state.saving}>
                  Skip setup
                </Button>
              </>
            )}
            {state.step === 3 && (
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={state.saving}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {state.step < 3 ? (
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
            ) : (
              <Button onClick={goNext} disabled={!canProceed() || state.saving}>
                {state.saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Finishing…
                  </>
                ) : (
                  <>
                    Go to Dashboard <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
