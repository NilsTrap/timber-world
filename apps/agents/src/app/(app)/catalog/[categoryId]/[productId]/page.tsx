import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImageGallery } from "@/components/ImageGallery";
import { ExpandableText } from "@/components/ExpandableText";
import { imageUrl, thumbUrl } from "@/lib/images";
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
      catalog_product_images(id, storage_path, is_primary, sort_order),
      catalog_product_field_values(catalog_fields(field_label), catalog_field_options(label))
    `).eq("id", productId).single(),
    (supabase as any).from("catalog_variants").select(`
      id, sku, thickness_mm, width_mm, length_mm, is_active,
      catalog_variant_images(storage_path, is_primary, sort_order),
      catalog_variant_packaging_assignments(is_default, catalog_packaging_types(pieces_per_package))
    `).eq("product_id", productId).eq("is_active", true).order("sort_order"),
  ]);

  if (!catResult.data || !productResult.data) notFound();
  const category = catResult.data;
  const product = productResult.data;
  const variants = variantsResult.data || [];

  const [unitResult, pricesResult, agentResult] = await Promise.all([
    (supabase as any).from("catalog_pricing_units").select("symbol, calc_method").eq("code", category.primary_unit).single(),
    (supabase as any).from("catalog_currency_prices").select("entity_type, entity_id, price_cents")
      .eq("currency_code", "GBP").in("entity_id", [categoryId, productId, ...variants.map((v: any) => v.id)]),
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

  const priceMap: Record<string, number> = {};
  for (const r of pricesResult.data || []) priceMap[`${r.entity_type}:${r.entity_id}`] = r.price_cents;
  const gbpRate = (variantId: string) =>
    priceMap[`variant:${variantId}`] ?? priceMap[`product:${productId}`] ?? priceMap[`category:${categoryId}`] ?? null;

  const productImages = (product.catalog_product_images || [])
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order)
    .map((img: any) => imageUrl(img.storage_path)!)
    .filter(Boolean);

  const specs = (product.catalog_product_field_values || []).map((fv: any) => ({
    label: fv.catalog_fields?.field_label, value: fv.catalog_field_options?.label,
  })).filter((s: any) => s.label && s.value);

  const variantThumb = (v: any): string | null => {
    const imgs = (v.catalog_variant_images || []).sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order);
    return imgs[0] ? thumbUrl(imgs[0].storage_path, 120) : null;
  };
  const defaultPkgPieces = (v: any): number | null => {
    const a = (v.catalog_variant_packaging_assignments || []).find((x: any) => x.is_default) ?? (v.catalog_variant_packaging_assignments || [])[0];
    return a?.catalog_packaging_types?.pieces_per_package ?? null;
  };

  const rows = variants.map((v: any) => {
    const rate = gbpRate(v.id);
    const perPiece = computeQuantity(calcMethod, v);
    const ppp = defaultPkgPieces(v);
    const perPack = ppp != null && perPiece != null ? Math.round(ppp * perPiece * 100) / 100 : null;
    const pkgPriceCents = rate != null && perPack != null ? Math.round(rate * perPack) : null;
    const commPkg = showComm && hasCommission && pkgPriceCents != null
      ? Math.round((pkgPriceCents * commissionPctForDiscount(commission, 0)) / 100) : null;
    return { v, rate, perPack, commPkg, thumb: variantThumb(v) };
  });

  const rates = rows.map((r: any) => r.rate).filter((x: any) => x != null) as number[];
  const minRate = rates.length ? Math.min(...rates) : null;
  const maxRate = rates.length ? Math.max(...rates) : null;

  return (
    <div className="space-y-4">
      <Link href={`/catalog/${categoryId}`} className="inline-flex items-center gap-1 text-sm text-[var(--charcoal-light)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
        {category.name}
      </Link>

      <ImageGallery images={productImages} alt={product.name} />

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
          <ExpandableText text={product.description} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2">Variants</h2>
        <div className="rounded-xl bg-white border border-gray-100 divide-y divide-gray-100">
          {rows.map(({ v, rate, perPack, commPkg, thumb }: any) => (
            <Link key={v.id} href={`/catalog/${categoryId}/${productId}/${v.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-gray-50">
              {thumb ? (
                <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg shrink-0" style={{ background: "linear-gradient(135deg, #E8D5B7, #C4A87C)" }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium"><span className="font-semibold">{v.thickness_mm}</span> × {v.width_mm} × {v.length_mm} mm</div>
                {showComm && commPkg != null && (
                  <div className="text-xs text-[var(--forest-green)] mt-0.5">Commission ~{gbp(commPkg)}/pack</div>
                )}
              </div>
              <div className="text-right">
                {rate != null ? (
                  <>
                    <div className="text-sm font-semibold text-[var(--forest-green)]">{gbp(rate)}<span className="text-xs font-normal text-[var(--charcoal-light)]">/{unitSymbol}</span></div>
                    {perPack != null && <div className="text-xs text-[var(--charcoal-light)]">{perPack} {unitSymbol} / pack</div>}
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
