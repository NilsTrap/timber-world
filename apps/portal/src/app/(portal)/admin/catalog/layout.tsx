import { CatalogTabs } from "@/features/catalog/components/CatalogTabs";

export default function CatalogLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <CatalogTabs />
      {children}
    </div>
  );
}
