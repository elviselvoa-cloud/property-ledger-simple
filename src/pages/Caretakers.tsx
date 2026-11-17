import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLandlord } from "@/hooks/useLandlord";
import { supabase, type Caretaker, type CaretakerPermission, type Property } from "@/integrations/supabase/client";
import { HardHat, Loader2, Plus, Trash2, Send, CheckCircle2, AlertCircle, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const ALL_TABS = [
  { key: "properties", label: "Properties" },
  { key: "units", label: "Units" },
  { key: "tenants", label: "Tenants" },
  { key: "leases", label: "Leases" },
  { key: "payments", label: "Payments" },
  { key: "invoices", label: "Invoices" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
];

type InviteState = "idle" | "sending" | "sent" | "error";

export default function Caretakers() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [rows, setRows] = useState<Caretaker[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteState, setInviteState] = useState<InviteState>("idle");
  const [inviteTargetId, setInviteTargetId] = useState<number | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState<number | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState<Record<number, boolean>>({});
  const [permissions, setPermissions] = useState<Record<number, CaretakerPermission[]>>({});

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [caretakersRes, propertiesRes, permsRes] = await Promise.all([
      supabase.from("caretakers").select("*").eq("landlord_id", landlordId).order("created_at", { ascending: false }),
      supabase.from("properties").select("*").eq("landlord_id", landlordId).eq("is_active", true).order("name"),
      supabase.from("caretaker_permissions").select("*").eq("landlord_id", landlordId),
    ]);
    if (caretakersRes.error) toast.error(caretakersRes.error.message);
    if (propertiesRes.error) toast.error(propertiesRes.error.message);
    if (permsRes.error) toast.error(permsRes.error.message);
    setRows((caretakersRes.data ?? []) as Caretaker[]);
    setProperties((propertiesRes.data ?? []) as Property[]);
    const permMap: Record<number, CaretakerPermission[]> = {};
    for (const p of permsRes.data ?? []) {
      const cp = p as any;
      const cid = cp.caretaker_id as number;
      if (!permMap[cid]) permMap[cid] = [];
      permMap[cid].push(cp as CaretakerPermission);
    }
    setPermissions(permMap);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  const openInvite = (caretakerId?: number) => {
    setInviteTargetId(caretakerId ?? null);
    setInviteEmail(caretakerId ? (rows.find(r => r.id === caretakerId)?.email ?? "") : "");
    setInviteState("idle");
    setInviteOpen(true);
  };

  const openPermissions = (caretakerId: number) => {
    setPermissionsOpen(caretakerId);
  };

  const closePermissions = () => {
    setPermissionsOpen(null);
  };

  const sendInvite = async () => {
    if (!landlordId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { toast.error("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Invalid email address"); return; }

    // Check if caretaker already exists with this email
    const { data: existing } = await supabase
      .from("caretakers")
      .select("id")
      .eq("landlord_id", landlordId)
      .eq("email", email)
      .single();

    let caretakerId: number;
    if (existing) {
      caretakerId = existing.id;
    } else {
      // Create new caretaker record
      const name = email.split("@")[0];
      const { data, error } = await supabase
        .from("caretakers")
        .insert({ landlord_id: landlordId, name, email, is_active: true })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      caretakerId = data!.id as number;
      setRows(prev => [{ id: caretakerId, name, email, landlord_id: landlordId, is_active: true } as any, ...prev]);
    }

    setInviteTargetId(caretakerId);
    setInviteState("sending");
    try {
      const { error } = await supabase.functions.invoke("send-caretaker-invite", {
        body: { caretakerId, baseUrl: window.location.origin },
      });
      if (error) throw error;
      setInviteState("sent");
      toast.success("Invite sent successfully");
      setTimeout(() => { setInviteOpen(false); load(); }, 1500);
    } catch (e: any) {
      setInviteState("error");
      toast.error(e?.message ?? "Failed to send invite");
    }
  };

  const togglePermission = async (caretakerId: number, tabKey: string) => {
    setPermissionsLoading(prev => ({ ...prev, [caretakerId]: true }));
    const current = permissions[caretakerId] ?? [];
    const existing = current.find(p => p.tab_key === tabKey);
    const nextEnabled = !existing?.enabled;

    if (existing) {
      const { error } = await supabase
        .from("caretaker_permissions")
        .update({ enabled: nextEnabled })
        .eq("id", existing.id);
      if (error) { toast.error(error.message); setPermissionsLoading(prev => ({ ...prev, [caretakerId]: false })); return; }
    } else {
      const { error } = await supabase
        .from("caretaker_permissions")
        .insert({ caretaker_id: caretakerId, tab_key: tabKey, enabled: nextEnabled });
      if (error) { toast.error(error.message); setPermissionsLoading(prev => ({ ...prev, [caretakerId]: false })); return; }
    }

    setPermissions(prev => ({
      ...prev,
      [caretakerId]: existing
        ? prev[caretakerId].map(p => p.tab_key === tabKey ? { ...p, enabled: nextEnabled } : p)
        : [...(prev[caretakerId] ?? []), { id: Date.now(), caretaker_id: caretakerId, tab_key: tabKey, enabled: nextEnabled, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as CaretakerPermission],
    }));
    setPermissionsLoading(prev => ({ ...prev, [caretakerId]: false }));
  };

  const deleteCaretaker = async (c: Caretaker) => {
    if (!confirm(`Delete ${c.name}? Their property assignments and permissions will be removed too.`)) return;
    const { error } = await supabase.from("caretakers").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Caretaker deleted"); load(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); sendInvite(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Caretakers</h2>
            <p className="text-muted-foreground text-sm">Manage caretaker accounts and their access.</p>
          </div>
          <Button onClick={() => openInvite()}>
            <Plus className="h-4 w-4 mr-1" /> Invite Caretaker
          </Button>
        </div>

        {landlordError && (
          <Card><CardContent className="py-6 text-sm text-destructive">{landlordError}</CardContent></Card>
        )}

        <Card>
          <CardContent className="p-0">
            {loading || landlordLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4"><HardHat className="h-8 w-8 text-muted-foreground" /></div>
                <h3 className="text-lg font-semibold mb-1">No caretakers yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Invite a caretaker to manage your properties.</p>
                <Button onClick={() => openInvite()}><Plus className="h-4 w-4 mr-1" /> Invite Caretaker</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => {
                    const hasAccount = !!c.auth_user_id;
                    const hasSignedIn = !!c.last_signed_in;
                    const tabs = permissions[c.id] ?? [];
                    const enabledTabs = tabs.filter(t => t.enabled);
                    const accessList = enabledTabs.map(t => ALL_TABS.find(at => at.key === t.tab_key)?.label ?? t.tab_key).join(", ") || "None";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell>
                          {hasAccount ? (
                            hasSignedIn
                              ? <span className="text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />Signed in</span>
                              : <span className="text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3 text-yellow-500" />Invited</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not invited</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{accessList}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openInvite(c.id)} title="Re-send invite">
                              <Send className="h-4 w-4" />
                            </Button>
                            {c.auth_user_id && (
                              <Button variant="ghost" size="icon" onClick={() => openPermissions(c.id)} title="Manage permissions">
                                <Settings className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteCaretaker(c)} title="Delete caretaker">
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

        {/* Permissions dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{inviteTargetId ? "Invite Caretaker" : "Add & Invite Caretaker"}</DialogTitle>
            </DialogHeader>
            {!inviteTargetId && (
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="caretaker@example.com"
                  disabled={inviteState === "sending"}
                />
              </div>
            )}
            {inviteState === "sent" ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Invite sent! The caretaker will receive an email to set up their account.</p>
              </div>
            ) : inviteState === "error" ? (
              <div className="py-6 text-center">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
                <p className="text-sm text-destructive">Failed to send invite. Please try again.</p>
              </div>
            ) : (
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteState === "sending"}>Cancel</Button>
                <Button onClick={sendInvite} disabled={inviteState === "sending" || !inviteEmail}>
                  {inviteState === "sending" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {inviteState === "sending" ? "Sending..." : "Send Invite"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Permissions management dialog */}
        <Dialog
          open={permissionsOpen !== null}
          onOpenChange={(open) => { if (!open) closePermissions(); }}
        >
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Permissions</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Select which tabs this caretaker can access.</p>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {ALL_TABS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={(permissions[permissionsOpen!] ?? []).find(p => p.tab_key === key)?.enabled ?? false}
                      onCheckedChange={() => { if (permissionsOpen) togglePermission(permissionsOpen, key); }}
                      disabled={permissionsLoading[permissionsOpen!] ?? false}
                    />
                    <Label htmlFor={`perm-${key}`} className="cursor-pointer text-sm">{label}</Label>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closePermissions}>Close</Button>
              <Button onClick={closePermissions}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
