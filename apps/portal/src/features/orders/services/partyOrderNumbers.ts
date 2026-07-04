/**
 * N3 · Party order numbers — the customer's and supplier's OWN order numbers for
 * a deal, stored as first-class labeled refs on `order_external_refs`. Nils:
 * "klientam un ražotājam ir savs order number, kuram jāparādās darījumā obligāti
 * — gan dokumentos, gan sarakstos."
 *
 * PURE (no DB / no react) so it is shared by the deal service, the document
 * assembler, the References editor, AND the orders overview render (M1 · handed
 * over — call `partyOrderNumbers(order.externalRefs)` there; see the accessor).
 */
import type { OrderExternalRefType } from "./dealModel";

export const CUSTOMER_ORDER_NO_REF_TYPE: OrderExternalRefType = "customer_order_no";
export const SUPPLIER_ORDER_NO_REF_TYPE: OrderExternalRefType = "supplier_order_no";

/** Canonical labels — the exact strings rendered on documents + shown in the UI. */
export const CUSTOMER_ORDER_NO_LABEL = "Customer order no.";
export const SUPPLIER_ORDER_NO_LABEL = "Supplier order no.";

export interface PartyOrderNumbers {
  customerOrderNo: string | null;
  supplierOrderNo: string | null;
}

/** A ref shape tolerant of both the camelCase service type (OrderExternalRef) and
 *  raw snake_case DB rows, so M1 can pass whichever it has to the overview. The
 *  index signature lets a full OrderExternalRef literal (id/label/…) pass. */
type RefLike = {
  refType?: string | null;
  ref_type?: string | null;
  refValue?: string | null;
  ref_value?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function findRef(refs: ReadonlyArray<RefLike>, type: OrderExternalRefType): string | null {
  const r = refs.find((x) => (x.refType ?? x.ref_type) === type);
  const v = r ? (r.refValue ?? r.ref_value) : null;
  return v != null && String(v).trim() !== "" ? String(v) : null;
}

/**
 * Extract the canonical party order numbers from a deal's external refs.
 * Accessor handed to M1's OrdersOverview render (Reference column):
 *   `partyOrderNumbers(order.externalRefs)` → `{ customerOrderNo, supplierOrderNo }`.
 * (M1 must include `order_external_refs` in the getOrders query and expose it on
 *  the Order row — it isn't fetched there today.)
 */
export function partyOrderNumbers(refs: ReadonlyArray<RefLike> | null | undefined): PartyOrderNumbers {
  const list = refs ?? [];
  return {
    customerOrderNo: findRef(list, CUSTOMER_ORDER_NO_REF_TYPE),
    supplierOrderNo: findRef(list, SUPPLIER_ORDER_NO_REF_TYPE),
  };
}
