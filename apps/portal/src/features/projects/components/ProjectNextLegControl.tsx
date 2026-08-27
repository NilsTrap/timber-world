"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectPartyOption } from "../types";
import { setProjectSeller } from "../actions/projectPartyActions";

export function ProjectNextLegControl({ projectId, options }: { projectId: string; options: ProjectPartyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const traders = options.filter((option) => option.group === "traders");
  const suppliers = options.filter((option) => option.group === "suppliers");
  const item = (option: ProjectPartyOption) => <SelectItem key={option.id} value={option.id}>{option.code ? `${option.code} — ${option.name}` : option.name}</SelectItem>;

  async function append(sellerOrganisationId: string) {
    setBusy(true);
    try {
      const result = await setProjectSeller({ projectId, sellerOrganisationId });
      if (!result.success) return toast.error(result.error);
      toast.success("Next project leg added");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not add the next project leg");
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/20 p-3">{open ? <><span className="text-sm font-medium">Next leg seller</span><Select disabled={busy} onValueChange={(id) => void append(id)}><SelectTrigger className="w-full sm:w-72" aria-label="Select next leg seller">{busy ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span> : <SelectValue placeholder="Select trader or supplier" />}</SelectTrigger><SelectContent>{traders.length ? <SelectGroup><SelectLabel>Traders</SelectLabel>{traders.map(item)}</SelectGroup> : null}{traders.length && suppliers.length ? <SelectSeparator /> : null}{suppliers.length ? <SelectGroup><SelectLabel>Suppliers / Manufacturers</SelectLabel>{suppliers.map(item)}</SelectGroup> : null}</SelectContent></Select><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></> : <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add next leg</Button>}</div>;
}
