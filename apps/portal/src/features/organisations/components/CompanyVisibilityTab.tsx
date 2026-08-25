"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@timber/ui";
import { getCompanyVisibility, updateCompanyVisibility } from "../actions";
import type {
  CompanyVisibilityData,
  CompanyVisibilityGroup,
  CompanyVisibilityOption,
} from "../types";

const GROUPS: Array<{ id: CompanyVisibilityGroup; label: string; empty: string }> = [
  { id: "customers", label: "Customers", empty: "No customer companies are available." },
  { id: "traders", label: "Traders", empty: "No other trader companies are available." },
  { id: "suppliers", label: "Suppliers", empty: "No supplier or manufacturer companies are available." },
];

export function CompanyVisibilityTab({ traderId }: { traderId: string }) {
  const [data, setData] = useState<CompanyVisibilityData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getCompanyVisibility(traderId);
    if (!result.success) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    const ids = new Set(
      Object.values(result.data.groups)
        .flat()
        .filter((option) => option.selected)
        .map((option) => option.id),
    );
    setData(result.data);
    setSelected(ids);
    setSaved(new Set(ids));
    setLoading(false);
  }, [traderId]);

  useEffect(() => { void load(); }, [load]);

  const changed = useMemo(() => {
    if (selected.size !== saved.size) return true;
    for (const id of selected) if (!saved.has(id)) return true;
    return false;
  }, [saved, selected]);

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const result = await updateCompanyVisibility(traderId, [...selected]);
    if (result.success) {
      setSaved(new Set(selected));
      toast.success("Company access updated");
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 font-medium"><Share2 className="h-4 w-4" />Shared with this trader</div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Checked companies are visible and selectable by this trader. Sharing is direct: customers and suppliers are not exposed to one another.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={!changed || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search companies"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList>
          {GROUPS.map((group) => (
            <TabsTrigger key={group.id} value={group.id}>
              {group.label}
              <Badge variant="secondary" className="ml-1">
                {data.groups[group.id].filter((option) => selected.has(option.id)).length}/{data.groups[group.id].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map((group) => {
          const needle = search.trim().toLowerCase();
          const options = data.groups[group.id].filter((option) =>
            !needle || option.name.toLowerCase().includes(needle) || option.code.toLowerCase().includes(needle),
          );
          return (
            <TabsContent key={group.id} value={group.id}>
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                {options.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {needle ? "No matching companies." : group.empty}
                  </p>
                ) : options.map((option: CompanyVisibilityOption) => (
                  <label key={option.id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40">
                    <Checkbox checked={selected.has(option.id)} onCheckedChange={() => toggle(option.id)} />
                    <span className="w-14 shrink-0 font-mono text-sm font-medium">{option.code}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
                  </label>
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
