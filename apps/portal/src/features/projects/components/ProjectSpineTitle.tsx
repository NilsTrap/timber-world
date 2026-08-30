"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { updateProjectSpineTitle } from "../actions/projectSpineActions";

export function ProjectSpineTitle({ projectId, title, expectedTitle, canEdit }: { projectId: string; title: string; expectedTitle: string | null; canEdit: boolean }) {
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [titleToken, setTitleToken] = useState(expectedTitle);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (editing) return;
    setValue(title);
    setTitleToken(expectedTitle);
  }, [editing, expectedTitle, title]);

  function save() {
    if (pending) return;
    startTransition(async () => {
      const result = await updateProjectSpineTitle({ projectId, title: value, expectedTitle: titleToken });
      if (!result.success) { toast.error(result.error); return; }
      setValue(result.data.title);
      setTitleToken(result.data.title);
      setEditing(false);
      toast.success("Project title updated");
    });
  }

  if (!editing) return <div className="group flex min-w-0 items-center gap-2"><h1 className="truncate text-3xl font-semibold tracking-tight">{value}</h1>{canEdit ? <Button type="button" size="icon" variant="ghost" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" aria-label="Edit project title" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button> : null}</div>;

  return <div className="flex min-w-0 items-center gap-2"><Input autoFocus value={value} maxLength={160} aria-label="Project title" className="h-10 min-w-0 text-xl font-semibold" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") { setValue(titleToken ?? title); setEditing(false); } }} /><Button type="button" size="icon" disabled={pending || !value.trim()} aria-label="Save project title" onClick={save}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button><Button type="button" size="icon" variant="ghost" disabled={pending} aria-label="Cancel title editing" onClick={() => { setValue(titleToken ?? title); setEditing(false); }}><X className="h-4 w-4" /></Button></div>;
}
