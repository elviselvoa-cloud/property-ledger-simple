import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useLandlord } from "@/hooks/useLandlord";
import { supabase, type Landlord } from "@/integrations/supabase/client";
import { signOut, updatePassword } from "@/lib/supabase-auth";
import {
  Building2,
  Info,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Save,
  Settings as SettingsIcon,
  Smartphone,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type OrgForm = {
  business_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
};

type PayForm = {
  mpesa_paybill: string;
  payment_instructions: string;
};

export default function Settings() {
  const { user } = useAuth();
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();
  const [navigate] = useLocation();

  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [hasPayColumns, setHasPayColumns] = useState(true);

  const [org, setOrg] = useState<OrgForm>({
    business_name: "",
    phone: "",
    address: "",
    city: "",
    country: "Kenya",
  });
  const [pay, setPay] = useState<PayForm>({ mpesa_paybill: "", payment_instructions: "" });
  const [subscription, setSubscription] = useState<Landlord | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (landlordLoading) return;
    if (!landlordId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("landlords")
        .select("*")
        .eq("id", landlordId)
        .maybeSingle();
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) return;
      const row = data as Landlord;
      setSubscription(row);
      setOrg({
        business_name: row.business_name ?? "",
        phone: row.phone ?? "",
        address: row.address ?? "",
        city: row.city ?? "",
        country: row.country ?? "Kenya",
      });
      // If the migration (06_settings.sql) has not been run yet, the
      // select("*") result simply won't contain these keys.
      if ("mpesa_paybill" in row) {
        setPay({
          mpesa_paybill: (row.mpesa_paybill as string | null) ?? "",
          payment_instructions: (row.payment_instructions as string | null) ?? "",
        });
        setHasPayColumns(true);
      } else {
        setHasPayColumns(false);
      }
    })();
  }, [landlordId, landlordLoading]);

  const saveOrg = async () => {
    if (!landlordId) return;
    if (!org.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSavingOrg(true);
    const { error } = await supabase
      .from("landlords")
      .update({
        business_name: org.business_name.trim(),
        phone: org.phone.trim() || null,
        address: org.address.trim() || null,
        city: org.city.trim() || null,
        country: org.country.trim() || null,
      })
      .eq("id", landlordId);
    setSavingOrg(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business profile saved");
  };

  const savePay = async () => {
    if (!landlordId) return;
    if (!hasPayColumns) {
      toast.error("Run supabase/sql/06_settings.sql in the Supabase SQL editor first");
      return;
    }
    setSavingPay(true);
    const { error } = await supabase
      .from("landlords")
      .update({
        mpesa_paybill: pay.mpesa_paybill.trim() || null,
        payment_instructions: pay.payment_instructions.trim() || null,
      })
      .eq("id", landlordId);
    setSavingPay(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment details saved");
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated");
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) toast.error(error.message);
    else navigate("/login");
  };

  const planLabel = subscription?.subscription_plan ?? "free";
  const statusLabel = subscription?.subscription_status ?? "active";
  const trialEnds = subscription?.trial_ends_at ? subscription.trial_ends_at.slice(0, 10) : null;

  const loadingAll = landlordLoading || loading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground text-sm">
            Manage your business profile, payment details and account.
          </p>
        </div>

        {landlordError && (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{landlordError}</CardContent>
          </Card>
        )}

        {/* ─── Business profile ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              Business profile
            </CardTitle>
            <CardDescription>
              Shown on your dashboard. This is how your business appears in Property Ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAll ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="business_name">Business name *</Label>
                    <Input
                      id="business_name"
                      value={org.business_name}
                      onChange={(e) => setOrg({ ...org, business_name: e.target.value })}
                      placeholder="e.g. Acme Properties Ltd"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={org.phone}
                      onChange={(e) => setOrg({ ...org, phone: e.target.value })}
                      placeholder="e.g. +254 7XX XXX XXX"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={org.address}
                    onChange={(e) => setOrg({ ...org, address: e.target.value })}
                    placeholder="Street / estate address"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City / town</Label>
                    <Input
                      id="city"
                      value={org.city}
                      onChange={(e) => setOrg({ ...org, city: e.target.value })}
                      placeholder="e.g. Nairobi"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={org.country}
                      onChange={(e) => setOrg({ ...org, country: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Button onClick={saveOrg} disabled={savingOrg || !landlordId}>
                    {savingOrg ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save business profile
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Payment details ──────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-primary" />
              Payment details
            </CardTitle>
            <CardDescription>
              M-Pesa details and instructions tenants should follow when paying rent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasPayColumns && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Payment settings need a small database update: run{" "}
                  <span className="font-mono text-foreground">supabase/sql/06_settings.sql</span> in
                  your Supabase SQL editor, then reload this page.
                </span>
              </div>
            )}
            {loadingAll ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="mpesa_paybill">M-Pesa Paybill / Till number</Label>
                  <Input
                    id="mpesa_paybill"
                    value={pay.mpesa_paybill}
                    onChange={(e) => setPay({ ...pay, mpesa_paybill: e.target.value })}
                    placeholder="e.g. 123456"
                    disabled={!hasPayColumns}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment_instructions">Payment instructions</Label>
                  <Textarea
                    id="payment_instructions"
                    value={pay.payment_instructions}
                    onChange={(e) => setPay({ ...pay, payment_instructions: e.target.value })}
                    placeholder={
                      "e.g. Pay via M-Pesa Paybill 123456, use the invoice number as the account number."
                    }
                    rows={3}
                    disabled={!hasPayColumns}
                  />
                </div>
                <div>
                  <Button onClick={savePay} disabled={savingPay || !landlordId || !hasPayColumns}>
                    {savingPay ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save payment details
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Subscription ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-primary" />
              Subscription
            </CardTitle>
            <CardDescription>Your current plan and billing status.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAll ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Plan:</span>
                  <Badge variant="secondary" className="capitalize">
                    {planLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={statusLabel === "active" ? "default" : "outline"} className="capitalize">
                    {statusLabel}
                  </Badge>
                </div>
                {trialEnds && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Trial ends:</span>
                    <span className="font-medium">{trialEnds}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Account ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">
                {user?.user_metadata?.full_name ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ─── Security ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-5 w-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Change your password or sign out of this device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm_password">Confirm new password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={changePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <SettingsIcon className="h-4 w-4 mr-1" />
                )}
                Update password
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
