import { describe, expect, it } from "vitest";
import { getLeaseDeletionBlocker } from "./lease-deletion";

describe("lease deletion safeguards", () => {
  it("allows deletion only when there are no linked invoices, payments, or documents", () => {
    expect(getLeaseDeletionBlocker({ invoiceCount: 0, paymentCount: 0, documentCount: 0 })).toBeNull();
  });

  it("preserves the lease history when linked invoices exist, including settled invoices", () => {
    expect(getLeaseDeletionBlocker({ invoiceCount: 1, paymentCount: 0, documentCount: 0 })).toBe(
      "This lease has 1 rent invoice linked to it. Keep the lease record to preserve its history.",
    );
  });

  it("reports linked payments and documents before a deletion is attempted", () => {
    expect(getLeaseDeletionBlocker({ invoiceCount: 0, paymentCount: 2, documentCount: 1 })).toBe(
      "This lease has 2 payments, 1 document linked to it. Keep the lease record to preserve its history.",
    );
  });
});