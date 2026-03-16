"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { Loader2 } from "lucide-react";
import { getStockPrices, updateStockPrice } from "../actions";
import type { StockPriceRow } from "../actions";

function formatEur(value: number): string {
  const parts = value.toFixed(2).split(".");
  return parts[0] + "," + parts[1];
}

function parseEur(value: string): number {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function EditablePrice({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        className="w-24 text-right bg-transparent border-b border-primary outline-none text-sm py-0.5"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => {
          onSave(parseEur(input));
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(parseEur(input));
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-primary hover:underline decoration-dotted underline-offset-4"
      onClick={() => { setInput(formatEur(value)); setEditing(true); }}
    >
      {formatEur(value)}
    </span>
  );
}

function EditableText({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        className={`bg-transparent border-b border-primary outline-none text-sm py-0.5 ${className ?? "w-20"}`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => { onSave(input); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(input); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-primary hover:underline decoration-dotted underline-offset-4"
      onClick={() => { setInput(value); setEditing(true); }}
    >
      {value}
    </span>
  );
}

export function StockPricesTable() {
  const [prices, setPrices] = useState<StockPriceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const result = await getStockPrices();
    if (result.success) setPrices(result.data);
    setLoading(false);
  }

  async function handleUpdate(id: string, field: string, value: string | number) {
    // Update locally first for instant feedback
    setPrices((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    await updateStockPrice(id, field, value);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  let lastSpecies = "";

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Click any cell to edit. Changes are saved to the database automatically.</p>
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Species</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Thickness</TableHead>
              <TableHead>Length (mm)</TableHead>
              <TableHead className="text-right">Order Price (€/m³)</TableHead>
              <TableHead className="text-right">Stock Price (€/m³)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((row, i) => {
              const isNewSpecies = row.species !== lastSpecies;
              lastSpecies = row.species;
              return (
                <TableRow key={row.id} className={isNewSpecies && i > 0 ? "border-t-2" : ""}>
                  <TableCell className="font-medium">
                    <EditableText value={row.species} onSave={(v) => handleUpdate(row.id, "species", v)} className="w-16" />
                  </TableCell>
                  <TableCell>
                    <EditableText value={row.panel_type} onSave={(v) => handleUpdate(row.id, "panel_type", v)} className="w-10" />
                  </TableCell>
                  <TableCell>
                    <EditableText value={row.quality} onSave={(v) => handleUpdate(row.id, "quality", v)} className="w-10" />
                  </TableCell>
                  <TableCell>
                    <EditableText value={row.thickness} onSave={(v) => handleUpdate(row.id, "thickness", v)} className="w-12" />
                  </TableCell>
                  <TableCell>
                    <EditableText value={row.length_range} onSave={(v) => handleUpdate(row.id, "length_range", v)} className="w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditablePrice value={Number(row.order_price)} onSave={(v) => handleUpdate(row.id, "order_price", v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditablePrice value={Number(row.stock_price)} onSave={(v) => handleUpdate(row.id, "stock_price", v)} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
