import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLandlord } from "@/hooks/useLandlord";
import { supabase, type Tenant } from "@/integrations/supabase/client";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  national_id: string;
  emergency_contact: string;
  emergency_phone: string;
  notes: string;
};

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  national_id: "",
  emergency_contact: "",
  emergency_phone: "",
  notes: "",
};

export default function Tenants() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Tenant[]);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setForm({
      first_name: t.first_name,
      last_name: t.last_name,
      email: t.email ?? "",
      phone: t.phone ?? "",
      national_id: t.national_id ?? "",
      emergency_contact: t.emergency_contact ?? "",
      emergency_phone: t.emergency_phone ?? "",
      notes: t.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!landlordId) return;
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    const payload = {
      landlord_id: landlordId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      national_id: form.national_id.trim() || null,
      emergency_contact: form.emergency_contact.trim() || null,
      emergency_phone: form.emergency_phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("tenants").update(payload).eq("id", editing.id)
      : await supabase.from("tenants").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Tenant updated" : "Tenant added");
    setOpen(false);
    load();
  };

  const remove = async (t: Tenant) => {
    // Check for active leases
    const { data: activeLeases } = await supabase
      .from("leases")
      .select("id, unit_id, status")
      .eq("tenant_id", t.id)
      .eq("status", "active");
    if (activeLeases && activeLeases.length > 0) {
      toast.error(
        `Cannot delete tenant ${t.first_name} ${t.last_name}. They are currently linked to an active lease on Unit ${activeLeases[0].unit_id}. Terminate the lease first.`
      );
      return;
    }
    // Check for outstanding invoices/balance
    const { data: invoices } = await supabase
      .from("rent_invoices")
      .select("id, amount, paid_amount")
      .eq("tenant_id", t.id)
      .neq("status", "paid");
    const hasOutstandingBalance = (invoices ?? []).some((inv) => {
      const balance = Number(inv.amount) - Number(inv.paid_amount ?? 0);
      return balance > 0;
    });
    if (hasOutstandingBalance) {
      const totalUnpaid = (invoices ?? [])
        .reduce((sum, inv) => sum + Math.max(0, Number(inv.amount) - Number(inv.paid_amount ?? 0)), 0);
      toast.error(
        `Cannot delete tenant ${t.first_name} ${t.last_name}. They have outstanding arrears of KES ${totalUnpaid.toLocaleString()}.`
      );
      return;
    }
    setTenantToDelete(t);
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;
    const { error } = await supabase.from("tenants").delete().eq("id", tenantToDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Tenant deleted");
      load();
    }
    setTenantToDelete(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tenants</h2>
            <p className="text-muted-foreground text-sm">
              Manage tenant records and contact information.
            </p>
          </div>
          <Button onClick={openCreate} disabled={!landlordId}>
            <Plus className="h-4 w-4 mr-1" /> Add Tenant
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
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No tenants yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add tenants before creating leases and invoices.
                </p>
                <Button onClick={openCreate} disabled={!landlordId}>
                  <Plus className="h-4 w-4 mr-1" /> Add Tenant
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>National ID</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.first_name} {t.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{t.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.national_id ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(t)}>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tenant" : "Add tenant"}</DialogTitle>
            <DialogDescription>Contact and identification details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+2547..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nid">National ID</Label>
              <Input
                id="nid"
                value={form.national_id}
                onChange={(e) => setForm({ ...form, national_id: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ec">Emergency contact</Label>
                <Input
                  id="ec"
                  value={form.emergency_contact}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ep">Emergency phone</Label>
                <Input
                  id="ep"
                  value={form.emergency_phone}
                  onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Add tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={tenantToDelete !== null} onOpenChange={(open) => setTenantToDelete(open ? tenantToDelete : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {tenantToDelete?.first_name} {tenantToDelete?.last_name}? This action cannot be undone.
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
