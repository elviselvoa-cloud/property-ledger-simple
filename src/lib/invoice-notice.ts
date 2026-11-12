import type {
  Landlord, Property, RentInvoice, Tenant, Unit,
} from "@/integrations/supabase/client";
import { normalizePhone } from "./phone";

export type InvoiceNoticeData = {
  invoiceNumber: string;
  landlordName: string;
  landlordPhone?: string | null;
  tenantName: string;
  tenantPhone?: string | null;
  unitLabel?: string | null;
  period: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  paybill?: string | null;
  till?: string | null;
  paymentInstructions?: string | null;
  notes?: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const invoicePeriodLabel = (month: number, year: number) =>
  `${MONTHS[month - 1] ?? month} ${year}`;

const formatKES = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function buildInvoiceWhatsAppMessage(d: InvoiceNoticeData): string {
  const lines: string[] = [];
  lines.push(`*RENT DEMAND — ${d.invoiceNumber}*`);
  lines.push("");
  lines.push(`Dear ${d.tenantName},`);
  lines.push("");
  lines.push("This is a reminder regarding your rent invoice:");
  lines.push(`*Unit:* ${d.unitLabel ?? "—"}`);
  lines.push(`*Billing Period:* ${d.period}`);
  lines.push(`*Due Date:* ${d.dueDate}`);
  lines.push(`*Total Amount:* ${formatKES(d.amount)}`);
  if (d.balanceDue < d.amount) {
    lines.push(`*Paid:* ${formatKES(d.amount - d.balanceDue)}`);
  }
  lines.push(`*Balance Due:* ${formatKES(d.balanceDue)}`);
  if (d.notes) {
    lines.push("");
    lines.push(`Notes: ${d.notes}`);
  }
  lines.push("");
  lines.push("*Payment Instructions:*");
  if (d.paybill) lines.push(`Paybill: ${d.paybill}`);
  if (d.till) lines.push(`Till Number: ${d.till}`);
  if (d.paymentInstructions) lines.push(d.paymentInstructions);
  lines.push("");
  lines.push("Kindly remit payment before the due date.");
  lines.push(`— ${d.landlordName}`);
  return lines.join("\n");
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildInvoiceHtml(d: InvoiceNoticeData): string {
  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`
      : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(d.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a1a; background: #f5f5f5; padding: 24px; }
  .invoice { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 32px 30px; }
  h1 { font-size: 20px; letter-spacing: 3px; text-align: center; margin-bottom: 2px; }
  .biz { text-align: center; font-weight: 700; font-size: 16px; }
  .biz-tel { text-align: center; color: #555; font-size: 12px; }
  .meta { text-align: center; color: #555; font-size: 12px; margin-bottom: 20px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 16px 0; }
  .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 4px 0; }
  .row span:first-child { color: #666; }
  .row span:last-child { text-align: right; font-weight: 500; }
  .amount-block { text-align: center; margin: 18px 0; }
  .amount-label { font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .amount-val { font-size: 32px; font-weight: 800; }
  .balance-row { display: flex; justify-content: center; gap: 24px; font-size: 13px; margin-top: 6px; }
  .paid { color: #16a34a; }
  .note { font-size: 12px; color: #555; white-space: pre-line; margin-top: 12px; }
  .pay-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-top: 14px; font-size: 13px; }
  .pay-info strong { display: block; margin-bottom: 4px; }
  .footer { text-align: center; color: #888; font-size: 11px; margin-top: 20px; }
  @media print { body { background: #fff; padding: 0; } .invoice { border: none; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="invoice">
    <h1>INVOICE</h1>
    <div class="biz">${escapeHtml(d.landlordName)}</div>
    ${d.landlordPhone ? `<div class="biz-tel">Tel: ${escapeHtml(d.landlordPhone)}</div>` : ""}
    <div class="meta">${escapeHtml(d.invoiceNumber)}</div>
    <hr />
    ${row("Bill To", d.tenantName)}
    ${row("Unit", d.unitLabel)}
    ${row("Period", d.period)}
    ${row("Due Date", d.dueDate)}
    <hr />
    <div class="amount-block">
      <div class="amount-label">Amount Due</div>
      <div class="amount-val">${escapeHtml(formatKES(d.balanceDue))}</div>
      ${d.balanceDue < d.amount
        ? `<div class="balance-row">
            <span>Total: ${escapeHtml(formatKES(d.amount))}</span>
            <span class="paid">Paid: ${escapeHtml(formatKES(d.amount - d.balanceDue))}</span>
          </div>`
        : ""}
    </div>
    ${d.notes ? `<p class="note">${escapeHtml(d.notes)}</p>` : ""}
    ${(d.paybill || d.till || d.paymentInstructions)
      ? `<div class="pay-info">
          <strong>Payment Instructions</strong>
          ${d.paybill ? `Paybill: ${escapeHtml(d.paybill)}<br />` : ""}
          ${d.till ? `Till Number: ${escapeHtml(d.till)}<br />` : ""}
          ${d.paymentInstructions ? escapeHtml(d.paymentInstructions) : ""}
        </div>`
      : ""}
    <p class="footer">Thank you for your timely payment.</p>
  </div>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 250); });</script>
</body>
</html>`;
}

export function printInvoice(d: InvoiceNoticeData): boolean {
  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) return false;
  win.document.write(buildInvoiceHtml(d));
  win.document.close();
  win.focus();
  return true;
}

export function shareInvoiceOnWhatsApp(d: InvoiceNoticeData): boolean {
  const text = buildInvoiceWhatsAppMessage(d);
  const phone = normalizePhone(d.tenantPhone);
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  const win = window.open(url, "_blank", "noopener");
  return !!win;
}

export function buildInvoiceNoticeData(opts: {
  invoice: RentInvoice;
  landlord?: Landlord | null;
  tenant?: Tenant | null;
  unit?: Unit | null;
  property?: Property | null;
}): InvoiceNoticeData {
  const t = opts.tenant;
  const u = opts.unit;
  const prop = opts.property;
  const unitLabel = u && prop
    ? [prop.name, u.unit_number].filter(Boolean).join(" · ")
    : u?.unit_number ?? null;
  const balance = Math.max(0, Number(opts.invoice.amount) - Number(opts.invoice.paid_amount ?? 0));
  return {
    invoiceNumber: opts.invoice.invoice_number,
    landlordName: opts.landlord?.business_name ?? "Property Ledger",
    landlordPhone: opts.landlord?.phone ?? null,
    tenantName: t ? `${t.first_name} ${t.last_name}` : "Tenant",
    tenantPhone: t?.phone ?? null,
    unitLabel,
    period: invoicePeriodLabel(opts.invoice.period_month, opts.invoice.period_year),
    dueDate: opts.invoice.due_date.slice(0, 10),
    amount: Number(opts.invoice.amount),
    balanceDue: balance,
    paybill: opts.landlord?.mpesa_paybill ?? null,
    till: null,
    paymentInstructions: opts.landlord?.payment_instructions ?? null,
    notes: opts.invoice.notes ?? null,
  };
}