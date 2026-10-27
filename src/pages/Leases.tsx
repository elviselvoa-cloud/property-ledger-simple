import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

  const openCreate = () => {
    if (tenants.length === 0 || units.length === 0) {
      toast.error("Add at least one tenant and one unit first");
      return;
    }
    setEditing(null);
    const firstUnit = units.find((u) => u.status !== "occupied") ?? units[0];
    setForm({
      ...emptyForm,
      start_date: today(),
      tenant_id: String(tenants[0].id),
      unit_id: String(firstUnit.id),
      rent_amount: String(firstUnit.rent_amount ?? ""),
      deposit_amount: firstUnit.deposit_amount != null ? String(firstUnit.deposit_amount) : "",
    });
    setOpen(true);
  };

  const openEdit = (l: Lease) => {
    setEditing(l);
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

    // Keep unit occupancy in sync with lease status.
    if (!error && (form.status === "active" || editing)) {
      const unitStatus = form.status === "active" ? "occupied" : "vacant";
      await supabase.from("units").update({ status: unitStatus }).eq("id", payload.unit_id);
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Lease updated" : "Lease created");
    setOpen(false);
    load();
  };

  const remove = async (l: Lease) => {
    const label = `${tenantName(l.tenant_id)} at ${unitLabel(l.unit_id)}`;
    if (!confirm(`Delete the lease for ${label}?`)) return;
    const { error } = await supabase.from("leases").delete().eq("id", l.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lease deleted");
      load();
    }
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
                          <Button variant="ghost" size="icon" onClick={() => remove(l)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.first_name} {t.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </DashboardLayout>
  );
}
