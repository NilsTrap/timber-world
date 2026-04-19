"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface SpecificationFile {
  id: string;
  fileName: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number | null;
  sortOrder: number;
  createdAt: string;
  publicUrl?: string;
}

export interface Specification {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  files: SpecificationFile[];
}

/**
 * Get all specifications with their files (admin view)
 */
export async function getSpecifications(): Promise<ActionResult<Specification[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_specifications")
    .select(`
      id, title, description, sort_order, is_active, created_at, updated_at,
      marketing_specification_files (
        id, file_name, original_name, storage_path, mime_type, file_size_bytes, sort_order, created_at
      )
    `)
    .order("sort_order")
    .order("sort_order", { referencedTable: "marketing_specification_files" });

  if (error) {
    console.error("Failed to fetch specifications:", error);
    return { success: false, error: "Failed to fetch specifications", code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const specs: Specification[] = (data as any[]).map((s: any) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    sortOrder: s.sort_order,
    isActive: s.is_active,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    files: (s.marketing_specification_files || []).map((f: any) => {
      const { data: urlData } = supabase.storage
        .from("marketing")
        .getPublicUrl(f.storage_path);
      return {
        id: f.id,
        fileName: f.file_name,
        originalName: f.original_name,
        storagePath: f.storage_path,
        mimeType: f.mime_type,
        fileSizeBytes: f.file_size_bytes,
        sortOrder: f.sort_order,
        createdAt: f.created_at,
        publicUrl: urlData?.publicUrl,
      };
    }),
  }));

  return { success: true, data: specs };
}
