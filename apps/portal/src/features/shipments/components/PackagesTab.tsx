"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Label,
} from "@timber/ui";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { SummaryCards } from "./SummaryCards";
import type { PackageListItem, ReferenceOption } from "../types";

interface PackagesTabProps {
  packages: PackageListItem[];
  productNames: ReferenceOption[];
  woodSpecies: ReferenceOption[];
}

type SortKey = keyof PackageListItem;

export function PackagesTab({ packages, productNames, woodSpecies }: PackagesTabProps) {
  const [filterProduct, setFilterProduct] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("");
  const [filterShipmentCode, setFilterShipmentCode] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  } | null>(null);

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (filterProduct && pkg.productName !== filterProduct) return false;
      if (filterSpecies && pkg.woodSpecies !== filterSpecies) return false;
      if (
        filterShipmentCode &&
        !pkg.shipmentCode.toLowerCase().includes(filterShipmentCode.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [packages, filterProduct, filterSpecies, filterShipmentCode]);

  const sortedPackages = useMemo(() => {
    if (!sortConfig) return filteredPackages;
    return [...filteredPackages].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredPackages, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const totalPackages = filteredPackages.length;
  const totalVolume = filteredPackages.reduce(
    (sum, pkg) => sum + (pkg.volumeM3 ?? 0),
    0
  );

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig?.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline text-muted-foreground" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 inline text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 inline text-primary" />
    );
  };

  // Get unique product names and species from actual data for filter options
  const uniqueProducts = useMemo(() => {
    const names = new Set(packages.map((p) => p.productName).filter(Boolean) as string[]);
    return productNames.filter((pn) => names.has(pn.value));
  }, [packages, productNames]);

  const uniqueSpecies = useMemo(() => {
    const names = new Set(packages.map((p) => p.woodSpecies).filter(Boolean) as string[]);
    return woodSpecies.filter((ws) => names.has(ws.value));
  }, [packages, woodSpecies]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <SummaryCards
        items={[
          { label: "Total Packages", value: totalPackages },
          { label: "Total m³", value: totalVolume.toFixed(4) },
        ]}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 items-end rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="filter-product" className="text-xs">Product Name</Label>
          <select
            id="filter-product"
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All</option>
            {uniqueProducts.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-species" className="text-xs">Species</Label>
          <select
            id="filter-species"
            value={filterSpecies}
            onChange={(e) => setFilterSpecies(e.target.value)}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All</option>
            {uniqueSpecies.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-shipment" className="text-xs">Shipment Code</Label>
          <Input
            id="filter-shipment"
            type="text"
            placeholder="Search..."
            value={filterShipmentCode}
            onChange={(e) => setFilterShipmentCode(e.target.value)}
            className="w-44 h-9"
          />
        </div>
      </div>

      {/* Packages Table */}
      {sortedPackages.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {packages.length === 0
            ? "No packages recorded yet"
            : "No packages match the current filters"}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("packageNumber")}
                >
                  Package No
                  <SortIcon columnKey="packageNumber" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("shipmentCode")}
                >
                  Shipment
                  <SortIcon columnKey="shipmentCode" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("productName")}
                >
                  Product
                  <SortIcon columnKey="productName" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("woodSpecies")}
                >
                  Species
                  <SortIcon columnKey="woodSpecies" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("humidity")}
                >
                  Humidity
                  <SortIcon columnKey="humidity" />
                </TableHead>
                <TableHead className="text-right">Dimensions</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => toggleSort("pieces")}
                >
                  Pieces
                  <SortIcon columnKey="pieces" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => toggleSort("volumeM3")}
                >
                  m³
                  <SortIcon columnKey="volumeM3" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPackages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-mono text-sm">
                    {pkg.packageNumber}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {pkg.shipmentCode}
                  </TableCell>
                  <TableCell>{pkg.productName ?? "-"}</TableCell>
                  <TableCell>{pkg.woodSpecies ?? "-"}</TableCell>
                  <TableCell>{pkg.humidity ?? "-"}</TableCell>
                  <TableCell className="text-right text-sm">
                    {[pkg.thickness, pkg.width, pkg.length]
                      .filter(Boolean)
                      .join(" × ") || "-"}
                  </TableCell>
                  <TableCell className="text-right">{pkg.pieces ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    {pkg.volumeM3 != null ? pkg.volumeM3.toFixed(4) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
