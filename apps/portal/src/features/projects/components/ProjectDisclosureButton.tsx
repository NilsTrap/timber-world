"use client";

import { ChevronDown } from "lucide-react";
import { Button, cn } from "@timber/ui";

export function ProjectDisclosureButton({ open, controls, disabled = false, expandLabel, collapseLabel, onToggle }: { open: boolean; controls: string; disabled?: boolean; expandLabel: string; collapseLabel: string; onToggle: () => void }) {
  return <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={open ? collapseLabel : expandLabel} aria-expanded={open} aria-controls={controls} disabled={disabled} onClick={onToggle}><ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" /></Button>;
}
