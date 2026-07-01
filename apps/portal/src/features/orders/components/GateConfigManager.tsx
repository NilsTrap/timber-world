"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import {
  Button, Input, Switch,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  StatusBadge, SectionHeader, EmptyState,
} from "@timber/ui";
import { LIFECYCLE_STAGES, describeBlock, type GateBlock, type GateConfigRow } from "../services/lifecycle";
import { listGateConfigsAction, upsertGateConfigAction } from "../actions/lifecycleActions";

/** Deal kinds a gate can be configured for (mirrors dealModel.DealKind). */
const DEAL_KINDS: { value: string; label: string }[] = [
  { value: "buy_sell", label: "Buy / Sell" },
  { value: "sale_only", label: "Sale only" },
  { value: "purchase_only", label: "Purchase only" },
];
/** From-stages a gate can guard (every active stage except the terminal "delivered"). */
const FROM_STAGES = LIFECYCLE_STAGES.filter((s) => s !== "delivered");

const STAGE_LABELS: Record<string, string> = {
  draft: "Draft", confirmed: "Confirmed", produced: "Produced", loaded: "Loaded",
};
function dealKindLabel(k: string): string {
  return DEAL_KINDS.find((d) => d.value === k)?.label ?? k;
}
function stageLabel(s: string): string {
  return STAGE_LABELS[s] ?? s;
}

/** The building-block templates the admin can add to a gate. */
type BlockTemplate = "party_signoff:seller" | "party_signoff:buyer" | "acceptance" | "condition:payment_recorded" | "condition:document_present";
const BLOCK_TEMPLATES: { value: BlockTemplate; label: string }[] = [
  { value: "party_signoff:seller", label: "Seller sign-off" },
  { value: "party_signoff:buyer", label: "Buyer sign-off" },
  { value: "acceptance", label: "Buyer acceptance" },
  { value: "condition:payment_recorded", label: "Condition: payment recorded" },
  { value: "condition:document_present", label: "Condition: document present" },
];
function templateToBlock(t: BlockTemplate): GateBlock {
  switch (t) {
    case "party_signoff:seller": return { type: "party_signoff", party: "seller" };
    case "party_signoff:buyer": return { type: "party_signoff", party: "buyer" };
    case "acceptance": return { type: "acceptance" };
    case "condition:payment_recorded": return { type: "condition", condition: "payment_recorded" };
    case "condition:document_present": return { type: "condition", condition: "document_present" };
  }
}

interface EditorState {
  dealKind: string;
  fromStage: string;
  requirements: GateBlock[];
  isActive: boolean;
  /** True when editing an existing gate (deal-kind × from-stage locked). */
  existing: boolean;
}

/**
 * Gate-config admin manager (E3): lists every configured gate (deal-kind ×
 * from-stage) and lets an admin edit its requirement building blocks and active
 * flag. Saves via upsertGateConfigAction (upsert on deal_kind+from_stage).
 * Mirrors ReferenceDataManager's add/edit/save UX.
 */
export function GateConfigManager() {
  const [gates, setGates] = useState<GateConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [addTemplate, setAddTemplate] = useState<BlockTemplate>("party_signoff:seller");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listGateConfigsAction();
    if (res.success) setGates(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditor({ dealKind: "buy_sell", fromStage: "draft", requirements: [], isActive: true, existing: false });
  const openEdit = (g: GateConfigRow) => setEditor({ dealKind: g.dealKind, fromStage: g.fromStage, requirements: g.requirements, isActive: g.isActive, existing: true });

  const addBlock = () => {
    if (!editor) return;
    setEditor({ ...editor, requirements: [...editor.requirements, templateToBlock(addTemplate)] });
  };
  const removeBlock = (idx: number) => {
    if (!editor) return;
    setEditor({ ...editor, requirements: editor.requirements.filter((_, i) => i !== idx) });
  };
  const setDocType = (idx: number, docType: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      requirements: editor.requirements.map((b, i) =>
        i === idx && b.type === "condition" && b.condition === "document_present"
          ? { ...b, docType: docType.trim() === "" ? undefined : docType }
          : b,
      ),
    });
  };

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    const res = await upsertGateConfigAction({
      dealKind: editor.dealKind,
      fromStage: editor.fromStage,
      requirements: editor.requirements,
      isActive: editor.isActive,
    });
    setSaving(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Gate saved");
    setEditor(null);
    await load();
  };

  const toggleActive = async (g: GateConfigRow) => {
    const res = await upsertGateConfigAction({ dealKind: g.dealKind, fromStage: g.fromStage, requirements: g.requirements, isActive: !g.isActive });
    if (!res.success) { toast.error(res.error); return; }
    toast.success(g.isActive ? "Gate deactivated" : "Gate activated");
    await load();
  };

  // Which (deal-kind × from-stage) combos already exist — used when adding a new gate.
  const existingKeys = useMemo(() => new Set(gates.map((g) => `${g.dealKind}|${g.fromStage}`)), [gates]);
  const editorCollides = editor != null && !editor.existing && existingKeys.has(`${editor.dealKind}|${editor.fromStage}`);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Deal gates"
        subtitle={`${gates.length} configured — an empty or inactive gate auto-advances.`}
        action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Add gate</Button>}
      />

      {gates.length === 0 ? (
        <EmptyState message="No gates configured. Every stage auto-advances until you add a gate." onClick={openNew} />
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Deal kind</TableHead>
                <TableHead>From stage</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gates.map((g) => (
                <TableRow key={g.id} className={g.isActive ? "" : "opacity-50"}>
                  <TableCell className="font-medium">{dealKindLabel(g.dealKind)}</TableCell>
                  <TableCell>{stageLabel(g.fromStage)}</TableCell>
                  <TableCell>
                    {g.requirements.length === 0
                      ? <span className="text-muted-foreground">— (auto-advance)</span>
                      : g.requirements.map(describeBlock).join(", ")}
                  </TableCell>
                  <TableCell><StatusBadge variant={g.isActive ? "success" : "draft"}>{g.isActive ? "Active" : "Inactive"}</StatusBadge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(g)}>{g.isActive ? "Disable" : "Enable"}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editor != null} onOpenChange={(o) => { if (!o) setEditor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.existing ? "Edit gate" : "Add gate"}</DialogTitle>
            <DialogDescription>
              Requirements to advance FROM this stage. Every block must be satisfied; an empty or inactive gate auto-advances.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Deal kind</label>
                  <Select value={editor.dealKind} onValueChange={(v) => setEditor({ ...editor, dealKind: v })} disabled={editor.existing}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEAL_KINDS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">From stage</label>
                  <Select value={editor.fromStage} onValueChange={(v) => setEditor({ ...editor, fromStage: v })} disabled={editor.existing}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FROM_STAGES.map((s) => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editorCollides && (
                <p className="text-xs text-amber-600">A gate for this deal kind and stage already exists — saving will overwrite it.</p>
              )}

              {/* Requirement blocks */}
              <div className="space-y-2">
                <span className="text-xs font-medium">Requirements</span>
                {editor.requirements.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No requirements — this gate auto-advances.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {editor.requirements.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                        <span className="text-sm flex-1">{describeBlock(b)}</span>
                        {b.type === "condition" && b.condition === "document_present" && (
                          <Input
                            value={b.docType ?? ""}
                            onChange={(e) => setDocType(idx, e.target.value)}
                            placeholder="docType (optional)"
                            className="h-7 w-40 text-xs"
                          />
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => removeBlock(idx)} aria-label="Remove requirement">
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2">
                  <Select value={addTemplate} onValueChange={(v) => setAddTemplate(v as BlockTemplate)}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BLOCK_TEMPLATES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={addBlock}><Plus className="h-3.5 w-3.5" /> Add</Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={editor.isActive} onCheckedChange={(c) => setEditor({ ...editor, isActive: c })} id="gate-active" />
                <label htmlFor="gate-active" className="text-sm">Active</label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditor(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save gate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
