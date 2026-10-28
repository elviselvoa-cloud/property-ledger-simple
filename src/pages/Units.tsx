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
import { supabase, type Property, type Unit } from "@/integrations/supabase/client";
import { generateFromRule, parseUnitList } from "@/lib/units-generator";
import { DoorOpen, Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type FormState = {
  property_id: string;
  unit_number: string;
  floor: string;
  bedrooms: string;
  bathrooms: string;
  rent_amount: string;
  deposit_amount: string;
  status: Unit["status"];
};

const emptyForm: FormState = {
  property_id: "",
  unit_number: "",
  floor: "",
  bedrooms: "1",
  bathrooms: "1",
  rent_amount: "",
  deposit_amount: "",
  status: "vacant",
};

type GenForm = {
  property_id: string;
  mode: "rule" | "list";
  prefix: string;
  suffix: string;
  start: string;
  end: string;
  pad: string;
  floor: string;
  list_text: string;
  bedrooms: string;
  bathrooms: string;
  rent_amount: string;
  deposit_amount: string;
};

const emptyGenForm: GenForm = {
  property_id: "",
  mode: "rule",
  prefix: "",
  suffix: "",
  start: "1",
  end: "10",
  pad: "",
  floor: "",
  list_text: "",
  bedrooms: "1",
  bathrooms: "1",
  rent_amount: "",
  deposit_amount: "",
};

const statusVariant: Record<Unit["status"], "default" | "secondary" | "outline"> = {
  occupied: "default",
  vacant: "secondary",
  maintenance: "outline",
};

export default function Units() {
  const { landlordId, loading: landlordLoading } = useLandlord();
  const [rows, setRows] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [genOpen, setGenOpen] = useState(false);
  const [genSaving, setGenSaving] = useState(false);
  const [genForm, setGenForm] = useState<GenForm>(emptyGenForm);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [unitsRes, propsRes] = await Promise.all([
      supabase
        .from("units")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false }),
      supabase.from("properties").select("*").eq("landlord_id", landlordId).order("name"),
    ]);
    if (unitsRes.error) toast.error(unitsRes.error.message);
    else setRows((unitsRes.data ?? []) as Unit[]);
    if (propsRes.error) toast.error(propsRes.error.message);
    else setProperties((propsRes.data ?? []) as Property[]);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  const propertyName = (id: number) => properties.find((p) => p.id === id)?.name ?? "—";

  const openCreate = () => {
    if (properties.length === 0) {
      toast.error("Add a property first");
      return;
    }
    setEditing(null);
    setForm({ ...emptyForm, property_id: String(properties[0].id) });
    setOpen(true);
  };

  const openEdit = (u: Unit) => {
    setEditing(u);
    setForm({
      property_id: String(u.property_id),
      unit_number: u.unit_number,
      floor: u.floor ?? "",
      bedrooms: String(u.bedrooms ?? 1),
      bathrooms: String(u.bathrooms ?? 1),
      rent_amount: String(u.rent_amount ?? ""),
      deposit_amount: u.deposit_amount != null ? String(u.deposit_amount) : "",
      status: u.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!landlordId) return;
    if (!form.property_id || !form.unit_number.trim() || !form.rent_amount) {
      toast.error("Property, unit number and rent are required");
      return;
    }
    setSaving(true);
    const payload = {
      landlord_id: landlordId,
      property_id: Number(form.property_id),
      unit_number: form.unit_number.trim(),
      floor: form.floor.trim() || null,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      rent_amount: Number(form.rent_amount),
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
      status: form.status,
    };
    const { error } = editing
      ? await supabase.from("units").update(payload).eq("id", editing.id)
      : await supabase.from("units").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Unit updated" : "Unit added");
    setOpen(false);
    load();
  };

  const remove = async (u: Unit) => {
    if (!confirm(`Delete unit ${u.unit_number}?`)) return;
    const { error } = await supabase.from("units").delete().eq("id", u.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Unit deleted");
      load();
    }
  };

  const openGenerate = () => {
    if (properties.length === 0) {
      toast.error("Add a property first");
      return;
    }
    setGenForm((f) => ({
      ...emptyGenForm,
      property_id: f.property_id || String(properties[0].id),
    }));
    setGenOpen(true);
  };

  const genPreview = useMemo(() => {
    if (genForm.mode === "rule") {
      return generateFromRule(genForm.prefix.trim(), Number(genForm.start), Number(genForm.end), {
        suffix: genForm.suffix.trim(),
        pad: Number(genForm.pad) || 0,
      });
    }
    return parseUnitList(genForm.list_text);
  }, [genForm]);

  const saveGenerate = async () => {
    if (!landlordId) return;
    if (!genForm.property_id) {
      toast.error("Select a property");
      return;
    }
    if (genPreview.length === 0) {
      toast.error("No units to create — check the pattern or the list");
      return;
    }
    if (!genForm.rent_amount) {
      toast.error("Monthly rent is required");
      return;
    }
    setGenSaving(true);
    // Skip names that already exist on this property.
    const { data: existing } = await supabase
      .from("units")
      .select("unit_number")
      .eq("landlord_id", landlordId)
      .eq("property_id", Number(genForm.property_id));
    const taken = new Set((existing ?? []).map((e) => e.unit_number.toLowerCase()));
    const fresh = genPreview.filter((u) => !taken.has(u.unit_number.toLowerCase()));
    if (fresh.length === 0) {
      setGenSaving(false);
      toast.error("All of these units already exist for that property");
      return;
    }
    const payload = fresh.map((u) => ({
      landlord_id: landlordId,
      property_id: Number(genForm.property_id),
      unit_number: u.unit_number,
      floor: genForm.floor.trim() || u.floor,
      bedrooms: Number(genForm.bedrooms) || 0,
      bathrooms: Number(genForm.bathrooms) || 0,
      rent_amount: Number(genForm.rent_amount),
      deposit_amount: genForm.deposit_amount ? Number(genForm.deposit_amount) : null,
      status: "vacant" as const,
    }));
    const { error } = await supabase.from("units").insert(payload);
    setGenSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `${fresh.length} unit${fresh.length > 1 ? "s" : ""} created${
        fresh.length < genPreview.length
          ? ` (${genPreview.length - fresh.length} duplicate${genPreview.length - fresh.length > 1 ? "s" : ""} skipped)`
          : ""
      }`
    );
    setGenOpen(false);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Units</h2>
            <p className="text-muted-foreground text-sm">
              Manage individual units within your properties.
            </p>
          </div>
          <Button onClick={openCreate} disabled={!landlordId}>
            <Plus className="h-4 w-4 mr-1" /> Add Unit
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading || landlordLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <DoorOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No units yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {properties.length === 0
                    ? "Add a property first, then create its units."
                    : "Add units and set their monthly rent."}
                </p>
                <Button onClick={openCreate} disabled={!landlordId}>
                  <Plus className="h-4 w-4 mr-1" /> Add Unit
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Beds / Baths</TableHead>
                    <TableHead className="text-right">Rent (KES)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.unit_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {propertyName(u.property_id)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.bedrooms} / {u.bathrooms}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(u.rent_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[u.status]} className="capitalize">
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(u)}>
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
            <DialogTitle>{editing ? "Edit unit" : "Add unit"}</DialogTitle>
            <DialogDescription>Units belong to a property and carry the rent.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Property</Label>
              <Select
                value={form.property_id}
                onValueChange={(v) => setForm({ ...form, property_id: v })}
              >
                <SelectTrigger>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="unum">Unit number</Label>
                <Input
                  id="unum"
                  value={form.unit_number}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                  placeholder="A1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder="Ground"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="beds">Bedrooms</Label>
                <Input
                  id="beds"
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="baths">Bathrooms</Label>
                <Input
                  id="baths"
                  type="number"
                  min={0}
                  value={form.bathrooms}
                  onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
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
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as Unit["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Add unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
