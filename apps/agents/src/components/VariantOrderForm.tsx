"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addToCart } from "@/app/(app)/cart/actions";
import { commissionPctForDiscount, clampDiscount, gbp, fmtQty, type CommissionConfig } from "@/lib/pricing";

interface Props {
  variantId: string;
  packagePriceCents: number;
  unitSymbol: string;
  baseQtyPerPackage: number;
  commission: CommissionConfig;
  showCommissions: boolean;
}

export function VariantOrderForm({ variantId, packagePriceCents, commission, showCommissions, unitSymbol, baseQtyPerPackage }: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [adding, setAdding] = useState(false);

  const maxDiscount = commission.maxDiscountPct ?? 0;
  const d = clampDiscount(commission, discount);
  const subtotal = packagePriceCents * Math.max(1, qty);
  const total = Math.round(subtotal * (1 - d / 100));
  const commissionPct = commissionPctForDiscount(commission, d);
  const commissionCents = Math.round((total * commissionPct) / 100);

  const handleAdd = async () => {
    setAdding(true);
    const result = await addToCart({ variantId, quantityPackages: qty, discountPct: d });
    setAdding(false);
    if (result.success) {
      toast.success("Added to cart");
      router.push("/cart");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Quantity (packages)</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-lg font-semibold">−</button>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-14 h-9 text-center rounded-lg border border-gray-200 text-sm" />
          <button onClick={() => setQty((q) => q + 1)} className="w-9 h-9 rounded-lg border border-gray-200 text-lg font-semibold">+</button>
        </div>
      </div>
      <div className="text-xs text-[var(--charcoal-light)] -mt-2">{fmtQty(baseQtyPerPackage * Math.max(1, qty))} {unitSymbol} total</div>

      {maxDiscount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Discount</span>
            <span>{d.toFixed(1)}% <span className="text-[var(--charcoal-light)]">(max {maxDiscount}%)</span></span>
          </div>
          <input type="range" min={0} max={maxDiscount} step={0.5} value={d} onChange={(e) => setDiscount(parseFloat(e.target.value))} className="w-full accent-[var(--forest-green)]" />
        </div>
      )}

      <div className="rounded-lg bg-gray-50 p-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--charcoal-light)]">Subtotal</span><span>{gbp(subtotal)}</span></div>
        {d > 0 && <div className="flex justify-between text-[var(--charcoal-light)]"><span>Discount {d.toFixed(1)}%</span><span>−{gbp(subtotal - total)}</span></div>}
        <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{gbp(total)}</span></div>
        {showCommissions && commission.standardPct != null && (
          <div className="flex justify-between text-[var(--forest-green)] font-medium pt-1 border-t border-gray-200 mt-1">
            <span>Your commission ({commissionPct.toFixed(1)}%)</span><span>{gbp(commissionCents)}</span>
          </div>
        )}
      </div>

      <button onClick={handleAdd} disabled={adding} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--forest-green)" }}>
        {adding ? "Adding…" : "Add to cart"}
      </button>
    </div>
  );
}
