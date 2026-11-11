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
} from "@/integrations/supabase/client";
import {
  AgingBucket,
  buildTenantLedger,
  getAgingBucket,
  invoiceBalance,
  type LedgerRow,
} from "@/lib/arrears";
import { FileSpreadsheet, Loader2, Search, Users } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  // UI states
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statementTenant, setStatementTenant] = useState<TenantSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [statementOpen, setStatementOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!landlordId) return;
    setLoading(true);
    const [invRes, payRes, tenRes, unitRes, propRes] = await Promise.all([
      supabase.from("rent_invoices").select("*").eq("landlord_id", landlordId),
      supabase.from("payments").select("*").eq("landlord_id", landlordId),
      supabase.from("tenants").select("id, first_name, last_name, phone").eq("landlord_id", landlordId),
      supabase.from("units").select("id, unit_number, property_id").eq("landlord_id", landlordId),
      supabase.from("properties").select("id, name").eq("landlord_id", landlordId),
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
    setLoading(false);
  }, [landlordId]);

  useEffect(() => {
    if (!landlordLoading) load();
  }, [landlordLoading, load]);

  // ── Derived data ──────────────────────────────────────────────

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
        // Accumulate if same tenant has multiple overdue invoices
        existing.balance += bal;
        // Keep the earliest aging bucket (most severe)
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

  // Filtered list
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

  // Unique property names for filter dropdown
  const propertyNames = useMemo(
    () => Array.from(new Set(tenantSummaries.map((s) => s.property_name))).filter(Boolean),
    [tenantSummaries]
  );

  // ── Actions ───────────────────────────────────────────────────

  const openStatement = useCallback(
    (summary: TenantSummary) => {
      const tenantInvoices = invoices.filter(
        (inv) => inv.tenant_id === summary.id && inv.status !== "cancelled"
      );
      const tenantPayments = (payments as Payment[]).filter((p) => p.tenant_id === summary.id);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Arrears &amp; Aging Report</h2>
            <p className="text-muted-foreground text-sm">
              Overview of outstanding rent balances and aging by tenant.
            </p>
          </div>
          <Button onClick={exportCSV} disabled={exporting || filtered.length === 0}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-1" />
            )}
            Export CSV
          </Button>
        </div>

        {/* Error */}
        {landlordError && (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{landlordError}</CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        {(loading || landlordLoading) ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 flex flex-col gap-1">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-7 w-28 bg-muted rounded animate-pulse mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Total Outstanding - prominent card */}
            <Card className="sm:col-span-2">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Outstanding Rent</p>
                <p className="text-3xl font-bold mt-1">KES {agingTotals.totalOutstanding.toLocaleString()}</p>
              </CardContent>
            </Card>

            {/* Aging buckets */}
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
          </>
        )}

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenant name or unit…"
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
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Arrears Table */}
        <Card>
          <CardContent className="p-0">
            {loading || landlordLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tenantSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No arrears</h3>
                <p className="text-sm text-muted-foreground">
                  All tenants are up to date. Great work!
                </p>
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
                      <TableCell className="font-medium">
                        KES {s.balance.toLocaleString()}
                      </TableCell>
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
      </div>

      {/* Tenant Statement Ledger Modal */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Tenant Statement</DialogTitle>
            <DialogDescription>
              {statementTenant?.name} · {statementTenant?.unit_label},{" "}
              {statementTenant?.property_name}
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
                      <TableCell className="text-right">
                        {row.debit > 0 ? row.debit.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.credit > 0 ? row.credit.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.balance.toLocaleString()}
                      </TableCell>
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
