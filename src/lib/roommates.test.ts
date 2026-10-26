import { describe, expect, it } from "vitest";
import { participantShares } from "./roommates";

const base = { tenant_id: 1, rent_amount: 20000 };

describe("participantShares", () => {
  it("bills the full rent to the lease tenant for standard leases", () => {
    expect(participantShares({ ...base, is_roommate: false })).toEqual([
      { tenant_id: 1, amount: 20000 },
    ]);
  });

  it("bills the full rent to the primary tenant when roommates share one invoice", () => {
    expect(
      participantShares({
        ...base,
        is_roommate: true,
        billing_mode: "shared",
        roommates: [{ tenant_id: 2, share: null }],
      })
    ).toEqual([{ tenant_id: 1, amount: 20000 }]);
  });

  it("splits separate invoices between the primary tenant and roommates", () => {
    expect(
      participantShares({
        ...base,
        is_roommate: true,
        billing_mode: "separate",
        roommates: [
          { tenant_id: 2, share: 7500 },
          { tenant_id: 3, share: 7500 },
        ],
      })
    ).toEqual([
      { tenant_id: 1, amount: 5000 },
      { tenant_id: 2, amount: 7500 },
      { tenant_id: 3, amount: 7500 },
    ]);
  });

  it("skips the primary invoice when roommate shares cover the full rent", () => {
    expect(
      participantShares({
        ...base,
        is_roommate: true,
        billing_mode: "separate",
        roommates: [
          { tenant_id: 2, share: 10000 },
          { tenant_id: 3, share: 10000 },
        ],
      })
    ).toEqual([
      { tenant_id: 2, amount: 10000 },
      { tenant_id: 3, amount: 10000 },
    ]);
  });
});
