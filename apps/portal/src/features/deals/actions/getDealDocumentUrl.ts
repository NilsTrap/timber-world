"use server";

import { createClient } from "@/lib/supabase/server";
import { getDocumentUrl } from "../services/documentService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult } from "../types";

export async function getDealDocumentUrl(
  documentId: string
): Promise<ActionResult<{ url: string; fileName: string | null }>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return getDocumentUrl(db, resolveActor(session!), documentId);
}
