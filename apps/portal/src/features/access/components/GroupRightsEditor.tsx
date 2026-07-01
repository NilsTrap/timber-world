"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, ChevronRight, ChevronDown } from "lucide-react";
import {
  Button,
  Input,
  Switch,
  Checkbox,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@timber/ui";
import { FIELD_DOMAINS, type DealScope, type FieldDomain, type FieldGrant } from "@/lib/access/types";
import type { GroupRightsInput } from "../types";
import { getAccessGroupDetail, listPortalModules, saveGroupRights } from "../actions";
import { ORDER_FIELD_DOMAINS } from "@/features/orders/services/dealFields";

const DOMAIN_LABELS: Record<FieldDomain, string> = {
  general: "General",
  deal_terms: "Deal terms & pricing",
  production: "Production",
  margin: "Margin & P&L",
  financial_docs: "Invoicing",
  logistics: "Logistics",
  customer_identity: "Customer identity",
  supplier_identity: "Supplier identity",
  chain: "Chain & spine linkage",
};

const DEAL_VISIBILITY_OPTIONS: { key: string; label: string }[] = [
  { key: "side.sell", label: "Sell-side deals" },
  { key: "side.buy", label: "Buy-side deals" },
  { key: "legacy.producer", label: "Legacy producer slot (transitional)" },
  { key: "spine.status", label: "Spine status (chain overview)" },
];

const SCOPE_OPTIONS: { value: DealScope; label: string }[] = [
  { value: "mine", label: "Only own deals" },
  { value: "company", label: "Own company's deals" },
  { value: "all", label: "Everything" },
];

const ACTION_OPTIONS: { key: string; label: string }[] = [
  { key: "counterparty:clients", label: "Manage client records" },
  { key: "counterparty:suppliers", label: "Manage supplier records" },
  { key: "deal:create", label: "Create deals (seeds spines)" },
];

/** Known deal-field keys offered as suggestions for per-field overrides. */
const KNOWN_FIELD_KEYS = Object.keys(ORDER_FIELD_DOMAINS).sort();

interface PortalModule {
  code: string;
  name: string;
  category: string | null;
}

interface OverrideRow {
  field: string;
  visible: boolean;
  editable: boolean;
}

interface EditorState {
  modules: Set<string>;
  dealVisibility: Set<string>;
  fieldDomains: Record<FieldDomain, FieldGrant>;
  overrides: OverrideRow[];
  scope: DealScope;
  actions: Set<string>;
}

function emptyDomains(): Record<FieldDomain, FieldGrant> {
  const out = {} as Record<FieldDomain, FieldGrant>;
  for (const d of FIELD_DOMAINS) out[d] = { visible: false, editable: false };
  return out;
}

interface GroupRightsEditorProps {
  groupId: string | null;
  groupName: string;
  isSystem: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * GroupRightsEditor (E4) — the per-group rights matrix dialog: module
 * toggles (grouped by category), row-level deal visibility + scope,
 * field-domain grants (visible/editable), per-field overrides, and action
 * rights. Saves the whole matrix via saveGroupRights (full replace).
 */
export function GroupRightsEditor({
  groupId,
  groupName,
  isSystem,
  open,
  onOpenChange,
  onSaved,
}: GroupRightsEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<PortalModule[]>([]);
  const [state, setState] = useState<EditorState | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newFieldKey, setNewFieldKey] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    // Clear any previously loaded group's matrix BEFORE fetching, so a failed
    // load can never leave a stale group's rights renderable/savable under the
    // new group's title.
    setState(null);
    const [detailRes, modulesRes] = await Promise.all([
      getAccessGroupDetail(groupId),
      listPortalModules(),
    ]);
    if (!detailRes.success) {
      toast.error(detailRes.error);
      setLoading(false);
      return;
    }
    if (modulesRes.success) setModules(modulesRes.data);
    else toast.error(modulesRes.error);

    const detail = detailRes.data;
    const domains = emptyDomains();
    for (const d of FIELD_DOMAINS) {
      const grant = detail.fieldDomains[d];
      if (grant) domains[d] = { visible: grant.visible, editable: grant.editable };
    }
    setState({
      modules: new Set(detail.modules),
      dealVisibility: new Set(detail.dealVisibility),
      fieldDomains: domains,
      overrides: Object.entries(detail.fieldOverrides).map(([field, grant]) => ({
        field,
        visible: grant.visible,
        editable: grant.editable,
      })),
      scope: detail.scope,
      actions: new Set(detail.actions),
    });
    setNewFieldKey("");
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (open && groupId) load();
  }, [open, groupId, load]);

  // Group modules by category (null → "Other"); expand all on first load.
  const groupedModules = useMemo(() => {
    const groups = new Map<string, PortalModule[]>();
    for (const m of modules) {
      const category = m.category ?? "Other";
      const existing = groups.get(category) || [];
      existing.push(m);
      groups.set(category, existing);
    }
    return groups;
  }, [modules]);

  useEffect(() => {
    setExpandedCategories(new Set(groupedModules.keys()));
  }, [groupedModules]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // The counterparty address books are gated by TWO rights that must move
  // together: the module (nav/page + org ceiling) and the action (server
  // actions + organisations RLS). Granting one without the other yields a
  // visible-but-broken book, so the editor keeps them in lockstep.
  const MODULE_ACTION_PAIR: Record<string, string> = {
    "counterparties.clients": "counterparty:clients",
    "counterparties.suppliers": "counterparty:suppliers",
  };
  const ACTION_MODULE_PAIR: Record<string, string> = {
    "counterparty:clients": "counterparties.clients",
    "counterparty:suppliers": "counterparties.suppliers",
  };

  const toggleModule = (code: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const modulesNext = new Set(prev.modules);
      const enabled = !modulesNext.has(code);
      if (enabled) modulesNext.add(code);
      else modulesNext.delete(code);
      const paired = MODULE_ACTION_PAIR[code];
      if (!paired) return { ...prev, modules: modulesNext };
      const actionsNext = new Set(prev.actions);
      if (enabled) actionsNext.add(paired);
      else actionsNext.delete(paired);
      return { ...prev, modules: modulesNext, actions: actionsNext };
    });
  };

  const toggleVisibility = (key: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.dealVisibility);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, dealVisibility: next };
    });
  };

  const toggleAction = (key: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const actionsNext = new Set(prev.actions);
      const enabled = !actionsNext.has(key);
      if (enabled) actionsNext.add(key);
      else actionsNext.delete(key);
      const paired = ACTION_MODULE_PAIR[key];
      if (!paired) return { ...prev, actions: actionsNext };
      const modulesNext = new Set(prev.modules);
      if (enabled) modulesNext.add(paired);
      else modulesNext.delete(paired);
      return { ...prev, actions: actionsNext, modules: modulesNext };
    });
  };

  /** Editable implies visible: enabling editable enables visible; disabling
   * visible disables editable. `general` is visible to anyone who can see the
   * row (deny-by-default only applies to the sensitive domains), so its
   * visibility cannot be turned off — only its editability is configurable. */
  const setDomainGrant = (domain: FieldDomain, patch: Partial<FieldGrant>) => {
    setState((prev) => {
      if (!prev) return prev;
      const current = prev.fieldDomains[domain];
      let next: FieldGrant = { ...current, ...patch };
      if (patch.editable === true) next = { ...next, visible: true };
      if (patch.visible === false) next = { ...next, editable: false };
      if (domain === "general") next = { ...next, visible: true };
      return { ...prev, fieldDomains: { ...prev.fieldDomains, [domain]: next } };
    });
  };

  const setOverride = (idx: number, patch: Partial<FieldGrant>) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        overrides: prev.overrides.map((row, i) => {
          if (i !== idx) return row;
          let next = { ...row, ...patch };
          if (patch.editable === true) next = { ...next, visible: true };
          if (patch.visible === false) next = { ...next, editable: false };
          return next;
        }),
      };
    });
  };

  const removeOverride = (idx: number) => {
    setState((prev) =>
      prev ? { ...prev, overrides: prev.overrides.filter((_, i) => i !== idx) } : prev,
    );
  };

  const addOverride = () => {
    const key = newFieldKey.trim();
    if (!key) return;
    if (state?.overrides.some((row) => row.field === key)) {
      toast.error("An override for this field already exists");
      return;
    }
    setState((prev) =>
      prev
        ? { ...prev, overrides: [...prev.overrides, { field: key, visible: true, editable: false }] }
        : prev,
    );
    setNewFieldKey("");
  };

  const save = async () => {
    if (!groupId || !state) return;
    setSaving(true);
    const fieldDomains: Partial<Record<FieldDomain, FieldGrant>> = {};
    for (const d of FIELD_DOMAINS) {
      const grant = state.fieldDomains[d];
      if (grant.visible || grant.editable) fieldDomains[d] = grant;
    }
    const fieldOverrides: Record<string, FieldGrant> = {};
    for (const row of state.overrides) {
      const key = row.field.trim();
      if (!key) continue;
      fieldOverrides[key] = { visible: row.visible, editable: row.editable };
    }
    const input: GroupRightsInput = {
      modules: Array.from(state.modules),
      dealVisibility: Array.from(state.dealVisibility),
      fieldDomains,
      fieldOverrides,
      scope: state.scope,
      actions: Array.from(state.actions),
    };
    const res = await saveGroupRights(groupId, input);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Group rights saved");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit rights — {groupName}</DialogTitle>
          <DialogDescription>
            Members get the union of the rights of all their groups; module rights are additionally
            capped by the organisation ceiling.
          </DialogDescription>
        </DialogHeader>

        {loading || !state ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-1 pr-1">
            {isSystem && (
              <p className="text-xs text-muted-foreground">
                This is a system group with seeded defaults. Edits apply immediately to all its
                members.
              </p>
            )}

            {/* a. Modules */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Modules</h3>
              <div className="space-y-1">
                {Array.from(groupedModules.entries()).map(([category, categoryModules]) => {
                  const isExpanded = expandedCategories.has(category);
                  const enabledCount = categoryModules.filter((m) => state.modules.has(m.code)).length;
                  return (
                    <div key={category} className="border rounded-lg">
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex w-full items-center gap-2 p-2 hover:bg-accent/30 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="flex-1 text-left text-sm font-medium">{category}</span>
                        <Badge variant="outline" className="text-xs">
                          {enabledCount}/{categoryModules.length}
                        </Badge>
                      </button>
                      {isExpanded && (
                        <div className="border-t divide-y">
                          {categoryModules.map((m) => (
                            <div
                              key={m.code}
                              className="flex items-center gap-2 py-1.5 px-3 pl-8 hover:bg-accent/20 transition-colors"
                            >
                              <Checkbox
                                id={`grp-mod-${m.code}`}
                                checked={state.modules.has(m.code)}
                                onCheckedChange={() => toggleModule(m.code)}
                                disabled={saving}
                              />
                              <label
                                htmlFor={`grp-mod-${m.code}`}
                                className="flex-1 text-sm cursor-pointer"
                              >
                                {m.name}
                              </label>
                              <span className="text-xs text-muted-foreground">{m.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* b. Deal visibility + scope */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Deal visibility</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {DEAL_VISIBILITY_OPTIONS.map((opt) => (
                  <div key={opt.key} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <Checkbox
                      id={`grp-vis-${opt.key}`}
                      checked={state.dealVisibility.has(opt.key)}
                      onCheckedChange={() => toggleVisibility(opt.key)}
                      disabled={saving}
                    />
                    <label htmlFor={`grp-vis-${opt.key}`} className="flex-1 text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Scope</span>
                <Select
                  value={state.scope}
                  onValueChange={(v) => setState((prev) => (prev ? { ...prev, scope: v as DealScope } : prev))}
                  disabled={saving}
                >
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* c. Field domains */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Field domains</h3>
              <p className="text-xs text-muted-foreground">
                Hidden by default — grant Visible to show a domain&apos;s fields, Editable to allow
                changes (editable implies visible).
              </p>
              <div className="rounded-lg border">
                <Table dense>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead className="w-24">Visible</TableHead>
                      <TableHead className="w-24">Editable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FIELD_DOMAINS.map((domain) => {
                      const grant = state.fieldDomains[domain];
                      return (
                        <TableRow key={domain}>
                          <TableCell className="font-medium">{DOMAIN_LABELS[domain]}</TableCell>
                          <TableCell>
                            <Switch
                              checked={domain === "general" ? true : grant.visible}
                              onCheckedChange={(c) => setDomainGrant(domain, { visible: c })}
                              disabled={saving || domain === "general"}
                              aria-label={`${DOMAIN_LABELS[domain]} visible`}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={grant.editable}
                              onCheckedChange={(c) => setDomainGrant(domain, { editable: c })}
                              disabled={saving}
                              aria-label={`${DOMAIN_LABELS[domain]} editable`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* d. Per-field overrides */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Per-field overrides</h3>
              <p className="text-xs text-muted-foreground">
                Override a single field&apos;s visibility regardless of its domain grant.
              </p>
              {state.overrides.length > 0 && (
                <div className="rounded-lg border">
                  <Table dense>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field key</TableHead>
                        <TableHead className="w-24">Visible</TableHead>
                        <TableHead className="w-24">Editable</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.overrides.map((row, idx) => (
                        <TableRow key={`${row.field}-${idx}`}>
                          <TableCell className="font-mono text-xs">{row.field}</TableCell>
                          <TableCell>
                            <Switch
                              checked={row.visible}
                              onCheckedChange={(c) => setOverride(idx, { visible: c })}
                              disabled={saving}
                              aria-label={`${row.field} visible`}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={row.editable}
                              onCheckedChange={(c) => setOverride(idx, { editable: c })}
                              disabled={saving}
                              aria-label={`${row.field} editable`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeOverride(idx)}
                              disabled={saving}
                              aria-label={`Remove override for ${row.field}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOverride();
                    }
                  }}
                  placeholder="Field key (e.g. totalPricePence)"
                  list="deal-field-key-suggestions"
                  className="h-8 flex-1 text-xs"
                  disabled={saving}
                />
                <datalist id="deal-field-key-suggestions">
                  {KNOWN_FIELD_KEYS.map((key) => (
                    <option key={key} value={key} />
                  ))}
                </datalist>
                <Button variant="outline" size="sm" onClick={addOverride} disabled={saving || !newFieldKey.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Add override
                </Button>
              </div>
            </section>

            {/* e. Actions */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ACTION_OPTIONS.map((opt) => (
                  <div key={opt.key} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <Checkbox
                      id={`grp-act-${opt.key}`}
                      checked={state.actions.has(opt.key)}
                      onCheckedChange={() => toggleAction(opt.key)}
                      disabled={saving}
                    />
                    <label htmlFor={`grp-act-${opt.key}`} className="flex-1 text-sm cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading || !state}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save rights"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
