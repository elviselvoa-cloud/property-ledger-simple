import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLandlord } from "@/hooks/useLandlord";
import {
  supabase,
  type Lease,
  type Property,
  type Tenant,
  type Unit,
} from "@/integrations/supabase/client";
import { getLeaseDeletionBlocker } from "@/lib/lease-deletion";
import { FileText, Loader2, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type RoommateForm = { tenant_id: string; share: string };

type FormState = {
  tenant_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  rent_amount: string;
  deposit_amount: string;
  deposit_paid: boolean;
  rent_due_day: string;
  status: Lease["status"];
  is_roommate: boolean;
  billing_mode: "shared" | "separate";
  roommates: RoommateForm[];
  notes: string;
};

type MoveOutDeduction = {
  type: "deduction";
  description: string;
  amount: number;
};

type MoveOutRefund = {
  type: "refund";
  description: string;
  amount: number;
};

const emptyForm: FormState = {
  tenant_id: "",
  unit_id: "",
  start_date: "",
  end_date: "",
  rent_amount: "",
  deposit_amount: "",
  deposit_paid: false,
  rent_due_day: "1",
  status: "active",
  is_roommate: false,
  billing_mode: "shared",
  roommates: [],
  notes: "",
};

const statusVariant: Record<Lease["status"], "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "secondary",
  expired: "outline",
  terminated: "destructive",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Leases() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [rows, setRows] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showLeased, setShowLeased] = useState(false);
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [leaseForMoveOut, setLeaseForMoveOut] = useState<Lease | null>(null);
  const [deductions, setDeductions] = useState<MoveOutDeduction[]>([]);
  const [refunds, setRefunds] = useState<MoveOutRefund[]>([]);
  const [moveOutSaving, setMoveOutSaving] = useState(false);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [leasesRes, tenantsRes, unitsRes, propsRes] = await Promise.all([
      supabase
        .from("leases")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false }),
      supabase
        .from("tenants")
        .select("id, first_name, last_name")
        .eq("landlord_id", landlordId)
        .eq("is_active", true)
        .order("first_name"),
      supabase
        .from("units")
        .select("id, unit_number, property_id, rent_amount, deposit_amount, status")
        .eq("landlord_id", landlordId)
        .order("unit_number"),
      supabase.from("properties").select("id, name").eq("landlord_id", landlordId).order("name"),
    ]);
    if (leasesRes.error) toast.error(leasesRes.error.message);
    else setRows((leasesRes.data ?? []) as Lease[]);
    if (tenantsRes.error) toast.error(tenantsRes.error.message);
    else setTenants((tenantsRes.data ?? []) as Tenant[]);
    if (unitsRes.error) toast.error(unitsRes.error.message);
    else setUnits((unitsRes.data ?? []) as Unit[]);
    if (propsRes.error) toast.error(propsRes.error.message);
    else setProperties((propsRes.data ?? []) as Property[]);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  const tenantName = (id: number) => {
    const t = tenants.find((x) => x.id === id);
    return t ? `${t.first_name} ${t.last_name}` : "—";
  };

  const unitLabel = (id: number) => {
    const u = units.find((x) => x.id === id);
    if (!u) return "—";
    const property = properties.find((p) => p.id === u.property_id);
    return property ? `${property.name} · ${u.unit_number}` : u.unit_number;
  };

  // Find active leases for a tenant
  const getLeasedTenantIds = useCallback(() => {
    const set = new Set<number>();
    rows.forEach((l) => {
      if (l.status === "active" || l.status === "pending") set.add(l.tenant_id);
    });
    return set;
  }, [rows]);

  // Tenants already holding an active/pending lease as primary leaseholder
  // (excluding the lease being edited). Hidden unless the landlord opts in.
  const leasedTenantIds = getLeasedTenantIds();
  const selectableTenants = tenants.filter(
    (t) => showLeased || !leasedTenantIds.has(t.id) || String(t.id) === form.tenant_id
  );

  const openCreate = () => {
    if (tenants.length === 0 || units.length === 0) {
      toast.error("Add at least one tenant and one unit first");
      return;
    }
    setEditing(null);
    setShowLeased(false);
    const activeLeasedIds = Array.from(leasedTenantIds);
    const firstUnit = units.find((u) => u.status !== "occupied") ?? units[0];
    const firstTenant = tenants.find((t) => !activeLeasedIds.includes(t.id)) ?? tenants[0];
    setForm({
      ...emptyForm,
      start_date: today(),
      tenant_id: firstTenant ? String(firstTenant.id) : "",
      unit_id: String(firstUnit.id),
      rent_amount: String(firstUnit.rent_amount ?? ""),
      deposit_amount: firstUnit.deposit_amount != null ? String(firstUnit.deposit_amount) : "",
    });
    setOpen(true);
  };

  const openEdit = (l: Lease) => {
    setEditing(l);
    setShowLeased(false);
    setForm({
      tenant_id: String(l.tenant_id),
      unit_id: String(l.unit_id),
      start_date: l.start_date ? l.start_date.slice(0, 10) : "",
      end_date: l.end_date ? l.end_date.slice(0, 10) : "",
      rent_amount: String(l.rent_amount ?? ""),
      deposit_amount: l.deposit_amount != null ? String(l.deposit_amount) : "",
      deposit_paid: l.deposit_paid,
      rent_due_day: String(l.rent_due_day ?? 1),
      status: l.status,
      is_roommate: l.is_roommate ?? false,
      billing_mode: l.billing_mode ?? "shared",
      roommates: (l.roommates ?? []).map((r) => ({
        tenant_id: String(r.tenant_id),
        share: r.share != null ? String(r.share) : "",
      })),
      notes: l.notes ?? "",
    });
    setOpen(true);
  };

  const openMoveOutDialog = (l: Lease) => {
    setLeaseForMoveOut(l);
    setDeductions([]);
    setRefunds([]);
    setMoveOutOpen(true);
  };

  const handleMoveOut = async () => {
    if (!leaseForMoveOut) return;
    setMoveOutSaving(true);

    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    const depositToReturn = Math.max(0, (Number(leaseForMoveOut.deposit_amount || 0) - totalDeductions + totalRefunds));

    const { error } = await supabase
      .from("leases")
      .update({
        status: "terminated",
        end_date: today(),
      })
      .eq("id", leaseForMoveOut.id);

    if (error) {
      toast.error(error.message);
      setMoveOutSaving(false);
      return;
    }

    // Update unit status to vacant
    await supabase.from("units").update({ status: "vacant" }).eq("id", leaseForMoveOut.unit_id);

    // Create settlement notice
    const noticeText = `
MOVE-OUT SETTLEMENT NOTICE

Lease TERMINATED: ${tenantName(leaseForMoveOut.tenant_id)}
Unit: ${unitLabel(leaseForMoveOut.unit_id)}

Deposit Paid: KES ${Number(leaseForMoveOut.deposit_amount ?? 0).toLocaleString()}
Total Deductions: KES ${totalDeductions.toLocaleString()}
Total Refunds: KES ${totalRefunds.toLocaleString()}
Net Deposit Return: KES ${depositToReturn.toLocaleString()}

Deductions:
${deductions.length === 0 ? "None" : deductions.map((d) => `  - ${d.description}: -KES ${d.amount.toLocaleString()}`).join("\n")}

Refunds:
${refunds.length === 0 ? "None" : refunds.map((r) => `  - ${r.description}: +KES ${r.amount.toLocaleString()}`).join("\n")}

This settlement notice is generated by the Property Ledger system.
`;

    // Store the settlement for reference (optional - could be displayed or emailed)
    toast.success(`Lease terminated. Deposit return: KES ${depositToReturn.toLocaleString()}`);
    setMoveOutOpen(false);
    setLeaseForMoveOut(null);
    load();
    setMoveOutSaving(false);
  };

  // When the unit selection changes, prefill rent and deposit from that unit.
  const onUnitChange = (unitId: string) => {
    const u = units.find((x) => x.id === Number(unitId));
    setForm((f) => ({
      ...f,
      unit_id: unitId,
      rent_amount: editing ? f.rent_amount : u ? String(u.rent_amount ?? "") : f.rent_amount,
      deposit_amount: editing
        ? f.deposit_amount
        : u && u.deposit_amount != null
          ? String(u.deposit_amount)
          : f.deposit_amount,
    }));
  };

  const save = async () => {
    if (!landlordId) return;
    if (!form.tenant_id || !form.unit_id || !form.start_date || !form.rent_amount) {
      toast.error("Tenant, unit, start date and rent are required");
      return;
    }
    if (leasedTenantIds.has(Number(form.tenant_id)) && !showLeased && !editing) {
      toast.error("This tenant already has an active lease. Tick 'Show already leased tenants' to allow it.");
      return;
    }

    const dueDay = Number(form.rent_due_day);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      toast.error("Rent due day must be between 1 and 31");
      return;
    }

    // Roommate entries: kept when co-staying, cleared otherwise.
    const roommateEntries = form.is_roommate
      ? form.roommates
          .filter((r) => r.tenant_id)
          .map((r) => ({
            tenant_id: Number(r.tenant_id),
            share: form.billing_mode === "separate" ? Number(r.share) || 0 : null,
          }))
      : [];

    if (form.is_roommate && form.billing_mode === "separate") {
      if (roommateEntries.length === 0) {
        toast.error("Add at least one roommate with a share");
        return;
      }
      const totalShares = roommateEntries.reduce((s, r) => s + (r.share ?? 0), 0);
      if (totalShares > Number(form.rent_amount)) {
        toast.error("Roommate shares exceed the monthly rent");
        return;
      }
    }

    setSaving(true);
    const payload = {
      landlord_id: landlordId,
      tenant_id: Number(form.tenant_id),
      unit_id: Number(form.unit_id),
      start_date: form.start_date,
      end_date: form.end_date || null,
      rent_amount: Number(form.rent_amount),
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
      deposit_paid: form.deposit_paid,
      rent_due_day: dueDay,
      status: form.status,
      is_roommate: form.is_roommate,
      billing_mode: form.billing_mode,
      roommates: roommateEntries,
      notes: form.notes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("leases").update(payload).eq("id", editing.id)
      : await supabase.from("leases").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Sync unit occupancy:
    // - On create/activate: mark new unit as occupied, free old unit if tenant had another active lease
    // - On termination/expiration: mark unit as vacant
    // - On delete: handled by delete guard
    if (!error) {
      if (!editing) {
        // New lease - mark new unit occupied
        await supabase.from("units").update({ status: "occupied" }).eq("id", payload.unit_id);
      } else if (editing) {
        // Editing existing lease
        const oldUnitId = editing.unit_id;
        const newUnitId = payload.unit_id;

        if (oldUnitId !== newUnitId) {
          // Unit reassignment - check if old unit has other active leases
          const { data: otherActiveLeases } = await supabase
            .from("leases")
            .select("id")
            .eq("unit_id", oldUnitId)
            .eq("status", "active");

          if (!otherActiveLeases || otherActiveLeases.length === 0) {
            // No other active leases, free the old unit
            await supabase.from("units").update({ status: "vacant" }).eq("id", oldUnitId);
          }

          // Mark new unit occupied if not already
          await supabase.from("units").update({ status: "occupied" }).eq("id", newUnitId);
        } else if (form.status === "active") {
          // Same unit, activating the lease
          await supabase.from("units").update({ status: "occupied" }).eq("id", payload.unit_id);
        } else if (form.status === "terminated" || form.status === "expired") {
          // Ending the lease
          await supabase.from("units").update({ status: "vacant" }).eq("id", payload.unit_id);
        }
      }
    }

    toast.success(editing ? "Lease updated" : "Lease created");
    setOpen(false);
    load();
  };

  const leaseToDelete = useState<Lease | null>(null)[0];
  const [leaseToDeleteState, setLeaseToDeleteState] = useState<Lease | null>(null);

  const remove = async (l: Lease) => {
    // Check for linked invoices and payments
    const [{ data: invoices, error: invErr }, { data: payments, error: payErr }] = await Promise.all([
      supabase
        .from("rent_invoices")
        .select("id, amount, paid_amount, status")
        .eq("lease_id", l.id),
      supabase
        .from("payments")
        .select("id, amount, status")
        .eq("lease_id", l.id),
    ]);

    if (invErr) {
      toast.error(invErr.message);
      return;
    }
    if (payErr) {
      toast.error(payErr.message);
      return;
    }

    // Build dependency count for the blocker message
    const invoiceCount = invoices?.length ?? 0;
    const paymentCount = payments?.length ?? 0;

    const blocker = getLeaseDeletionBlocker({ invoiceCount, paymentCount, documentCount: 0 });
    if (blocker) {
      toast.error(blocker);
      return;
    }

    setLeaseToDeleteState(l);
  };

  const confirmDelete = async () => {
    const l = leaseToDeleteState;
    if (!l) return;

    // Delete the lease record first
    const { error } = await supabase.from("leases").delete().eq("id", l.id);
    if (error) {
      toast.error(error.message);
      setLeaseToDeleteState(null);
      return;
    }

    // Sync unit occupancy: check if any other active/pending leases exist for this unit
    const { data: remainingLeases } = await supabase
      .from("leases")
      .select("id")
      .eq("unit_id", l.unit_id)
      .in("status", ["active", "pending"]);

    // If no other active/pending leases, free the unit
    if (!remainingLeases || remainingLeases.length === 0) {
      await supabase.from("units").update({ status: "vacant" }).eq("id", l.unit_id);
    }

    toast.success("Lease deleted");
    load();
    setLeaseToDeleteState(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Leases</h2>
            <p className="text-muted-foreground text-sm">
              Track leases tying tenants to units, with rent terms and deposits.
            </p>
          </div>
          <Button onClick={openCreate} disabled={!landlordId}>
            <Plus className="h-4 w-4 mr-1" /> Add Lease
          </Button>
        </div>

        {landlordError && (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{landlordError}</CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {loading || landlordLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No leases yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a lease to place a tenant in a unit and start invoicing rent.
                </p>
                <Button onClick={openCreate} disabled={!landlordId}>
                  <Plus className="h-4 w-4 mr-1" /> Add Lease
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Rent (KES)</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {tenantName(l.tenant_id)}
                        {l.is_roommate && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            · co-stay ({l.billing_mode})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {unitLabel(l.unit_id)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.start_date.slice(0, 10)}
                        {l.end_date ? ` → ${l.end_date.slice(0, 10)}` : " → open"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(l.rent_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {l.deposit_amount != null ? (
                          <span className={l.deposit_paid ? "" : "text-muted-foreground"}>
                            {Number(l.deposit_amount).toLocaleString()}
                            {l.deposit_paid ? " (paid)" : " (unpaid)"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[l.status]} className="capitalize">
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {l.status === "active" ? (
                            <Button variant="ghost" size="icon" onClick={() => openMoveOutDialog(l)}>
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => remove(l)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Lease Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lease" : "Add lease"}</DialogTitle>
            <DialogDescription>
              Link a tenant to a unit and set the rent terms.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Tenant</Label>
              <Select
                value={form.tenant_id}
                onValueChange={(v) => setForm({ ...form, tenant_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {selectableTenants.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.first_name} {t.last_name}
                      {leasedTenantIds.has(t.id) ? " (already leased)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showLeased}
                  onChange={(e) => setShowLeased(e.target.checked)}
                />
                Show already leased tenants (special cases only)
              </label>
              {form.tenant_id && leasedTenantIds.has(Number(form.tenant_id)) && !showLeased && !editing && (
                <p className="text-xs text-destructive">
                  This tenant already has an active lease on another unit.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Select value={form.unit_id} onValueChange={onUnitChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => {
                    const property = properties.find((p) => p.id === u.property_id);
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {property?.name ?? "Unit"} · {u.unit_number}
                        {u.status === "occupied" ? " (occupied)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="start">Start date</Label>
                <Input
                  id="start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">End date (optional)</Label>
                <Input
                  id="end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rent">Monthly rent (KES)</Label>
                <Input
                  id="rent"
                  type="number"
                  min={0}
                  value={form.rent_amount}
                  onChange={(e) => setForm({ ...form, rent_amount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dep">Deposit (KES)</Label>
                <Input
                  id="dep"
                  type="number"
                  min={0}
                  value={form.deposit_amount}
                  onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="due">Rent due day (1–31)</Label>
                <Input
                  id="due"
                  type="number"
                  min={1}
                  max={31}
                  value={form.rent_due_day}
                  onChange={(e) => setForm({ ...form, rent_due_day: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Lease["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="dep_paid"
                checked={form.deposit_paid}
                onCheckedChange={(v) => setForm({ ...form, deposit_paid: v === true })}
              />
              <Label htmlFor="dep_paid" className="font-normal cursor-pointer">
                Deposit has been paid
              </Label>
            </div>
            <div className="grid gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_roommate"
                  checked={form.is_roommate}
                  onCheckedChange={(v) => setForm({ ...form, is_roommate: v === true })}
                />
                <Label htmlFor="is_roommate" className="font-normal cursor-pointer">
                  Roommates / co-staying (more than one tenant on this unit)
                </Label>
              </div>
              {form.is_roommate && (
                <div className="grid gap-3 pt-1">
                  <div className="grid gap-2">
                    <Label>Billing</Label>
                    <Select
                      value={form.billing_mode}
                      onValueChange={(v) =>
                        setForm({ ...form, billing_mode: v as "shared" | "separate" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shared">
                          Shared — one invoice, roommates settle with the primary tenant
                        </SelectItem>
                        <SelectItem value="separate">
                          Separate — each roommate billed their own share
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.billing_mode === "separate" && (
                    <div className="grid gap-2">
                      <Label>Roommates & monthly share (KES)</Label>
                      {form.roommates.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Select
                            value={r.tenant_id}
                            onValueChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                roommates: f.roommates.map((x, j) =>
                                  j === i ? { ...x, tenant_id: v } : x
                                ),
                              }))
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select tenant" />
                            </SelectTrigger>
                            <SelectContent>
                              {tenants
                                .filter((t) => String(t.id) !== form.tenant_id)
                                .map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.first_name} {t.last_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Share"
                            className="w-32"
                            value={r.share}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                roommates: f.roommates.map((x, j) =>
                                  j === i ? { ...x, share: e.target.value } : x
                                ),
                              }))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                roommates: f.roommates.filter((_, j) => j !== i),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            roommates: [...f.roommates, { tenant_id: "", share: "" }],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add roommate
                      </Button>
                      {(() => {
                        const rent = Number(form.rent_amount) || 0;
                        const shares = form.roommates.reduce(
                          (s, r) => s + (Number(r.share) || 0),
                          0
                        );
                        const remainder = rent - shares;
                        const primary = form.tenant_id ? tenantName(Number(form.tenant_id)) : "";
                        return (
                          <p className="text-xs text-muted-foreground">
                            {remainder > 0
                              ? `${primary || "The primary tenant"} will be billed the remaining KES ${remainder.toLocaleString()}.`
                              : remainder === 0
                                ? "Roommate shares cover the full rent — no primary invoice."
                                : "Shares exceed the monthly rent."}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                  {form.billing_mode === "shared" && (
                    <p className="text-xs text-muted-foreground">
                      One invoice covers the whole unit and goes to{" "}
                      {form.tenant_id ? tenantName(Number(form.tenant_id)) : "the primary tenant"};
                      roommates settle with them directly.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create lease"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move-Out Reconciliation Dialog */}
      <Dialog open={moveOutOpen} onOpenChange={setMoveOutOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move-Out Reconciliation</DialogTitle>
            <DialogDescription>
              Settle the security deposit for {leaseForMoveOut ? `${tenantName(leaseForMoveOut.tenant_id)} at ${unitLabel(leaseForMoveOut.unit_id)}` : ""}.
            </DialogDescription>
          </DialogHeader>
          {leaseForMoveOut && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Deposit Details</Label>
                <div className="bg-muted rounded-md p-3 grid gap-1 text-sm">
                  <div className="flex justify-between">
                    <span>Security Deposit Paid:</span>
                    <span className="font-mono">KES {Number(leaseForMoveOut.deposit_amount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deposit Status:</span>
                    <span>{leaseForMoveOut.deposit_paid ? "Paid" : "Unpaid"}</span>
                  </div>
                </div>
              </div>

              {leaseForMoveOut.deposit_paid && (
                <>
                  <div className="grid gap-2">
                    <Label>Deductions (for damages, cleaning, etc.)</Label>
                    {deductions.map((d, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          type="text"
                          placeholder="Description"
                          value={d.description}
                          onChange={(e) =>
                            setDeductions((prev) => {
                              const copy = [...prev];
                              copy[i] = { ...d, description: e.target.value };
                              return copy;
                            })
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Amount"
                          value={d.amount}
                          onChange={(e) =>
                            setDeductions((prev) => {
                              const copy = [...prev];
                              copy[i] = { ...d, amount: Number(e.target.value) };
                              return copy;
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeductions((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeductions((prev) => [...prev, { type: "deduction", description: "", amount: 0 }])}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add deduction
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    <Label>Refunds (for excess payments, overages, etc.)</Label>
                    {refunds.map((r, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          type="text"
                          placeholder="Description"
                          value={r.description}
                          onChange={(e) =>
                            setRefunds((prev) => {
                              const copy = [...prev];
                              copy[i] = { ...r, description: e.target.value };
                              return copy;
                            })
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Amount"
                          value={r.amount}
                          onChange={(e) =>
                            setRefunds((prev) => {
                              const copy = [...prev];
                              copy[i] = { ...r, amount: Number(e.target.value) };
                              return copy;
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRefunds((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRefunds((prev) => [...prev, { type: "refund", description: "", amount: 0 }])}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add refund
                    </Button>
                  </div>

                  <div className="bg-muted rounded-md p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>Deposit Paid:</span>
                      <span className="font-mono">KES {Number(leaseForMoveOut.deposit_amount ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Deductions:</span>
                      <span className="text-destructive font-mono">- KES {deductions.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Refunds:</span>
                      <span className="text-green-600 font-mono">+ KES {refunds.reduce((s, r) => s + r.amount, 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg font-bold">
                      <span>Net Return:</span>
                      <span className="text-blue-600">
                        KES{" "}
                        {Math.max(
                          0,
                          (Number(leaseForMoveOut.deposit_amount ?? 0) -
                            deductions.reduce((s, d) => s + d.amount, 0) +
                            refunds.reduce((s, r) => s + r.amount, 0))
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveOut} disabled={moveOutSaving || !leaseForMoveOut}>
              {moveOutSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Terminate Lease
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={leaseToDeleteState !== null} onOpenChange={(open) => setLeaseToDeleteState(open ? leaseToDeleteState : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the lease for {leaseToDeleteState ? `${tenantName(leaseToDeleteState.tenant_id)} at ${unitLabel(leaseToDeleteState.unit_id)}` : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// Missing Badge import
import { Badge } from "@/components/ui/badge";