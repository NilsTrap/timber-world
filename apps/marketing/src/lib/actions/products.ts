"use server";

import { createClient } from "@timber/database/server";
import type { Product, StockStatus, ProductType } from "@timber/database";

export interface ProductFilters {
  species?: string[];
  width?: string[];
  length?: string[];
  thickness?: string[];
  qualityGrade?: string[];
  type?: string[];
  humidity?: string[];
  processing?: string[];
  fscCertified?: boolean;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FilterOptions {
  species: string[];
  widths: number[];
  lengths: number[];
  thicknesses: number[];
  qualityGrades: string[];
  types: ProductType[];
  humidities: string[];
  processings: string[];
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const PAGE_SIZE = 20;

export async function getProducts(
  filters: ProductFilters,
  page: number = 1,
  sortBy?: string,
  sortOrder: "asc" | "desc" = "asc"
): Promise<ActionResult<ProductsResponse>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("products")
      .select("*", { count: "exact" });

    // Apply filters
    if (filters.species?.length) {
      query = query.in("species", filters.species);
    }
    if (filters.width?.length) {
      query = query.in("width", filters.width.map(Number));
    }
    if (filters.length?.length) {
      query = query.in("length", filters.length.map(Number));
    }
    if (filters.thickness?.length) {
      query = query.in("thickness", filters.thickness.map(Number));
    }
    if (filters.qualityGrade?.length) {
      query = query.in("quality_grade", filters.qualityGrade);
    }
    if (filters.type?.length) {
      query = query.in("type", filters.type as ProductType[]);
    }
    if (filters.humidity?.length) {
      query = query.in("humidity", filters.humidity);
    }
    if (filters.processing?.length) {
      query = query.in("processing", filters.processing);
    }
    if (filters.fscCertified !== undefined) {
      query = query.eq("fsc_certified", filters.fscCertified);
    }

    // Apply sorting
    const validSortColumns = ["sku", "name", "species", "width", "length", "thickness", "quality_grade", "type", "humidity", "processing", "fsc_certified", "stock_quantity", "unit_price_piece", "unit_price_m3", "unit_price_m2"];
    if (sortBy && validSortColumns.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === "asc" });
    } else {
      // Default sort by SKU
      query = query.order("sku", { ascending: true });
    }

    // Apply pagination
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch products:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        products: data as Product[],
        total: count ?? 0,
        page,
        pageSize: PAGE_SIZE,
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching products:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

interface ProductFilterRow {
  species: string;
  width: number;
  length: number;
  thickness: number;
  quality_grade: string;
  type: ProductType;
  humidity: string;
  processing: string;
}

export async function getFilterOptions(): Promise<ActionResult<FilterOptions>> {
  try {
    const supabase = await createClient();

    // Get distinct values for each filter field
    const { data, error } = await supabase
      .from("products")
      .select("species, width, length, thickness, quality_grade, type, humidity, processing");

    if (error) {
      console.error("Failed to fetch filter options:", error);
      return { success: false, error: error.message };
    }

    const products = data as ProductFilterRow[];

    // Extract unique values
    const species = [...new Set(products.map(p => p.species))].filter(Boolean).sort();
    const widths = [...new Set(products.map(p => p.width))].filter(Boolean).sort((a, b) => a - b);
    const lengths = [...new Set(products.map(p => p.length))].filter(Boolean).sort((a, b) => a - b);
    const thicknesses = [...new Set(products.map(p => p.thickness))].filter(Boolean).sort((a, b) => a - b);
    const qualityGrades = [...new Set(products.map(p => p.quality_grade))].filter(Boolean).sort();
    const types = [...new Set(products.map(p => p.type))].filter(Boolean).sort() as ProductType[];
    const humidities = [...new Set(products.map(p => p.humidity))].filter(Boolean).sort();
    const processings = [...new Set(products.map(p => p.processing))].filter(Boolean).sort();

    return {
      success: true,
      data: {
        species,
        widths,
        lengths,
        thicknesses,
        qualityGrades,
        types,
        humidities,
        processings,
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching filter options:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
