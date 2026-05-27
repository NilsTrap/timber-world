import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createClient();

  const { data: categories } = await (supabase as any)
    .from("catalog_categories")
    .select("id, name, slug, description, primary_unit, catalog_products(id)")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Products</h1>

      <div className="grid grid-cols-2 gap-3">
        {(categories || []).map((cat: any) => (
          <Link
            key={cat.id}
            href={`/catalog/${cat.id}`}
            className="rounded-xl bg-white overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="aspect-[4/3] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E8D5B7, #C4A87C)" }}>
              <svg viewBox="0 0 80 60" fill="none" className="w-12 opacity-25">
                <rect x="5" y="5" width="70" height="50" rx="3" stroke="#8B6914" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="p-3">
              <div className="font-semibold text-sm">{cat.name}</div>
              <div className="text-xs text-[var(--charcoal-light)] mt-0.5">
                {cat.catalog_products?.length || 0} products
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
