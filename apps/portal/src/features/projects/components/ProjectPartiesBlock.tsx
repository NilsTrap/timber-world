"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Pencil, X } from "lucide-react";
import { Button, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectPartyOption, ProjectPartyRef, ProjectPartyWorkspace } from "../types";
import { correctProjectLegSeller, setProjectBuyer } from "../actions/projectPartyActions";
import { completeProjectLegParty } from "../actions/projectLegActions";
import { PersonaBadges } from "./PersonaBadges";

export function ProjectPartiesBlock({ projectId, workspace }: { projectId: string; workspace: ProjectPartyWorkspace }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"buyer" | "seller" | null>(null);
  const [editing, setEditing] = useState<"buyer" | "seller" | null>(null);

  async function mutate(kind: "buyer" | "seller", action: () => Promise<{ success: boolean; error?: string }>, success: string) {
    setBusy(kind);
    try {
      const result = await action();
      if (!result.success) return toast.error(result.error ?? "Could not update party");
      setEditing(null);
      toast.success(success);
      router.refresh();
    } catch {
      toast.error("Could not update party");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
      <PartySlot label="Buyer" party={workspace.buyer} onEdit={workspace.canEditBuyer && editing !== "buyer" ? () => setEditing("buyer") : undefined}>
        {workspace.buyerProjectId && editing === "buyer" ? <PartySelect placeholder="Select buyer" options={workspace.buyerOptions} busy={busy === "buyer"} onChange={(id) => void mutate("buyer", () => workspace.buyer ? setProjectBuyer({ projectId: workspace.buyerProjectId!, buyerOrganisationId: id }) : completeProjectLegParty({ projectId, side: "buyer", organisationId: id }), "Buyer updated")} /> : null}
        {editing === "buyer" ? <CancelButton onClick={() => setEditing(null)} /> : null}
      </PartySlot>
      <ArrowRight className="hidden h-5 w-5 shrink-0 self-center text-muted-foreground md:block" aria-hidden="true" />
      <PartySlot label="Seller" party={workspace.seller} emptyLabel={workspace.openRfqState === "open" ? "RFP - no winner selected" : workspace.openRfqState === "unavailable" ? "Sourcing state unavailable" : undefined} onEdit={workspace.canEditSeller && editing !== "seller" ? () => setEditing("seller") : undefined}>
        {editing === "seller" ? <PartySelect placeholder="Select seller" options={workspace.sellerOptions} grouped busy={busy === "seller"} onChange={(id) => void mutate("seller", () => workspace.seller ? correctProjectLegSeller({ projectId, sellerOrganisationId: id }) : completeProjectLegParty({ projectId, side: "seller", organisationId: id }), "Seller updated")} /> : null}
        {editing === "seller" ? <CancelButton onClick={() => setEditing(null)} /> : null}
      </PartySlot>
    </div>
  );
}

function PartySlot({ label, party, emptyLabel, onEdit, children }: { label: string; party: ProjectPartyRef | null; emptyLabel?: string; onEdit?: () => void; children?: React.ReactNode }) {
  return <div className="min-w-[14rem] flex-1 rounded-md border bg-background p-4"><p className="text-sm text-muted-foreground">{label}</p><div className="mt-1 flex items-center justify-between gap-3"><p className="truncate text-base font-semibold">{party?.name ?? emptyLabel ?? "Not assigned"}</p>{onEdit ? <Button type="button" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button> : null}</div>{party ? <div className="mt-2 flex items-center gap-2">{party.code ? <span className="text-xs text-muted-foreground">{party.code}</span> : null}<PersonaBadges personas={party.personas} /></div> : null}{children ? <div className="mt-3 space-y-2">{children}</div> : null}</div>;
}

function CancelButton({ onClick }: { onClick: () => void }) { return <Button type="button" size="sm" variant="ghost" onClick={onClick}><X className="h-3.5 w-3.5" /> Cancel</Button>; }
function PartySelect({ placeholder, options, busy, grouped = false, onChange }: { placeholder: string; options: ProjectPartyOption[]; busy: boolean; grouped?: boolean; onChange: (id: string) => void }) {
  const traders = options.filter((option) => option.group === "traders");
  const suppliers = options.filter((option) => option.group === "suppliers");
  const item = (option: ProjectPartyOption) => <SelectItem key={option.id} value={option.id}>{option.code ? `${option.code} — ${option.name}` : option.name}</SelectItem>;
  return <Select disabled={busy} onValueChange={onChange}><SelectTrigger aria-label={placeholder}>{busy ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span> : <SelectValue placeholder={placeholder} />}</SelectTrigger><SelectContent>{grouped ? <>{traders.length ? <SelectGroup><SelectLabel>Traders</SelectLabel>{traders.map(item)}</SelectGroup> : null}{traders.length && suppliers.length ? <SelectSeparator /> : null}{suppliers.length ? <SelectGroup><SelectLabel>Suppliers / Manufacturers</SelectLabel>{suppliers.map(item)}</SelectGroup> : null}</> : options.map(item)}</SelectContent></Select>;
}
