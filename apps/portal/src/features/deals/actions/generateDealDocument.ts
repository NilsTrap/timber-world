"use server";

import { createClient } from "@/lib/supabase/server";
import { generateDocument, type GenerateDocumentInput, type GeneratedDocument } from "../services/documentService";
import { getSession, requireDeals, resolveActor } from "./_actor";
import type { ActionResult } from "../types";

export async function generateDealDocument(
  input: GenerateDocumentInput
): Promise<ActionResult<GeneratedDocument>> {
  const session = await getSession();
  const guard = await requireDeals(session);
  if (guard) return guard;
  const db = await createClient();
  return generateDocument(db, resolveActor(session!), input);
}
