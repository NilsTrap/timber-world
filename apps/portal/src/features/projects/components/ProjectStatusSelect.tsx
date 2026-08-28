"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@timber/ui";
import { toast } from "sonner";
import { updateProjectStage } from "../../project-stages/actions";
import type { StageOption } from "../../project-stages/stages";

export function ProjectStatusSelect({ projectId, current, selectable, expectedUpdatedAt, fallbackLabel }: { projectId: string; current: StageOption | null; selectable: StageOption[]; expectedUpdatedAt: string | null; fallbackLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(current);
  const [token, setToken] = useState(expectedUpdatedAt);
  useEffect(() => { setSelected(current); setToken(expectedUpdatedAt); }, [current, expectedUpdatedAt]);
  const choices = current && !selectable.some((stage) => stage.key === current.key) ? [current, ...selectable] : selectable;
  const canChange = Boolean(token && selectable.some((stage) => stage.key !== selected?.key));
  function change(stageKey: string) {
    if (!token || stageKey === selected?.key) return;
    startTransition(async () => {
      const result = await updateProjectStage({ projectId, stageKey, expectedUpdatedAt: token });
      if (!result.success) { toast.error(result.error); if (result.code === "CONFLICT") router.refresh(); return; }
      setSelected(result.data.stage); setToken(result.data.updatedAt); toast.success("Project stage updated"); router.refresh();
    });
  }
  return <Select value={selected?.key ?? current?.key} disabled={!canChange || pending} onValueChange={change}>
    <SelectTrigger className="h-8 min-w-36" aria-label="Project stage"><SelectValue><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected?.color ?? current?.color ?? "#64748B" }} />{selected?.label ?? current?.label ?? fallbackLabel}</span></SelectValue></SelectTrigger>
    <SelectContent>{choices.map((stage) => <SelectItem key={stage.key} value={stage.key} disabled={!stage.isActive}><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />{stage.label}</span></SelectItem>)}</SelectContent>
  </Select>;
}
