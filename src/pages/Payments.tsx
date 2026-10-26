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
  printReceipt,
  shareReceiptOnWhatsApp,
  periodLabel,
  type ReceiptData,
} from "@/lib/receipt";
import {
  supabase,
  type Landlord,
  type Payment,
  type Property,
  type RentInvoice,
  type Tenant,
  type Unit,
} from "@/integrations/supabase/client";
import {
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type FormState = {
  invoice_id: string;
  amount: string;
  payment_method: Payment["payment_method"];
  reference: string;
  payment_date: string;
  notes: string;
};

const METHOD_LABELS: Record<Payment["payment_method"], string> = {
  mpesa: "M-Pesa",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

const statusVariant: Record<RentInvoice["status"], "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  partial: "outline",
  overdue: "destructive",
  cancelled: "outline",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Payments() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [rows, setRows] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [landlordProfile, setLandlordProfile] = useState<Landlord | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [payRes, invRes, tenantsRes, unitsRes, propsRes, llRes] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("payment_date", { ascending: false }),
      supabase
        .from("rent_invoices")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("due_date", { ascending: true }),
      supabase
        .from("tenants")
        .select("id, first_name, last_name, phone")
        .eq("landlord_id", landlordId),
      supabase.from("units").select("id, unit_number, property_id").eq("landlord_id", landlordId),
      supabase.from("properties").select("id, name").eq("landlord_id", landlordId),
      supabase.from("landlords").select("*").eq("id", landlordId).maybeSingle(),
    ]);
    if (payRes.error) toast.error(payRes.error.message);
    else setRows((payRes.data ?? []) as Payment[]);
    if (invRes.error) toast.error(invRes.error.message);
    else setInvoices((invRes.data ?? []) as RentInvoice[]);
    if (tenantsRes.error) toast.error(tenantsRes.error.message);
    else setTenants((tenantsRes.data ?? []) as Tenant[]);
    if (unitsRes.error) toast.error(unitsRes.error.message);
    else setUnits((unitsRes.data ?? []) as Unit[]);
    if (propsRes.error) toast.error(propsRes.error.message);
    else setProperties((propsRes.data ?? []) as Property[]);
    if (llRes.error) toast.error(llRes.error.message);
    else setLandlordProfile((llRes.data ?? null) as Landlord | null);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  const tenantName = (id: number) => {
    const t = tenants.find((x) => x.id === id);
    return t ? `${t.first_name} ${t.last_name}` : "—";
  };

  const balance = (inv: RentInvoice) => Number(inv.amount) - Number(inv.paid_amount ?? 0);

  const receiptFor = (p: Payment): ReceiptData => {
    const inv = invoices.find((i) => i.id === p.invoice_id);
    const unit = inv ? units.find((u) => u.id === inv.unit_id) : undefined;
    const property = unit ? properties.find((pr) => pr.id === unit.property_id) : undefined;
    const tenant = tenants.find((t) => t.id === p.tenant_id);
    return {
      receiptNo: `PL-${String(p.id).padStart(6, "0")}`,
      landlordName: landlordProfile?.business_name ?? "Property Ledger",
      landlordPhone: landlordProfile?.phone ?? null,
      paybill: landlordProfile?.mpesa_paybill ?? null,
      paymentInstructions: landlordProfile?.payment_instructions ?? null,
      tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}` : "Tenant",
      tenantPhone: tenant?.phone ?? null,
      invoiceNumber: inv?.invoice_number ?? null,
      period: inv ? periodLabel(inv.period_month, inv.period_year) : null,
      unitLabel: unit
        ? [property?.name, unit.unit_number].filter(Boolean).join(" · ")
        : null,
      amount: Number(p.amount),
      paymentMethod: METHOD_LABELS[p.payment_method],
      reference: p.mpesa_transaction_id ?? p.bank_reference ?? p.receipt_number ?? null,
      paymentDate: p.payment_date.slice(0, 10),
    };
  };

  const onPrint = (p: Payment) => {
    if (!printReceipt(receiptFor(p))) {
      toast.error("Allow pop-ups for this site to print receipts");
    }
  };

  const onShare = (p: Payment) => {
    if (!shareReceiptOnWhatsApp(receiptFor(p))) {
      toast.error("Allow pop-ups for this site to open WhatsApp");
    }
  };

  const openBalance = (inv: RentInvoice) => {
    if (inv.status === "pending" && new Date(inv.due_date) < new Date(new Date().toDateString())) {
      return "overdue" as const;
    }
    return inv.status;
  };

  const openCreate = () => {
    const payable = invoices.filter(
      (inv) => inv.status !== "cancelled" && balance(inv) > 0
    );
    if (payable.length === 0) {
      toast.error("No outstanding invoices to record a payment against");
      return;
    }
    setEditing(null);
    const inv = payable[0];
    setForm({
      invoice_id: String(inv.id),
      amount: String(balance(inv)),
      payment_method: "mpesa",
      reference: "",
      payment_date: today(),
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      invoice_id: p.invoice_id != null ? String(p.invoice_id) : "",
      amount: String(p.amount),
      payment_method: p.payment_method,
      reference: p.mpesa_transaction_id ?? p.bank_reference ?? p.receipt_number ?? "",
      payment_date: p.payment_date ? p.payment_date.slice(0, 10) : today(),
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const onInvoiceChange = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === Number(invoiceId));
    setForm((f) =>
      f
        ? {
            ...f,
            invoice_id: invoiceId,
            amount: editing ? f.amount : inv ? String(balance(inv)) : f.amount,
          }
        : f
    );
  };

  // Reference goes to the column matching the payment method.
  const referenceFor = (method: Payment["payment_method"], value: string) => {
    if (method === "mpesa") return { mpesa_transaction_id: value || null };
    if (method === "bank_transfer") return { bank_reference: value || null };
    return { receipt_number: value || null };
  };

  // Recompute an invoice's paid total from its payments and update its status.
  const syncInvoice = async (invoiceId: number) => {
    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .eq("invoice_id", invoiceId);
    const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const status: RentInvoice["status"] =
      paid <= 0 ? "pending" : paid >= Number(inv.amount) ? "paid" : "partial";
    await supabase
      .from("rent_invoices")
      .update({
        paid_amount: paid,
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", invoiceId);
  };

  const save = async () => {
    if (!landlordId || !form) return;
    if (!form.invoice_id || !form.amount || !form.payment_date) {
      toast.error("Invoice, amount and payment date are required");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    const invoiceId = Number(form.invoice_id);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) {
      toast.error("Selected invoice not found");
      return;
    }
    if (!editing && amount > balance(inv)) {
      toast.error(`Amount exceeds the invoice balance of KES ${balance(inv).toLocaleString()}`);
      return;
    }
    setSaving(true);
    const payload = {
      landlord_id: landlordId,
      invoice_id: invoiceId,
      tenant_id: inv.tenant_id,
      amount,
      payment_method: form.payment_method,
      payment_date: form.payment_date,
      notes: form.notes.trim() || null,
      ...referenceFor(form.payment_method, form.reference.trim()),
    };
    const { error } = editing
      ? await supabase.from("payments").update(payload).eq("id", editing.id)
      : await supabase.from("payments").insert(payload);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    await syncInvoice(invoiceId);
    setSaving(false);
    toast.success(editing ? "Payment updated" : "Payment recorded");
    setOpen(false);
    load();
  };

  const remove = async (p: Payment) => {
    if (!confirm(`Delete this payment of KES ${Number(p.amount).toLocaleString()}?`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (p.invoice_id != null) await syncInvoice(p.invoice_id);
    toast.success("Payment deleted");
    load();
  };

  const collectedThisMonth = rows
    .filter((p) => p.payment_date.slice(0, 7) === today().slice(0, 7))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
            <p className="text-muted-foreground text-sm">
              Record rent payments against invoices and keep balances up to date.
            </p>
          </div>
          <Button onClick={openCreate} disabled={!landlordId}>
            <Plus className="h-4 w-4 mr-1" /> Record Payment
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
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No payments yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {invoices.length === 0
                    ? "Create invoices first, then record payments against them."
                    : "Record a payment against an outstanding invoice."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Amount (KES)</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const inv = invoices.find((i) => i.id === p.invoice_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{tenantName(p.tenant_id)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv?.invoice_number ?? "—"}
                          {inv && (
                            <Badge
                              variant={statusVariant[openBalance(inv)]}
                              className="capitalize ml-2"
                            >
                              {openBalance(inv)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(p.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{METHOD_LABELS[p.payment_method]}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.mpesa_transaction_id ?? p.bank_reference ?? p.receipt_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.payment_date.slice(0, 10)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(p)}>
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
        {collectedThisMonth > 0 && (
          <p className="text-sm text-muted-foreground">
            Collected this month:{" "}
            <span className="font-medium text-foreground">
              KES {collectedThisMonth.toLocaleString()}
            </span>
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit payment" : "Record payment"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Adjust the amount, method or reference."
                : "Payments update the invoice balance automatically."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Invoice</Label>
                <Select
                  value={form.invoice_id}
                  onValueChange={onInvoiceChange}
                  disabled={!!editing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices
                      .filter((inv) => inv.status !== "cancelled" && balance(inv) > 0)
                      .map((inv) => (
                        <SelectItem key={inv.id} value={String(inv.id)}>
                          {inv.invoice_number} · {tenantName(inv.tenant_id)} · balance{" "}
                          {balance(inv).toLocaleString()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <Label htmlFor="method">Method</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(v) =>
                      setForm({ ...form, payment_method: v as Payment["payment_method"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ref">
                    {form.payment_method === "mpesa"
                      ? "M-Pesa transaction code"
                      : form.payment_method === "bank_transfer"
                        ? "Bank reference"
                        : "Receipt number"}
                  </Label>
                  <Input
                    id="ref"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder={form.payment_method === "mpesa" ? "QGH7XYZ123" : "Optional"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Payment date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
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
              {editing ? "Save changes" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
