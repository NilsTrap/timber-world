/**
 * Epic C · §7 "Activities by stage and direction" — DISPLAY-ONLY guidance data.
 *
 * The spec (§7) describes, for every lifecycle stage and each direction (facing
 * the customer = SELL, facing the supplier = BUY), the activities a person would
 * carry out. These are the CRM / communication layer and are EXPLICITLY "not
 * built as enforced tasks in this version" (§1.3, §7). So this module holds only
 * static reference text: no persistence, no checkboxes, no gating. The card that
 * renders it (DealActivitiesCard) is pure guidance — every capability stays
 * available at every stage (§8.1).
 *
 * The activity strings are VERBATIM from the specification PDF §7 table. Do not
 * paraphrase — if the spec text changes, mirror it here exactly.
 *
 * SUGGESTED_DOC_TYPES additionally powers C3's stage emphasis in the document
 * panel (which doc types the current stage foregrounds). It is guidance too —
 * every doc type remains generatable at every stage. When Epic D2's document-type
 * registry lands, these direction/stage hints can migrate onto it; kept local
 * here so Epic C does not depend on D.
 */
import { LIFECYCLE_STAGES, CANCELLED_STAGE, type LifecycleStage } from "./lifecycle";
import type { DocType } from "./dealModel";

/** Direction of the leg the viewer stands on (§2.5) — never an absolute label. */
export type ActivityDirection = "sell" | "buy";

/** The short caption the spec prints under each stage name (§6.1 / §7). */
export const STAGE_CAPTIONS: Record<string, string> = {
  draft: "preparing",
  confirmed: "firm",
  produced: "goods made",
  loaded: "goods loaded",
  delivered: "goods arrive",
  [CANCELLED_STAGE]: "halted",
};

interface StageActivities {
  sell: string[];
  buy: string[];
}

/**
 * §7 activities table, verbatim. Keyed by lifecycle stage; each stage carries the
 * sell-side (facing the customer) and buy-side (facing the supplier) activity list.
 */
export const DEAL_ACTIVITIES: Record<LifecycleStage, StageActivities> = {
  draft: {
    sell: [
      "build the sales spec",
      "send the quotation",
      "negotiate terms with the customer",
      "prepare the sales contract & proforma",
      "secure the customer's agreement",
    ],
    buy: [
      "build the purchase spec",
      "request a quote from the producer",
      "agree price, terms & timing with the factory",
      "prepare the purchase order",
      "secure the producer's agreement",
    ],
  },
  confirmed: {
    sell: [
      "deal locked as firm",
      "keep the customer informed of progress",
    ],
    buy: [
      "deal locked as firm",
      "chase the factory on production progress",
    ],
  },
  produced: {
    sell: [
      "confirm the goods are made and acceptable",
      "notify the customer",
    ],
    buy: [
      "confirm production complete",
      "inspect / quality-check",
      "request photos & packing details",
      "verify against the spec",
      "prepare the packing list & labels",
    ],
  },
  loaded: {
    sell: [
      "order transport for delivery (when it is your responsibility)",
      "confirm dispatch toward the customer",
      "send the shipment notice",
    ],
    buy: [
      "order transport for the inbound leg (when it is your responsibility)",
      "confirm loading at origin",
      "obtain the transport documents (CMR)",
    ],
  },
  delivered: {
    sell: [
      "customer receives & accepts",
      "close the deal",
    ],
    buy: [
      "receive & unload into the warehouse",
      "check on arrival",
      "close the deal",
    ],
  },
};

/** §7 note: "Cancelled is identical on both directions." */
export const CANCELLED_NOTE =
  "The deal is halted before delivery and flagged across the spine.";

/** The activities for a stage + direction (empty array for cancelled/unknown). */
export function activitiesFor(stage: string, direction: ActivityDirection): string[] {
  const entry = DEAL_ACTIVITIES[stage as LifecycleStage];
  return entry ? entry[direction] : [];
}

/**
 * C3 · stage-suggested documents per direction — the doc types the current stage
 * foregrounds (guidance, never a gate). Ordered by relevance; the first entry is
 * the natural default to pre-select. Derived from §7 activities + the §8.2 set.
 */
export const SUGGESTED_DOC_TYPES: Record<LifecycleStage, Record<ActivityDirection, DocType[]>> = {
  draft: {
    sell: ["sales_spec", "proforma_invoice", "contract"],
    buy: ["purchase_spec"],
  },
  confirmed: {
    sell: ["sales_spec", "proforma_invoice"],
    buy: ["purchase_spec"],
  },
  produced: {
    sell: ["packing_list"],
    buy: ["packing_list"],
  },
  loaded: {
    sell: ["cmr", "packing_list", "invoice"],
    buy: ["cmr", "packing_list"],
  },
  delivered: {
    sell: ["invoice"],
    buy: ["invoice"],
  },
};

/** Suggested doc types for a stage + direction (empty for cancelled/unknown). */
export function suggestedDocsFor(stage: string, direction: ActivityDirection): DocType[] {
  const entry = SUGGESTED_DOC_TYPES[stage as LifecycleStage];
  return entry ? entry[direction] : [];
}

/** The ordered stage list plus the terminal cancelled state, for the guidance card. */
export const ACTIVITY_STAGES: readonly string[] = [...LIFECYCLE_STAGES, CANCELLED_STAGE];
