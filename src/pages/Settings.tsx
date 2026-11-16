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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useLandlord } from "@/hooks/useLandlord";
import { supabase, type Landlord } from "@/integrations/supabase/client";
import { signOut, updatePassword } from "@/lib/supabase-auth";
import { ExternalLink, Mail, Copy, Building2, Info, Loader2, Lock, LogOut, Save, Settings as SettingsIcon, Smartphone, User, Wallet, MessageCircle, CreditCard } from "lucide-react";
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
  const [, navigate] = useLocation();

  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [hasPayColumns, setHasPayColumns] = useState(true);

  // WhatsApp & M-Pesa integration settings
  const [waMode, setWaMode] = useState<"shared" | "custom" | "disabled">("shared");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waVerifyToken, setWaVerifyToken] = useState("");
  const [mpesaEnv, setMpesaEnv] = useState<"sandbox" | "production">("sandbox");
  const [mpesaPaybill, setMpesaPaybill] = useState("");
  const [mpesaPasskey, setMpesaPasskey] = useState("");
  const [mpesaConsumerKey, setMpesaConsumerKey] = useState("");
  const [mpesaConsumerSecret, setMpesaConsumerSecret] = useState("");

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
      // Check if payment columns exist by checking for undefined fields
      if ("mpesa_paybill" in row) {
        setPay({
          mpesa_paybill: (row.mpesa_paybill as string | null) ?? "",
          payment_instructions: (row.payment_instructions as string | null) ?? "",
        });
        setHasPayColumns(true);
      } else {
        setHasPayColumns(false);
      }

      // Load WhatsApp & M-Pesa integration settings
      setWaMode((row.whatsapp_mode as "shared" | "custom" | "disabled") ?? "shared");
      setWaPhoneId(row.whatsapp_phone_number_id ?? "");
      setWaVerifyToken(row.whatsapp_verify_token ?? "");
      setMpesaEnv((row.mpesa_environment as "sandbox" | "production") ?? "sandbox");
      setMpesaPaybill(row.mpesa_paybill ?? "");
      setMpesaPasskey(row.mpesa_passkey ?? "");
      setMpesaConsumerKey(row.mpesa_consumer_key ?? "");
      setMpesaConsumerSecret(row.mpesa_consumer_secret ?? "");
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

  const saveIntegration = async () => {
    if (!landlordId) return;
    setSavingIntegration(true);
    const { error } = await supabase
      .from("landlords")
      .update({
        whatsapp_mode: waMode,
        whatsapp_phone_number_id: waPhoneId.trim() || null,
        whatsapp_verify_token: waVerifyToken.trim() || null,
        mpesa_environment: mpesaEnv,
        mpesa_paybill: mpesaPaybill.trim() || null,
        mpesa_passkey: mpesaPasskey.trim() || null,
        mpesa_consumer_key: mpesaConsumerKey.trim() || null,
        mpesa_consumer_secret: mpesaConsumerSecret.trim() || null,
      })
      .eq("id", landlordId);
    setSavingIntegration(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Integration settings saved");
  };

  const copyWebhookUrl = () => {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/^https?:\/\//, "");
    const webhookUrl = `https://${projectUrl}/functions/v1/whatsapp-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
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
            Manage your business profile and account settings.
          </p>
        </div>

        {landlordError && (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{landlordError}</CardContent>
          </Card>
        )}

        {/* ─── Business profile ───────────────────────────────── */}
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

        {/* ─── Payment details ───────────────────────────────── */}
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

        {/* ─── Integrations & Automations ───────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-primary" />
              Integrations & Automations
            </CardTitle>
            <CardDescription>
              Connect WhatsApp tenant self-service and M-Pesa payment automation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAll ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* WhatsApp Bot Configuration */}
                <div className="space-y-3">
                  <Label>WhatsApp Platform</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={waMode !== "disabled"}
                        onCheckedChange={(checked) => setWaMode(checked ? "shared" : "disabled")}
                      />
                      <span className="text-sm">
                        {waMode === "shared"
                          ? "Shared Platform Number (Default)"
                          : "Custom WhatsApp Business API"}
                      </span>
                    </div>
                    {waMode === "custom" && (
                      <div className="grid gap-2 mt-2">
                        <div className="grid gap-2">
                          <Label htmlFor="wa-phone-id">WhatsApp Phone Number ID</Label>
                          <Input
                            id="wa-phone-id"
                            value={waPhoneId}
                            onChange={(e) => setWaPhoneId(e.target.value)}
                            placeholder="e.g. 123456789012345"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="wa-verify-token">Webhook Verify Token</Label>
                          <Input
                            id="wa-verify-token"
                            value={waVerifyToken}
                            onChange={(e) => setWaVerifyToken(e.target.value)}
                            placeholder="Your webhook verify token"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* M-Pesa Daraja Configuration */}
                <div className="space-y-3 border-t pt-3">
                  <Label>M-Pesa Daraja</Label>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mpesa-env">Environment</Label>
                      <Select value={mpesaEnv} onValueChange={(v) => setMpesaEnv(v as "sandbox" | "production")}>
                        <SelectTrigger id="mpesa-env">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Development)</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {waMode !== "disabled" && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="mpesa-paybill">Paybill / Till Number</Label>
                          <Input
                            id="mpesa-paybill"
                            value={mpesaPaybill}
                            onChange={(e) => setMpesaPaybill(e.target.value)}
                            placeholder="e.g. 178630"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="mpesa-passkey">Passkey</Label>
                          <Input
                            id="mpesa-passkey"
                            type={mpesaEnv === "sandbox" ? "text" : "password"}
                            value={mpesaPasskey}
                            onChange={(e) => setMpesaPasskey(e.target.value)}
                            placeholder="Daraja passkey"
                          />
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label htmlFor="mpesa-key">Consumer Key</Label>
                            <Input
                              id="mpesa-key"
                              type="password"
                              value={mpesaConsumerKey}
                              onChange={(e) => setMpesaConsumerKey(e.target.value)}
                              placeholder="Daraja consumer key"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="mpesa-secret">Consumer Secret</Label>
                            <Input
                              id="mpesa-secret"
                              type="password"
                              value={mpesaConsumerSecret}
                              onChange={(e) => setMpesaConsumerSecret(e.target.value)}
                              placeholder="Daraja consumer secret"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Webhook URL display for custom mode */}
                {waMode === "custom" && (
                  <div className="grid gap-2">
                    <Label>Webhook Callback URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`${import.meta.env.VITE_SUPABASE_URL?.replace(/^https?:\/\//, "")}/functions/v1/whatsapp-webhook`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyWebhookUrl}
                        title="Copy webhook URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add this URL to your Meta WhatsApp app webhook settings.
                    </p>
                  </div>
                )}

                <Button onClick={saveIntegration} disabled={savingIntegration || !landlordId}>
                  {savingIntegration ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save integration settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Subscription ─────────────────────────────────── */}
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

        {/* ─── Account ──────────────────────────────────────── */}
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

        {/* ─── Security ─────────────────────────────────────── */}
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