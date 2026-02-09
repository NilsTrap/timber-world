"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@timber/ui";

interface SortableHeaderProps {
  column: string;
  label: string;
  currentSort?: string;
  currentOrder: "asc" | "desc";
  onSort: (column: string, order: "asc" | "desc") => void;
  align?: "left" | "right";
}

export function SortableHeader({
  column,
  label,
  currentSort,
  currentOrder,
  onSort,
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSort === column;

  const handleClick = () => {
    if (isActive) {
      // Toggle order
      onSort(column, currentOrder === "asc" ? "desc" : "asc");
    } else {
      // Start with ascending
      onSort(column, "asc");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors",
        align === "right" && "flex-row-reverse ml-auto"
      )}
    >
      <span>{label}</span>
      {isActive ? (
        currentOrder === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );
}
