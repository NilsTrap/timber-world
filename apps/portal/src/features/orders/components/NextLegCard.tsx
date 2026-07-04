"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";
import { Button } from "@timber/ui";
import { NewDealDialog } from "./NewDealDialog";

/**
 * L1 · "Create next leg" (right action column, ADMIN ONLY). Opens the New-deal
 * dialog pre-set to THIS deal's spine — the new leg copies this deal's spec lines
 * (prices blank) and joins its spine (minted now if the deal has none yet). Nils
 * assembles chains manually, so this is admin-only; salespeople never see it.
 */
export function NextLegCard({
  orderId,
  originLabel,
}: {
  orderId: string;
  originLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Chain</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Add another deal on this spine — its spec lines copy over with prices left blank for the new leg to price itself.
      </p>
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
        <GitBranch className="h-3.5 w-3.5" /> Create next leg
      </Button>

      <NewDealDialog
        open={open}
        onOpenChange={setOpen}
        presetOriginDealId={orderId}
        presetOriginLabel={originLabel}
      />
    </div>
  );
}
