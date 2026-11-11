export type AgingBucket = "current" | "1-29" | "30-59" | "60-89" | "90+";

export type LedgerInvoice = {
  id: number;
  tenant_id: number;
  invoice_number: string;
  amount: number | string;
  due_date: string;
  status: string;
  period_month: number;
  period_year: number;
};

export type LedgerPayment = {
  id: number;
  tenant_id: number;
  invoice_id: number | null;
  amount: number | string;
  payment_date: string;
  mpesa_transaction_id?: string | null;
  bank_reference?: string | null;
  receipt_number?: string | null;
};

export type LedgerRow = {
  date: string;
  type: "Charge" | "Payment";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export function invoiceBalance(invoice: Pick<LedgerInvoice, "amount"> & { paid_amount?: number | string | null }) {
  return Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount ?? 0));
}

export function getAgingBucket(
  dueDate: string,
  balance: number,
  asOf: Date = new Date(),
): AgingBucket | null {
  if (balance <= 0) return null;

  const dueTimestamp = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(dueTimestamp)) return null;
  const todayTimestamp = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const daysPastDue = Math.floor((todayTimestamp - dueTimestamp) / 86_400_000);

  if (daysPastDue <= 0) return "current";
  if (daysPastDue < 30) return "1-29";
  if (daysPastDue < 60) return "30-59";
  if (daysPastDue < 90) return "60-89";
  return "90+";
}

export function buildTenantLedger(
  tenantId: number,
  invoices: LedgerInvoice[],
  payments: LedgerPayment[],
): LedgerRow[] {
  const tenantInvoices = invoices.filter(
    (invoice) => invoice.tenant_id === tenantId && invoice.status !== "cancelled",
  );
  const invoiceById = new Map(tenantInvoices.map((invoice) => [invoice.id, invoice]));
  const entries: Array<Omit<LedgerRow, "balance"> & { sortOrder: number }> = [
    ...tenantInvoices.map((invoice) => ({
      date: invoice.due_date.slice(0, 10),
      type: "Charge" as const,
      reference: invoice.invoice_number,
      description: `Rent charge · ${invoice.period_month}/${invoice.period_year}`,
      debit: Number(invoice.amount),
      credit: 0,
      sortOrder: 0,
    })),
    ...payments
      .filter((payment) => payment.tenant_id === tenantId)
      .map((payment) => {
        const invoice = payment.invoice_id == null ? undefined : invoiceById.get(payment.invoice_id);
        const reference =
          invoice?.invoice_number ??
          payment.mpesa_transaction_id ??
          payment.bank_reference ??
          payment.receipt_number ??
          `Payment ${payment.id}`;
        return {
          date: payment.payment_date.slice(0, 10),
          type: "Payment" as const,
          reference,
          description: invoice ? `Payment received · ${invoice.invoice_number}` : "Unallocated payment received",
          debit: 0,
          credit: Number(payment.amount),
          sortOrder: 1,
        };
      }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.reference.localeCompare(b.reference));

  let runningBalance = 0;
  return entries.map(({ sortOrder: _sortOrder, ...entry }) => {
    runningBalance += entry.debit - entry.credit;
    return { ...entry, balance: runningBalance };
  });
}