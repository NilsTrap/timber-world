import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeQuantity, commissionPctForDiscount, gbp, type CalcMethod, type CommissionConfig } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string; productId: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { categoryId, productId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [catResult, productResult, variantsResult] = await Promise.all([
    (supabase as any).from("catalog_categories")
      .select("id, name, primary_unit, commission_standard_pct, commission_max_discount_pct, commission_discounted_pct")
      .eq("id", categoryId).single(),
    (supabase as any).from("catalog_products").select(`
      id, name, description,
      catalog_product_images(id, storage_path, alt_text, is_primary, sort_order),
      catalog_product_field_values(catalog_fields(field_label), catalog_field_options(label))
    `).eq("id", productId).single(),
    (supabase as any).from("catalog_variants").select(`
      id, sku, thickness_mm, width_mm, length_mm, is_active,
      catalog_variant_images(id, storage_path)
    `).eq("product_id", productId).eq("is_active", true).order("sort_order"),
  ]);

  if (!catResult.data || !productResult.data) notFound();

  const category = catResult.data;
  const product = productResult.data;
  const variants = variantsResult.data || [];

  const [unitResult, pricesResult, agentResult] = await Promise.all([
    (supabase as any).from("catalog_pricing_units").select("symbol, calc_method").eq("code", category.primary_unit).single(),
    (supabase as any).from("catalog_currency_prices")
      .select("entity_type, entity_id, price_cents")
      .eq("currency_code", "GBP")
      .in("entity_id", [categoryId, productId, ...variants.map((v: any) => v.id)]),
    user ? (supabase as any).from("agent_users").select("show_commissions").eq("auth_user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const unitSymbol = unitResult.data?.symbol ?? "unit";
  const calcMethod: CalcMethod = unitResult.data?.calc_method ?? "per_piece";
  const showComm = !!agentResult.data?.show_commissions;
  const commission: CommissionConfig = {
    standardPct: category.commission_standard_pct,
    maxDiscountPct: category.commission_max_discount_pct,
    discountedPct: category.commission_discounted_pct,
  };
  const hasCommission = commission.standardPct != null;

  // GBP rate map (variant -> product -> category fallback)
  const priceMap: Record<string, number> = {};
  for (const r of pricesResult.data || []) priceMap[`${r.entity_type}:${r.entity_id}`] = r.price_cents;
  const gbpRate = (variantId: string) =>
    priceMap[`variant:${variantId}`] ?? priceMap[`product:${productId}`] ?? priceMap[`category:${categoryId}`] ?? null;

  const images = (product.catalog_product_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const specs = (product.catalog_product_field_values || []).map((fv: any) => ({
    label: fv.catalog_fields?.field_label, value: fv.catalog_field_options?.label,
  })).filter((s: any) => s.label && s.value);

  const rows = variants.map((v: any) => {
    const rate = gbpRate(v.id);
    const qty = computeQuantity(calcMethod, v);
    const total = rate != null && qty != null ? Math.round(rate * qty) : null;
    const stdCommission = showComm && hasCommission && total != null
      ? Math.round((total * commissionPctForDiscount(commission, 0)) / 100) : null;
    return { v, rate, total, stdCommission };
  });

  const rates = rows.map((r: any) => r.rate).filter((x: any) => x != null) as number[];
  const minRate = rates.length ? Math.min(...rates) : null;
  const maxRate = rates.length ? Math.max(...rates) : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div className="space-y-4">
      <Link href={`/catalog/${categoryId}`} className="inline-flex items-center gap-1 text-sm text-[var(--charcoal-light)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
        {category.name}
      </Link>

      {images.length > 0 ? (
        <div className="rounded-xl overflow-hidden">
          <img src={`${supabaseUrl}/storage/v1/object/public/catalog/${images[0].storage_path}`} alt={images[0].alt_text || product.name} className="w-full aspect-[4/3] object-cover" />
        </div>
      ) : (
        <div className="rounded-xl aspect-[4/3] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E8D5B7, #C4A87C)" }}>
          <svg viewBox="0 0 120 90" fill="none" className="w-24 opacity-20"><rect x="5" y="5" width="110" height="80" rx="4" stroke="#8B6914" strokeWidth="2"/></svg>
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold">{product.name}</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold shrink-0">In Stock</span>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {specs.map((s: any, i: number) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--warm-cream-dark)] text-[var(--charcoal)]">{s.value}</span>
          ))}
        </div>
      </div>

      {minRate != null && (
        <div className="rounded-xl p-4 text-white" style={{ background: "var(--forest-green)" }}>
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">Price Range</div>
          <div className="text-xl font-bold mt-1">
            {gbp(minRate)}{maxRate && maxRate !== minRate ? ` – ${gbp(maxRate)}` : ""}
            <span className="text-sm font-normal text-white/60 ml-1">/{unitSymbol}</span>
          </div>
          <div className="text-xs text-white/50 mt-1">{variants.length} variants · tap one to order</div>
        </div>
      )}

      {product.description && (
        <div>
          <h2 className="text-sm font-semibold mb-1">Description</h2>
          <p className="text-sm text-[var(--charcoal-light)] leading-relaxed whitespace-pre-line">{product.description}</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2">Variants</h2>
        <div className="rounded-xl bg-white border border-gray-100 divide-y divide-gray-100">
          {rows.map(({ v, rate, total, stdCommission }: any) => (
            <Link
              key={v.id}
              href={`/catalog/${categoryId}/${productId}/${v.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  <span className="font-semibold">{v.thickness_mm}</span> × {v.width_mm} × {v.length_mm} mm
                </div>
                {showComm && stdCommission != null && (
                  <div className="text-xs text-[var(--forest-green)] mt-0.5">Commission ~{gbp(stdCommission)}/{unitSymbol === "pcs" ? "pc" : "pc"} at standard rate</div>
                )}
              </div>
              <div className="text-right">
                {rate != null ? (
                  <>
                    <div className="text-sm font-semibold text-[var(--forest-green)]">{gbp(rate)}<span className="text-xs font-normal text-[var(--charcoal-light)]">/{unitSymbol}</span></div>
                    {total != null && <div className="text-xs text-[var(--charcoal-light)]">{gbp(total)} / piece</div>}
                  </>
                ) : (
                  <div className="text-xs text-[var(--charcoal-light)]">price on request</div>
                )}
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[var(--charcoal-light)] shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
          {rows.length === 0 && <div className="px-4 py-6 text-sm text-center text-[var(--charcoal-light)]">No variants available.</div>}
        </div>
      </div>
    </div>
  );
}
