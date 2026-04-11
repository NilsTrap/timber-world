"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  ColumnHeaderMenu,
  type ColumnSortState,
} from "@timber/ui";
import { getOrders, createOrder, deleteOrder, updateOrder, updateOrderStatus, getCustomerOptions } from "../actions";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import type { Order, OrderStatus } from "../types";
import { getStatusBadgeVariant, getStatusLabel, ORDER_STATUSES } from "../types";

export type OrderColumn =
  | "customer"
  | "seller"
  | "producer"
  | "dateReceived"
  | "dateLoaded"
  | "purchaseOrderNr"
  | "projectNumber"
  | "type"
  | "treads"
  | "winders"
  | "quarters"
  | "totalPieces"
  | "plannedDate"
  | "treadLength"
  | "totalPrice"
  | "totalKg"
  | "maxM3"
  | "treadM3"
  | "winderM3"
  | "quarterM3"
  | "totalProducedM3"
  | "usedMaterialM3"
  | "wasteM3"
  | "wastePercent"
  | "productionMaterial"
  | "productionFinishing"
  | "productionTotal"
  | "productionInvoiceNumber"
  | "productionPaymentDate"
  | "woodArt"
  | "woodArtCnc"
  | "woodArtTotal"
  | "woodArtInvoiceNumber"
  | "woodArtPaymentDate"
  | "advanceInvoiceNumber"
  | "invoiceNumber"
  | "packageNumber"
  | "transportInvoiceNumber"
  | "transportPrice"
  | "invoicedM3"
  | "usedM3"
  | "diffM3"
  | "diffPercent"
  | "invoicedWork"
  | "usedWork"
  | "diffWork"
  | "diffWorkPercent"
  | "invoicedTransport"
  | "usedTransport"
  | "diffTransport"
  | "diffTransportPercent"
  | "plMaterial"
  | "plWork"
  | "plTransport"
  | "plMaterials"
  | "plTotal"
  | "plPercentFromInvoice"
  | "status";

/** All columns shown by default */
const ALL_COLUMNS: OrderColumn[] = [
  "customer", "seller", "dateReceived", "dateLoaded", "purchaseOrderNr", "projectNumber",
  "type", "treadLength", "treads", "winders", "quarters", "totalPieces", "totalPrice", "status",
];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

interface OrganisationOption {
  id: string;
  code: string;
  name: string;
}

/** Inline editable text/date cell — only active when editing prop is true */
function EditableCell({
  value,
  type = "text",
  placeholder,
  onSave,
  editing: editMode,
  align,
}: {
  value: string;
  type?: "text" | "date";
  placeholder?: string;
  onSave: (value: string) => void;
  editing: boolean;
  align?: "left" | "right";
}) {
  const [draft, setDraft] = useState(value);
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (active || editMode) {
      inputRef.current?.focus();
      if (type === "text") inputRef.current?.select();
    }
  }, [active, editMode, type]);

  const commit = (deactivate = true) => {
    if (deactivate) setActive(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const handleBlur = () => {
    // If the window is losing focus (alt-tab), keep active but save
    if (!document.hasFocus()) {
      commit(false);
    } else {
      commit(true);
    }
  };

  if (!editMode && !active) {
    const display = type === "date" ? formatDate(value || null) : (value || placeholder || "-");
    return (
      <span
        className={`cursor-text rounded py-0.5 block w-full min-h-[1.75rem] flex items-center hover:bg-muted/60 transition-colors ${!value ? "text-muted-foreground" : ""}${align === "right" ? " justify-end" : ""}`}
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
      >
        {display}
      </span>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (type === "date") {
          if (e.target.value !== value) onSave(e.target.value);
        }
      }}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setDraft(value); setActive(false); }
      }}
      onClick={(e) => e.stopPropagation()}
      className={`h-7 text-sm px-1 py-0 w-full${align === "right" ? " text-right" : ""}`}
    />
  );
}

/** Inline editable select cell for customer — click to edit */
function EditableSelectCell({
  value,
  displayValue,
  options,
  onSave,
}: {
  value: string;
  displayValue: string;
  options: OrganisationOption[];
  onSave: (value: string) => void;
  editing?: boolean;
}) {
  const [active, setActive] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (active) selectRef.current?.focus();
  }, [active]);

  if (!active) {
    return (
      <span
        className={`cursor-text rounded py-0.5 block w-full min-h-[1.75rem] flex items-center hover:bg-muted/60 transition-colors line-clamp-2 ${!displayValue ? "text-muted-foreground" : ""}`}
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
      >
        {displayValue || "-"}
      </span>
    );
  }

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={(e) => { onSave(e.target.value); setActive(false); }}
      onBlur={() => setActive(false)}
      onClick={(e) => e.stopPropagation()}
      className="h-7 text-sm rounded-md border border-input bg-transparent px-1 py-0 w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.code} - {o.name}
        </option>
      ))}
    </select>
  );
}

export interface OrdersTableHandle {
  addOrder: () => void;
  hasActiveFilters: () => boolean;
  clearFilters: () => void;
}

export type OrdersTabContext = "list" | "production" | "analytics" | "sales";

interface OrdersTableProps {
  isAdmin: boolean;
  canSelectCustomer: boolean;
  userOrganisationId?: string | null;
  userOrganisationName?: string | null;
  /** Which columns to show. Defaults to all. */
  columns?: OrderColumn[];
  /** Tab context — controls detail view routing */
  tab?: OrdersTabContext;
}

export const OrdersTable = forwardRef<OrdersTableHandle, OrdersTableProps>(function OrdersTable({ isAdmin, canSelectCustomer, userOrganisationId, userOrganisationName, columns = ALL_COLUMNS, tab = "list" }, ref) {
  const router = useRouter();
  const show = useCallback((col: OrderColumn) => columns.includes(col), [columns]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const scrollRef = useScrollRestore(`orders-${tab}-scroll`);

  // Edit mode — which order row is being edited
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteOrderItem, setDeleteOrderItem] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status change state
  const [statusChangeOrder, setStatusChangeOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const loadOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    const result = await getOrders();
    if (result.success) {
      setOrders(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadOrders(true);
  }, [loadOrders]);

  // Load organisation options for inline dropdowns (customer + producer)
  useEffect(() => {
    if (canSelectCustomer || isAdmin) {
      getCustomerOptions().then((result) => {
        if (result.success) setOrganisations(result.data ?? []);
      });
    }
  }, [canSelectCustomer, isAdmin]);

  // --- ColumnHeaderMenu sort/filter ---
  const [columnSort, setColumnSort] = useState<ColumnSortState | null>({ column: "dateReceived", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

  const handleFilterChange = useCallback(
    (columnKey: string, values: Set<string>) => {
      setColumnFilters((prev) => ({ ...prev, [columnKey]: values }));
    },
    []
  );

  // Column display value getter for filter/sort
  const getOrderDisplayValue = useCallback((order: Order, colKey: string): string => {
    switch (colKey) {
      case "customer": return order.customerOrganisationName || "";
      case "seller": return order.sellerOrganisationName || "";
      case "producer": return order.producerOrganisationName || "";
      case "dateReceived": return formatDate(order.dateReceived);
      case "dateLoaded": return formatDate(order.dateLoaded);
      case "plannedDate": return formatDate(order.plannedDate);
      case "purchaseOrderNr": return order.name || "";
      case "projectNumber": return order.projectNumber || "";
      case "type": return order.typeSummary || "";
      case "treadLength": return order.treadLength || "";
      case "treads": return order.treads ? String(order.treads) : "";
      case "winders": return order.winders ? String(order.winders) : "";
      case "quarters": return order.quarters ? String(order.quarters) : "";
      case "totalPieces": return order.totalPieces ? String(order.totalPieces) : "";
      case "totalPrice": return order.totalPricePence ? (order.totalPricePence / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
      case "totalKg": return order.totalKg > 0 ? order.totalKg.toFixed(2) : "";
      case "maxM3": return order.maxM3 > 0 ? order.maxM3.toFixed(4) : "";
      case "invoicedM3": return order.maxM3 > 0 ? order.maxM3.toFixed(4) : "";
      case "usedM3": return order.usedMaterialM3 > 0 ? order.usedMaterialM3.toFixed(4) : "";
      case "diffM3": return order.maxM3 > 0 && order.usedMaterialM3 > 0 ? (order.maxM3 - order.usedMaterialM3).toFixed(4) : "";
      case "diffPercent": return order.maxM3 > 0 && order.usedMaterialM3 > 0 ? (((order.maxM3 - order.usedMaterialM3) / order.maxM3) * 100).toFixed(1) : "";
      case "invoicedWork": return order.invoicedWork > 0 ? order.invoicedWork.toFixed(2) : "";
      case "usedWork": return order.usedWork > 0 ? order.usedWork.toFixed(2) : "";
      case "diffWork": return order.invoicedWork > 0 && order.usedWork > 0 ? (order.invoicedWork - order.usedWork).toFixed(2) : "";
      case "diffWorkPercent": return order.invoicedWork > 0 && order.usedWork > 0 ? (((order.invoicedWork - order.usedWork) / order.invoicedWork) * 100).toFixed(1) : "";
      case "invoicedTransport": return order.invoicedTransport > 0 ? order.invoicedTransport.toFixed(2) : "";
      case "usedTransport": return order.usedTransport > 0 ? order.usedTransport.toFixed(2) : "";
      case "diffTransport": return order.invoicedTransport > 0 && order.usedTransport > 0 ? (order.invoicedTransport - order.usedTransport).toFixed(2) : "";
      case "diffTransportPercent": return order.invoicedTransport > 0 && order.usedTransport > 0 ? (((order.invoicedTransport - order.usedTransport) / order.invoicedTransport) * 100).toFixed(1) : "";
      case "treadM3": return order.treadM3 > 0 ? order.treadM3.toFixed(4) : "";
      case "winderM3": return order.winderM3 > 0 ? order.winderM3.toFixed(4) : "";
      case "quarterM3": return order.quarterM3 > 0 ? order.quarterM3.toFixed(4) : "";
      case "totalProducedM3": return order.totalProducedM3 > 0 ? order.totalProducedM3.toFixed(4) : "";
      case "usedMaterialM3": return order.usedMaterialM3 > 0 ? order.usedMaterialM3.toFixed(4) : "";
      case "wasteM3": return order.wasteM3 > 0 ? order.wasteM3.toFixed(4) : "";
      case "wastePercent": return order.wastePercent > 0 ? order.wastePercent.toFixed(1) : "";
      case "productionMaterial": return order.productionMaterial > 0 ? order.productionMaterial.toFixed(2) : "";
      case "productionFinishing": return order.productionFinishing > 0 ? order.productionFinishing.toFixed(2) : "";
      case "productionTotal": return order.productionTotal > 0 ? order.productionTotal.toFixed(2) : "";
      case "productionInvoiceNumber": return order.productionInvoiceNumber || "";
      case "productionPaymentDate": return formatDate(order.productionPaymentDate);
      case "woodArt": return order.woodArt > 0 ? order.woodArt.toFixed(2) : "";
      case "woodArtCnc": return order.woodArtCnc > 0 ? order.woodArtCnc.toFixed(2) : "";
      case "woodArtTotal": return order.woodArtTotal > 0 ? order.woodArtTotal.toFixed(2) : "";
      case "woodArtInvoiceNumber": return order.woodArtInvoiceNumber || "";
      case "woodArtPaymentDate": return formatDate(order.woodArtPaymentDate);
      case "advanceInvoiceNumber": return order.advanceInvoiceNumber || "";
      case "invoiceNumber": return order.invoiceNumber || "";
      case "packageNumber": return order.packageNumber || "";
      case "transportInvoiceNumber": return order.transportInvoiceNumber || "";
      case "transportPrice": return order.transportPrice || "";
      case "plMaterial": return order.plMaterialValue !== 0 ? order.plMaterialValue.toFixed(2) : "";
      case "plWork": return order.plWorkValue !== 0 ? order.plWorkValue.toFixed(2) : "";
      case "plTransport": return order.plTransportValue !== 0 ? order.plTransportValue.toFixed(2) : "";
      case "plMaterials": return order.plMaterialsValue !== 0 ? order.plMaterialsValue.toFixed(2) : "";
      case "plTotal": return order.plTotalValue !== 0 ? order.plTotalValue.toFixed(2) : "";
      case "plPercentFromInvoice": return order.plPercentFromInvoice !== 0 ? order.plPercentFromInvoice.toFixed(1) : "";
      case "status": return getStatusLabel(order.status);
      default: return "";
    }
  }, []);

  const NUMERIC_COLS = new Set([
    "treads", "winders", "quarters", "totalPieces", "totalPrice", "totalKg", "maxM3",
    "invoicedM3", "usedM3", "diffM3", "diffPercent",
    "invoicedWork", "usedWork", "diffWork", "diffWorkPercent",
    "invoicedTransport", "usedTransport", "diffTransport", "diffTransportPercent",
    "treadLength", "treadM3", "winderM3", "quarterM3", "totalProducedM3", "usedMaterialM3",
    "wasteM3", "wastePercent", "productionMaterial", "productionFinishing", "productionTotal",
    "woodArt", "woodArtCnc", "woodArtTotal", "plMaterial", "plWork", "plTransport", "plMaterials", "plTotal", "plPercentFromInvoice",
  ]);

  const DATE_COLS = new Set(["dateReceived", "dateLoaded", "plannedDate", "productionPaymentDate", "woodArtPaymentDate"]);

  // Raw sort value getter — uses ISO dates for proper date sorting
  const getOrderSortValue = useCallback((order: Order, colKey: string): string => {
    if (DATE_COLS.has(colKey)) {
      switch (colKey) {
        case "dateReceived": return order.dateReceived || "";
        case "dateLoaded": return order.dateLoaded || "";
        case "plannedDate": return order.plannedDate || "";
        case "productionPaymentDate": return order.productionPaymentDate || "";
        case "woodArtPaymentDate": return order.woodArtPaymentDate || "";
        default: return "";
      }
    }
    return getOrderDisplayValue(order, colKey);
  }, [getOrderDisplayValue]);

  // Compute unique values per column (cascading: each column's values respect other active filters)
  const columnUniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const colKey of columns) {
      const filteredRows = orders.filter((order) => {
        for (const [filterCol, allowedValues] of Object.entries(columnFilters)) {
          if (filterCol === colKey || allowedValues.size === 0) continue;
          const val = getOrderDisplayValue(order, filterCol);
          if (!allowedValues.has(val)) return false;
        }
        return true;
      });
      const valSet = new Set<string>();
      for (const row of filteredRows) {
        const val = getOrderDisplayValue(row, colKey);
        if (val) valSet.add(val);
      }
      map[colKey] = [...valSet];
    }
    return map;
  }, [orders, columns, columnFilters, getOrderDisplayValue]);

  // Filtered + sorted orders
  const displayOrders = useMemo(() => {
    // Apply filters
    let result = orders.filter((order) => {
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (allowedValues.size === 0) continue;
        const val = getOrderDisplayValue(order, colKey);
        if (!allowedValues.has(val)) return false;
      }
      return true;
    });
    // Apply sort
    if (columnSort) {
      const { column: sortCol, direction } = columnSort;
      const isNum = NUMERIC_COLS.has(sortCol);
      result = [...result].sort((a, b) => {
        const aVal = getOrderSortValue(a, sortCol);
        const bVal = getOrderSortValue(b, sortCol);
        if (isNum) {
          const aNum = parseFloat(aVal) || 0;
          const bNum = parseFloat(bVal) || 0;
          return direction === "asc" ? aNum - bNum : bNum - aNum;
        }
        const cmp = aVal.localeCompare(bVal);
        return direction === "asc" ? cmp : -cmp;
      });
    } else {
      // Default sort by dateReceived desc
      result = [...result].sort((a, b) => b.dateReceived.localeCompare(a.dateReceived));
    }
    return result;
  }, [orders, columnFilters, columnSort, getOrderDisplayValue, getOrderSortValue]);

  // Analytics summary computed from filtered orders
  const analyticsSummary = useMemo(() => {
    if (tab !== "analytics") return null;
    let totalPounds = 0;
    let plTotal = 0;
    // Only sum invoiced/used for orders where both sides exist (matching PL logic)
    let invM3 = 0; let usedM3 = 0; let plM3 = 0;
    let invWork = 0; let usedWork = 0; let plWork = 0;
    let invTransport = 0; let usedTransport = 0; let plTransport = 0;
    let plMaterials = 0;

    for (const o of displayOrders) {
      totalPounds += o.totalPricePence / 100;
      plTotal += o.plTotalValue;
      plM3 += o.plMaterialValue;
      plWork += o.plWorkValue;
      plTransport += o.plTransportValue;
      plMaterials += o.plMaterialsValue;
      // Only include in diff % when both invoiced and used are present
      if (o.maxM3 > 0 && o.usedMaterialM3 > 0) {
        invM3 += o.maxM3;
        usedM3 += o.usedMaterialM3;
      }
      if (o.invoicedWork > 0 && o.usedWork > 0) {
        invWork += o.invoicedWork;
        usedWork += o.usedWork;
      }
      if (o.invoicedTransport > 0 && o.usedTransport > 0) {
        invTransport += o.invoicedTransport;
        usedTransport += o.usedTransport;
      }
    }

    const totalEur = totalPounds / 0.9;
    const plPercent = totalEur > 0 ? (plTotal / totalEur) * 100 : 0;
    const diffM3Pct = invM3 > 0 ? ((invM3 - usedM3) / invM3) * 100 : 0;
    const diffWorkPct = invWork > 0 ? ((invWork - usedWork) / invWork) * 100 : 0;
    const diffTransportPct = invTransport > 0 ? ((invTransport - usedTransport) / invTransport) * 100 : 0;
    // Column totals for footer — only include rows where both sides have values (matching table display)
    let treads = 0, winders = 0, quarters = 0, totalPieces = 0, totalPrice = 0;
    let totalInvM3All = 0, totalUsedM3All = 0;
    let totalInvWorkAll = 0, totalUsedWorkAll = 0;
    let totalInvTransAll = 0, totalUsedTransAll = 0;

    for (const o of displayOrders) {
      treads += o.treads;
      winders += o.winders;
      quarters += o.quarters;
      totalPieces += o.totalPieces;
      totalPrice += o.totalPricePence / 100;
      if (o.maxM3 > 0 && o.usedMaterialM3 > 0) {
        totalInvM3All += o.maxM3;
        totalUsedM3All += o.usedMaterialM3;
      }
      if (o.invoicedWork > 0 && o.usedWork > 0) {
        totalInvWorkAll += o.invoicedWork;
        totalUsedWorkAll += o.usedWork;
      }
      if (o.invoicedTransport > 0 && o.usedTransport > 0) {
        totalInvTransAll += o.invoicedTransport;
        totalUsedTransAll += o.usedTransport;
      }
    }

    return {
      totalEur, plTotal, plPercent, diffM3Pct, plM3, diffWorkPct, plWork, diffTransportPct, plTransport, plMaterials,
      treads, winders, quarters, totalPieces, totalPrice,
      totalInvM3All, totalUsedM3All, diffM3All: totalInvM3All - totalUsedM3All,
      diffM3PctAll: totalInvM3All > 0 ? ((totalInvM3All - totalUsedM3All) / totalInvM3All) * 100 : 0,
      totalInvWorkAll, totalUsedWorkAll, diffWorkAll: totalInvWorkAll - totalUsedWorkAll,
      diffWorkPctAll: totalInvWorkAll > 0 ? ((totalInvWorkAll - totalUsedWorkAll) / totalInvWorkAll) * 100 : 0,
      totalInvTransAll, totalUsedTransAll, diffTransAll: totalInvTransAll - totalUsedTransAll,
      diffTransPctAll: totalInvTransAll > 0 ? ((totalInvTransAll - totalUsedTransAll) / totalInvTransAll) * 100 : 0,
    };
  }, [tab, displayOrders]);

  // Inline save helper — update a single field on an order
  const saveField = useCallback(
    async (orderId: string, field: Record<string, string | number | null>) => {
      const result = await updateOrder(orderId, field);
      if (result.success) {
        // Only update the field that was saved + updatedAt, preserving everything else
        const updates: Record<string, unknown> = { ...field, updatedAt: result.data.updatedAt };

        // Resolve display names for org fields
        if (field.customerOrganisationId) {
          const org = organisations.find((o) => o.id === field.customerOrganisationId);
          if (org) { updates.customerOrganisationName = org.name; updates.customerOrganisationCode = org.code; }
        }
        if (field.sellerOrganisationId !== undefined) {
          const org = organisations.find((o) => o.id === field.sellerOrganisationId);
          updates.sellerOrganisationName = org?.name ?? undefined;
          updates.sellerOrganisationCode = org?.code ?? undefined;
        }
        if (field.producerOrganisationId !== undefined) {
          const org = organisations.find((o) => o.id === field.producerOrganisationId);
          updates.producerOrganisationName = org?.name ?? undefined;
          updates.producerOrganisationCode = org?.code ?? undefined;
        }

        // Auto-set status to "loaded" when dateLoaded is set
        if (field.dateLoaded && field.dateLoaded !== null) {
          const statusResult = await updateOrderStatus(orderId, "loaded");
          if (statusResult.success) {
            updates.status = "loaded";
          }
        }

        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
        );
      } else {
        toast.error(result.error);
      }
    },
    [organisations]
  );

  // Save a production m³ field and recalculate derived values locally
  const saveProductionField = useCallback(
    async (orderId: string, fieldName: "treadM3" | "winderM3" | "quarterM3" | "usedMaterialM3", value: string) => {
      const numVal = value ? parseFloat(value.replace(",", ".")) : null;
      const result = await updateOrder(orderId, { [fieldName]: numVal });
      if (result.success) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            const updated = { ...o, [fieldName]: numVal ?? 0, updatedAt: result.data.updatedAt };
            const total = updated.treadM3 + updated.winderM3 + updated.quarterM3;
            updated.totalProducedM3 = total;
            updated.wasteM3 = updated.usedMaterialM3 > 0 ? updated.usedMaterialM3 - total : 0;
            updated.wastePercent = updated.usedMaterialM3 > 0 ? (updated.wasteM3 / updated.usedMaterialM3) * 100 : 0;
            return updated;
          })
        );
      } else {
        toast.error(result.error);
      }
    },
    []
  );

  // Save a production cost field and recalculate totals locally
  const saveProductionCostField = useCallback(
    async (orderId: string, fieldName: "productionMaterial" | "productionFinishing" | "woodArt" | "woodArtCnc", value: string) => {
      const numVal = value ? parseFloat(value.replace(",", ".")) : null;
      const result = await updateOrder(orderId, { [fieldName]: numVal });
      if (result.success) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            const updated = { ...o, [fieldName]: numVal ?? 0, updatedAt: result.data.updatedAt };
            updated.productionTotal = updated.productionMaterial + updated.productionFinishing;
            updated.woodArtTotal = updated.woodArt + updated.woodArtCnc;
            return updated;
          })
        );
      } else {
        toast.error(result.error);
      }
    },
    []
  );

  const handleAdd = useCallback(async () => {
    const result = await createOrder({
      name: "-",
      customerOrganisationId: null,
      dateReceived: new Date().toISOString().slice(0, 10),
    });
    if (result.success) {
      await loadOrders();
      // Auto-enter edit mode for the new order
      setEditingOrderId(result.data.id);
    } else {
      toast.error(result.error);
    }
  }, [loadOrders]);

  const hasActiveFilters = useCallback(() => {
    if (Object.values(columnFilters).some((s) => s.size > 0)) return true;
    if (columnSort && (columnSort.column !== "dateReceived" || columnSort.direction !== "desc")) return true;
    return false;
  }, [columnFilters, columnSort]);

  const clearFilters = useCallback(() => {
    setColumnFilters({});
    setColumnSort({ column: "dateReceived", direction: "desc" });
  }, []);

  useImperativeHandle(ref, () => ({ addOrder: handleAdd, hasActiveFilters, clearFilters }), [handleAdd, hasActiveFilters, clearFilters]);

  const handleDelete = (order: Order) => {
    setDeleteOrderItem(order);
  };

  const confirmDelete = async () => {
    if (deleteOrderItem) {
      setIsDeleting(true);
      const result = await deleteOrder(deleteOrderItem.id);
      if (result.success) {
        toast.success("Order deleted");
        loadOrders();
      } else {
        toast.error(result.error);
      }
      setDeleteOrderItem(null);
      setIsDeleting(false);
    }
  };

  const handleStatusClick = (order: Order) => {
    setStatusChangeOrder(order);
  };

  const handleStatusChange = async (status: OrderStatus) => {
    if (statusChangeOrder) {
      setNewStatus(status);
      setIsChangingStatus(true);
      const result = await updateOrderStatus(statusChangeOrder.id, status);
      if (result.success) {
        toast.success(`Status changed to ${getStatusLabel(status)}`);
        loadOrders();
      } else {
        toast.error(result.error);
      }
      setStatusChangeOrder(null);
      setNewStatus(null);
      setIsChangingStatus(false);
    }
  };

  // Helper: render header content with ColumnHeaderMenu
  const headerWithMenu = (colKey: OrderColumn, label: React.ReactNode, isNumeric = false) => (
    <span className="flex items-center gap-0.5">
      {label}
      <ColumnHeaderMenu
        columnKey={colKey}
        isNumeric={isNumeric}
        uniqueValues={columnUniqueValues[colKey] ?? []}
        activeSort={columnSort}
        activeFilter={columnFilters[colKey] ?? new Set()}
        onSortChange={setColumnSort}
        onFilterChange={handleFilterChange}
      />
    </span>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3">
      {orders.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No orders yet</p>
          <Button onClick={handleAdd} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First Order
          </Button>
        </div>
      ) : (<>
        <div ref={scrollRef} className="rounded-lg border max-h-[calc(100vh-10rem)] overflow-auto">
          <Table className="w-auto table-fixed">
            <TableHeader className="bg-card sticky top-0 z-10 [&_tr:first-child]:rounded-t-lg [&_tr:first-child_th:first-child]:rounded-tl-lg [&_tr:first-child_th:last-child]:rounded-tr-lg">
              <TableRow>
                {show("customer") && (
                <TableHead className="text-sm px-2 w-28 whitespace-nowrap">
                  {headerWithMenu("customer", "Customer")}
                </TableHead>
                )}
                {show("seller") && (
                <TableHead className="text-sm px-2 w-40 whitespace-nowrap">{headerWithMenu("seller", tab === "production" ? "Buyer" : "Seller")}</TableHead>
                )}
                {show("producer") && (
                <TableHead className="text-sm px-2">{headerWithMenu("producer", "Producer")}</TableHead>
                )}
                {show("dateReceived") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("dateReceived", <span className="flex flex-col leading-tight"><span>Date</span><span>Received</span></span>)}
                </TableHead>
                )}
                {show("dateLoaded") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("dateLoaded", <span className="flex flex-col leading-tight"><span>Date</span><span>Loaded</span></span>)}
                </TableHead>
                )}
                {show("purchaseOrderNr") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("purchaseOrderNr", <span className="flex flex-col leading-tight"><span>Purchase</span><span>Order Nr</span></span>)}
                </TableHead>
                )}
                {show("projectNumber") && (
                <TableHead className="text-sm px-2 w-20">
                  {headerWithMenu("projectNumber", <span className="flex flex-col leading-tight"><span>Project</span><span>Number</span></span>)}
                </TableHead>
                )}
                {show("type") && (
                <TableHead className="text-sm px-2 w-16">{headerWithMenu("type", "Type")}</TableHead>
                )}
                {show("treadLength") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("treadLength", <span className="flex flex-col leading-tight"><span>Tread</span><span>Length</span></span>, true)}
                </TableHead>
                )}
                {show("treads") && (
                <TableHead className="text-sm px-2 text-right w-12">{headerWithMenu("treads", "Treads", true)}</TableHead>
                )}
                {show("winders") && (
                <TableHead className="text-sm px-2 text-right w-12">{headerWithMenu("winders", "Winders", true)}</TableHead>
                )}
                {show("quarters") && (
                <TableHead className="text-sm px-2 text-right w-12">{headerWithMenu("quarters", "Quarters", true)}</TableHead>
                )}
                {show("totalPieces") && (
                <TableHead className="text-sm px-2 text-right w-14">
                  {headerWithMenu("totalPieces", <span className="flex flex-col leading-tight text-right"><span>Total</span><span>Pcs</span></span>, true)}
                </TableHead>
                )}
                {show("plannedDate") && (
                <TableHead className="text-sm px-2">
                  {headerWithMenu("plannedDate", <span className="flex flex-col leading-tight"><span>Planned</span><span>Date</span></span>)}
                </TableHead>
                )}
                {show("totalPrice") && (
                <TableHead className="text-sm px-2 text-right w-16">
                  {headerWithMenu("totalPrice", <span className="flex flex-col leading-tight text-right"><span>Total</span><span>£</span></span>, true)}
                </TableHead>
                )}
                {show("totalKg") && (
                <TableHead className="text-sm px-2 text-right w-16">
                  {headerWithMenu("totalKg", <span className="flex flex-col leading-tight text-right"><span>Total</span><span>kg</span></span>, true)}
                </TableHead>
                )}
                {show("maxM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("maxM3", <span className="flex flex-col leading-tight text-right"><span>Max</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("invoicedM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("invoicedM3", <span className="flex flex-col leading-tight text-right"><span>Invoiced</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("usedM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("usedM3", <span className="flex flex-col leading-tight text-right"><span>Used</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("diffM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("diffM3", <span className="flex flex-col leading-tight text-right"><span>Diff</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("diffPercent") && (
                <TableHead className="text-sm px-2 text-right w-16">
                  {headerWithMenu("diffPercent", <span className="flex flex-col leading-tight text-right"><span>Diff</span><span>%</span></span>, true)}
                </TableHead>
                )}
                {show("plMaterial") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("plMaterial", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>PL</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("treadM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("treadM3", <span className="flex flex-col leading-tight text-right"><span>Tread</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("winderM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("winderM3", <span className="flex flex-col leading-tight text-right"><span>Winder</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("quarterM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("quarterM3", <span className="flex flex-col leading-tight text-right"><span>Quarter</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("totalProducedM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("totalProducedM3", <span className="flex flex-col leading-tight text-right"><span>Total</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("usedMaterialM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("usedMaterialM3", <span className="flex flex-col leading-tight text-right"><span>Used</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("wasteM3") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("wasteM3", <span className="flex flex-col leading-tight text-right"><span>Waste</span><span>m³</span></span>, true)}
                </TableHead>
                )}
                {show("wastePercent") && (
                <TableHead className="text-sm px-2 text-right w-14">
                  {headerWithMenu("wastePercent", <span className="flex flex-col leading-tight text-right"><span>Waste</span><span>%</span></span>, true)}
                </TableHead>
                )}
                {show("productionMaterial") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("productionMaterial", <span className="flex flex-col leading-tight text-right"><span>Material</span><span>Production</span></span>, true)}
                </TableHead>
                )}
                {show("productionFinishing") && (
                <TableHead className="text-sm px-2 text-right w-20">{headerWithMenu("productionFinishing", "Finishing", true)}</TableHead>
                )}
                {show("productionTotal") && (
                <TableHead className="text-sm px-2 text-right w-20">{headerWithMenu("productionTotal", "Total", true)}</TableHead>
                )}
                {show("productionInvoiceNumber") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("productionInvoiceNumber", <span className="flex flex-col leading-tight"><span>Invoice</span><span>Number</span></span>)}
                </TableHead>
                )}
                {show("productionPaymentDate") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("productionPaymentDate", <span className="flex flex-col leading-tight"><span>Payment</span><span>Date</span></span>)}
                </TableHead>
                )}
                {show("woodArt") && (
                <TableHead className="text-sm px-2 text-right min-w-[5.5rem]">
                  {headerWithMenu("woodArt", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>Wood Art</span><span>Gluing</span></span>, true)}
                </TableHead>
                )}
                {show("woodArtCnc") && (
                <TableHead className="text-sm px-2 text-right min-w-[5.5rem]">
                  {headerWithMenu("woodArtCnc", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>Wood Art</span><span>CNC</span></span>, true)}
                </TableHead>
                )}
                {show("woodArtTotal") && (
                <TableHead className="text-sm px-2 text-right w-24">{headerWithMenu("woodArtTotal", "Total", true)}</TableHead>
                )}
                {show("woodArtInvoiceNumber") && (
                <TableHead className="text-sm px-2 w-28">
                  {headerWithMenu("woodArtInvoiceNumber", <span className="flex flex-col leading-tight"><span>Invoice</span><span>Number</span></span>)}
                </TableHead>
                )}
                {show("woodArtPaymentDate") && (
                <TableHead className="text-sm px-2 w-28">
                  {headerWithMenu("woodArtPaymentDate", <span className="flex flex-col leading-tight"><span>Payment</span><span>Date</span></span>)}
                </TableHead>
                )}
                {show("advanceInvoiceNumber") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("advanceInvoiceNumber", <span className="flex flex-col leading-tight"><span>Advance</span><span>Invoice</span></span>)}
                </TableHead>
                )}
                {show("invoiceNumber") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("invoiceNumber", <span className="flex flex-col leading-tight"><span>Invoice</span><span>Number</span></span>)}
                </TableHead>
                )}
                {show("packageNumber") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("packageNumber", <span className="flex flex-col leading-tight"><span>Package</span><span>Number</span></span>)}
                </TableHead>
                )}
                {show("transportInvoiceNumber") && (
                <TableHead className="text-sm px-2 w-24">
                  {headerWithMenu("transportInvoiceNumber", <span className="flex flex-col leading-tight"><span>Transport</span><span>Invoice</span></span>)}
                </TableHead>
                )}
                {show("transportPrice") && (
                <TableHead className="text-sm px-2 w-20">
                  {headerWithMenu("transportPrice", <span className="flex flex-col leading-tight"><span>Transport</span><span>Price</span></span>)}
                </TableHead>
                )}
                {show("invoicedWork") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("invoicedWork", <span className="flex flex-col leading-tight text-right"><span>Invoiced</span><span>Work</span></span>, true)}
                </TableHead>
                )}
                {show("usedWork") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("usedWork", <span className="flex flex-col leading-tight text-right"><span>Used</span><span>Work</span></span>, true)}
                </TableHead>
                )}
                {show("diffWork") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("diffWork", <span className="flex flex-col leading-tight text-right"><span>Diff</span><span>Work</span></span>, true)}
                </TableHead>
                )}
                {show("diffWorkPercent") && (
                <TableHead className="text-sm px-2 text-right w-16">
                  {headerWithMenu("diffWorkPercent", <span className="flex flex-col leading-tight text-right"><span>Diff</span><span>%</span></span>, true)}
                </TableHead>
                )}
                {show("plWork") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("plWork", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>PL</span><span>Work</span></span>, true)}
                </TableHead>
                )}
                {show("invoicedTransport") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("invoicedTransport", <span className="flex flex-col leading-tight text-right"><span>Invoiced</span><span>Transport</span></span>, true)}
                </TableHead>
                )}
                {show("usedTransport") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("usedTransport", <span className="flex flex-col leading-tight text-right"><span>Used</span><span>Transport</span></span>, true)}
                </TableHead>
                )}
                {show("diffTransport") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("diffTransport", <span className="flex flex-col leading-tight text-right"><span>Diff</span><span>Transport</span></span>, true)}
                </TableHead>
                )}
                {show("diffTransportPercent") && (
                <TableHead className="text-sm px-2 text-right w-16">
                  {headerWithMenu("diffTransportPercent", <span className="flex flex-col leading-tight text-right"><span>Diff</span><span>%</span></span>, true)}
                </TableHead>
                )}
                {show("plTransport") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("plTransport", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>PL</span><span>Transport</span></span>, true)}
                </TableHead>
                )}
                {show("plMaterials") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("plMaterials", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>PL</span><span>Materials</span></span>, true)}
                </TableHead>
                )}
                {show("plTotal") && (
                <TableHead className="text-sm px-2 text-right w-20">
                  {headerWithMenu("plTotal", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>PL</span><span>Total</span></span>, true)}
                </TableHead>
                )}
                {show("plPercentFromInvoice") && (
                <TableHead className="text-sm px-2 text-right w-16">
                  {headerWithMenu("plPercentFromInvoice", <span className="flex flex-col leading-tight text-right whitespace-nowrap"><span>%</span><span>Invoice</span></span>, true)}
                </TableHead>
                )}
                {show("status") && (
                <TableHead className="text-sm px-2 w-20">
                  {headerWithMenu("status", "Status")}
                </TableHead>
                )}
                <TableHead className="w-16 px-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.map((order) => {
                const isEditing = editingOrderId === order.id;
                return (
                <TableRow
                  key={order.id}
                  className={`hover:bg-accent/50 transition-colors ${tab !== "production" ? "cursor-pointer" : ""}`}
                  onClick={tab !== "production" ? () => router.push(tab === "list" ? `/orders/${order.id}` : `/orders/${order.id}?tab=${tab}`) : undefined}
                >
                  {show("customer") && (
                  <TableCell className="px-2 text-sm">
                    {canSelectCustomer ? (
                      <EditableSelectCell
                        value={order.customerOrganisationId}
                        displayValue={order.customerOrganisationName || "-"}
                        options={organisations}
                        onSave={(val) => saveField(order.id, { customerOrganisationId: val })}
                      />
                    ) : (
                      <span className={!order.customerOrganisationName ? "text-muted-foreground" : ""}>{order.customerOrganisationName || "-"}</span>
                    )}
                  </TableCell>
                  )}
                  {show("seller") && (
                  <TableCell className="px-2 text-sm whitespace-nowrap">
                    {organisations.length > 0 ? (
                      <EditableSelectCell
                        value={order.sellerOrganisationId || ""}
                        displayValue={order.sellerOrganisationName || "-"}
                        options={organisations}
                        onSave={(val) => saveField(order.id, { sellerOrganisationId: val || null })}
                      />
                    ) : (
                      <span className={!order.sellerOrganisationName ? "text-muted-foreground" : ""}>{order.sellerOrganisationName || "-"}</span>
                    )}
                  </TableCell>
                  )}
                  {show("producer") && (
                  <TableCell className="px-2 text-sm max-w-48">
                    {tab === "production" ? (
                      <span className={!order.producerOrganisationName ? "text-muted-foreground" : ""}>{order.producerOrganisationName || "-"}</span>
                    ) : organisations.length > 0 ? (
                      <EditableSelectCell
                        value={order.producerOrganisationId || ""}
                        displayValue={order.producerOrganisationName || "-"}
                        options={organisations}
                        onSave={(val) => saveField(order.id, { producerOrganisationId: val || null })}
                      />
                    ) : (
                      <span className={!order.producerOrganisationName ? "text-muted-foreground" : ""}>{order.producerOrganisationName || "-"}</span>
                    )}
                  </TableCell>
                  )}
                  {show("dateReceived") && (
                  <TableCell className="px-2 text-sm">
                    {tab === "production" ? (
                      <span>{formatDate(order.dateReceived)}</span>
                    ) : (
                    <EditableCell
                      value={order.dateReceived}
                      type="date"
                      onSave={(val) => saveField(order.id, { dateReceived: val })}
                      editing={isEditing}
                    />
                    )}
                  </TableCell>
                  )}
                  {show("dateLoaded") && (
                  <TableCell className="px-2 text-sm">
                    {tab === "production" ? (
                      <span className={!order.dateLoaded ? "text-muted-foreground" : ""}>{formatDate(order.dateLoaded)}</span>
                    ) : (
                    <EditableCell
                      value={order.dateLoaded || ""}
                      type="date"
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { dateLoaded: val || null })}
                      editing={isEditing}
                    />
                    )}
                  </TableCell>
                  )}
                  {show("purchaseOrderNr") && (
                  <TableCell className="px-2 text-sm">
                    {tab === "production" ? (
                      <span className={!order.name ? "text-muted-foreground" : ""}>{order.name || "-"}</span>
                    ) : (
                    <EditableCell
                      value={order.name}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { name: val })}
                      editing={isEditing}
                    />
                    )}
                  </TableCell>
                  )}
                  {show("projectNumber") && (
                  <TableCell className="px-2 text-sm whitespace-nowrap">
                    {tab === "production" ? (
                      <span className={!order.projectNumber ? "text-muted-foreground" : ""}>{order.projectNumber || "-"}</span>
                    ) : (
                    <EditableCell
                      value={order.projectNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { projectNumber: val || null })}
                      editing={isEditing}
                    />
                    )}
                  </TableCell>
                  )}
                  {show("type") && (
                  <TableCell className="px-2 text-sm">{order.typeSummary || <span className="text-muted-foreground">-</span>}</TableCell>
                  )}
                  {show("treadLength") && (
                  <TableCell className="px-2 text-sm text-right whitespace-nowrap">
                    {tab === "production" ? (
                      <span className={!order.treadLength ? "text-muted-foreground" : ""}>{order.treadLength || "-"}</span>
                    ) : (
                    <EditableCell
                      value={order.treadLength || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { treadLength: val || null })}
                      editing={isEditing}
                      align="right"
                    />
                    )}
                  </TableCell>
                  )}
                  {show("treads") && (
                  <TableCell className="px-2 text-sm text-right">{order.treads || <span className="text-muted-foreground">-</span>}</TableCell>
                  )}
                  {show("winders") && (
                  <TableCell className="px-2 text-sm text-right">{order.winders || <span className="text-muted-foreground">-</span>}</TableCell>
                  )}
                  {show("quarters") && (
                  <TableCell className="px-2 text-sm text-right">{order.quarters || <span className="text-muted-foreground">-</span>}</TableCell>
                  )}
                  {show("totalPieces") && (
                  <TableCell className="px-2 text-sm text-right">{order.totalPieces || <span className="text-muted-foreground">-</span>}</TableCell>
                  )}
                  {show("plannedDate") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.plannedDate || ""}
                      type="date"
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { plannedDate: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("totalPrice") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.totalPricePence ? (order.totalPricePence / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("totalKg") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.totalKg > 0 ? order.totalKg.toFixed(2) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("maxM3") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.maxM3 > 0 ? order.maxM3.toFixed(4) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("invoicedM3") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.maxM3 > 0 ? order.maxM3.toFixed(4) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("usedM3") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.usedMaterialM3 > 0 ? order.usedMaterialM3.toFixed(4) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("diffM3") && (() => {
                    const diff = order.maxM3 > 0 && order.usedMaterialM3 > 0 ? order.maxM3 - order.usedMaterialM3 : null;
                    return (
                    <TableCell className="px-2 text-sm text-right">
                      {diff !== null
                        ? <span className={diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : ""}>{diff.toFixed(4)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("diffPercent") && (() => {
                    const diffPct = order.maxM3 > 0 && order.usedMaterialM3 > 0 ? ((order.maxM3 - order.usedMaterialM3) / order.maxM3) * 100 : null;
                    return (
                    <TableCell className="px-2 text-sm text-right">
                      {diffPct !== null
                        ? <span className={diffPct < 0 ? "text-red-600" : diffPct > 0 ? "text-green-600" : ""}>{diffPct.toFixed(1)}%</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("plMaterial") && (() => {
                    const inv = order.maxM3;
                    const used = order.usedMaterialM3;
                    const diff = inv > 0 && used > 0 ? inv - used : null;
                    const tooltip = diff !== null
                      ? `(${inv.toFixed(4)} − ${used.toFixed(4)}) × ${order.eurPerM3.toFixed(2)} × 0.70 = ${order.plMaterialValue.toFixed(2)}`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {order.plMaterialValue !== 0
                        ? <span className={order.plMaterialValue < 0 ? "text-red-600" : "text-green-600"}>{order.plMaterialValue.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("treadM3") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.treadM3 > 0 ? order.treadM3.toFixed(4) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionField(order.id, "treadM3", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("winderM3") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.winderM3 > 0 ? order.winderM3.toFixed(4) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionField(order.id, "winderM3", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("quarterM3") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.quarterM3 > 0 ? order.quarterM3.toFixed(4) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionField(order.id, "quarterM3", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("totalProducedM3") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.totalProducedM3 > 0 ? order.totalProducedM3.toFixed(4) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("usedMaterialM3") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.usedMaterialM3 > 0 ? order.usedMaterialM3.toFixed(4) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionField(order.id, "usedMaterialM3", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("wasteM3") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.wasteM3 > 0 ? order.wasteM3.toFixed(4) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("wastePercent") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.wastePercent > 0 ? `${order.wastePercent.toFixed(1)}%` : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("productionMaterial") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.productionMaterial > 0 ? order.productionMaterial.toFixed(2) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionCostField(order.id, "productionMaterial", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("productionFinishing") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.productionFinishing > 0 ? order.productionFinishing.toFixed(2) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionCostField(order.id, "productionFinishing", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("productionTotal") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.productionTotal > 0 ? order.productionTotal.toFixed(2) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("productionInvoiceNumber") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.productionInvoiceNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { productionInvoiceNumber: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("productionPaymentDate") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.productionPaymentDate || ""}
                      type="date"
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { productionPaymentDate: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("woodArt") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.woodArt > 0 ? order.woodArt.toFixed(2) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionCostField(order.id, "woodArt", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("woodArtCnc") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.woodArtCnc > 0 ? order.woodArtCnc.toFixed(2) : ""}
                      placeholder="-"
                      onSave={(val) => saveProductionCostField(order.id, "woodArtCnc", val)}
                      editing={isEditing}
                      align="right"
                    />
                  </TableCell>
                  )}
                  {show("woodArtTotal") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.woodArtTotal > 0 ? order.woodArtTotal.toFixed(2) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("woodArtInvoiceNumber") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.woodArtInvoiceNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { woodArtInvoiceNumber: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("woodArtPaymentDate") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.woodArtPaymentDate || ""}
                      type="date"
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { woodArtPaymentDate: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("advanceInvoiceNumber") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.advanceInvoiceNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { advanceInvoiceNumber: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("invoiceNumber") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.invoiceNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { invoiceNumber: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("packageNumber") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.packageNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { packageNumber: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("transportInvoiceNumber") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.transportInvoiceNumber || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { transportInvoiceNumber: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("transportPrice") && (
                  <TableCell className="px-2 text-sm">
                    <EditableCell
                      value={order.transportPrice || ""}
                      placeholder="-"
                      onSave={(val) => saveField(order.id, { transportPrice: val || null })}
                      editing={isEditing}
                    />
                  </TableCell>
                  )}
                  {show("invoicedWork") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.invoicedWork > 0 ? order.invoicedWork.toFixed(2) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("usedWork") && (() => {
                    const f = order.productionFinishing;
                    const wa = order.woodArt;
                    const cnc = order.woodArtCnc;
                    const tooltip = order.usedWork > 0
                      ? `Finishing ${f.toFixed(2)} + Gluing ${wa.toFixed(2)} + CNC ${cnc.toFixed(2)} = ${order.usedWork.toFixed(2)}`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {order.usedWork > 0 ? order.usedWork.toFixed(2) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("diffWork") && (() => {
                    const diff = order.invoicedWork > 0 && order.usedWork > 0 ? order.invoicedWork - order.usedWork : null;
                    return (
                    <TableCell className="px-2 text-sm text-right">
                      {diff !== null
                        ? <span className={diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : ""}>{diff.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("diffWorkPercent") && (() => {
                    const diffPct = order.invoicedWork > 0 && order.usedWork > 0 ? ((order.invoicedWork - order.usedWork) / order.invoicedWork) * 100 : null;
                    return (
                    <TableCell className="px-2 text-sm text-right">
                      {diffPct !== null
                        ? <span className={diffPct < 0 ? "text-red-600" : diffPct > 0 ? "text-green-600" : ""}>{diffPct.toFixed(1)}%</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("plWork") && (() => {
                    const inv = order.invoicedWork;
                    const used = order.usedWork;
                    const tooltip = inv > 0 && used > 0
                      ? `${inv.toFixed(2)} − ${used.toFixed(2)} = ${order.plWorkValue.toFixed(2)}`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {order.plWorkValue !== 0
                        ? <span className={order.plWorkValue < 0 ? "text-red-600" : "text-green-600"}>{order.plWorkValue.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("invoicedTransport") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.invoicedTransport > 0 ? order.invoicedTransport.toFixed(2) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("usedTransport") && (
                  <TableCell className="px-2 text-sm text-right">
                    {order.usedTransport > 0 ? order.usedTransport.toFixed(2) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  )}
                  {show("diffTransport") && (() => {
                    const diff = order.invoicedTransport > 0 && order.usedTransport > 0 ? order.invoicedTransport - order.usedTransport : null;
                    return (
                    <TableCell className="px-2 text-sm text-right">
                      {diff !== null
                        ? <span className={diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : ""}>{diff.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("diffTransportPercent") && (() => {
                    const diffPct = order.invoicedTransport > 0 && order.usedTransport > 0 ? ((order.invoicedTransport - order.usedTransport) / order.invoicedTransport) * 100 : null;
                    return (
                    <TableCell className="px-2 text-sm text-right">
                      {diffPct !== null
                        ? <span className={diffPct < 0 ? "text-red-600" : diffPct > 0 ? "text-green-600" : ""}>{diffPct.toFixed(1)}%</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("plTransport") && (() => {
                    const inv = order.invoicedTransport;
                    const used = order.usedTransport;
                    const tooltip = inv > 0 && used > 0
                      ? `${inv.toFixed(2)} − ${used.toFixed(2)} = ${order.plTransportValue.toFixed(2)}`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {order.plTransportValue !== 0
                        ? <span className={order.plTransportValue < 0 ? "text-red-600" : "text-green-600"}>{order.plTransportValue.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("plMaterials") && (() => {
                    const val = order.plMaterialsValue;
                    const tooltip = val !== 0
                      ? `Total €/piece × 0.30 = ${val.toFixed(2)}`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {val !== 0
                        ? <span className={val < 0 ? "text-red-600" : "text-green-600"}>{val.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("plTotal") && (() => {
                    const val = order.plTotalValue;
                    const plM3 = order.plMaterialValue;
                    const plW = order.plWorkValue;
                    const plT = order.plTransportValue;
                    const plMat = order.plMaterialsValue;
                    const tooltip = val !== 0
                      ? `PL m³ ${plM3.toFixed(2)} + PL Work ${plW.toFixed(2)} + PL Transport ${plT.toFixed(2)} + PL Materials ${plMat.toFixed(2)} = ${val.toFixed(2)}`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {val !== 0
                        ? <span className={val < 0 ? "text-red-600" : "text-green-600"}>{val.toFixed(2)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("plPercentFromInvoice") && (() => {
                    const val = order.plPercentFromInvoice;
                    const totalInvoiceEur = order.totalPricePence > 0 ? (order.totalPricePence / 100) * 0.9 : 0;
                    const tooltip = totalInvoiceEur > 0 && order.plTotalValue !== 0
                      ? `${order.plTotalValue.toFixed(2)} / (${(order.totalPricePence / 100).toFixed(2)} GBP × 0.90) × 100 = ${val.toFixed(1)}%`
                      : "No data";
                    return (
                    <TableCell className="px-2 text-sm text-right" title={tooltip}>
                      {val !== 0
                        ? <span className={val < 0 ? "text-red-600" : "text-green-600"}>{val.toFixed(1)}%</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    );
                  })()}
                  {show("status") && (
                  <TableCell className="px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusClick(order); }}
                      className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                    >
                      <Badge
                        variant={getStatusBadgeVariant(order.status)}
                        className="cursor-pointer hover:opacity-80 transition-opacity text-xs"
                      >
                        {getStatusLabel(order.status)}
                      </Badge>
                    </button>
                  </TableCell>
                  )}
                  <TableCell className="px-0">
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => { e.stopPropagation(); setEditingOrderId(isEditing ? null : order.id); }}
                        aria-label={isEditing ? "Done editing" : "Edit order"}
                      >
                        {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(order); }}
                        aria-label={`Delete ${order.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
            {/* Analytics totals footer */}
            {analyticsSummary && displayOrders.length > 0 && (() => {
              const s = analyticsSummary;
              // Count leading non-numeric columns for the "Total" label colspan
              const leadingCols: OrderColumn[] = ["customer", "seller", "producer", "dateReceived", "dateLoaded", "purchaseOrderNr", "projectNumber", "type", "treadLength"];
              const leadingCount = leadingCols.filter((c) => columns.includes(c)).length;
              const fmt = (v: number, d = 2) => v !== 0 ? v.toFixed(d) : "-";
              const fmtInt = (v: number) => v !== 0 ? String(v) : "-";
              const fmtPct = (v: number) => v !== 0 ? `${v.toFixed(1)}%` : "-";
              const color = (v: number) => v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "";
              return (
                <tfoot className="bg-white dark:bg-gray-950 sticky bottom-0 z-10 border-t font-medium text-sm shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                  <tr>
                    {leadingCount > 0 && <td className="px-2 py-2" colSpan={leadingCount}>Total</td>}
                    {show("treads") && <td className="px-2 py-2 text-right">{fmtInt(s.treads)}</td>}
                    {show("winders") && <td className="px-2 py-2 text-right">{fmtInt(s.winders)}</td>}
                    {show("quarters") && <td className="px-2 py-2 text-right">{fmtInt(s.quarters)}</td>}
                    {show("totalPieces") && <td className="px-2 py-2 text-right">{fmtInt(s.totalPieces)}</td>}
                    {show("totalPrice") && <td className="px-2 py-2 text-right">{fmt(s.totalPrice)}</td>}
                    {show("totalKg") && <td className="px-2 py-2 text-right">-</td>}
                    {show("invoicedM3") && <td className="px-2 py-2 text-right">{fmt(s.totalInvM3All, 4)}</td>}
                    {show("usedM3") && <td className="px-2 py-2 text-right">{fmt(s.totalUsedM3All, 4)}</td>}
                    {show("diffM3") && <td className={`px-2 py-2 text-right ${color(s.diffM3All)}`}>{fmt(s.diffM3All, 4)}</td>}
                    {show("diffPercent") && <td className={`px-2 py-2 text-right ${color(s.diffM3PctAll)}`}>{fmtPct(s.diffM3PctAll)}</td>}
                    {show("plMaterial") && <td className={`px-2 py-2 text-right ${color(s.plM3)}`}>{fmt(s.plM3)}</td>}
                    {show("invoicedWork") && <td className="px-2 py-2 text-right">{fmt(s.totalInvWorkAll)}</td>}
                    {show("usedWork") && <td className="px-2 py-2 text-right">{fmt(s.totalUsedWorkAll)}</td>}
                    {show("diffWork") && <td className={`px-2 py-2 text-right ${color(s.diffWorkAll)}`}>{fmt(s.diffWorkAll)}</td>}
                    {show("diffWorkPercent") && <td className={`px-2 py-2 text-right ${color(s.diffWorkPctAll)}`}>{fmtPct(s.diffWorkPctAll)}</td>}
                    {show("plWork") && <td className={`px-2 py-2 text-right ${color(s.plWork)}`}>{fmt(s.plWork)}</td>}
                    {show("invoicedTransport") && <td className="px-2 py-2 text-right">{fmt(s.totalInvTransAll)}</td>}
                    {show("usedTransport") && <td className="px-2 py-2 text-right">{fmt(s.totalUsedTransAll)}</td>}
                    {show("diffTransport") && <td className={`px-2 py-2 text-right ${color(s.diffTransAll)}`}>{fmt(s.diffTransAll)}</td>}
                    {show("diffTransportPercent") && <td className={`px-2 py-2 text-right ${color(s.diffTransPctAll)}`}>{fmtPct(s.diffTransPctAll)}</td>}
                    {show("plTransport") && <td className={`px-2 py-2 text-right ${color(s.plTransport)}`}>{fmt(s.plTransport)}</td>}
                    {show("plMaterials") && <td className={`px-2 py-2 text-right ${color(s.plMaterials)}`}>{fmt(s.plMaterials)}</td>}
                    {show("plTotal") && <td className={`px-2 py-2 text-right ${color(s.plTotal)}`}>{fmt(s.plTotal)}</td>}
                    {show("plPercentFromInvoice") && <td className={`px-2 py-2 text-right ${color(s.plPercent)}`}>{fmtPct(s.plPercent)}</td>}
                    {show("status") && <td className="px-2 py-2" />}
                  </tr>
                </tfoot>
              );
            })()}
          </Table>
        </div>
      </>)}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteOrderItem}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteOrderItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteOrderItem?.name || "this order"}&quot;?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Dialog */}
      <AlertDialog
        open={!!statusChangeOrder}
        onOpenChange={(open) => {
          if (!open && !isChangingStatus) {
            setStatusChangeOrder(null);
            setNewStatus(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Order Status</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new status for &quot;{statusChangeOrder?.name}&quot;
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-wrap gap-2 py-4">
            {ORDER_STATUSES.map((status) => (
              <Button
                key={status}
                variant={statusChangeOrder?.status === status ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange(status)}
                disabled={isChangingStatus || statusChangeOrder?.status === status}
              >
                {isChangingStatus && newStatus === status ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                {getStatusLabel(status)}
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isChangingStatus}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
