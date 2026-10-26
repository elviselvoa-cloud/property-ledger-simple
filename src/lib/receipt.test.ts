import { describe, expect, it } from "vitest";
import { normalizePhone, periodLabel, receiptText } from "./receipt";

describe("normalizePhone", () => {
  it("converts local 07xx numbers to 254 format", () => {
    expect(normalizePhone("0712345678")).toBe("254712345678");
  });

  it("keeps international 254 numbers intact", () => {
    expect(normalizePhone("+254712345678")).toBe("254712345678");
  });

  it("returns null for missing or invalid numbers", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("periodLabel", () => {
  it("formats month and year", () => {
    expect(periodLabel(1, 2026)).toBe("January 2026");
    expect(periodLabel(12, 2025)).toBe("December 2025");
  });
});

describe("receiptText", () => {
  it("includes the amount, tenant and reference", () => {
    const text = receiptText({
      receiptNo: "PL-000001",
      landlordName: "Test Properties",
      tenantName: "Jane Doe",
      amount: 12500,
      paymentMethod: "M-Pesa",
      reference: "QGH7XYZ123",
      paymentDate: "2026-01-05",
      period: "January 2026",
    });
    expect(text).toContain("KES 12,500");
    expect(text).toContain("Jane Doe");
    expect(text).toContain("QGH7XYZ123");
    expect(text).toContain("RECEIPT PL-000001");
  });
});
