"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult, ProductImage, VariantImage } from "../types";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<ActionResult<ProductImage>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };
  if (!ALLOWED_TYPES.includes(file.type)) return { success: false, error: "Invalid file type. Use JPG, PNG, or WebP." };
  if (file.size > MAX_SIZE) return { success: false, error: "File too large. Maximum 10MB." };

  const supabase = await createClient();
  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const storagePath = `products/${productId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("catalog")
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadError) return { success: false, error: "Upload failed: " + uploadError.message };

  const { data: existing } = await (supabase as any)
    .from("catalog_product_images")
    .select("id")
    .eq("product_id", productId);

  const isPrimary = !existing || existing.length === 0;

  const { data, error } = await (supabase as any)
    .from("catalog_product_images")
    .insert({
      product_id: productId,
      storage_path: storagePath,
      alt_text: file.name,
      is_primary: isPrimary,
      sort_order: existing?.length ?? 0,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/catalog");
  return {
    success: true,
    data: {
      id: data.id,
      productId: data.product_id,
      storagePath: data.storage_path,
      altText: data.alt_text,
      isPrimary: data.is_primary,
      sortOrder: data.sort_order,
    },
  };
}

export async function deleteProductImage(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data: img } = await (supabase as any)
    .from("catalog_product_images")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (img?.storage_path) {
    await supabase.storage.from("catalog").remove([img.storage_path]);
  }

  const { error } = await (supabase as any)
    .from("catalog_product_images")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}

export async function uploadVariantImage(
  variantId: string,
  formData: FormData
): Promise<ActionResult<VariantImage>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };
  if (!ALLOWED_TYPES.includes(file.type)) return { success: false, error: "Invalid file type." };
  if (file.size > MAX_SIZE) return { success: false, error: "File too large. Maximum 10MB." };

  const supabase = await createClient();
  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const storagePath = `variants/${variantId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("catalog")
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadError) return { success: false, error: "Upload failed: " + uploadError.message };

  const { data: existing } = await (supabase as any)
    .from("catalog_variant_images")
    .select("id")
    .eq("variant_id", variantId);

  const { data, error } = await (supabase as any)
    .from("catalog_variant_images")
    .insert({
      variant_id: variantId,
      storage_path: storagePath,
      alt_text: file.name,
      is_primary: !existing || existing.length === 0,
      sort_order: existing?.length ?? 0,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/catalog");
  return {
    success: true,
    data: {
      id: data.id,
      variantId: data.variant_id,
      storagePath: data.storage_path,
      altText: data.alt_text,
      isPrimary: data.is_primary,
      sortOrder: data.sort_order,
    },
  };
}

export async function deleteVariantImage(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data: img } = await (supabase as any)
    .from("catalog_variant_images")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (img?.storage_path) {
    await supabase.storage.from("catalog").remove([img.storage_path]);
  }

  const { error } = await (supabase as any)
    .from("catalog_variant_images")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}

export async function uploadCategoryImage(
  categoryId: string,
  formData: FormData
): Promise<ActionResult<{ imageUrl: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };
  if (!ALLOWED_TYPES.includes(file.type)) return { success: false, error: "Invalid file type." };
  if (file.size > MAX_SIZE) return { success: false, error: "File too large. Maximum 10MB." };

  const supabase = await createClient();
  const fileExt = file.name.split(".").pop() || "jpg";
  const storagePath = `categories/${categoryId}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("catalog")
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) return { success: false, error: "Upload failed: " + uploadError.message };

  const { data: urlData } = supabase.storage.from("catalog").getPublicUrl(storagePath);

  await (supabase as any)
    .from("catalog_categories")
    .update({ image_storage_path: storagePath })
    .eq("id", categoryId);

  revalidatePath("/admin/catalog");
  return { success: true, data: { imageUrl: urlData?.publicUrl || "" } };
}

export async function removeCategoryImage(categoryId: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data: cat } = await (supabase as any)
    .from("catalog_categories").select("image_storage_path").eq("id", categoryId).single();
  if (cat?.image_storage_path) {
    await supabase.storage.from("catalog").remove([cat.image_storage_path]);
  }
  await (supabase as any).from("catalog_categories").update({ image_storage_path: null }).eq("id", categoryId);
  revalidatePath("/admin/catalog");
  return { success: true, data: null };
}
