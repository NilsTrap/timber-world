"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removeOrderPackage } from "../actions/removeOrderPackage";
import type { OrderPackage } from "../actions/getOrderPackages";

interface OrderPackagesTableProps {
  title: string;
  subtitle: string;
  packages: OrderPackage[];
  orderId: string;
  organisationId: string;
  editable: boolean;
  onChanged: () => void;
}

export function OrderPackagesTable({
  title,
  subtitle,
  packages,
  editable,
  onChanged,
}: OrderPackagesTableProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (pkg: OrderPackage) => {
    setRemovingId(pkg.id);
    const result = await removeOrderPackage(pkg.id);
    if (result.success) {
      toast.success(`Removed ${pkg.packageNumber}`);
      onChanged();
    } else {
      toast.error(result.error);
    }
    setRemovingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {editable && (
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.info("Add package form coming soon")}
          >
            <Plus className="h-4 w-4" />
            Add Package
          </button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No packages yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Package</th>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Species</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Quality</th>
                  <th className="px-3 py-2 text-right font-medium">Thickness</th>
                  <th className="px-3 py-2 text-right font-medium">Width</th>
                  <th className="px-3 py-2 text-right font-medium">Length</th>
                  <th className="px-3 py-2 text-right font-medium">Pieces</th>
                  <th className="px-3 py-2 text-right font-medium">Volume m³</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  {editable && <th className="px-3 py-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono font-medium">{pkg.packageNumber}</td>
                    <td className="px-3 py-2">{pkg.productName || "-"}</td>
                    <td className="px-3 py-2">{pkg.woodSpecies || "-"}</td>
                    <td className="px-3 py-2">{pkg.typeName || "-"}</td>
                    <td className="px-3 py-2">{pkg.quality || "-"}</td>
                    <td className="px-3 py-2 text-right">{pkg.thickness || "-"}</td>
                    <td className="px-3 py-2 text-right">{pkg.width || "-"}</td>
                    <td className="px-3 py-2 text-right">{pkg.length || "-"}</td>
                    <td className="px-3 py-2 text-right">{pkg.pieces || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {pkg.volumeM3 !== null ? pkg.volumeM3.toFixed(4) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          pkg.status === "ordered"
                            ? "bg-blue-100 text-blue-800"
                            : pkg.status === "available"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    {editable && (
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRemove(pkg)}
                          disabled={removingId === pkg.id}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          {removingId === pkg.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
