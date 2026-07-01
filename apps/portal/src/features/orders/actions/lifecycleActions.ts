"use server";

/**
 * Lifecycle + gate server actions (E3) — thin UI callers of the lifecycle
 * service. Advance / cancel / record-confirmation / evaluate reuse the SAME
 * (db, actor) resolution + orders.view permission as the other deal actions
 * (via resolveDealActor); the gate-config actions additionally require an admin
 * and re-check it here (the service re-checks too — never trust the client).
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";
import {
  advanceDeal,
  cancelDeal,
  evaluateAdvance,
  recordGateConfirmation,
  listGateConfigs,
  upsertGateConfig,
  type AdvanceEvaluation,
  type GateConfigRow,
  type GateBlock,
} from "../services/lifecycle";
import { resolveDealActor } from "./_dealActor";

/** Advance a deal one milestone if its gate is satisfied. Re-checks orders.view. */
export async function advanceDealAction(orderId: string): Promise<ActionResult<{ stage: string }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  const res = await advanceDeal(a.db, a.actor, orderId);
  if (res.success) revalidatePath(`/orders/${orderId}`);
  return res;
}

/** Cancel a deal (flags the spine/chain if it was still active). Re-checks orders.view. */
export async function cancelDealAction(orderId: string): Promise<ActionResult<{ stage: string; chainFlagged: boolean }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  const res = await cancelDeal(a.db, a.actor, orderId);
  if (res.success) revalidatePath(`/orders/${orderId}`);
  return res;
}

/** Record a party sign-off / buyer-acceptance confirmation for the current-stage gate. */
export async function recordGateConfirmationAction(
  orderId: string,
  fromStage: string,
  blockType: "party_signoff" | "acceptance",
  blockKey: string,
): Promise<ActionResult<{ recorded: boolean }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  const res = await recordGateConfirmation(a.db, a.actor, {
    orderId,
    fromStage,
    blockType,
    blockKey,
    confirmedByOrg: a.orgId, // the actor's org, when they belong to one (null for admins)
  });
  if (res.success) revalidatePath(`/orders/${orderId}`);
  return res;
}

/** Read-only: current stage, next stage, and which gate blocks are still unmet. */
export async function evaluateAdvanceAction(orderId: string): Promise<ActionResult<AdvanceEvaluation>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  return evaluateAdvance(a.db, orderId);
}

/** Admin-only: list every configured gate (deal-kind × from-stage). */
export async function listGateConfigsAction(): Promise<ActionResult<GateConfigRow[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Only an admin can view gate configuration", code: "FORBIDDEN" };
  return listGateConfigs(a.db);
}

/** Admin-only: create/update a gate's requirements + active flag. Service re-checks admin. */
export async function upsertGateConfigAction(input: {
  dealKind: string;
  fromStage: string;
  requirements: GateBlock[];
  isActive?: boolean;
}): Promise<ActionResult<GateConfigRow>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Only an admin can configure gates", code: "FORBIDDEN" };
  return upsertGateConfig(a.db, a.actor, input);
}
