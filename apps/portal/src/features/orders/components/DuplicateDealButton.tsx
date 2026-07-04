"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@timber/ui";
import { toast } from "sonner";
import { duplicateDealAction } from "../actions/legActions";

/**
 * R5 · "Duplicate" (right action column, ADMIN ONLY — the parent gates on isAdmin,
 * the action re-checks). Copies THIS deal into a new Draft origin: parties, currency,
 * all terms and the spec lines WITH prices, on a FRESH spine + its own code (no docs,
 * no external refs). Navigates to the new deal.
 */
export function DuplicateDealButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onDuplicate = async () => {
    setBusy(true);
    const res = await duplicateDealAction({ sourceDealId: orderId });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(res.data.dealCode ? `Deal ${res.data.dealCode} created` : "Deal duplicated");
    router.push(`/orders/${res.data.id}`);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Copy className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Duplicate</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Create a new Draft deal that copies this deal&apos;s parties, terms and priced lines onto a fresh spine.
      </p>
      <Button size="sm" variant="outline" className="w-full" onClick={onDuplicate} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Duplicate deal
      </Button>
    </div>
  );
}
