"use server";

import { createClient } from "@/lib/supabase/server";
import { getDeal as getDealSvc } from "../services/dealsService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult, Deal } from "../types";

export async function getDeal(dealId: string): Promise<ActionResult<Deal>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return getDealSvc(db, resolveActor(session!), dealId);
}
