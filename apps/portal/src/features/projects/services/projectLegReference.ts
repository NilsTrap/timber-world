export function projectLegReference(
  storedReference: string,
  buyerCode: string | null,
  sellerCode: string | null,
): string {
  const suffix = storedReference.match(/([0-9]+)$/)?.[1];
  if (!suffix) return storedReference;
  return `${buyerCode || "XXX"}-${sellerCode || "XXX"}-${suffix}`;
}
