type LeaseDependencies = {
  invoiceCount: number;
  paymentCount: number;
  documentCount: number;
};

export function getLeaseDeletionBlocker({
  invoiceCount,
  paymentCount,
  documentCount,
}: LeaseDependencies): string | null {
  const linkedRecords = [
    invoiceCount > 0 ? `${invoiceCount} rent invoice${invoiceCount === 1 ? "" : "s"}` : null,
    paymentCount > 0 ? `${paymentCount} payment${paymentCount === 1 ? "" : "s"}` : null,
    documentCount > 0 ? `${documentCount} document${documentCount === 1 ? "" : "s"}` : null,
  ].filter((item): item is string => item !== null);

  if (linkedRecords.length === 0) return null;
  return `This lease has ${linkedRecords.join(", ")} linked to it. Keep the lease record to preserve its history.`;
}