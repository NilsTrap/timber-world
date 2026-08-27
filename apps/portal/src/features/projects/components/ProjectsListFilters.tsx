import Link from "next/link";
import { Button, Input } from "@timber/ui";
import type { ProjectListFilterOption, ProjectListFilters } from "../types";

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: ProjectListFilterOption[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select name={name} defaultValue={value} className="h-9 min-w-40 rounded-md border bg-background px-3 text-sm text-foreground">
        <option value="">All</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function ProjectsListFilters({ filters, options }: {
  filters: ProjectListFilters;
  options: { customers: ProjectListFilterOption[]; traders: ProjectListFilterOption[]; suppliers: ProjectListFilterOption[]; stages: ProjectListFilterOption[] };
}) {
  const active = Object.values(filters).some(Boolean);
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        <span>Search counterparties</span>
        <Input name="q" defaultValue={filters.search} placeholder="Company name" />
      </label>
      <FilterSelect name="customer" label="Customer" value={filters.customer} options={options.customers} />
      <FilterSelect name="trader" label="Trader" value={filters.trader} options={options.traders} />
      <FilterSelect name="supplier" label="Supplier" value={filters.supplier} options={options.suppliers} />
      <FilterSelect name="stage" label="Stage" value={filters.stage} options={options.stages} />
      <Button type="submit" size="sm">Apply</Button>
      {active ? <Button asChild type="button" variant="ghost" size="sm"><Link href="/projects">Clear</Link></Button> : null}
    </form>
  );
}
