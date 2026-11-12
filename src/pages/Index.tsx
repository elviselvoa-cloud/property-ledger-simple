import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, DoorOpen, Users, Receipt, TrendingUp, AlertCircle,
  Plus, FileSignature, Wallet, FileText, ArrowRight, Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLandlord } from "@/hooks/useLandlord";
import { supabase, type Landlord } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import OnboardingWizard from "@/components/OnboardingWizard";

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  bank_transfer: "Bank",
  cash: "Cash",
  other: "Other",
};

const kes = (n: number) => `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export default function Index() {
  const { user } = useAuth();
  const { landlordId } = useLandlord();
  const [counts, setCounts] = useState({ properties: 0, units: 0, tenants: 0, invoices: 0 });
  const [revenue, setRevenue] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [landlordData, setLandlordData] = useState<Landlord | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [skipPrompt, setSkipPrompt] = useState(false);

  useEffect(() => {
    if (!landlordId) return;

    // Initialize showWizard based on onboarding status
    supabase
      .from("landlords")
      .select("onboarding_status")
      .eq("id", landlordId)
      .maybeSingle()
      .then(({ data }) => {
        const ld = data as Landlord | null;
        setLandlordData(ld);
        if (ld?.onboarding_status !== "completed") {
          setShowWizard(true);
        }
      });

    const count = (table: string, extra?: (q: any) => any) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("landlord_id", landlordId);
      if (extra) q = extra(q);
      return q.then((r: { count: number | null }) => r.count ?? 0);
    };
    Promise.all([
      count("properties"),
      count("units"),
      count("tenants", (q) => q.eq("is_active", true)),
      count("rent_invoices", (q) => q.in("status", ["pending", "overdue", "partial"])),
    ]).then(([properties, units, tenants, invoices]) =>
      setCounts({ properties, units, tenants, invoices })
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    supabase
      .from("payments")
      .select("amount")
      .eq("landlord_id", landlordId)
      .gte("payment_date", monthStart)
      .then(({ data }) => setRevenue((data ?? []).reduce((s, p: any) => s + Number(p.amount), 0)));

    supabase
      .from("payments")
      .select("*")
      .eq("landlord_id", landlordId)
      .order("payment_date", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent(data ?? []));

    supabase
      .from("rent_invoices")
      .select("*")
      .eq("landlord_id", landlordId)
      .in("status", ["pending", "overdue", "partial"])
      .order("due_date", { ascending: true })
      .limit(5)
      .then(({ data }) => setAttention(data ?? []));

    supabase
      .from("tenants")
      .select("id, first_name, last_name")
      .eq("landlord_id", landlordId)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((t: any) => (map[t.id] = `${t.first_name} ${t.last_name}`));
        setTenantNames(map);
      });
  }, [landlordId]);

  const handleSkipConfirm = async () => {
    if (!landlordId) return;
    const { error } = await supabase
      .from("landlords")
      .update({ onboarding_status: "completed" })
      .eq("id", landlordId);
    if (error) return;
    setSkipPrompt(false);
    setLandlordData((d) => d ? { ...d, onboarding_status: "completed" } : null);
  };

  const handleResumeSetup = async () => {
    setShowWizard(true);
  };

  const stats = [
    { label: "Properties", value: counts.properties, icon: Building2 },
    { label: "Total Units", value: counts.units, icon: DoorOpen },
    { label: "Active Tenants", value: counts.tenants, icon: Users },
    { label: "Pending Invoices", value: counts.invoices, icon: Receipt },
  ];
  const actions = [
    { label: "Add Property", href: "/properties", icon: Plus },
    { label: "New Lease", href: "/leases", icon: FileSignature },
    { label: "Record Payment", href: "/payments", icon: Wallet },
    { label: "Generate Invoices", href: "/invoices", icon: FileText },
  ];
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const today = new Date(new Date().toDateString());
  const tenant = (id: string) => tenantNames[id] ?? "Tenant";
  const needsOnboarding = !landlordData?.onboarding_status || landlordData.onboarding_status !== "completed";

  return (
    <>
      <OnboardingWizard
        landlordId={landlordId!}
        open={showWizard}
        onOpenChange={(open) => {
          if (!open && landlordData?.onboarding_status === "completed") {
            // Already completed, close without showing banner
            setShowWizard(false);
          } else if (!open) {
            // User closed the wizard - remember they skipped it for this session
            // but keep the resume banner available
          }
          setShowWizard(open);
        }}
        onComplete={() => {
          setShowWizard(false);
          setLandlordData((d) => d ? { ...d, onboarding_status: "completed" } : null);
        }}
      />

      <DashboardLayout>
        <div className="space-y-6">
          {/* Onboarding Banner */}
          {needsOnboarding && landlordId && !skipPrompt && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <Settings className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Setup incomplete — {showWizard ? 'Complete your setup' : 'Resume Setup'}</p>
                <p className="text-xs text-muted-foreground">
                  {!showWizard ? 'Set up your business profile, property, and units to get started.' : 'Finish setting up your account to unlock all features.'}
                </p>
              </div>
              <Button size="sm" onClick={() => setShowWizard(true)}>
                {showWizard ? "Resume Setup" : "Setup now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSkipPrompt(true)}>
                Skip for now
              </Button>
            </div>
          )}

          {/* Skip confirmation */}
          {skipPrompt && landlordId && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Skip onboarding?</span>
              <Button size="sm" variant="outline" onClick={handleSkipConfirm}>
                Yes, skip
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSkipPrompt(false)}>
                Cancel
              </Button>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back, {name} 👋</h2>
            <p className="text-muted-foreground text-sm">Here's an overview of your property portfolio.</p>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {actions.map(({ label, href, icon: Icon }) => (
              <Button key={label} asChild variant="outline" className="h-auto py-3 justify-start">
                <Link href={href}>
                  <Icon className="h-4 w-4 mr-2 text-primary" />
                  {label}
                </Link>
              </Button>
            ))}
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Collected This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kes(revenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date().toLocaleString("en-KE", { month: "long", year: "numeric" })}
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-primary" />
                  Recent Payments
                </CardTitle>
                <Link href="/payments" className="text-xs text-primary inline-flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <ul className="divide-y">
                    {recent.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <div className="font-medium">{tenant(String(p.tenant_id))}</div>
                          <div className="text-xs text-muted-foreground">
                            {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                            {p.mpesa_transaction_id || p.bank_reference || p.receipt_number
                              ? ` · ${p.mpesa_transaction_id || p.bank_reference || p.receipt_number}`
                              : ""}
                            {" · "}
                            {String(p.payment_date ?? "").slice(0, 10)}
                          </div>
                        </div>
                        <div className="font-semibold">{kes(Number(p.amount))}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Needs Attention
              </CardTitle>
              <Link href="/invoices" className="text-xs text-primary inline-flex items-center gap-1">
                View invoices <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">All invoices are settled. 🎉</p>
              ) : (
                <ul className="divide-y">
                  {attention.map((inv) => {
                    const overdue = inv.status === "overdue" || new Date(inv.due_date) < today;
                    const balance = Number(inv.amount) - Number(inv.paid_amount ?? 0);
                    return (
                      <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <div className="font-medium">{tenant(String(inv.tenant_id))}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv.invoice_number} · due {String(inv.due_date).slice(0, 10)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={overdue ? "destructive" : "secondary"}>
                            {overdue ? "Overdue" : inv.status === "partial" ? "Partial" : "Pending"}
                          </Badge>
                          <span className="font-semibold">{kes(balance)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
