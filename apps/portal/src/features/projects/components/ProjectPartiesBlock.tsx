"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectPartyRef, ProjectPartyWorkspace } from "../types";
import { setProjectBuyer, setProjectSeller } from "../actions/projectPartyActions";
import { PersonaBadges } from "./PersonaBadges";

export function ProjectPartiesBlock({ projectId, workspace }: { projectId: string; workspace: ProjectPartyWorkspace }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"buyer" | "seller" | null>(null);

  async function chooseBuyer(id: string) {
    setBusy("buyer");
    const result = await setProjectBuyer({ projectId, buyerOrganisationId: id });
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Buyer assigned");
    router.refresh();
  }

  async function chooseSeller(id: string) {
    setBusy("seller");
    const result = await setProjectSeller({ projectId, sellerOrganisationId: id });
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Seller assigned and purchase project shared");
    router.refresh();
  }

  return (
    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
      <PartySlot label="Buyer" party={workspace.buyer}>
        {workspace.canSetBuyer ? (
          <PartySelect placeholder="Select customer" options={workspace.buyerOptions} busy={busy === "buyer"} onChange={chooseBuyer} />
        ) : null}
      </PartySlot>
      <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-muted-foreground md:block" aria-hidden="true" />
      <PartySlot label="Represented company" party={workspace.center} emphasized />
      <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-muted-foreground md:block" aria-hidden="true" />
      <PartySlot label="Seller" party={workspace.seller} href={workspace.seller?.projectId ? `/projects/${workspace.seller.projectId}` : undefined}>
        {workspace.canSetSeller ? (
          <PartySelect placeholder="Select trader or supplier" options={workspace.sellerOptions} busy={busy === "seller"} onChange={chooseSeller} />
        ) : null}
      </PartySlot>
    </div>
  );
}

function PartySlot({ label, party, emphasized = false, href, children }: { label: string; party: ProjectPartyRef | null; emphasized?: boolean; href?: string; children?: React.ReactNode }) {
  const card = (
    <div className={`h-full rounded-lg border p-4 ${emphasized ? "border-primary/40 bg-primary/5 shadow-sm" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold">{party?.name ?? "Not assigned"}</p>
      {party ? (
        <div className="mt-2 flex items-center gap-2">
          {party.code ? <span className="text-xs text-muted-foreground">{party.code}</span> : null}
          <PersonaBadges personas={party.personas} />
        </div>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{card}</Link> : card;
}

function PartySelect({ placeholder, options, busy, onChange }: { placeholder: string; options: ProjectPartyWorkspace["buyerOptions"]; busy: boolean; onChange: (id: string) => void }) {
  return (
    <Select disabled={busy} onValueChange={onChange}>
      <SelectTrigger aria-label={placeholder}>
        {busy ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span> : <SelectValue placeholder={placeholder} />}
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.code ? `${option.code} — ${option.name}` : option.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
