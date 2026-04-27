"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { sanitizeStorageFileName } from "@/lib/utils/storage";
import { PDFDocument, rgb } from "pdf-lib";
import type { ActionResult, OrderFileCategory } from "../types";
import { logOrderActivity } from "./logOrderActivity";

/**
 * Remove the client logo / title block from the bottom-right corner of every page.
 * Draws a white rectangle over the area while preserving the drawing border/margins.
 *
 * Measured from real technical drawings (A1 landscape, 2384×1684pt):
 * The title block occupies the bottom-right ~20% width × ~22% height,
 * inset ~10pt from the outer page edge to preserve the border frame
 * and grid reference letters/numbers.
 */
async function removeLogo(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    // Title block: single white rectangle, bottom-right corner.
    // The three *Inset values shrink the rectangle from a given edge while the opposite
    // edge stays fixed, so we can preserve drawing content adjacent to the title block.
    //   - bottomLift: raises the bottom edge (preserves drawing legend / version line)
    //   - leftInset:  moves the left edge to the right (preserves drawing area)
    //   - topInset:   moves the top edge down (preserves drawing area)
    const marginRight = 30;
    const marginBottom = 30;
    const bottomLift = 28;
    const leftInset = 35;
    const topInset = 95;
    const baseBlockWidth = width * 0.16;
    const baseBlockHeight = height * 0.23;
    const blockWidth = baseBlockWidth - leftInset;
    const blockHeight = baseBlockHeight - bottomLift - topInset;
    const x = width - marginRight - baseBlockWidth + leftInset;
    const y = marginBottom + bottomLift;

    page.drawRectangle({
      x,
      y,
      width: blockWidth,
      height: blockHeight,
      color: rgb(1, 1, 1),
    });
  }

  return doc.save();
}

/**
 * Copy an order file from one category to another.
 * Downloads the file from storage and re-uploads it under the target category.
 * If stripLogo is true, removes the client logo/title block from PDF pages.
 */
export async function copyOrderFile(
  fileId: string,
  targetCategory: OrderFileCategory,
  stripLogo?: boolean
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Fetch the source file record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: file, error: fetchError } = await (supabase as any)
    .from("order_files")
    .select("id, order_id, category, file_name, mime_type, file_size_bytes, storage_path")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, error: "File not found", code: "NOT_FOUND" };
  }

  if (file.category === targetCategory) {
    return { success: false, error: "File is already in this category" };
  }

  // Download the file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("orders")
    .download(file.storage_path);

  if (downloadError || !fileData) {
    console.error("Failed to download file for copy:", downloadError);
    return { success: false, error: "Failed to read source file", code: "DOWNLOAD_FAILED" };
  }

  // Upload to new path under target category
  const uniqueId = crypto.randomUUID();
  const fileName = stripLogo ? file.file_name.replace(/\.pdf$/i, "_nl.pdf") : file.file_name;
  const safeName = sanitizeStorageFileName(fileName);
  const newStoragePath = `${file.order_id}/${targetCategory}/${uniqueId}_${safeName}`;

  const arrayBuffer = await fileData.arrayBuffer();
  let uploadData: Uint8Array | ArrayBuffer = arrayBuffer;

  if (stripLogo && (file.mime_type === "application/pdf" || file.file_name.toLowerCase().endsWith(".pdf"))) {
    try {
      uploadData = await removeLogo(arrayBuffer);
    } catch (err) {
      console.error("Failed to strip logo from PDF:", err);
      return { success: false, error: "Failed to process PDF", code: "LOGO_STRIP_FAILED" };
    }
  }

  const { error: uploadError } = await supabase.storage
    .from("orders")
    .upload(newStoragePath, uploadData, {
      contentType: file.mime_type || "application/octet-stream",
    });

  if (uploadError) {
    console.error("Failed to upload copied file:", uploadError);
    return {
      success: false,
      error: `Failed to copy file: ${uploadError.message}`,
      code: "UPLOAD_FAILED",
    };
  }

  // Insert new DB record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from("order_files")
    .insert({
      order_id: file.order_id,
      category: targetCategory,
      file_name: fileName,
      storage_path: newStoragePath,
      mime_type: file.mime_type,
      file_size_bytes: file.file_size_bytes,
      uploaded_by: session.portalUserId,
    });

  if (insertError) {
    // Clean up uploaded file
    await supabase.storage.from("orders").remove([newStoragePath]);
    console.error("Failed to insert copied file record:", insertError);
    return { success: false, error: "Failed to save copied file", code: "INSERT_FAILED" };
  }

  const fromLabel = file.category === "customer" ? "customer" : "production";
  const toLabel = targetCategory === "customer" ? "customer" : "production";
  const logoNote = stripLogo ? " (logo removed)" : "";
  await logOrderActivity(
    file.order_id,
    session.portalUserId,
    "file_copied",
    `Copied "${file.file_name}" from ${fromLabel} to ${toLabel}${logoNote}`,
    "sales"
  );

  return { success: true, data: null };
}
