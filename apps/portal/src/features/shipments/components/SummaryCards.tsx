"use client";

import { Card, CardContent } from "@timber/ui";

interface SummaryItem {
  label: string;
  value: string | number;
}

interface SummaryCardsProps {
  items: SummaryItem[];
}

export function SummaryCards({ items }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
