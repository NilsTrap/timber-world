"use server";

import { createClient } from "@/lib/supabase/server";
import { listDeals, type ListDealsFilters } from "../services/dealsService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult, Deal } from "../types";

export async function getDeals(filters: ListDealsFilters = {}): Promise<ActionResult<Deal[]>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return listDeals(db, resolveActor(session!), filters);
}
