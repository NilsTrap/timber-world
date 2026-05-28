import Link from "next/link";
import { getVariantOrderContext } from "@/app/(app)/cart/actions";
import { VariantOrderForm } from "@/components/VariantOrderForm";
import { gbp } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string; productId: string; variantId: string }>;
}

export default async function VariantDetailPage({ params }: Props) {
  const { categoryId, productId, variantId } = await params;
  const result = await getVariantOrderContext(variantId);

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

  return (
    <div className="space-y-4">
      {back}

      <div>
        <h1 className="text-xl font-bold">{c.productName}</h1>
        <div className="text-sm text-[var(--charcoal-light)]">{c.variantLabel}{c.sku ? ` · ${c.sku}` : ""}</div>
      </div>

      {/* Stock + packaging */}
      <div className="rounded-xl bg-white border border-gray-100 divide-y divide-gray-100 text-sm">
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">In stock</span>
          <span className="font-medium">{c.stockPackages != null ? `${c.stockPackages} pkg${c.stockBaseQty != null ? ` · ${c.stockBaseQty} ${c.unitSymbol}` : ""}` : "—"}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">Packaging</span>
          <span className="font-medium">{c.packagingName} · {c.piecesPerPackage} pcs</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">Per package</span>
          <span className="font-medium">{c.baseQtyPerPackage} {c.unitSymbol} · {gbp(c.packagePriceCents)}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-[var(--charcoal-light)]">Unit price</span>
          <span className="font-medium">{gbp(c.gbpRateCents)}/{c.unitSymbol}</span>
        </div>
      </div>

      <VariantOrderForm
        variantId={variantId}
        packagePriceCents={c.packagePriceCents}
        unitSymbol={c.unitSymbol}
        baseQtyPerPackage={c.baseQtyPerPackage}
        commission={c.commission}
        showCommissions={c.showCommissions}
      />
    </div>
  );
}
