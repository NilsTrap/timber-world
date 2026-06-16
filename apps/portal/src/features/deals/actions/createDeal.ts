"use server";

import { createClient } from "@/lib/supabase/server";
import { createDeal as createDealSvc } from "../services/dealsService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult, CreateDealInput, Deal } from "../types";

export async function createDeal(input: CreateDealInput): Promise<ActionResult<Deal>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return createDealSvc(db, resolveActor(session!), input);
}
