"use server";

import { createClient } from "@timber/database/server";

export interface CMSSpecificationFile {
  id: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  publicUrl: string;
}

export interface CMSSpecification {
  id: string;
  title: string;
  description: string | null;
  files: CMSSpecificationFile[];
}

/**
 * Get active specifications with their files for the public website
 */
export async function getCMSSpecifications(): Promise<CMSSpecification[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_specifications")
    .select(`
      id, title, description,
      marketing_specification_files (
        id, original_name, storage_path, mime_type, file_size_bytes, sort_order
      )
    `)
    .eq("is_active", true)
    .order("sort_order")
    .order("sort_order", { referencedTable: "marketing_specification_files" });

  if (error) {
    console.error("Failed to fetch specifications:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((s: any) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    files: (s.marketing_specification_files || []).map((f: any) => {
      const { data: urlData } = supabase.storage
        .from("marketing")
        .getPublicUrl(f.storage_path);
      return {
        id: f.id,
        originalName: f.original_name,
        mimeType: f.mime_type,
        fileSizeBytes: f.file_size_bytes,
        publicUrl: urlData?.publicUrl || "",
      };
    }),
  }));
}
