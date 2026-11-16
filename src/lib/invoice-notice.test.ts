import { describe, expect, it } from "vitest";
import {
  buildInvoiceHtml,
  buildInvoiceNoticeData,
  buildInvoiceWhatsAppMessage,
  invoicePeriodLabel,
  type InvoiceNoticeData,
} from "./invoice-notice";
import { normalizePhone } from "./phone";
import type { Landlord, Property, RentInvoice, Tenant, Unit } from "@/integrations/supabase/client";

const base: InvoiceNoticeData = {
  invoiceNumber: "INV-202601-A1B2",
  landlordName: "Test Properties Ltd",
  landlordPhone: "+254700123456",
  tenantName: "Jane Doe",
  tenantPhone: "0712345678",
  unitLabel: "Sunrise Apartments · 4B",
  period: "January 2026",
  dueDate: "2026-01-25",
  amount: 25000,
  balanceDue: 25000,
  paybill: "123456",
  paymentInstructions: "Account: 1234567",
};

describe("normalizePhone", () => {
  it("converts local Kenyan numbers to international format", () => {
    expect(normalizePhone("0712345678")).toBe("+254712345678");
  });

  it("keeps international Kenyan numbers intact", () => {
    expect(normalizePhone("+254712345678")).toBe("+254712345678");
  });

  it("returns null for missing or invalid numbers", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("invoicePeriodLabel", () => {
  it("formats month and year", () => {
    expect(invoicePeriodLabel(1, 2026)).toBe("January 2026");
    expect(invoicePeriodLabel(12, 2025)).toBe("December 2025");
  });
});

describe("buildInvoiceWhatsAppMessage", () => {
  it("includes key invoice details and payment instructions", () => {
    const message = buildInvoiceWhatsAppMessage(base);
    expect(message).toContain("INV-202601-A1B2");
    expect(message).toContain("Jane Doe");
    expect(message).toContain("January 2026");
    expect(message).toContain("2026-01-25");
    expect(message).toContain("KES 25,000");
    expect(message).toContain("Test Properties Ltd");
    expect(message).toContain("Paybill: 123456");
  });

  it("shows the paid amount for a partial payment", () => {
    const message = buildInvoiceWhatsAppMessage({ ...base, balanceDue: 10000 });
    expect(message).toContain("*Paid:* KES 15,000");
    expect(message).toContain("*Balance Due:* KES 10,000");
  });

  it("omits the paid line when the invoice is unpaid", () => {
    expect(buildInvoiceWhatsAppMessage(base)).not.toContain("*Paid:*");
  });
});

describe("buildInvoiceHtml", () => {
  it("escapes user-provided text before placing it in printable markup", () => {
    const html = buildInvoiceHtml({ ...base, tenantName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("buildInvoiceNoticeData", () => {
  it("derives tenant and unit details from related records", () => {
    const invoice = {
      invoice_number: "INV-001",
      amount: 30000,
      paid_amount: 5000,
      due_date: "2026-02-01T00:00:00Z",
      period_month: 2,
      period_year: 2026,
      notes: null,
    } as RentInvoice;
    const data = buildInvoiceNoticeData({
      invoice,
      landlord: { business_name: "Kenyatta Homes", phone: "0722334455", mpesa_paybill: "556677" } as Landlord,
      tenant: { first_name: "John", last_name: "Kimani", phone: "0711223344" } as Tenant,
      unit: { unit_number: "A1" } as Unit,
      property: { name: "Greenview Estate" } as Property,
    });

    expect(data.landlordName).toBe("Kenyatta Homes");
    expect(data.tenantName).toBe("John Kimani");
    expect(data.unitLabel).toBe("Greenview Estate · A1");
    expect(data.balanceDue).toBe(25000);
    expect(data.paybill).toBe("556677");
  });

  it("uses safe defaults when related records are absent", () => {
    const invoice = {
      invoice_number: "INV-002",
      amount: 15000,
      paid_amount: 15000,
      due_date: "2026-03-01T00:00:00Z",
      period_month: 3,
      period_year: 2026,
      notes: null,
    } as RentInvoice;
    const data = buildInvoiceNoticeData({ invoice });

    expect(data.landlordName).toBe("Property Ledger");
    expect(data.tenantName).toBe("Tenant");
    expect(data.unitLabel).toBeNull();
    expect(data.balanceDue).toBe(0);
  });