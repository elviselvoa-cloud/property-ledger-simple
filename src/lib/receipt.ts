import type { Payment } from "@/integrations/supabase/client";
import { normalizePhone } from "./phone";

export type ReceiptData = {
  receiptNo: string;
  landlordName: string;
  landlordPhone?: string | null;
  paybill?: string | null;
  paymentInstructions?: string | null;
  tenantName: string;
  tenantPhone?: string | null;
  invoiceNumber?: string | null;
  period?: string | null;
  unitLabel?: string | null;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  paymentDate: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const periodLabel = (month: number, year: number) =>
  `${MONTHS[month - 1] ?? month} ${year}`;

const formatKES = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function receiptText(d: ReceiptData): string {
  const lines: string[] = [];
  lines.push(`*RECEIPT ${d.receiptNo}*`);
  lines.push(d.landlordName);
  if (d.landlordPhone) lines.push(`Tel: ${d.landlordPhone}`);
  lines.push("");
  lines.push(`Received from: ${d.tenantName}`);
  lines.push(`Amount: ${formatKES(d.amount)}`);
  if (d.period) lines.push(`For: Rent — ${d.period}`);
  if (d.invoiceNumber) lines.push(`Invoice: ${d.invoiceNumber}`);
  if (d.unitLabel) lines.push(`Unit: ${d.unitLabel}`);
  lines.push(`Date: ${d.paymentDate}`);
  lines.push(`Method: ${d.paymentMethod}${d.reference ? ` (${d.reference})` : ""}`);
  if (d.paybill || d.paymentInstructions) {
    lines.push("");
    if (d.paybill) lines.push(`Pay to: M-Pesa Paybill ${d.paybill}`);
    if (d.paymentInstructions) lines.push(d.paymentInstructions);
  }
  lines.push("");
  lines.push("Thank you for your payment!");
  return lines.join("\n");
}

export function shareReceiptOnWhatsApp(d: ReceiptData): boolean {
  const text = receiptText(d);
  const phone = normalizePhone(d.tenantPhone);
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  const win = window.open(url, "_blank", "noopener");
  return !!win;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildReceiptHtml(d: ReceiptData): string {
  const row = (label: string, value: string | null | undefined) =>
    value ? `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>` : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(d.receiptNo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a1a; background: #f5f5f5; padding: 24px; }
  .receipt { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 28px 26px; }
  h1 { font-size: 18px; letter-spacing: 3px; text-align: center; margin-bottom: 4px; }
  .biz { text-align: center; font-weight: 700; font-size: 15px; }
  .biz-tel { text-align: center; color: #555; font-size: 12px; }
  .meta { text-align: center; color: #555; font-size: 12px; margin-bottom: 14px; }
  .amount { text-align: center; font-size: 28px; font-weight: 800; margin: 16px 0 4px; }
  .amount-for { text-align: center; color: #555; font-size: 13px; margin-bottom: 16px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 14px 0; }
  .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 3px 0; }
  .row span:first-child { color: #666; }
  .row span:last-child { text-align: right; font-weight: 500; }
  .note { font-size: 12px; color: #555; white-space: pre-line; }
  .thanks { text-align: center; color: #666; font-size: 12px; margin-top: 14px; }
  @media print { body { background: #fff; padding: 0; } .receipt { border: none; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="receipt">
    <h1>RECEIPT</h1>
    <div class="biz">${escapeHtml(d.landlordName)}</div>
    ${d.landlordPhone ? `<div class="biz-tel">Tel: ${escapeHtml(d.landlordPhone)}</div>` : ""}
    <div class="meta">${escapeHtml(d.receiptNo)}</div>
    <div class="amount">${escapeHtml(formatKES(d.amount))}</div>
    <div class="amount-for">Received on ${escapeHtml(d.paymentDate)}</div>
    <hr />
    ${row("Received from", d.tenantName)}
    ${row("For", d.period ? `Rent — ${d.period}` : null)}
    ${row("Invoice", d.invoiceNumber)}
    ${row("Unit", d.unitLabel)}
    ${row("Method", d.paymentMethod)}
    ${row("Reference", d.reference)}
    <hr />
    ${d.paybill ? `<div class="row"><span>Pay to</span><span>M-Pesa Paybill ${escapeHtml(d.paybill)}</span></div>` : ""}
    ${d.paymentInstructions ? `<p class="note">${escapeHtml(d.paymentInstructions)}</p>` : ""}
    <p class="thanks">Thank you for your payment!</p>
  </div>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 250); });</script>
</body>
</html>`;
}

export function printReceipt(d: ReceiptData): boolean {
  const win = window.open("", "_blank", "width=520,height=760");
  if (!win) return false;
  win.document.write(buildReceiptHtml(d));
  win.document.close();
  win.focus();
  return true;
}

export type { Payment };
