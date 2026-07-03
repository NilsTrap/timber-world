/**
 * Catalog routes no longer use an in-page tab bar — Products / Categories are
 * sidebar items and Currencies moved to Settings. This layout is now a pass-through.
 */
export default function CatalogLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
