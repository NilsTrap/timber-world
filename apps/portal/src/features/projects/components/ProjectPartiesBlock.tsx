"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Pencil, X } from "lucide-react";
import { Button, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectPartyOption, ProjectPartyRef, ProjectPartyWorkspace } from "../types";
import { setProjectBuyer, setProjectCenter, setProjectSeller } from "../actions/projectPartyActions";
import { PersonaBadges } from "./PersonaBadges";

export function ProjectPartiesBlock({ projectId, workspace }: { projectId: string; workspace: ProjectPartyWorkspace }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"buyer" | "center" | "seller" | null>(null);
  const [editing, setEditing] = useState<"buyer" | "center" | null>(null);
  const downstream = workspace.downstreamParties ?? (workspace.seller ? [{ ...workspace.seller, projectId: workspace.seller.projectId ?? projectId, group: workspace.seller.personas.includes("trader") ? "traders" as const : "suppliers" as const }] : []);
  const mayAddTrader = workspace.sellerOptions.some((option) => option.group === "traders");

  async function mutate(kind: "buyer" | "center" | "seller", action: () => Promise<{ success: boolean; error?: string }>, success: string) {
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
      <PartySlot label="Buyer" party={workspace.buyer} onPartyClick={workspace.canEditBuyer && editing !== "buyer" ? () => setEditing("buyer") : undefined} className="min-w-[14rem] flex-1">
        {workspace.buyerProjectId && (workspace.canSetBuyer || editing === "buyer") ? <PartySelect placeholder="Select customer" options={workspace.buyerOptions} busy={busy === "buyer"} onChange={(id) => void mutate("buyer", () => setProjectBuyer({ projectId: workspace.buyerProjectId!, buyerOrganisationId: id }), "Buyer updated")} /> : null}
        {editing === "buyer" ? <CancelButton onClick={() => setEditing(null)} /> : null}
      </PartySlot>
      <ChainArrow />
      <PartySlot label="Trader 1 · Represented company" party={workspace.center} emphasized className="min-w-[15rem] flex-1">
        {editing === "center" ? <PartySelect placeholder="Select represented trader" options={workspace.centerOptions} busy={busy === "center"} onChange={(id) => void mutate("center", () => setProjectCenter({ projectId, traderOrganisationId: id }), "Represented trader updated")} /> : workspace.canEditCenter ? <EditButton onClick={() => setEditing("center")} /> : null}
        {editing === "center" ? <CancelButton onClick={() => setEditing(null)} /> : null}
      </PartySlot>
      {downstream.map((party, index) => <div key={party.projectId} className="contents"><ChainArrow /><PartySlot label={party.group === "traders" ? `Trader ${index + 2}` : "Manufacturer / Supplier"} party={party} href={`/projects/${party.projectId}`} className="min-w-[14rem] flex-1" /></div>)}
      {workspace.canSetSeller && workspace.chainProjectId ? <><ChainArrow /><PartySlot label={mayAddTrader ? (downstream.length === 0 ? "Next seller" : "Next party") : "Manufacturer / Supplier"} party={null} className="min-w-[15rem] flex-1"><PartySelect placeholder={mayAddTrader ? "Select trader or supplier" : "Select supplier or manufacturer"} options={workspace.sellerOptions} grouped busy={busy === "seller"} onChange={(id) => void mutate("seller", () => setProjectSeller({ projectId: workspace.chainProjectId!, sellerOrganisationId: id }), "Party added to the project chain")} /></PartySlot></> : null}
    </div>
  );
}

function ChainArrow() { return <ArrowRight className="hidden h-5 w-5 shrink-0 self-center text-muted-foreground md:block" aria-hidden="true" />; }
function PartySlot({ label, party, emphasized = false, href, onPartyClick, className = "", children }: { label: string; party: ProjectPartyRef | null; emphasized?: boolean; href?: string; onPartyClick?: () => void; className?: string; children?: React.ReactNode }) {
  const partyName = onPartyClick && party ? <button type="button" className="mt-1 block max-w-full truncate text-left text-base font-semibold underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Change buyer ${party.name ?? "company"}`} onClick={onPartyClick}>{party.name ?? "Not assigned"}</button> : <p className="mt-1 truncate text-base font-semibold">{party?.name ?? "Not assigned"}</p>;
  const card = <div className={`h-full rounded-lg border p-4 ${emphasized ? "border-primary/40 bg-primary/5 shadow-sm" : "bg-card"} ${className}`}><p className="text-sm text-muted-foreground">{label}</p>{partyName}{party ? <div className="mt-2 flex items-center gap-2">{party.code ? <span className="text-xs text-muted-foreground">{party.code}</span> : null}<PersonaBadges personas={party.personas} /></div> : null}{children ? <div className="mt-3 space-y-2">{children}</div> : null}</div>;
  return href ? <Link href={href} className={`${className} rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>{card}</Link> : card;
}
function EditButton({ onClick }: { onClick: () => void }) { return <Button type="button" size="sm" variant="outline" onClick={onClick}><Pencil className="h-3.5 w-3.5" /> Edit</Button>; }
function CancelButton({ onClick }: { onClick: () => void }) { return <Button type="button" size="sm" variant="ghost" onClick={onClick}><X className="h-3.5 w-3.5" /> Cancel</Button>; }
function PartySelect({ placeholder, options, busy, grouped = false, onChange }: { placeholder: string; options: ProjectPartyOption[]; busy: boolean; grouped?: boolean; onChange: (id: string) => void }) {
  const traders = options.filter((option) => option.group === "traders");
  const suppliers = options.filter((option) => option.group === "suppliers");
  const item = (option: ProjectPartyOption) => <SelectItem key={option.id} value={option.id}>{option.code ? `${option.code} — ${option.name}` : option.name}</SelectItem>;
  return <Select disabled={busy} onValueChange={onChange}><SelectTrigger aria-label={placeholder}>{busy ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span> : <SelectValue placeholder={placeholder} />}</SelectTrigger><SelectContent>{grouped ? <>{traders.length ? <SelectGroup><SelectLabel>Traders</SelectLabel>{traders.map(item)}</SelectGroup> : null}{traders.length && suppliers.length ? <SelectSeparator /> : null}{suppliers.length ? <SelectGroup><SelectLabel>Suppliers / Manufacturers</SelectLabel>{suppliers.map(item)}</SelectGroup> : null}</> : options.map(item)}</SelectContent></Select>;
}
