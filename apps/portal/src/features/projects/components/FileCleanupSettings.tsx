"use client";

import { useState } from "react";
import { Button, Card, CardContent, Checkbox, Input, Label, Textarea } from "@timber/ui";
import { toast } from "sonner";
import { setPlatformSetting } from "@/features/access/actions/platformSettings";

export interface FileCleanupPolicy { llmEnabled: boolean; prompt: string; extraTerms: string[] }

export function FileCleanupSettings({ initial }: { initial: FileCleanupPolicy }) {
  const [value, setValue] = useState(initial); const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); const result = await setPlatformSetting("project_file_cleanup", value); setSaving(false); result.success ? toast.success("Cleanup instructions saved") : toast.error(result.error); };
  return <Card><CardContent className="space-y-5 pt-6"><label className="flex items-center gap-2"><Checkbox checked={value.llmEnabled} onCheckedChange={(checked) => setValue((current) => ({ ...current, llmEnabled: checked === true }))} />Use the optional LLM detector when configured</label><div className="space-y-2"><Label htmlFor="cleanup-prompt">Cleanup system prompt</Label><Textarea id="cleanup-prompt" rows={7} value={value.prompt} onChange={(event) => setValue((current) => ({ ...current, prompt: event.target.value }))} /><p className="text-xs text-muted-foreground">The LLM suggests exact identifying strings. Deterministic format cleaners perform removal; the trader still approves the result.</p></div><div className="space-y-2"><Label htmlFor="cleanup-terms">Additional sensitive terms</Label><Input id="cleanup-terms" value={value.extraTerms.join(", ")} onChange={(event) => setValue((current) => ({ ...current, extraTerms: event.target.value.split(",").map((term) => term.trim()).filter(Boolean) }))} placeholder="Bank account, internal customer code, alias" /></div><Button type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save cleanup instructions"}</Button></CardContent></Card>;
}
