"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@timber/ui";
import { toast } from "sonner";
import { confirmAgentOrder, cancelAgentOrder } from "../actions/agentOrders";

export function AgentOrderActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.success) { toast.success(ok); router.refresh(); }
    else toast.error(r.error || "Failed");
  };

  if (status === "cancelled") return <span className="text-sm text-muted-foreground">This order was cancelled.</span>;
  if (status === "confirmed") {
    return (
      <div className="flex gap-2">
        <span className="text-sm text-green-700 font-medium self-center">Confirmed</span>
        <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => run(() => cancelAgentOrder(id), "Order cancelled")}>Cancel order</Button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button disabled={busy} onClick={() => run(() => confirmAgentOrder(id), "Order confirmed")}>Confirm order</Button>
      <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => run(() => cancelAgentOrder(id), "Order cancelled")}>Cancel</Button>
    </div>
  );
}
