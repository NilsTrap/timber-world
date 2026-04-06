"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@timber/ui";
import { removeOrderPackage } from "../actions/removeOrderPackage";
import { addOrderPackage } from "../actions/addOrderPackage";
import { getStaircaseCodes } from "../actions/getStaircaseCodes";
import { getReferenceDropdowns } from "@/features/shipments/actions";
import type { OrderPackage } from "../actions/getOrderPackages";
import type { StaircaseCode } from "../actions/getStaircaseCodes";

interface ReferenceOption {
  id: string;
  value: string;
}

// Map staircase pricing product_type to ref_types value
const PRODUCT_TYPE_TO_REF: Record<string, string> = {
  FJ: "FJ",
  FS: "Full stave",
};

interface NewRowState {
  selectedCodeId: string;
  productNameId: string;
  woodSpeciesId: string;
  typeId: string;
  qualityId: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: string;
  unitPrice: string;
}

const EMPTY_ROW: NewRowState = {
  selectedCodeId: "",
  productNameId: "",
  woodSpeciesId: "",
  typeId: "",
  qualityId: "",
  thickness: "",
  width: "",
  length: "",
  pieces: "",
  volumeM3: "",
  unitPrice: "",
};

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
  orderId,
  organisationId,
  editable,
  onChanged,
}: OrderPackagesTableProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);

  // Reference dropdowns
  const [productNames, setProductNames] = useState<ReferenceOption[]>([]);
  const [woodSpecies, setWoodSpecies] = useState<ReferenceOption[]>([]);
  const [types, setTypes] = useState<ReferenceOption[]>([]);
  const [quality, setQuality] = useState<ReferenceOption[]>([]);

  // Staircase codes
  const [staircaseCodes, setStaircaseCodes] = useState<StaircaseCode[]>([]);

  // New row state
  const [newRow, setNewRow] = useState<NewRowState>(EMPTY_ROW);

  useEffect(() => {
    if (isAdding && productNames.length === 0) {
      setIsLoadingRefs(true);
      Promise.all([
        getReferenceDropdowns(),
        getStaircaseCodes(),
      ]).then(([refsResult, codesResult]) => {
        if (refsResult.success) {
          const d = refsResult.data;
          setProductNames(d.productNames);
          setWoodSpecies(d.woodSpecies);
          setTypes(d.types);
          setQuality(d.quality);
        }
        if (codesResult.success) {
          setStaircaseCodes(codesResult.data ?? []);
        }
        setIsLoadingRefs(false);
      });
    }
  }, [isAdding, productNames.length]);

  const handleCodeSelect = (codeId: string) => {
    if (!codeId) {
      setNewRow((r) => ({ ...r, selectedCodeId: "" }));
      return;
    }

    const code = staircaseCodes.find((c) => c.id === codeId);
    if (!code) return;

    const updates: Partial<NewRowState> = { selectedCodeId: codeId };

    // Auto-fill product name
    const matchingProduct = productNames.find(
      (p) => p.value.toLowerCase() === code.name.toLowerCase()
    );
    if (matchingProduct) updates.productNameId = matchingProduct.id;

    // Auto-fill species (all staircase products are Oak)
    const oakSpecies = woodSpecies.find(
      (s) => s.value.toLowerCase() === "oak"
    );
    if (oakSpecies) updates.woodSpeciesId = oakSpecies.id;

    // Auto-fill type
    const refTypeName = PRODUCT_TYPE_TO_REF[code.productType];
    if (refTypeName) {
      const matchingType = types.find(
        (t) => t.value.toLowerCase() === refTypeName.toLowerCase()
      );
      if (matchingType) updates.typeId = matchingType.id;
    }

    // Auto-fill dimensions
    updates.thickness = String(code.thicknessMm);
    updates.width = String(code.widthMm);
    updates.length = String(code.lengthMm);

    // Auto-calculate volume in m³
    const vol = (code.thicknessMm * code.widthMm * code.lengthMm) / 1_000_000_000;
    updates.volumeM3 = vol.toFixed(4);

    // Auto-fill price (final_price_cents → GBP)
    if (code.finalPriceCents != null) {
      updates.unitPrice = (code.finalPriceCents / 100).toFixed(2);
    }

    setNewRow((r) => ({ ...r, ...updates }));
  };

  const handleAdd = async () => {
    if (!newRow.productNameId) {
      toast.error("Please select a product");
      return;
    }

    setIsSubmitting(true);
    const nextNumber = String(packages.length + 1);

    const result = await addOrderPackage({
      orderId,
      packageNumber: nextNumber,
      organisationId,
      productNameId: newRow.productNameId || null,
      woodSpeciesId: newRow.woodSpeciesId || null,
      typeId: newRow.typeId || null,
      qualityId: newRow.qualityId || null,
      thickness: newRow.thickness || null,
      width: newRow.width || null,
      length: newRow.length || null,
      pieces: newRow.pieces || null,
      volumeM3: newRow.volumeM3 ? parseFloat(newRow.volumeM3) : null,
      unitPricePiece: newRow.unitPrice ? parseFloat(newRow.unitPrice) : null,
    });

    if (result.success) {
      toast.success("Product added");
      setNewRow(EMPTY_ROW);
      onChanged();
    } else {
      toast.error(result.error);
    }
    setIsSubmitting(false);
  };

  const handleRemove = async (pkg: OrderPackage) => {
    setRemovingId(pkg.id);
    const result = await removeOrderPackage(pkg.id);
    if (result.success) {
      toast.success("Product removed");
      onChanged();
    } else {
      toast.error(result.error);
    }
    setRemovingId(null);
  };

  const selectClass =
    "h-7 w-full rounded border border-input bg-transparent px-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const inputClass =
    "h-7 w-full rounded border border-input bg-transparent px-1 text-xs text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const totalPieces = packages.reduce(
    (sum, p) => sum + (p.pieces ? parseInt(p.pieces, 10) || 0 : 0), 0
  );
  const totalVolume = packages.reduce(
    (sum, p) => sum + (p.volumeM3 || 0), 0
  );
  const totalPrice = packages.reduce(
    (sum, p) => sum + (p.unitPricePiece !== null && p.pieces
      ? p.unitPricePiece * (parseInt(p.pieces, 10) || 0) : 0), 0
  );

  const showTable = packages.length > 0 || isAdding;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {editable && !isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {!showTable ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No products yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {isAdding && <th className="px-2 py-2 text-left font-medium">Code</th>}
                  <th className="px-2 py-2 text-left font-medium">Product</th>
                  <th className="px-2 py-2 text-left font-medium">Species</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th className="px-2 py-2 text-left font-medium">Quality</th>
                  <th className="px-2 py-2 text-right font-medium">Thick</th>
                  <th className="px-2 py-2 text-right font-medium">Width</th>
                  <th className="px-2 py-2 text-right font-medium">Length</th>
                  <th className="px-2 py-2 text-right font-medium">Pcs</th>
                  <th className="px-2 py-2 text-right font-medium">m³</th>
                  <th className="px-2 py-2 text-right font-medium">Price £</th>
                  <th className="px-2 py-2 text-right font-medium">Total £</th>
                  {editable && <th className="px-2 py-2 w-14" />}
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b last:border-0 hover:bg-accent/30">
                    {isAdding && <td className="px-2 py-2" />}
                    <td className="px-2 py-2">{pkg.productName || "-"}</td>
                    <td className="px-2 py-2">{pkg.woodSpecies || "-"}</td>
                    <td className="px-2 py-2">{pkg.typeName || "-"}</td>
                    <td className="px-2 py-2">{pkg.quality || "-"}</td>
                    <td className="px-2 py-2 text-right">{pkg.thickness || "-"}</td>
                    <td className="px-2 py-2 text-right">{pkg.width || "-"}</td>
                    <td className="px-2 py-2 text-right">{pkg.length || "-"}</td>
                    <td className="px-2 py-2 text-right">{pkg.pieces || "-"}</td>
                    <td className="px-2 py-2 text-right">
                      {pkg.volumeM3 !== null ? pkg.volumeM3.toFixed(4) : "-"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {pkg.unitPricePiece !== null ? pkg.unitPricePiece.toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {pkg.unitPricePiece !== null && pkg.pieces
                        ? (pkg.unitPricePiece * (parseInt(pkg.pieces, 10) || 0)).toFixed(2)
                        : "-"}
                    </td>
                    {editable && (
                      <td className="px-2 py-2">
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

                {/* Inline new row */}
                {isAdding && (
                  <tr className="border-b last:border-0 bg-accent/20">
                    <td className="px-1 py-1">
                      {isLoadingRefs ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                      ) : (
                        <select
                          value={newRow.selectedCodeId}
                          onChange={(e) => handleCodeSelect(e.target.value)}
                          className={selectClass}
                        >
                          <option value="">Code...</option>
                          {staircaseCodes.map((c) => (
                            <option key={c.id} value={c.id}>{c.code}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={newRow.productNameId}
                        onChange={(e) => setNewRow((r) => ({ ...r, productNameId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">Product...</option>
                        {productNames.map((o) => (
                          <option key={o.id} value={o.id}>{o.value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={newRow.woodSpeciesId}
                        onChange={(e) => setNewRow((r) => ({ ...r, woodSpeciesId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">-</option>
                        {woodSpecies.map((o) => (
                          <option key={o.id} value={o.id}>{o.value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={newRow.typeId}
                        onChange={(e) => setNewRow((r) => ({ ...r, typeId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">-</option>
                        {types.map((o) => (
                          <option key={o.id} value={o.id}>{o.value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={newRow.qualityId}
                        onChange={(e) => setNewRow((r) => ({ ...r, qualityId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">-</option>
                        {quality.map((o) => (
                          <option key={o.id} value={o.id}>{o.value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="mm"
                        value={newRow.thickness}
                        onChange={(e) => setNewRow((r) => ({ ...r, thickness: e.target.value }))}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="mm"
                        value={newRow.width}
                        onChange={(e) => setNewRow((r) => ({ ...r, width: e.target.value }))}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="1"
                        placeholder="mm"
                        value={newRow.length}
                        onChange={(e) => setNewRow((r) => ({ ...r, length: e.target.value }))}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="1"
                        placeholder="pcs"
                        value={newRow.pieces}
                        onChange={(e) => setNewRow((r) => ({ ...r, pieces: e.target.value }))}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="m³"
                        value={newRow.volumeM3}
                        onChange={(e) => setNewRow((r) => ({ ...r, volumeM3: e.target.value }))}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="£"
                        value={newRow.unitPrice}
                        onChange={(e) => setNewRow((r) => ({ ...r, unitPrice: e.target.value }))}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-1 py-1 text-right text-xs text-muted-foreground">
                      {newRow.unitPrice && newRow.pieces
                        ? (parseFloat(newRow.unitPrice) * (parseInt(newRow.pieces, 10) || 0)).toFixed(2)
                        : "-"}
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex gap-0.5">
                        <button
                          onClick={handleAdd}
                          disabled={isSubmitting || isLoadingRefs}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                          title="Save"
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => { setNewRow(EMPTY_ROW); setIsAdding(false); }}
                          disabled={isSubmitting}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {packages.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/50 font-medium">
                    {isAdding && <td className="px-2 py-2" />}
                    <td className="px-2 py-2" colSpan={4}>Total</td>
                    <td className="px-2 py-2 text-right" colSpan={3} />
                    <td className="px-2 py-2 text-right">{totalPieces || "-"}</td>
                    <td className="px-2 py-2 text-right">{totalVolume ? totalVolume.toFixed(4) : "-"}</td>
                    <td className="px-2 py-2 text-right" />
                    <td className="px-2 py-2 text-right">{totalPrice ? totalPrice.toFixed(2) : "-"}</td>
                    {editable && <td className="px-2 py-2" />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
