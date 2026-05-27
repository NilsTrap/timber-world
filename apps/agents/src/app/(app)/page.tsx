import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: categories } = await (supabase as any)
    .from("catalog_categories")
    .select("id, name, slug, catalog_products(id)")
    .eq("is_active", true)
    .order("sort_order");

  const totalProducts = (categories || []).reduce(
    (sum: number, c: any) => sum + (c.catalog_products?.length || 0), 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="text-sm text-[var(--charcoal-light)] mt-1">Browse our timber product catalog</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 text-white" style={{ background: "var(--forest-green)" }}>
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">Categories</div>
          <div className="text-2xl font-bold mt-1">{categories?.length || 0}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="text-xs uppercase tracking-wide text-[var(--charcoal-light)] font-semibold">Products</div>
          <div className="text-2xl font-bold mt-1">{totalProducts}</div>
        </div>
      </div>

      {/* Quick links to categories */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--charcoal-light)] mb-3">Browse by Category</h2>
        <div className="space-y-2">
          {(categories || []).map((cat: any) => (
            <Link
              key={cat.id}
              href={`/catalog/${cat.id}`}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div>
                <div className="font-semibold">{cat.name}</div>
                <div className="text-xs text-[var(--charcoal-light)] mt-0.5">
                  {cat.catalog_products?.length || 0} products
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--charcoal-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      <Link
        href="/catalog"
        className="block text-center py-3 rounded-xl font-semibold text-sm text-white"
        style={{ background: "var(--forest-green)" }}
      >
        View Full Catalog →
      </Link>
    </div>
  );
}
