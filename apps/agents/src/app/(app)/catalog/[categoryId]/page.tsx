import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string }>;
}

export default async function CategoryProductsPage({ params }: Props) {
  const { categoryId } = await params;
  const supabase = await createClient();

  const { data: category } = await (supabase as any)
    .from("catalog_categories")
    .select("id, name, description, primary_unit")
    .eq("id", categoryId)
    .single();

  if (!category) notFound();

  const { data: products } = await (supabase as any)
    .from("catalog_products")
    .select(`
      id, name, slug, description, is_active,
      catalog_variants(id),
      catalog_product_field_values(
        catalog_field_options(label)
      ),
      catalog_product_images(storage_path, is_primary)
    `)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("sort_order");

  const unitLabels: Record<string, string> = { m2: "£/m²", m3: "£/m³", piece: "£/pc", linear_m: "£/m" };

  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div>
        <Link href="/catalog" className="inline-flex items-center gap-1 text-sm text-[var(--charcoal-light)] mb-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
          Categories
        </Link>
        <h1 className="text-2xl font-bold">{category.name}</h1>
        {category.description && <p className="text-sm text-[var(--charcoal-light)] mt-1">{category.description}</p>}
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {(products || []).map((product: any) => {
          const variantCount = product.catalog_variants?.length || 0;
          const fieldLabels = (product.catalog_product_field_values || [])
            .map((fv: any) => fv.catalog_field_options?.label)
            .filter(Boolean);
          const primaryImage = (product.catalog_product_images || []).find((img: any) => img.is_primary);

          return (
            <Link
              key={product.id}
              href={`/catalog/${categoryId}/${product.id}`}
              className="flex gap-3 rounded-xl bg-white p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div className="w-20 h-20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ background: "linear-gradient(135deg, #E8D5B7, #C4A87C)" }}>
                {primaryImage ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${primaryImage.storage_path}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg viewBox="0 0 40 30" fill="none" className="w-8 opacity-25">
                    <rect x="2" y="2" width="36" height="26" rx="2" stroke="#8B6914" strokeWidth="1"/>
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{product.name}</div>
                <div className="text-xs text-[var(--charcoal-light)] mt-0.5">
                  {fieldLabels.join(" · ")}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-medium text-[var(--forest-green)]">
                    {variantCount} variant{variantCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-[var(--charcoal-light)]">{unitLabels[category.primary_unit] || ""}</span>
                </div>
              </div>

              <svg viewBox="0 0 24 24" fill="none" stroke="var(--charcoal-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 self-center flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          );
        })}

        {(!products || products.length === 0) && (
          <div className="text-center py-12 text-[var(--charcoal-light)]">
            No products available in this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
