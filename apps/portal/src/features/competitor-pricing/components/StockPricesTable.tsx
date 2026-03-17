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
import { Loader2, Plus, Trash2 } from "lucide-react";
import { getStockPrices, updateStockPrice, addStockPriceRow, deleteStockPriceRow, reorderStockPrices } from "../actions";
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
      className="cursor-pointer hover:text-primary hover:underline decoration-dotted underline-offset-4 min-w-[2rem] inline-block"
      onClick={() => { setInput(value); setEditing(true); }}
    >
      {value || <span className="text-muted-foreground/40">—</span>}
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
    setPrices((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    await updateStockPrice(id, field, value);
  }

  async function handleInsertAfter(index: number) {
    const ref = prices[index]!;
    // Calculate sort_order: midpoint between current and next row
    const currentOrder = ref.sort_order;
    const nextOrder = index < prices.length - 1 ? prices[index + 1]!.sort_order : currentOrder + 10;
    let newOrder = Math.floor((currentOrder + nextOrder) / 2);

    // If no gap, reorder all rows to create space
    if (newOrder === currentOrder) {
      const reorders = prices.map((row, i) => ({ id: row.id, sort_order: (i + 1) * 10 }));
      await reorderStockPrices(reorders);
      newOrder = (index + 1) * 10 + 5;
    }

    const newRow: Omit<StockPriceRow, "id"> & { sort_order: number } = {
      species: ref.species,
      panel_type: ref.panel_type,
      quality: ref.quality,
      thickness: ref.thickness,
      length_range: "",
      order_price: 0,
      stock_price: 0,
      sort_order: newOrder,
    };

    const result = await addStockPriceRow(newRow);
    if (result.success) {
      // Insert into local state at the right position
      setPrices((prev) => {
        const copy = [...prev];
        copy.splice(index + 1, 0, result.data);
        return copy;
      });
    }
  }

  async function handleAddToEnd() {
    const lastOrder = prices.length > 0 ? prices[prices.length - 1]!.sort_order : 0;
    const newRow: Omit<StockPriceRow, "id"> & { sort_order: number } = {
      species: prices.length > 0 ? prices[prices.length - 1]!.species : "Oak",
      panel_type: prices.length > 0 ? prices[prices.length - 1]!.panel_type : "FS",
      quality: prices.length > 0 ? prices[prices.length - 1]!.quality : "AB",
      thickness: "All",
      length_range: "",
      order_price: 0,
      stock_price: 0,
      sort_order: lastOrder + 10,
    };

    const result = await addStockPriceRow(newRow);
    if (result.success) {
      setPrices((prev) => [...prev, result.data]);
    }
  }

  async function handleDelete(id: string) {
    setPrices((prev) => prev.filter((row) => row.id !== id));
    await deleteStockPriceRow(id);
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
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Click any cell to edit. Click + to insert a row below. Changes are saved automatically.</p>
        <button
          onClick={handleAddToEnd}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
      </div>
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Species</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Thickness</TableHead>
              <TableHead>Length (mm)</TableHead>
              <TableHead className="text-right">Order Price (€/m³)</TableHead>
              <TableHead className="text-right">Stock Price (€/m³)</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((row, i) => {
              const isNewSpecies = row.species !== lastSpecies;
              lastSpecies = row.species;
              return (
                <TableRow key={row.id} className={isNewSpecies && i > 0 ? "border-t-2" : ""}>
                  <TableCell className="px-1">
                    <button
                      onClick={() => handleInsertAfter(i)}
                      className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5"
                      title="Insert row below"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
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
                  <TableCell className="px-1">
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"
                      title="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
