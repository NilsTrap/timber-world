"use server";

import { createClient } from "@/lib/supabase/server";
import { replaceLineItems } from "../services/dealsService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult, DealLineItem, DealSide } from "../types";

export async function saveDealLineItems(
  dealId: string,
  side: DealSide,
  items: Partial<DealLineItem>[]
): Promise<ActionResult<DealLineItem[]>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return replaceLineItems(db, resolveActor(session!), dealId, side, items);
}
