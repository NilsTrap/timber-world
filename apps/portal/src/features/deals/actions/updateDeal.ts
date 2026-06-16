"use server";

import { createClient } from "@/lib/supabase/server";
import { updateDeal as updateDealSvc } from "../services/dealsService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult, CreateDealInput, Deal, DealStatus } from "../types";

export async function updateDeal(
  dealId: string,
  patch: Partial<CreateDealInput> & { status?: DealStatus }
): Promise<ActionResult<Deal>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return updateDealSvc(db, resolveActor(session!), dealId, patch);
}
