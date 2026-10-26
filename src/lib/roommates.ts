export type RoommateEntry = { tenant_id: number; share: number | null };

type LeaseLike = {
  tenant_id: number;
  rent_amount: number | string;
  is_roommate?: boolean | null;
  billing_mode?: string | null;
  roommates?: RoommateEntry[] | null;
};

export type InvoiceParticipant = { tenant_id: number; amount: number };

/**
 * Who gets billed for a lease, and how much.
 *
 * Standard leases (and roommate leases billed "shared") produce a single
 * invoice for the full rent, addressed to the lease's primary tenant.
 * Roommate leases billed "separate" produce one invoice per roommate for
 * their share, plus one for the primary tenant covering the remainder.
 */
export function participantShares(lease: LeaseLike): InvoiceParticipant[] {
  const rent = Number(lease.rent_amount) || 0;

  if (!lease.is_roommate || lease.billing_mode !== "separate") {
    return [{ tenant_id: lease.tenant_id, amount: rent }];
  }

  const shares = (lease.roommates ?? [])
    .map((r) => ({ tenant_id: r.tenant_id, amount: Number(r.share) || 0 }))
    .filter((r) => r.tenant_id && r.amount > 0);

  const primaryShare = rent - shares.reduce((sum, s) => sum + s.amount, 0);
  const out: InvoiceParticipant[] = [...shares];
  if (primaryShare > 0) out.unshift({ tenant_id: lease.tenant_id, amount: primaryShare });
  return out;
}
