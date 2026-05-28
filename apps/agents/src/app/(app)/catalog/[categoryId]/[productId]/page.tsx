import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string; productId: string }>;
}

type CalcMethod = "per_piece" | "area" | "volume" | "length";

function computeQuantity(method: CalcMethod, v: any): number | null {
  const w = v.width_mm != null ? v.width_mm / 1000 : null;
  const l = v.length_mm != null ? v.length_mm / 1000 : null;
  const t = v.thickness_mm != null ? v.thickness_mm / 1000 : null;
  switch (method) {
    case "per_piece": return 1;
    case "length": return l;
    case "area": return w != null && l != null ? w * l : null;
    case "volume": return w != null && l != null && t != null ? w * l * t : null;
    default: return null;
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { categoryId, productId } = await params;
  const supabase = await createClient();

  const [catResult, productResult, variantsResult] = await Promise.all([
    (supabase as any).from("catalog_categories").select("id, name, primary_unit, default_price_eur_cents").eq("id", categoryId).single(),
    (supabase as any).from("catalog_products").select(`
      id, name, description, base_price_eur_cents,
      catalog_product_images(id, storage_path, alt_text, is_primary, sort_order),
      catalog_product_field_values(
        catalog_fields(field_label),
        catalog_field_options(label)
      )
    `).eq("id", productId).single(),
    (supabase as any).from("catalog_variants").select(`
      id, thickness_mm, width_mm, length_mm, price_eur_cents, is_active,
      catalog_variant_images(id, storage_path)
    `).eq("product_id", productId).eq("is_active", true).order("sort_order"),
  ]);

  if (!catResult.data || !productResult.data) notFound();

  const category = catResult.data;
  const product = productResult.data;
  const variants = variantsResult.data || [];

  const unitResult = await (supabase as any)
    .from("catalog_pricing_units").select("symbol, calc_method").eq("code", category.primary_unit).single();
  const unitSymbol = unitResult.data?.symbol ?? "unit";
  const calcMethod: CalcMethod = unitResult.data?.calc_method ?? "per_piece";

  const images = (product.catalog_product_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const specs = (product.catalog_product_field_values || []).map((fv: any) => ({
    label: fv.catalog_fields?.field_label,
    value: fv.catalog_field_options?.label,
  })).filter((s: any) => s.label && s.value);

  const rows = variants.map((v: any) => {
    const rate = v.price_eur_cents ?? product.base_price_eur_cents ?? category.default_price_eur_cents ?? null;
    const qty = computeQuantity(calcMethod, v);
    const total = rate != null && qty != null ? Math.round(rate * qty) : null;
    return { v, rate, total };
  });

  const rates = rows.map((r: any) => r.rate).filter((x: any) => x != null) as number[];
  const minRate = rates.length ? Math.min(...rates) : null;
  const maxRate = rates.length ? Math.max(...rates) : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link href={`/catalog/${categoryId}`} className="inline-flex items-center gap-1 text-sm text-[var(--charcoal-light)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
        {category.name}
      </Link>

      {/* Image gallery */}
      {images.length > 0 ? (
        <div className="rounded-xl overflow-hidden">
          <img
            src={`${supabaseUrl}/storage/v1/object/public/catalog/${images[0].storage_path}`}
            alt={images[0].alt_text || product.name}
            className="w-full aspect-[4/3] object-cover"
          />
        </div>
      ) : (
        <div className="rounded-xl aspect-[4/3] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E8D5B7, #C4A87C)" }}>
          <svg viewBox="0 0 120 90" fill="none" className="w-24 opacity-20">
            <rect x="5" y="5" width="110" height="80" rx="4" stroke="#8B6914" strokeWidth="2"/>
          </svg>
        </div>
      )}

      {/* Product header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold">{product.name}</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold shrink-0">In Stock</span>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {specs.map((s: any, i: number) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--warm-cream-dark)] text-[var(--charcoal)]">
              {s.value}
            </span>
          ))}
        </div>
      </div>

      {/* Price summary */}
      {minRate != null && (
        <div className="rounded-xl p-4 text-white" style={{ background: "var(--forest-green)" }}>
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">Price Range</div>
          <div className="text-xl font-bold mt-1">
            {fmt(minRate)}
            {maxRate && maxRate !== minRate ? ` – ${fmt(maxRate)}` : ""}
            <span className="text-sm font-normal text-white/60 ml-1">/{unitSymbol}</span>
          </div>
          <div className="text-xs text-white/50 mt-1">{variants.length} variants available</div>
        </div>
      )}

      {/* Description */}
      {product.description && (
        <div>
          <h2 className="text-sm font-semibold mb-1">Description</h2>
          <p className="text-sm text-[var(--charcoal-light)] leading-relaxed whitespace-pre-line">{product.description}</p>
        </div>
      )}

      {/* Specifications */}
      {specs.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-100 divide-y divide-gray-100">
          <h2 className="text-sm font-semibold px-4 py-2.5">Specifications</h2>
          {specs.map((s: any, i: number) => (
            <div key={i} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-[var(--charcoal-light)]">{s.label}</span>
              <span className="font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Variant pricing table */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Pricing &amp; Variants</h2>
        <div className="rounded-xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-white" style={{ background: "var(--forest-green)" }}>
                <th className="px-3 py-2.5 font-semibold">Size (mm)</th>
                <th className="px-3 py-2.5 font-semibold text-right">€/{unitSymbol}</th>
                <th className="px-3 py-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, rate, total }: any) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5">
                    <span className="font-semibold">{v.thickness_mm}</span> × {v.width_mm} × {v.length_mm}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[var(--forest-green)]">
                    {rate != null ? fmt(rate) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {total != null ? fmt(total) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <button className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 text-[var(--forest-green)]" style={{ borderColor: "var(--forest-green)" }}>
          Request Quote
        </button>
        <button className="flex-[1.3] py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--forest-green)" }}>
          Add to Order
        </button>
      </div>
    </div>
  );
}
