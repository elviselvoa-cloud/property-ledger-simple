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
  type Caretaker,
  type Property,
} from "@/integrations/supabase/client";
import { HardHat, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type FormState = {
  name: string;
  phone: string;
  email: string;
  national_id: string;
  notes: string;
  is_active: boolean;
  propertyIds: number[];
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  national_id: "",
  notes: "",
  is_active: true,
  propertyIds: [],
};

type Assignment = { caretaker_id: number; property_id: number };

export default function Caretakers() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [rows, setRows] = useState<Caretaker[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Caretaker | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [caretakersRes, propertiesRes, assignmentsRes] = await Promise.all([
      supabase
        .from("caretakers")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false }),
      supabase
        .from("properties")
        .select("*")
        .eq("landlord_id", landlordId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("caretaker_properties")
        .select("caretaker_id, property_id")
        .eq("landlord_id", landlordId),
    ]);
    if (caretakersRes.error) toast.error(caretakersRes.error.message);
    if (propertiesRes.error) toast.error(propertiesRes.error.message);
    if (assignmentsRes.error) toast.error(assignmentsRes.error.message);
    setRows((caretakersRes.data ?? []) as Caretaker[]);
    setProperties((propertiesRes.data ?? []) as Property[]);
    setAssignments((assignmentsRes.data ?? []) as Assignment[]);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  const propertiesFor = (caretakerId: number) =>
    assignments
      .filter((a) => a.caretaker_id === caretakerId)
      .map((a) => properties.find((p) => p.id === a.property_id))
      .filter(Boolean) as Property[];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Caretaker) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      national_id: c.national_id ?? "",
      notes: c.notes ?? "",
      is_active: c.is_active,
      propertyIds: assignments
        .filter((a) => a.caretaker_id === c.id)
        .map((a) => a.property_id),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!landlordId) return;
    if (!form.name.trim()) {
      toast.error("Caretaker name is required");
      return;
    }
    setSaving(true);
    const payload = {
      landlord_id: landlordId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      national_id: form.national_id.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    const { data, error } = editing
      ? await supabase.from("caretakers").update(payload).eq("id", editing.id).select("id")
      : await supabase.from("caretakers").insert(payload).select("id");

    if (error || !data || data.length === 0) {
      setSaving(false);
      toast.error(error?.message ?? "Could not save caretaker");
      return;
    }

    const caretakerId = (data[0] as { id: number }).id;

    // Replace the property assignments with the current selection.
    await supabase.from("caretaker_properties").delete().eq("caretaker_id", caretakerId);
    if (form.propertyIds.length > 0) {
      const { error: assignError } = await supabase.from("caretaker_properties").insert(
        form.propertyIds.map((property_id) => ({
          caretaker_id: caretakerId,
          property_id,
          landlord_id: landlordId,
        }))
      );
      if (assignError) {
        setSaving(false);
        toast.error(assignError.message);
        return;
      }
    }

    setSaving(false);
    toast.success(editing ? "Caretaker updated" : "Caretaker added");
    setOpen(false);
    load();
  };

  const remove = async (c: Caretaker) => {
    if (!confirm(`Delete ${c.name}? Their property assignments will be removed too.`)) return;
    const { error } = await supabase.from("caretakers").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Caretaker deleted");
      load();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Caretakers</h2>
            <p className="text-muted-foreground text-sm">
              Manage caretakers and the properties they look after.
            </p>
          </div>
          <Button onClick={openCreate} disabled={!landlordId}>
            <Plus className="h-4 w-4 mr-1" /> Add Caretaker
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
                  <HardHat className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No caretakers yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add caretakers and assign them to the properties they manage.
                </p>
                <Button onClick={openCreate} disabled={!landlordId}>
                  <Plus className="h-4 w-4 mr-1" /> Add Caretaker
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Properties</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => {
                    const assigned = propertiesFor(c.id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                        <TableCell className="max-w-xs">
                          {assigned.length === 0 ? (
                            <span className="text-muted-foreground">Not assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {assigned.map((p) => (
                                <Badge key={p.id} variant="secondary">
                                  {p.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? "default" : "outline"}>
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(c)}>
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit caretaker" : "Add caretaker"}</DialogTitle>
            <DialogDescription>
              Contact details and the properties they look after.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. John Kamau"
              />
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
            <div className="grid gap-2">
              <Label>Assigned properties</Label>
              {properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No properties yet — add a property first to assign caretakers.
                </p>
              ) : (
                <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
                  {properties.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={form.propertyIds.includes(p.id)}
                        onCheckedChange={(checked) =>
                          setForm({
                            ...form,
                            propertyIds: checked
                              ? [...form.propertyIds, p.id]
                              : form.propertyIds.filter((id) => id !== p.id),
                          })
                        }
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
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
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked === true })}
              />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Add caretaker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
