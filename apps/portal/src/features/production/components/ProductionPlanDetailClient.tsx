"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Button,
  Input,
  Textarea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@timber/ui";
import { ArrowLeft, Plus, Trash2, Printer, Loader2 } from "lucide-react";
import {
  updateProductionPlan,
  deleteProductionPlan,
  removePackageFromPlan,
  getProductionPlan,
} from "../actions";
import type { ProductionPlanDetail } from "../types-plans";
import { PlanPackageSelector } from "./PlanPackageSelector";
import { PrintPlanButton } from "./PrintPlanButton";

interface Props {
  plan: ProductionPlanDetail;
}

export function ProductionPlanDetailClient({ plan: initial }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [isSaving, startTransition] = useTransition();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced inline save for name + description.
  const persist = useCallback((patch: { name?: string; description?: string | null }) => {
    startTransition(async () => {
      const result = await updateProductionPlan(plan.id, patch);
      if (!result.success) toast.error(result.error);
    });
  }, [plan.id]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => {
      if (value.trim()) persist({ name: value });
    }, 600);
  };
  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(() => {
      persist({ description: value || null });
    }, 600);
  };

  const refetch = useCallback(async () => {
    const r = await getProductionPlan(plan.id);
    if (r.success) setPlan(r.data);
  }, [plan.id]);

  const handleRemovePackage = useCallback(async (pkgId: string) => {
    setRemovingId(pkgId);
    const r = await removePackageFromPlan(plan.id, pkgId);
    setRemovingId(null);
    if (r.success) {
      toast.success("Package removed");
      await refetch();
    } else {
      toast.error(r.error);
    }
  }, [plan.id, refetch]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const r = await deleteProductionPlan(plan.id);
    setIsDeleting(false);
    if (r.success) {
      toast.success("Plan deleted");
      router.push("/production?tab=plans");
    } else {
      toast.error(r.error);
    }
  }, [plan.id, router]);

  const totals = plan.packages.reduce(
    (acc, p) => {
      const pcs = parseInt(p.pieces ?? "0", 10);
      if (!isNaN(pcs)) acc.pieces += pcs;
      acc.volume += p.volumeM3 ?? 0;
      return acc;
    },
    { pieces: 0, volume: 0 }
  );

  return (
    <div className="space-y-6">
      <Link
        href="/production?tab=plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to plans
      </Link>

      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="text-lg font-semibold"
              placeholder="Plan name"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-5">
            <PrintPlanButton plan={plan} />
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <Textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="What do you plan to make?"
            className="min-h-[72px] [field-sizing:content]"
          />
        </div>
        {isSaving && (
          <p className="text-xs text-muted-foreground">Saving…</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Packages ({plan.packages.length})
            {plan.packages.length > 0 && (
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                {totals.pieces} pcs · {totals.volume.toFixed(3).replace(".", ",")} m³
              </span>
            )}
          </h2>
          <Button onClick={() => setSelectorOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add packages
          </Button>
        </div>

        {plan.packages.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            No packages added yet.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Species</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead className="text-right">Thk</TableHead>
                  <TableHead className="text-right">W</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">Pcs</TableHead>
                  <TableHead className="text-right">Vol m³</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.packages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{p.shipmentCode || "-"}</TableCell>
                    <TableCell className="text-sm font-medium">{p.packageNumber || "-"}</TableCell>
                    <TableCell className="text-sm">{p.productName || "-"}</TableCell>
                    <TableCell className="text-sm">{p.woodSpecies || "-"}</TableCell>
                    <TableCell className="text-sm">{p.typeName || "-"}</TableCell>
                    <TableCell className="text-sm">{p.quality || "-"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.thickness || "-"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.width || "-"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.length || "-"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.pieces || "-"}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {p.volumeM3 != null ? p.volumeM3.toFixed(3).replace(".", ",") : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleRemovePackage(p.id)}
                        disabled={removingId === p.id}
                        title="Remove from plan"
                      >
                        {removingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PlanPackageSelector
        planId={plan.id}
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onPackagesAdded={refetch}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the plan and all its package links. The packages themselves are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Re-export for convenience if someone imports the named child
export { Printer };
