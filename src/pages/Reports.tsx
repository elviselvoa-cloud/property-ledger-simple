import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLandlord } from "@/hooks/useLandlord";
import {
  supabase,
  type Property,
  type Payment,
  type RentInvoice,
  type Tenant,
  type Unit,
  type Lease,
  type Expense,
} from "@/integrations/supabase/client";
import {
  AgingBucket,
  buildTenantLedger,
  getAgingBucket,
  invoiceBalance,
  type LedgerRow,
} from "@/lib/arrears";
import {
  BarChart3,
  FileSpreadsheet,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TenantSummary = {
  id: number;
  name: string;
  phone: string;
  unit_label: string;
  property_name: string;
  balance: number;
  aging: AgingBucket | null;
  due_date: string;
};

const BUCKET_COLOR: Record<AgingBucket, "default" | "secondary" | "outline" | "destructive"> = {
  current: "default",
  "1-29": "secondary",
  "30-59": "outline",
  "60-89": "destructive",
  "90+": "destructive",
};

export default function Reports() {
  const { landlordId, loading: landlordLoading, error: landlordError } = useLandlord();

  // Data states
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // UI states - Arrears tab
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statementTenant, setStatementTenant] = useState<TenantSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [statementOpen, setStatementOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // UI states - Period filter
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString());
  const [periodMonth, setPeriodMonth] = useState("all");

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [invRes, payRes, tenRes, unitRes, propRes, leaseRes, expRes] = await Promise.all([
      supabase.from("rent_invoices").select("*").eq("landlord_id", landlordId),
      supabase.from("payments").select("*").eq("landlord_id", landlordId),
      supabase.from("tenants").select("id, first_name, last_name, phone").eq("landlord_id", landlordId),
      supabase.from("units").select("id, unit_number, property_id, status").eq("landlord_id", landlordId),
      supabase.from("properties").select("id, name").eq("landlord_id", landlordId),
      supabase.from("leases").select("*").eq("landlord_id", landlordId),
      supabase.from("expenses").select("*").eq("landlord_id", landlordId),
    ]);
    if (invRes.error) toast.error(invRes.error.message);
    else setInvoices((invRes.data ?? []) as RentInvoice[]);
    if (payRes.error) toast.error(payRes.error.message);
    else setPayments((payRes.data ?? []) as Payment[]);
    if (tenRes.error) toast.error(tenRes.error.message);
    else setTenants((tenRes.data ?? []) as Tenant[]);
    if (unitRes.error) toast.error(unitRes.error.message);
    else setUnits((unitRes.data ?? []) as Unit[]);
    if (propRes.error) toast.error(propRes.error.message);
    else setProperties((propRes.data ?? []) as Property[]);
    if (leaseRes.error) toast.error(leaseRes.error.message);
    else setLeases((leaseRes.data ?? []) as Lease[]);
    if (expRes.error) toast.error(expRes.error.message);
    else setExpenses((expRes.data ?? []) as Expense[]);
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  // ── Arrears data ───────────────────────────────────────────────

  const asOf = new Date();

  const tenantSummaryMap = useMemo(() => {
    const map = new Map<number, TenantSummary>();
    for (const inv of invoices) {
      if (["paid", "cancelled"].includes(inv.status)) continue;
      const bal = invoiceBalance(inv);
      if (bal <= 0) continue;
      const bucket = getAgingBucket(inv.due_date, bal, asOf);
      if (!bucket) continue;
      const tenant = tenants.find((t) => t.id === inv.tenant_id);
      const unit = units.find((u) => u.id === inv.unit_id);
      const property = unit ? properties.find((p) => p.id === unit.property_id) : null;
      const key = inv.tenant_id;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: inv.tenant_id,
          name: tenant ? `${tenant.first_name} ${tenant.last_name}` : "—",
          phone: tenant?.phone ?? "—",
          unit_label: unit?.unit_number ?? "—",
          property_name: property?.name ?? "—",
          balance: bal,
          aging: bucket,
          due_date: inv.due_date.slice(0, 10),
        });
      } else {
        existing.balance += bal;
        const severity: Record<string, number> = { current: 0, "1-29": 1, "30-59": 2, "60-89": 3, "90+": 4 };
        if ((severity[bucket] ?? 0) > (severity[existing.aging!] ?? 0)) {
          existing.aging = bucket;
        }
      }
    }
    return map;
  }, [invoices, tenants, units, properties, asOf]);

  const tenantSummaries = Array.from(tenantSummaryMap.values());

  const agingTotals = useMemo(() => {
    const buckets: Record<string, number> = { current: 0, "1-29": 0, "30-59": 0, "60-89": 0, "90+": 0 };
    let totalOutstanding = 0;
    for (const s of tenantSummaries) {
      totalOutstanding += s.balance;
      if (s.aging && s.aging !== "current") {
        buckets[s.aging] = (buckets[s.aging] ?? 0) + s.balance;
      } else if (s.aging === "current") {
        buckets.current = (buckets.current ?? 0) + s.balance;
      }
    }
    return { totalOutstanding, buckets };
  }, [tenantSummaries]);

  const filtered = useMemo(() => {
    let list = tenantSummaries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.unit_label.toLowerCase().includes(q)
      );
    }
    if (propertyFilter !== "all") {
      list = list.filter((s) => s.property_name === propertyFilter);
    }
    return list;
  }, [tenantSummaries, search, propertyFilter]);

  const propertyNames = useMemo(
    () => Array.from(new Set(tenantSummaries.map((s) => s.property_name))).filter(Boolean),
    [tenantSummaries]
  );

  const openStatement = useCallback(
    (summary: TenantSummary) => {
      const tenantInvoices = invoices.filter(
        (inv) => inv.tenant_id === summary.id && inv.status !== "cancelled"
      );
      const tenantPayments = payments.filter((p) => p.tenant_id === summary.id);
      const rows = buildTenantLedger(summary.id, tenantInvoices, tenantPayments);
      setLedger(rows);
      setStatementTenant(summary);
      setStatementOpen(true);
    },
    [invoices, payments]
  );

  const exportCSV = useCallback(() => {
    if (filtered.length === 0) {
      toast.info("No data to export");
      return;
    }
    setExporting(true);
    try {
      const headers = ["Tenant Name", "Phone", "Unit", "Property", "Total Balance", "Aging"];
      const rows = filtered.map((s) => [
        s.name,
        s.phone,
        s.unit_label,
        s.property_name,
        s.balance.toString(),
        s.aging ?? "current",
      ]);
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arrears_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  }, [filtered]);

  // ── Financial period filtering ────────────────────────────────

  const yearNum = parseInt(periodYear, 10);
  const yearStart = new Date(yearNum, 0, 1);
  const yearEnd = new Date(yearNum, 11, 31);
  const monthStart = periodMonth === "all" ? undefined : new Date(yearNum, parseInt(periodMonth, 10), 1);
  const monthEnd = periodMonth === "all"
    ? yearEnd
    : new Date(yearNum, parseInt(periodMonth, 10) + 1, 0);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const d = new Date(inv.created_at);
      if (isNaN(d.getTime())) return false;
      const inYear = d.getFullYear() === yearNum;
      if (periodMonth === "all") return inYear;
      const inMonth = d.getMonth() === parseInt(periodMonth, 10);
      return inYear && inMonth;
    });
  }, [invoices, periodYear, periodMonth, yearStart, yearEnd, monthStart, monthEnd]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const d = new Date(p.created_at);
      if (isNaN(d.getTime())) return false;
      const inYear = d.getFullYear() === yearNum;
      if (periodMonth === "all") return inYear;
      const inMonth = d.getMonth() === parseInt(periodMonth, 10);
      return inYear && inMonth;
    });
  }, [payments, periodYear, periodMonth, yearStart, yearEnd, monthStart, monthEnd]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.expense_date);
      if (isNaN(d.getTime())) return false;
      const inYear = d.getFullYear() === yearNum;
      if (periodMonth === "all") return inYear;
      const inMonth = d.getMonth() === parseInt(periodMonth, 10);
      return inYear && inMonth;
    });
  }, [expenses, periodYear, periodMonth, yearStart, yearEnd, monthStart, monthEnd]);

  // ── Financial Summary ─────────────────────────────────────────

  const financialSummary = useMemo(() => {
    const totalIncome = filteredInvoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
    const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const netProfit = totalPaid - totalExpenses;
    return { totalIncome, totalPaid, totalExpenses, netProfit };
  }, [filteredInvoices, filteredPayments, filteredExpenses]);

  // ── Occupancy Metrics ──────────────────────────────────────────

  const occupancyMetrics = useMemo(() => {
    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === "occupied").length;
    const vacantUnits = units.filter((u) => u.status === "vacant").length;
    const maintenanceUnits = units.filter((u) => u.status === "maintenance").length;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    return {
      total: totalUnits,
      occupied: occupiedUnits,
      vacant: vacantUnits,
      maintenance: maintenanceUnits,
      occupancyRate,
    };
  }, [units]);

  const monthlyOccupancy = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const totalUnits = units.length;
    return months.map((_, i) => {
      const activeLeases = leases.filter((l) => {
        const start = l.start_date ? new Date(l.start_date) : new Date(0);
        const end = l.end_date ? new Date(l.end_date) : new Date(9999, 11, 31);
        const monthStartD = new Date(yearNum, i, 1);
        const monthEndD = new Date(yearNum, i + 1, 0);
        return l.status === "active" && start <= monthEndD && end >= monthStartD;
      });
      const occupiedByUnit = new Set(activeLeases.map((l) => l.unit_id));
      const rate = totalUnits > 0 ? Math.round((occupiedByUnit.size / totalUnits) * 100) : 0;
      return { label: months[i], rate };
    });
  }, [leases, units, yearNum]);

  // ── Collection Performance ────────────────────────────────────

  const collectionPerformance = useMemo(() => {
    const paidInvoices = filteredInvoices.filter((inv) => inv.status === "paid");
    const unpaidInvoices = filteredInvoices.filter((inv) => inv.status !== "paid");
    const collectedAmount = paidInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount ?? inv.amount ?? 0), 0);
    const totalBilled = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
    const collectionRate = (collectedAmount + totalBilled) > 0
      ? Math.round((collectedAmount / (collectedAmount + totalBilled)) * 100)
      : 100;
    return {
      billed: collectedAmount + totalBilled,
      collected: collectedAmount,
      outstanding: totalBilled,
      collectionRate,
      paidCount: paidInvoices.length,
      pendingCount: unpaidInvoices.length,
    };
  }, [filteredInvoices]);

  if (landlordLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (landlordError) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{landlordError}</CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
            <p className="text-muted-foreground text-sm">
              Financial summaries and operational insights for your portfolio.
            </p>
          </div>
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <Select value={periodYear} onValueChange={setPeriodYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => String(2021 + i)).map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodMonth} onValueChange={setPeriodMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="arrears" className="space-y-4">
          <TabsList>
            <TabsTrigger value="arrears" className="gap-2">
              <Users className="h-4 w-4" />
              Tenant Arrears
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-2">
              <Wallet className="h-4 w-4" />
              Income vs Expenses
            </TabsTrigger>
            <TabsTrigger value="occupancy" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Occupancy Rate
            </TabsTrigger>
            <TabsTrigger value="collection" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Collection Perf.
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Tenant Arrears ──────────────────────────── */}
          <TabsContent value="arrears">
            <div className="grid gap-4 sm:grid-cols-5">
              <Card className="sm:col-span-2">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-3xl font-bold mt-1">KES {agingTotals.totalOutstanding.toLocaleString()}</p>
                </CardContent>
              </Card>
              {(
                [
                  { label: "Current", key: "current", color: "text-green-600 dark:text-green-400" },
                  { label: "1-29 days", key: "1-29", color: "text-yellow-600 dark:text-yellow-400" },
                  { label: "30-59 days", key: "30-59", color: "text-orange-600 dark:text-orange-400" },
                  { label: "60-89 days", key: "60-89", color: "text-red-500 dark:text-red-400" },
                  { label: "90+ days", key: "90+", color: "text-red-700 dark:text-red-300" },
                ] as const
              ).map(({ label, key, color }) => (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${color}`}>
                      KES {(agingTotals.buckets[key] ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenant or unit…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All properties</SelectItem>
                  {propertyNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportCSV} disabled={exporting || filtered.length === 0}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                )}
                Export CSV
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {tenantSummaries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No arrears</h3>
                    <p className="text-sm text-muted-foreground">All tenants are up to date.</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <h3 className="text-lg font-semibold mb-1">No matches</h3>
                    <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Total Balance</TableHead>
                        <TableHead>Aging</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-muted-foreground">{s.phone}</TableCell>
                          <TableCell className="text-muted-foreground">{s.unit_label}</TableCell>
                          <TableCell className="text-muted-foreground">{s.property_name}</TableCell>
                          <TableCell className="font-medium">KES {s.balance.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={BUCKET_COLOR[s.aging!] ?? "default"} className="capitalize">
                              {s.aging ?? "current"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{s.due_date}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openStatement(s)}
                            >
                              View Statement
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab 2: Income vs Expenses ─────────────────────── */}
          <TabsContent value="cashflow">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Billed</p>
                  <p className="text-2xl font-bold mt-1">
                    KES {financialSummary.totalIncome.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Payments Received</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    KES {financialSummary.totalPaid.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-500 mt-1">
                    KES {financialSummary.totalExpenses.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${financialSummary.netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                    KES {financialSummary.netProfit.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly breakdown chart (simple table) */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Billed</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                      return months.map((_, i) => {
                        const mStart = new Date(yearNum, i, 1);
                        const mEnd = new Date(yearNum, i + 1, 0);
                        const billed = filteredInvoices
                          .filter((inv) => {
                            const d = new Date(inv.created_at);
                            return d >= mStart && d <= mEnd;
                          })
                          .reduce((s, inv) => s + Number(inv.amount), 0);
                        const collected = filteredPayments
                          .filter((p) => {
                            const d = new Date(p.created_at);
                            return d >= mStart && d <= mEnd;
                          })
                          .reduce((s, p) => s + Number(p.amount), 0);
                        const exp = filteredExpenses
                          .filter((e) => {
                            const d = new Date(e.expense_date);
                            return d >= mStart && d <= mEnd;
                          })
                          .reduce((s, e) => s + Number(e.amount), 0);
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{months[i]}</TableCell>
                            <TableCell className="text-right">KES {billed.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-green-600">KES {collected.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-red-500">KES {exp.toLocaleString()}</TableCell>
                            <TableCell className={`text-right font-bold ${(collected - exp) >= 0 ? "text-green-600" : "text-red-500"}`}>
                              KES {(collected - exp).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab 3: Occupancy Rate ────────────────────────── */}
          <TabsContent value="occupancy">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Units</p>
                  <p className="text-2xl font-bold mt-1">{occupancyMetrics.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Occupied</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {occupancyMetrics.occupied}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Vacant</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {occupancyMetrics.vacant}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                  <p className={`text-2xl font-bold mt-1 ${occupancyMetrics.occupancyRate >= 80 ? "text-green-600" : occupancyMetrics.occupancyRate >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                    {occupancyMetrics.occupancyRate}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly occupancy trend */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-base font-semibold mb-4">Monthly Occupancy Trend ({yearNum})</h3>
                <div className="space-y-3">
                  {monthlyOccupancy.map((m) => (
                    <div key={m.label} className="flex items-center gap-3">
                      <span className="text-sm w-10 text-muted-foreground shrink-0">{m.label}</span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            m.rate >= 80 ? "bg-green-500" : m.rate >= 50 ? "bg-yellow-500" : "bg-red-400"
                          }`}
                          style={{ width: `${m.rate}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono w-12 text-right">{m.rate}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Unit detail */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((u) => {
                      const prop = properties.find((p) => p.id === u.property_id);
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="text-muted-foreground">{prop?.name ?? "—"}</TableCell>
                          <TableCell className="font-medium">{u.unit_number}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                u.status === "occupied" ? "default"
                                  : u.status === "vacant" ? "outline"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {u.status}
                            </Badge>
                          </TableCell>
                          <TableCell>KES {Number(u.rent_amount ?? 0).toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab 4: Collection Performance ────────────────── */}
          <TabsContent value="collection">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Invoices Billed</p>
                  <p className="text-2xl font-bold mt-1">{collectionPerformance.paidCount + collectionPerformance.pendingCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Fully Collected</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{collectionPerformance.paidCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Pending / Partial</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{collectionPerformance.pendingCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Collection Rate</p>
                  <p className={`text-2xl font-bold mt-1 ${collectionPerformance.collectionRate >= 90 ? "text-green-600" : collectionPerformance.collectionRate >= 70 ? "text-yellow-600" : "text-red-500"}`}>
                    {collectionPerformance.collectionRate}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Visual bar for collection rate */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-base font-semibold mb-4">Collection Rate Overview</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        collectionPerformance.collectionRate >= 90 ? "bg-green-500"
                          : collectionPerformance.collectionRate >= 70 ? "bg-yellow-500"
                          : "bg-red-400"
                      }`}
                      style={{ width: `${Math.min(100, collectionPerformance.collectionRate)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono">{collectionPerformance.collectionRate}%</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Collected: </span>
                    <span className="font-mono font-semibold text-green-600">
                      KES {collectionPerformance.collected.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Outstanding: </span>
                    <span className="font-mono font-semibold text-red-500">
                      KES {collectionPerformance.outstanding.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unpaid invoices table */}
            <Card>
              <CardContent className="p-0">
                {collectionPerformance.pendingCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <ChevronRight className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">All Invoices Paid</h3>
                    <p className="text-sm text-muted-foreground">
                      No pending or partially paid invoices in this period.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices
                        .filter((inv) => inv.status !== "paid")
                        .sort((a, b) => new Date(b.due_date ?? 0).getTime() - new Date(a.due_date ?? 0).getTime())
                        .map((inv) => {
                          const tenant = tenants.find((t) => t.id === inv.tenant_id);
                          const unit = units.find((u) => u.id === inv.unit_id);
                          const balance = Math.max(0, Number(inv.amount) - Number(inv.paid_amount ?? 0));
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="text-muted-foreground">{(inv.created_at || inv.created_at)?.slice(0, 10)}</TableCell>
                              <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                              <TableCell className="font-mono">KES {Number(inv.amount).toLocaleString()}</TableCell>
                              <TableCell className="font-mono text-green-600">KES {Number(inv.paid_amount ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="font-mono font-semibold">{balance > 0 ? `KES ${balance.toLocaleString()}` : "—"}</TableCell>
                              <TableCell>
                                <Badge variant={inv.status === "overdue" ? "destructive" : "secondary"} className="capitalize">
                                  {inv.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tenant Statement Modal */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Tenant Statement</DialogTitle>
            <DialogDescription>
              {statementTenant?.name} · {statementTenant?.unit_label}, {statementTenant?.property_name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No transactions found for this tenant.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{row.date}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === "Charge" ? "secondary" : "default"} className="capitalize">
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                      <TableCell className="text-muted-foreground">{row.description}</TableCell>
                      <TableCell className="text-right">{row.debit > 0 ? row.debit.toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right">{row.credit > 0 ? row.credit.toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{row.balance.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
