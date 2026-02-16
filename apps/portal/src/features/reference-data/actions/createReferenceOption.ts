"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { referenceOptionSchema } from "../schemas";
import {
  VALID_REFERENCE_TABLES,
  type ReferenceTableName,
  type ReferenceOption,
  type ActionResult,
} from "../types";

/**
 * Create Reference Option
 *
 * Adds a new option to a reference table.
 * Admin only endpoint.
 */
export async function createReferenceOption(
  tableName: ReferenceTableName,
  input: { value: string; code?: string; workUnit?: string; workFormula?: string; price?: number | null }
): Promise<ActionResult<ReferenceOption>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate table name
  if (!VALID_REFERENCE_TABLES.includes(tableName)) {
    return {
      success: false,
      error: "Invalid table name",
      code: "INVALID_TABLE",
    };
  }

  // 4. Validate input with Zod
  const isProcesses = tableName === "ref_processes";
  const parsed = referenceOptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { value, code: processCode, workUnit, workFormula, price } = parsed.data;

  // For processes, code is required
  if (isProcesses && !processCode) {
    return {
      success: false,
      error: "Code is required for processes",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();

  // 5. Check for duplicate value
  // Note: Using type assertion because reference tables aren't in generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from(tableName)
    .select("id")
    .eq("value", value)
    .single();

  if (existing) {
    return {
      success: false,
      error: "This value already exists",
      code: "DUPLICATE_VALUE",
    };
  }

  // 6. Get max sort_order to append at end
  // Note: Using type assertion because reference tables aren't in generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxOrderData } = await (supabase as any)
    .from(tableName)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = ((maxOrderData?.sort_order as number) ?? 0) + 1;

  // 7. Check for duplicate code (processes only)
  if (isProcesses && processCode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCode } = await (supabase as any)
      .from(tableName)
      .select("id")
      .eq("code", processCode)
      .single();

    if (existingCode) {
      return {
        success: false,
        error: "This code already exists",
        code: "DUPLICATE_CODE",
      };
    }
  }

  // 8. Insert new option
  const insertPayload: Record<string, unknown> = {
    value,
    sort_order: nextSortOrder,
    is_active: true,
  };
  if (isProcesses && processCode) {
    insertPayload.code = processCode;
  }
  if (isProcesses && workUnit) {
    insertPayload.work_unit = workUnit;
  }
  if (isProcesses && workFormula) {
    insertPayload.work_formula = workFormula;
  }
  if (isProcesses && price != null) {
    insertPayload.price = price;
  }

  const selectColumns = isProcesses
    ? "id, value, code, work_unit, work_formula, price, sort_order, is_active, created_at, updated_at"
    : "id, value, sort_order, is_active, created_at, updated_at";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from(tableName)
    .insert(insertPayload)
    .select(selectColumns)
    .single();

  if (error) {
    console.error(`Failed to create option in ${tableName}:`, error);
    return {
      success: false,
      error: "Failed to create option",
      code: "CREATE_FAILED",
    };
  }

  // 9. Transform and return
  const option: ReferenceOption = {
    id: data.id as string,
    value: data.value as string,
    ...(isProcesses && data.code ? { code: data.code as string } : {}),
    ...(isProcesses && data.work_unit ? { workUnit: data.work_unit as string } : {}),
    ...(isProcesses && data.work_formula ? { workFormula: data.work_formula } : {}),
    ...(isProcesses ? { price: data.price != null ? Number(data.price) : null } : {}),
    sortOrder: data.sort_order as number,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return {
    success: true,
    data: option,
  };
}
