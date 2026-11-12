import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit,
  Trash2,
  Search,
  Download,
  X,
} from "lucide-react";
import type { Expense, Property, Landlord } from "@/integrations/supabase/client";

const EXPENSE_CATEGORIES = [
  { value: "repairs_maintenance", label: "Repairs & Maintenance" },
  { value: "utilities_water", label: "Water Bill" },
  { value: "utilities_electricity", label: "Electricity (Tokens / KPLC)" },
  { value: "caretaker_salary", label: "Caretaker Salary" },
  { value: "garbage_collection", label: "Garbage Collection" },
  { value: "security", label: "Security Services" },
  { value: "taxes_rates", label: "County Rates & Taxes" },
  { value: "management_fee", label: "Management Fee" },
  { value: "other", label: "Other Operating Expenses" },
] as const;

const PAYMENT_METHODS = ["mpesa", "bank_transfer", "cash", "other"];

function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    property_id: "" as string | number,
    category: "other" as string,
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    payee: "",
    payment_method: "mpesa",
    reference_number: "",
    notes: "",
  });

  // KPI state
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [topCategory, setTopCategory] = useState<string>("");
  const [netOperatingIncome, setNetOperatingIncome] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load landlord info
      const { data: landlords } = await supabase
        .from("landlords")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (landlords) {
        setLandlord(landlords as Landlord);
      }

      // Load properties
      const { data: props } = await supabase
        .from("properties")
        .select("*")
        .order("name");
      if (props) setProperties(props as Property[]);

      // Load expenses
      const { data: exps } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (exps) setExpenses(exps as Expense[]);

      // Calculate KPIs
      calculateKPIs(exps as Expense[], landlords?.id);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load expenses data");
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = (data: Expense[], landlordId?: number) => {
    if (!landlordId) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthExpenses = data.filter((e) => {
      const date = new Date(e.expense_date);
      return date >= monthStart && date <= monthEnd && e.landlord_id === landlordId;
    });

    // Total this month
    const total = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    setTotalThisMonth(total);

    // Top category
    const categoryTotals: Record<string, number> = {};
    monthExpenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
    });
    const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    setTopCategory(topCat ? EXPENSE_CATEGORIES.find((c) => c.value === topCat[0])?.label || topCat[0] : "-");

    // Net operating income (simplified: just show total expenses for now)
    setNetOperatingIncome(-total);
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      !searchTerm ||
      (e.payee?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.notes?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesProperty = !filterPropertyId || e.property_id === Number(filterPropertyId);
    const matchesCategory = !filterCategory || e.category === filterCategory;

    const matchesDateRange =
      (!dateRange.start || e.expense_date >= dateRange.start) &&
      (!dateRange.end || e.expense_date <= dateRange.end);

    return matchesSearch && matchesProperty && matchesCategory && matchesDateRange;
  });

  const openAddDialog = () => {
    setEditingExpense(null);
    setFormData({
      property_id: "",
      category: "other",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      payee: "",
      payment_method: "mpesa",
      reference_number: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      property_id: expense.property_id?.toString() || "",
      category: expense.category,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      payee: expense.payee || "",
      payment_method: expense.payment_method,
      reference_number: expense.reference_number || "",
      notes: expense.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const expenseData = {
        landlord_id: landlord?.id,
        property_id: formData.property_id ? Number(formData.property_id) : null,
        category: formData.category as Expense["category"],
        amount,
        expense_date: formData.expense_date,
        payee: formData.payee || null,
        payment_method: formData.payment_method,
        reference_number: formData.reference_number || null,
        notes: formData.notes || null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update(expenseData)
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast.success("Expense updated successfully");
      } else {
        const { error } = await supabase.from("expenses").insert(expenseData);
        if (error) throw error;
        toast.success("Expense added successfully");
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save expense");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast.success("Expense deleted successfully");
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete expense");
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Category", "Amount (KES)", "Property", "Payee", "Payment Method", "Reference", "Notes"];
    const rows = filteredExpenses.map((e) => [
      e.expense_date,
      EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label || e.category,
      e.amount.toString(),
      properties.find((p) => p.id === e.property_id)?.name || "-",
      e.payee || "-",
      e.payment_method,
      e.reference_number || "-",
      e.notes || "-",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Expenses exported to CSV");
  };

  const getCategoryLabel = (category: string) => {
    return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "mpesa": return "M-Pesa";
      case "bank_transfer": return "Bank Transfer";
      case "cash": return "Cash";
      case "other": return "Other";
      default: return method;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage property operating expenses and maintenance costs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses (This Month)</p>
                <p className="text-2xl font-bold text-destructive">
                  KES {formatKES(totalThisMonth)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Expense Category</p>
                <p className="text-2xl font-bold">{topCategory}</p>
              </div>
              <Wallet className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Operating Income</p>
                <p className={`text-2xl font-bold ${netOperatingIncome >= 0 ? "text-success" : "text-destructive"}`}>
                  KES {formatKES(Math.abs(netOperatingIncome))}
                </p>
              </div>
              {netOperatingIncome >= 0 ? (
                <TrendingUp className="h-8 w-8 text-success" />
              ) : (
                <TrendingDown className="h-8 w-8 text-destructive" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payee or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">To</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-[140px]"
              />
            </div>

            {(searchTerm || filterPropertyId || filterCategory || dateRange.start || dateRange.end) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterPropertyId("");
                  setFilterCategory("");
                  setDateRange({ start: "", end: "" });
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No expense records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.expense_date}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary">
                        {getCategoryLabel(expense.category)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-destructive">
                      KES {formatKES(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      {properties.find((p) => p.id === expense.property_id)?.name || "-"}
                    </TableCell>
                    <TableCell>{expense.payee || "-"}</TableCell>
                    <TableCell>{getPaymentMethodLabel(expense.payment_method)}</TableCell>
                    <TableCell>{expense.reference_number || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense-property">Property</Label>
                <Select
                  value={formData.property_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, property_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (General / Portfolio Expense)</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount (KES)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-date">Expense Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-payee">Payee</Label>
              <Input
                id="expense-payee"
                value={formData.payee}
                onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                placeholder="e.g. Kenya Power, Nairobi Water, Hardware"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense-payment-method">Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {getPaymentMethodLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-reference">Reference / Transaction ID</Label>
                <Input
                  id="expense-reference"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Transaction ID / Receipt number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-notes">Notes</Label>
              <Input
                id="expense-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingExpense ? "Save Changes" : "Add Expense"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}