import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  type RentInvoice,
  type Tenant,
  type Unit,
} from "@/integrations/supabase/client";
import { participantShares } from "@/lib/roommates";
import { Loader2, Pencil, Plus, Receipt, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type FormState = {
  lease_id: string;
  period_month: string;
  period_year: string;
  due_date: string;
  amount: string;
  notes: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusVariant: Record<RentInvoice["status"], "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  partial: "outline",
  overdue: "destructive",
  cancelled: "outline",
};

export default function Invoices() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [rows, setRows] = useState<RentInvoice[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RentInvoice | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const now = new Date();

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [invRes, leaseRes, tenantsRes, unitsRes, propsRes] = await Promise.all([
      supabase
        .from("rent_invoices")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false }),
      supabase
        .from("leases")
        .select("id, tenant_id, unit_id, rent_amount, rent_due_day, status, is_roommate, billing_mode, roommates")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false }),
      supabase.from("tenants").select("id, first_name, last_name").eq("landlord_id", landlordId),
      supabase
        .from("units")
        .select("id, unit_number, property_id")
        .eq("landlord_id", landlordId),
      supabase.from("properties").select("id, name").eq("landlord_id", landlordId),
    ]);
    if (invRes.error) toast.error(invRes.error.message);
    else setRows((invRes.data ?? []) as RentInvoice[]);
    if (leaseRes.error) toast.error(leaseRes.error.message);
    else setLeases((leaseRes.data ?? []) as Lease[]);
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

  const leaseLabel = (l: Lease) => `${tenantName(l.tenant_id)} · ${unitLabel(l.unit_id)}`;

  // Effective status: show overdue when a pending invoice passed its due date.
  const effectiveStatus = (inv: RentInvoice): RentInvoice["status"] => {
    if (inv.status === "pending" && new Date(inv.due_date) < new Date(new Date().toDateString())) {
      return "overdue";
    }
    return inv.status;
  };

  const balance = (inv: RentInvoice) => Number(inv.amount) - Number(inv.paid_amount ?? 0);

  const openCreate = () => {
    const activeLeases = leases.filter((l) => l.status === "active");
    if (activeLeases.length === 0) {
      toast.error("Create an active lease first — invoices are generated from leases");
      return;
    }
    setEditing(null);
    const lease = activeLeases[0];
    const dueDate = new Date(now.getFullYear(), now.getMonth(), lease.rent_due_day ?? 1);
    setForm({
      lease_id: String(lease.id),
      period_month: String(now.getMonth() + 1),
      period_year: String(now.getFullYear()),
      due_date: dueDate.toISOString().slice(0, 10),
      amount: String(participantShares(lease)[0]?.amount ?? lease.rent_amount ?? ""),
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (inv: RentInvoice) => {
    setEditing(inv);
    setForm({
      lease_id: String(inv.lease_id),
      period_month: String(inv.period_month),
      period_year: String(inv.period_year),
      due_date: inv.due_date ? inv.due_date.slice(0, 10) : "",
      amount: String(inv.amount),
      notes: inv.notes ?? "",
    });
    setOpen(true);
  };

  const onLeaseChange = (leaseId: string) => {
    const lease = leases.find((l) => l.id === Number(leaseId));
    setForm((f) =>
      f
        ? {
            ...f,
            lease_id: leaseId,
            amount: editing
              ? f.amount
              : lease
                ? String(participantShares(lease)[0]?.amount ?? lease.rent_amount ?? "")
                : f.amount,
          }
        : f
    );
  };

  const generateInvoiceNumber = (year: number, month: number) => {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `INV-${year}${String(month).padStart(2, "0")}-${rand}`;
  };

  const save = async () => {
    if (!landlordId || !form) return;
    if (!form.lease_id || !form.due_date || !form.amount) {
      toast.error("Lease, due date and amount are required");
      return;
    }
    const lease = leases.find((l) => l.id === Number(form.lease_id));
    if (!lease) {
      toast.error("Selected lease not found");
      return;
    }
    const month = Number(form.period_month);
    const year = Number(form.period_year);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      toast.error("Invalid billing period");
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("rent_invoices")
        .update({
          amount: Number(form.amount),
          due_date: form.due_date,
          notes: form.notes.trim() || null,
        })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Invoice updated");
    } else {
      // One invoice per billed tenant per period: for split (roommate) leases the
      // first participant without an invoice yet gets this one.
      const { data: existing } = await supabase
        .from("rent_invoices")
        .select("id, tenant_id")
        .eq("lease_id", lease.id)
        .eq("period_month", month)
        .eq("period_year", year)
        .neq("status", "cancelled");
      const billedTenants = new Set((existing ?? []).map((e) => e.tenant_id));
      const participant = participantShares(lease).find(
        (p) => p.amount > 0 && !billedTenants.has(p.tenant_id)
      );
      if (existing && existing.length > 0 && !participant) {
        setSaving(false);
        toast.error("Every billed tenant on this lease already has an invoice for that period");
        return;
      }
      if (!participant) {
        setSaving(false);
        toast.error("Nothing to bill on this lease");
        return;
      }
      const payload = {
        landlord_id: landlordId,
        lease_id: lease.id,
        tenant_id: participant.tenant_id,
        unit_id: lease.unit_id,
        invoice_number: generateInvoiceNumber(year, month),
        amount: participant.amount,
        due_date: form.due_date,
        period_month: month,
        period_year: year,
        status: "pending" as const,
        notes: form.notes.trim() || null,
      };
      const { error } = await supabase.from("rent_invoices").insert(payload);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Invoice created");
    }
    setOpen(false);
    load();
  };

  // Bulk-generate pending invoices for every active lease missing one this period.
  const generateMonth = async () => {
    if (!landlordId) return;
    const activeLeases = leases.filter((l) => l.status === "active");
    if (activeLeases.length === 0) {
      toast.error("No active leases to invoice");
      return;
    }
    setGenerating(true);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { data: existing } = await supabase
      .from("rent_invoices")
      .select("lease_id")
      .eq("landlord_id", landlordId)
      .eq("period_month", month)
      .eq("period_year", year)
      .neq("status", "cancelled");
    const covered = new Set(
      (existing ?? []).map((e) => `${e.lease_id}-${e.tenant_id}`)
    );
    const toInsert: Array<{
      landlord_id: number;
      lease_id: number;
      tenant_id: number;
      unit_id: number;
      invoice_number: string;
      amount: number;
      due_date: string;
      period_month: number;
      period_year: number;
      status: "pending";
    }> = [];
    for (const l of activeLeases) {
      // Split (roommate) leases produce one invoice per participant; standard
      // and shared leases produce a single invoice for the primary tenant.
      for (const p of participantShares(l)) {
        if (p.amount <= 0) continue;
        const key = `${l.id}-${p.tenant_id}`;
        if (covered.has(key)) continue;
        covered.add(key);
        toInsert.push({
          landlord_id: landlordId,
          lease_id: l.id,
          tenant_id: p.tenant_id,
          unit_id: l.unit_id,
          invoice_number: generateInvoiceNumber(year, month),
          amount: p.amount,
          due_date: new Date(Date.UTC(year, month - 1, l.rent_due_day ?? 1)).toISOString(),
          period_month: month,
          period_year: year,
          status: "pending" as const,
        });
      }
    }
    if (toInsert.length === 0) {
      setGenerating(false);
      toast.info("All active leases already have an invoice for this month");
      return;
    }
    const { error } = await supabase.from("rent_invoices").insert(toInsert);
    setGenerating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${toInsert.length} invoice${toInsert.length > 1 ? "s" : ""} generated`);
    load();
  };

  const remove = async (inv: RentInvoice) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    const { error } = await supabase.from("rent_invoices").delete().eq("id", inv.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Invoice deleted");
      load();
    }
  };

  const outstanding = rows
    .filter((r) => !["paid", "cancelled"].includes(r.status))
    .reduce((sum, r) => sum + balance(r), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Invoices</h2>
            <p className="text-muted-foreground text-sm">
              Generate and track monthly rent invoices from your active leases.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateMonth} disabled={generating || !landlordId}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate this month
            </Button>
            <Button onClick={openCreate} disabled={!landlordId}>
              <Plus className="h-4 w-4 mr-1" /> Add Invoice
            </Button>
          </div>
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
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No invoices yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {leases.some((l) => l.status === "active")
                    ? "Generate this month's invoices from your active leases."
                    : "Create an active lease first, then generate invoices from it."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Amount (KES)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => {
                    const status = effectiveStatus(inv);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{tenantName(inv.tenant_id)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {unitLabel(inv.unit_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {MONTHS[inv.period_month - 1]} {inv.period_year}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv.due_date.slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(inv.amount).toLocaleString()}
                          {inv.paid_amount != null && Number(inv.paid_amount) > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {Number(inv.paid_amount).toLocaleString()} paid ·{" "}
                              {balance(inv).toLocaleString()} due
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[status]} className="capitalize">
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(inv)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(inv)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {rows.length > 0 && outstanding > 0 && (
          <p className="text-sm text-muted-foreground">
            Outstanding balance across all invoices:{" "}
            <span className="font-medium text-foreground">
              KES {outstanding.toLocaleString()}
            </span>
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit invoice" : "Add invoice"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Adjust the amount, due date or notes."
                : "Create a rent invoice from an active lease."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              {!editing && (
                <>
                  <div className="grid gap-2">
                    <Label>Lease</Label>
                    <Select value={form.lease_id} onValueChange={onLeaseChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lease" />
                      </SelectTrigger>
                      <SelectContent>
                        {leases
                          .filter((l) => l.status === "active")
                          .map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {leaseLabel(l)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Billing month</Label>
                      <Select
                        value={form.period_month}
                        onValueChange={(v) => setForm({ ...form, period_month: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => (
                            <SelectItem key={m} value={String(i + 1)}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="year">Billing year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={form.period_year}
                        onChange={(e) => setForm({ ...form, period_year: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (KES)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due">Due date</Label>
                  <Input
                    id="due"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
