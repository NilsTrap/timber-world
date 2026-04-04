"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Button,
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
} from "@timber/ui";
import { getOrders, deleteOrder, updateOrderStatus } from "../actions";
import type { Order, OrderStatus } from "../types";
import { getStatusBadgeVariant, getStatusLabel, ORDER_STATUSES } from "../types";
import { OrderForm } from "./OrderForm";

type SortColumn = "code" | "name" | "organisation" | "orderDate" | "status" | "volume";
type SortDirection = "asc" | "desc";

/**
 * Sort Indicator Component
 */
function SortIndicator({
  column,
  sortColumn,
  sortDirection,
}: {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) {
    return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
  }
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  );
}

/**
 * Format currency value
 */
function formatValue(cents: number | null, currency: string): string {
  if (cents === null) return "-";
  const value = cents / 100;
  const symbols: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };
  return `${symbols[currency] || ""}${value.toLocaleString("en", { minimumFractionDigits: 2 })}`;
}

/**
 * Format volume
 */
function formatVolume(m3: number | null): string {
  if (m3 === null) return "-";
  return `${m3.toLocaleString("en", { minimumFractionDigits: 2 })} m³`;
}

interface OrdersTableProps {
  isAdmin: boolean;
  /** Whether the user can pick which customer the order is for (salesperson/admin) */
  canSelectCustomer: boolean;
  userOrganisationId?: string | null;
  userOrganisationName?: string | null;
}

/**
 * Orders Table
 *
 * Displays all orders with sortable columns and CRUD actions.
 */
export function OrdersTable({ isAdmin, canSelectCustomer, userOrganisationId, userOrganisationName }: OrdersTableProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>("orderDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Delete confirmation state
  const [deleteOrderItem, setDeleteOrderItem] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status change state
  const [statusChangeOrder, setStatusChangeOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    const result = await getOrders();
    if (result.success) {
      setOrders(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Sort orders based on current sort state
  const sortedOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "code":
          comparison = a.code.localeCompare(b.code);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "organisation":
          comparison = (a.organisationName || "").localeCompare(b.organisationName || "");
          break;
        case "orderDate":
          comparison = a.orderDate.localeCompare(b.orderDate);
          break;
        case "status":
          comparison = ORDER_STATUSES.indexOf(a.status) - ORDER_STATUSES.indexOf(b.status);
          break;
        case "volume":
          comparison = (a.volumeM3 ?? 0) - (b.volumeM3 ?? 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [orders, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingOrder(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadOrders();
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Order
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No orders yet</p>
          <Button onClick={handleAdd} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First Order
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("code")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                  >
                    Code
                    <SortIndicator column="code" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                  >
                    Name
                    <SortIndicator column="name" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("organisation")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                  >
                    Customer
                    <SortIndicator column="organisation" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("orderDate")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                  >
                    Date
                    <SortIndicator column="orderDate" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("volume")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                  >
                    Volume
                    <SortIndicator column="volume" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">Value</TableHead>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                  >
                    Status
                    <SortIndicator column="status" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrders.map((order) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <TableCell className="font-mono font-medium">{order.code}</TableCell>
                  <TableCell>{order.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-muted-foreground mr-1">
                      {order.organisationCode}
                    </span>
                    {order.organisationName}
                  </TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{formatVolume(order.volumeM3)}</TableCell>
                  <TableCell>{formatValue(order.valueCents, order.currency)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? (
                      <button
                        onClick={() => handleStatusClick(order)}
                        className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                      >
                        <Badge
                          variant={getStatusBadgeVariant(order.status)}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {getStatusLabel(order.status)}
                        </Badge>
                      </button>
                    ) : (
                      <Badge variant={getStatusBadgeVariant(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(order)}
                          aria-label={`Edit ${order.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {order.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(order)}
                            aria-label={`Delete ${order.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <OrderForm
        order={editingOrder}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleFormSuccess}
        isAdmin={isAdmin}
        canSelectCustomer={canSelectCustomer}
        userOrganisationId={userOrganisationId}
        userOrganisationName={userOrganisationName}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteOrderItem}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteOrderItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteOrderItem?.name}&quot;?
              <br />
              <br />
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
}
