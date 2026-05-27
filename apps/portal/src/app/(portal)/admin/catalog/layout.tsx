import { CatalogLayout } from "@/features/catalog/components/CatalogLayout";

export default function CatalogLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CatalogLayout>{children}</CatalogLayout>;
}
