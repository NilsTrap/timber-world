"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCartItem, removeCartItem, placeOrder } from "@/app/(app)/cart/actions";
import type { CartOrder } from "@/lib/orderTypes";
import { gbp } from "@/lib/pricing";

export function CartView({ order: initial }: { order: CartOrder | null }) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [placed, setPlaced] = useState<string | null>(null);

  const items = order?.items ?? [];

  const refresh = () => router.refresh();

  const changeQty = async (itemId: string, qty: number, discountPct: number) => {
    if (qty < 1) return;
    setBusy(true);
    const r = await updateCartItem({ itemId, quantityPackages: qty, discountPct });
    setBusy(false);
    if (r.success) refresh(); else toast.error(r.error);
  };

  const remove = async (itemId: string) => {
    setBusy(true);
    const r = await removeCartItem(itemId);
    setBusy(false);
    if (r.success) { setOrder((o) => o ? { ...o, items: o.items.filter((i) => i.id !== itemId) } : o); refresh(); }
    else toast.error(r.error);
  };

  const place = async () => {
    if (!name.trim() || !address.trim()) { toast.error("Customer name and delivery address are required."); return; }
    setBusy(true);
    const r = await placeOrder({ customerName: name, customerCompany: company, deliveryAddress: address, notes });
    setBusy(false);
    if (r.success) { setPlaced(r.data.code); toast.success(`Order ${r.data.code} placed`); }
    else toast.error(r.error);
  };

  if (placed) {
    return (
      <div className="rounded-xl bg-white border border-gray-100 p-6 text-center space-y-3">
        <h2 className="text-lg font-semibold">Order {placed} placed</h2>
        <p className="text-sm text-[var(--charcoal-light)]">Thanks — your order has been submitted. You can track it under My Orders.</p>
        <div className="flex gap-2 justify-center pt-1">
          <Link href="/orders" className="text-sm font-semibold text-[var(--forest-green)]">My Orders</Link>
          <span className="text-gray-300">·</span>
          <Link href="/catalog" className="text-sm font-semibold text-[var(--forest-green)]">Keep browsing</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-100 p-8 text-center space-y-3">
        <p className="text-sm text-[var(--charcoal-light)]">Your cart is empty.</p>
        <Link href="/catalog" className="text-sm font-semibold text-[var(--forest-green)]">Browse the catalog</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-gray-100 divide-y divide-gray-100">
        {items.map((it) => (
          <div key={it.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{it.productName}</div>
                <div className="text-xs text-[var(--charcoal-light)]">{it.variantLabel} · {it.packagingName} ({it.piecesPerPackage} pcs)</div>
              </div>
              <button onClick={() => remove(it.id)} disabled={busy} className="text-xs text-red-600 shrink-0">Remove</button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => changeQty(it.id, it.quantityPackages - 1, it.discountPct)} disabled={busy || it.quantityPackages <= 1} className="w-8 h-8 rounded-lg border border-gray-200 font-semibold">−</button>
                <span className="text-sm w-8 text-center">{it.quantityPackages}</span>
                <button onClick={() => changeQty(it.id, it.quantityPackages + 1, it.discountPct)} disabled={busy} className="w-8 h-8 rounded-lg border border-gray-200 font-semibold">+</button>
                <span className="text-xs text-[var(--charcoal-light)]">pkg{it.discountPct > 0 ? ` · −${it.discountPct}%` : ""}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{gbp(it.lineTotalCents)}</div>
                {it.commissionCents > 0 && <div className="text-xs text-[var(--forest-green)]">comm {gbp(it.commissionCents)}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="rounded-xl bg-white border border-gray-100 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--charcoal-light)]">Subtotal</span><span>{gbp(order!.subtotalCents)}</span></div>
        {order!.discountTotalCents > 0 && <div className="flex justify-between text-[var(--charcoal-light)]"><span>Discount</span><span>−{gbp(order!.discountTotalCents)}</span></div>}
        <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{gbp(order!.totalCents)}</span></div>
        {order!.commissionTotalCents > 0 && <div className="flex justify-between text-[var(--forest-green)] font-medium"><span>Your commission</span><span>{gbp(order!.commissionTotalCents)}</span></div>}
      </div>

      {/* Checkout */}
      <div className="rounded-xl bg-white border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-semibold">Customer & delivery</h2>
        <div className="space-y-1.5"><label className="text-xs font-medium">Customer name *</label><input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium">Company</label><input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium">Delivery address *</label><textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[70px]" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium">Notes</label><textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[50px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button onClick={place} disabled={busy} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--forest-green)" }}>
          {busy ? "Placing…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
