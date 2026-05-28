import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoryProductsClient, type FilterableField, type ProductCard } from "@/components/CategoryProductsClient";

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

  const [productsResult, assignmentsResult] = await Promise.all([
    (supabase as any)
      .from("catalog_products")
      .select(`
        id, name, slug, description, is_active,
        catalog_variants(id),
        catalog_product_field_values(
          catalog_fields(field_key, field_label),
          catalog_field_options(label)
        ),
        catalog_product_images(storage_path, is_primary)
      `)
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("sort_order"),
    (supabase as any)
      .from("catalog_category_field_assignments")
      .select(`
        applies_to, sort_order,
        catalog_fields(id, field_key, field_label, field_type,
          catalog_field_options(label, sort_order)
        )
      `)
      .eq("category_id", categoryId)
      .order("sort_order"),
  ]);

  const rawProducts = productsResult.data || [];
  const assignments = assignmentsResult.data || [];

  // Build product cards with field values keyed by field_key
  const products: ProductCard[] = rawProducts.map((p: any) => {
    const fieldValues: Record<string, string> = {};
    (p.catalog_product_field_values || []).forEach((fv: any) => {
      const key = fv.catalog_fields?.field_key;
      const label = fv.catalog_field_options?.label;
      if (key && label) fieldValues[key] = label;
    });
    const primaryImage = (p.catalog_product_images || []).find((img: any) => img.is_primary);
    return {
      id: p.id,
      name: p.name,
      variantCount: p.catalog_variants?.length || 0,
      fieldValues,
      imagePath: primaryImage?.storage_path || null,
    };
  });

  // Build filterable fields from product-level select fields
  const filters: FilterableField[] = assignments
    .filter((a: any) => a.applies_to === "product" && a.catalog_fields?.field_type === "select")
    .map((a: any) => {
      const f = a.catalog_fields;
      // Only include options actually used by products in this category
      const usedValues = new Set(products.map((p) => p.fieldValues[f.field_key]).filter(Boolean));
      const options = (f.catalog_field_options || [])
        .sort((x: any, y: any) => x.sort_order - y.sort_order)
        .map((o: any) => o.label)
        .filter((label: string) => usedValues.has(label));
      return { fieldKey: f.field_key, fieldLabel: f.field_label, options };
    })
    .filter((f: FilterableField) => f.options.length > 1); // only show filters with >1 choice

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

      <CategoryProductsClient
        categoryId={categoryId}
        products={products}
        filters={filters}
        unitLabel={unitLabels[category.primary_unit] || ""}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      />
    </div>
  );
}
