import { describe, expect, it } from "vitest";
import {
  buildInvoiceNoticeData,
  buildInvoiceWhatsAppMessage,
  invoicePeriodLabel,
  normalizePhone,
  type InvoiceNoticeData,
} from "./invoice-notice";

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
  it("converts local 07xx numbers to 254 format", () => {
    expect(normalizePhone("0712345678")).toBe("254712345678");
  });

  it("keeps international +254 numbers intact", () => {
    expect(normalizePhone("+254712345678")).toBe("254712345678");
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
  it("includes key invoice fields", () => {
    const msg = buildInvoiceWhatsAppMessage(base);
    expect(msg).toContain("INV-202601-A1B2");
    expect(msg).toContain("Jane Doe");
    expect(msg).toContain("January 2026");
    expect(msg).toContain("2026-01-25");
    expect(msg).toContain("KES 25,000");
    expect(msg).toContain("Test Properties Ltd");
  });

  it("shows partial payment info when balance < amount", () => {
    const partial = { ...base, amount: 25000, balanceDue: 10000 };
    const msg = buildInvoiceWhatsAppMessage(partial);
    expect(msg).toContain("KES 15,000");
    expect(msg).toContain("KES 10,000");
  });

  it("omits paid line when balance equals amount", () => {
    const full = { ...base, amount: 25000, balanceDue: 25000 };
    const msg = buildInvoiceWhatsAppMessage(full);
    expect(msg).not.toContain("Paid:");
  });
});

describe("buildInvoiceNoticeData", () => {
  it("derives tenant name and unit label from entities", () => {
    const d = buildInvoiceNoticeData({
      invoice: {
        id: 1,
        landlord_id: 1,
        lease_id: 1,
        tenant_id: 10,
        unit_id: 20,
        invoice_number: "INV-001",
        amount: 30000,
        due_date: "2026-02-01T00:00:00Z",
        period_month: 2,
        period_year: 2026,
        status: "pending",
        paid_amount: 0,
        paid_at: null,
        notes: "First invoice",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      landlord: {
        id: 1,
        user_id: 1,
        business_name: "Kenyatta Homes",
        phone: "0722334455",
        address: null,
        city: null,
        country: null,
        mpesa_paybill: "556677",
        payment_instructions: "Account No: 99887766",
        subscription_plan: "pro",
        subscription_status: "active",
        subscription_expires_at: null,
        trial_ends_at: null,
        is_active: true,
        onboarding_status: "completed",
        onboarding_completed_at: "2025-01-01",
        created_at: "",
        updated_at: "",
      },
      tenant: {
        id: 10,
        landlord_id: 1,
        first_name: "John",
        last_name: "Kimani",
        email: null,
        phone: "0711223344",
        national_id: null,
        emergency_contact: null,
        emergency_phone: null,
        notes: null,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      unit: {
        id: 20,
        property_id: 100,
        landlord_id: 1,
        unit_number: "A1",
        floor: null,
        bedrooms: 2,
        bathrooms: 1,
        size: null,
        rent_amount: 30000,
        deposit_amount: null,
        status: "occupied",
        description: null,
        created_at: "",
        updated_at: "",
      },
      property: {
        id: 100,
        landlord_id: 1,
        name: "Greenview Estate",
        address: "Nairobi",
        city: null,
        property_type: "residential",
        total_units: 10,
        description: null,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    });

    expect(d.landlordName).toBe("Kenyatta Homes");
    expect(d.tenantName).toBe("John Kimani");
    expect(d.unitLabel).toBe("Greenview Estate · A1");
    expect(d.balanceDue).toBe(30000);
    expect(d.paybill).toBe("556677");
  });

  it("falls back to defaults when optional entities are absent", () => {
    const d = buildInvoiceNoticeData({
      invoice: {
        id: 2,
        landlord_id: 1,
        lease_id: 1,
        tenant_id: 10,
        unit_id: 20,
        invoice_number: "INV-002",
        amount: 15000,
        due_date: "2026-03-01T00:00:00Z",
        period_month: 3,
        period_year: 2026,
        status: "paid",
        paid_amount: 15000,
        paid_at: "2026-03-01T00:00:00Z",
        notes: null,
        created_at: "",
        updated_at: "",
      },
    });
    expect(d.landlordName).toBe("Property Ledger");
    expect(d.tenantName).toBe("Tenant");
    expect(d.unitLabel).toBeNull();
    expect(d.balanceDue).toBe(0);
  });
});
