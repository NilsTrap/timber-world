import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Catalogue landing → Products (the default view). Categories and Currencies are
// their own sidebar entries (Currencies now lives under Settings).
export default function CatalogIndexPage() {
  redirect("/admin/catalog/products");
}
