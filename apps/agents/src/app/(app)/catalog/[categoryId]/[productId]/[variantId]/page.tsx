import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getVariantOrderContext, getVariantPublicContext } from "@/app/(app)/cart/actions";
import { VariantOrderForm } from "@/components/VariantOrderForm";
import { ImageGallery } from "@/components/ImageGallery";
import { imageUrl } from "@/lib/images";
import { gbp, fmtQty } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string; productId: string; variantId: string }>;
}

export default async function VariantDetailPage({ params }: Props) {
  const { categoryId, productId, variantId } = await params;
  const supabase = await createClient();

  // Approved agents get the order form; everyone else browses read-only.
  const { data: { user } } = await supabase.auth.getUser();
  let canOrder = false;
  if (user) {
    const { data: agent } = await (supabase as any)
      .from("agent_users").select("application_status, is_active").eq("auth_user_id", user.id).maybeSingle();
    canOrder = agent?.application_status === "approved" && agent?.is_active === true;
  }

  const [result, imagesResult] = await Promise.all([
    canOrder ? getVariantOrderContext(variantId) : getVariantPublicContext(variantId),
    (supabase as any).from("catalog_variant_images")
      .select("storage_path, is_primary, sort_order").eq("variant_id", variantId),
  ]);

  const back = (
    <Link href={`/catalog/${categoryId}/${productId}`} className="inline-flex items-center gap-1 text-sm text-[var(--charcoal-light)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
      Back to product
    </Link>
  );

  if (!result.success) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">{result.error}</div>
      </div>
    );
  }

  const c = result.data;
  const images = (imagesResult.data || [])
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order)
    .map((img: any) => imageUrl(img.storage_path)!)
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {back}

      {images.length > 0 && <ImageGallery images={images} alt={c.productName} />}

      <div>
        <h1 className="text-xl font-bold">{c.productName}</h1>
        <div className="text-sm text-[var(--charcoal-light)]">{c.variantLabel}{c.sku ? ` · ${c.sku}` : ""}</div>
      </div>

      {/* Stock + packaging */}
      <div className="rounded-xl bg-white border border-gray-100 divide-y divide-gray-100 text-sm">
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">In stock</span>
          <span className="font-medium">{c.stockPackages != null ? `${c.stockPackages} pkg${c.stockBaseQty != null ? ` · ${fmtQty(c.stockBaseQty)} ${c.unitSymbol}` : ""}` : "—"}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">Packaging</span>
          <span className="font-medium">{c.packagingName} · {c.piecesPerPackage} pcs</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">Per package</span>
          <span className="font-medium">{fmtQty(c.baseQtyPerPackage)} {c.unitSymbol}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">Unit price</span>
          <span className="font-medium">{gbp(c.gbpRateCents)}/{c.unitSymbol}</span>
        </div>
      </div>

      {canOrder ? (
        <VariantOrderForm
          variantId={variantId}
          packagePriceCents={c.packagePriceCents}
          unitSymbol={c.unitSymbol}
          baseQtyPerPackage={c.baseQtyPerPackage}
          commission={c.commission}
          showCommissions={c.showCommissions}
        />
      ) : (
        <div className="rounded-xl bg-white border border-gray-100 p-4 text-center space-y-3">
          <p className="text-sm text-[var(--charcoal-light)]">
            Log in as a Timber agent to place orders, set discounts and earn commission.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--forest-green)" }}
          >
            Log in to order
          </Link>
          <Link href="/register" className="block text-sm font-semibold text-[var(--forest-green)]">
            Apply to become an agent
          </Link>
        </div>
      )}
    </div>
  );
}
