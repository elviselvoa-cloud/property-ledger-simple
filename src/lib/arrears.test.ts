import { describe, expect, it } from "vitest";
import { buildTenantLedger, getAgingBucket, invoiceBalance } from "./arrears";

const asOf = new Date("2026-11-11T12:00:00Z");

describe("arrears aging", () => {
  it("classifies balances at the 30, 60, and 90 day boundaries", () => {
    expect(getAgingBucket("2026-11-11", 500, asOf)).toBe("current");
    expect(getAgingBucket("2026-11-10", 500, asOf)).toBe("1-29");
    expect(getAgingBucket("2026-10-12", 500, asOf)).toBe("30-59");
    expect(getAgingBucket("2026-09-12", 500, asOf)).toBe("60-89");
    expect(getAgingBucket("2026-08-13", 500, asOf)).toBe("90+");
  });

  it("excludes settled or invalid invoices from aging", () => {
    expect(getAgingBucket("2026-10-01", 0, asOf)).toBeNull();
    expect(getAgingBucket("not-a-date", 500, asOf)).toBeNull();
    expect(invoiceBalance({ amount: 1000, paid_amount: 1250 })).toBe(0);
  });
});

describe("tenant statement ledger", () => {
  it("sorts charges and payments chronologically and calculates the running balance", () => {
    const ledger = buildTenantLedger(
      7,
      [
        { id: 1, tenant_id: 7, invoice_number: "INV-1", amount: 12000, due_date: "2026-11-05", status: "pending", period_month: 11, period_year: 2026 },
        { id: 2, tenant_id: 7, invoice_number: "INV-CANCELLED", amount: 8000, due_date: "2026-11-06", status: "cancelled", period_month: 11, period_year: 2026 },
      ],
      [
        { id: 3, tenant_id: 7, invoice_id: 1, amount: 4000, payment_date: "2026-11-08" },
        { id: 4, tenant_id: 8, invoice_id: null, amount: 9000, payment_date: "2026-11-07" },
      ],
    );

    expect(ledger.map(({ type, balance }) => [type, balance])).toEqual([
      ["Charge", 12000],
      ["Payment", 8000],
    ]);
  });
});