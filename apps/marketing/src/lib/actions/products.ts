"use server";

import { createClient } from "@timber/database/server";
import type { Product, StockStatus, ProductType } from "@timber/database";

// Extended Product type with volume_m3 and display fields from inventory
export interface StockProduct extends Product {
  volume_m3: number | null;
  // Display fields for dimensions (may contain ranges like "100-350")
  thickness_display: string;
  width_display: string;
  length_display: string;
  // Original type value from database for filtering
  type_original: string;
}

// Interface for inventory package with resolved references
interface InventoryPackageRow {
  id: string;
  package_number: string;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volume_m3: number | null;
  unit_price_piece: number | null;
  unit_price_m3: number | null;
  unit_price_m2: number | null;
  ref_product_names: { value: string } | null;
  ref_wood_species: { value: string } | null;
  ref_humidity: { value: string } | null;
  ref_types: { value: string } | null;
  ref_processing: { value: string } | null;
  ref_fsc: { value: string } | null;
  ref_quality: { value: string } | null;
}

export interface ProductFilters {
  product?: string[];
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
  products: StockProduct[];
  total: number;
  page: number;
  pageSize: number;
  filterOptions: FilterOptions;
}

export interface FilterOptions {
  products: string[];
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

    // Fetch inventory packages with resolved references
    const { data: packagesData, error: packagesError } = await supabase
      .from("inventory_packages")
      .select(`
        id,
        package_number,
        thickness,
        width,
        length,
        pieces,
        volume_m3,
        unit_price_piece,
        unit_price_m3,
        unit_price_m2,
        ref_product_names!inventory_packages_product_name_id_fkey(value),
        ref_wood_species!inventory_packages_wood_species_id_fkey(value),
        ref_humidity!inventory_packages_humidity_id_fkey(value),
        ref_types!inventory_packages_type_id_fkey(value),
        ref_processing!inventory_packages_processing_id_fkey(value),
        ref_fsc!inventory_packages_fsc_id_fkey(value),
        ref_quality!inventory_packages_quality_id_fkey(value),
        organisations!inventory_packages_organisation_id_fkey(code)
      `)
      .eq("status", "available");

    if (packagesError) {
      console.error("Failed to fetch inventory packages:", packagesError);
      return { success: false, error: packagesError.message };
    }

    // Transform inventory packages to StockProduct format
    const safeParseInt = (value: string | null | undefined): number => {
      if (!value) return 0;
      const parts = value.split('-');
      const parsed = parseInt(parts[0] || '0');
      return isNaN(parsed) ? 0 : parsed;
    };

    const allProducts: StockProduct[] = (packagesData || []).map((pkg: InventoryPackageRow & { organisations: { code: string } | null }) => {
      const thickness = safeParseInt(pkg.thickness);
      const width = safeParseInt(pkg.width);
      const length = safeParseInt(pkg.length);
      const pieces = safeParseInt(pkg.pieces);
      const typeValue = pkg.ref_types?.value || "";
      // Convert database values to FJ/FS for display, but keep original for filtering
      const type: ProductType = typeValue.toLowerCase().includes("finger") || typeValue === "FJ" ? "FJ" : "FS";

      return {
        id: pkg.id,
        sku: pkg.package_number,
        name: pkg.ref_product_names?.value || "Unknown",
        species: pkg.ref_wood_species?.value || "Unknown",
        thickness,
        width,
        length,
        thickness_display: pkg.thickness || "",
        width_display: pkg.width || "",
        length_display: pkg.length || "",
        quality_grade: pkg.ref_quality?.value || "",
        type,
        // Store original type value for filtering
        type_original: typeValue,
        humidity: pkg.ref_humidity?.value || "",
        processing: pkg.ref_processing?.value || "",
        fsc_certified: pkg.ref_fsc?.value === "FSC 100%" || pkg.ref_fsc?.value === "FSC Credit Mix",
        stock_quantity: pieces,
        stock_status: "in_stock" as StockStatus,
        unit_price_piece: pkg.unit_price_piece || 0,
        unit_price_m3: pkg.unit_price_m3 || 0,
        unit_price_m2: pkg.unit_price_m2 || 0,
        moisture_content: 0,
        finish: null,
        volume_m3: pkg.volume_m3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Helper function to apply filters, optionally excluding one filter group
    const applyFilters = (items: StockProduct[], excludeFilter?: keyof ProductFilters): StockProduct[] => {
      let result = items;
      if (filters.product?.length && excludeFilter !== 'product') {
        result = result.filter(p => filters.product!.includes(p.name));
      }
      if (filters.species?.length && excludeFilter !== 'species') {
        result = result.filter(p => filters.species!.includes(p.species));
      }
      if (filters.width?.length && excludeFilter !== 'width') {
        result = result.filter(p => filters.width!.map(Number).includes(p.width));
      }
      if (filters.length?.length && excludeFilter !== 'length') {
        result = result.filter(p => filters.length!.map(Number).includes(p.length));
      }
      if (filters.thickness?.length && excludeFilter !== 'thickness') {
        result = result.filter(p => filters.thickness!.map(Number).includes(p.thickness));
      }
      if (filters.qualityGrade?.length && excludeFilter !== 'qualityGrade') {
        result = result.filter(p => filters.qualityGrade!.includes(p.quality_grade));
      }
      if (filters.type?.length && excludeFilter !== 'type') {
        result = result.filter(p => filters.type!.includes(p.type_original));
      }
      if (filters.humidity?.length && excludeFilter !== 'humidity') {
        result = result.filter(p => filters.humidity!.includes(p.humidity || ""));
      }
      return result;
    };

    // Apply all filters for the product results
    let products = applyFilters(allProducts);

    // Apply sorting
    if (sortBy) {
      // User-specified single column sort
      products.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortBy];
        const bVal = (b as unknown as Record<string, unknown>)[sortBy];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal || "");
        const bStr = String(bVal || "");
        return sortOrder === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    } else {
      // Default: multi-column sort in order:
      // Product (A-Z), Species (A-Z), Humidity (A-Z), Type (A-Z),
      // Quality (A-Z), Thickness (asc), Width (asc), Length (asc)
      products.sort((a, b) => {
        // 1. Product name (A-Z)
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;

        // 2. Species (A-Z)
        const speciesCompare = a.species.localeCompare(b.species);
        if (speciesCompare !== 0) return speciesCompare;

        // 3. Humidity (A-Z)
        const humidityCompare = (a.humidity || "").localeCompare(b.humidity || "");
        if (humidityCompare !== 0) return humidityCompare;

        // 4. Type (A-Z)
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) return typeCompare;

        // 5. Quality (A-Z)
        const qualityCompare = a.quality_grade.localeCompare(b.quality_grade);
        if (qualityCompare !== 0) return qualityCompare;

        // 6. Thickness (ascending)
        const thicknessCompare = a.thickness - b.thickness;
        if (thicknessCompare !== 0) return thicknessCompare;

        // 7. Width (ascending)
        const widthCompare = a.width - b.width;
        if (widthCompare !== 0) return widthCompare;

        // 8. Length (ascending)
        return a.length - b.length;
      });
    }

    // Calculate dynamic filter options
    // Each filter shows options from products filtered by ALL OTHER filters (not itself)
    // This allows multi-select within a filter while cascading to other filters
    const productsForProductFilter = applyFilters(allProducts, 'product');
    const productsForSpeciesFilter = applyFilters(allProducts, 'species');
    const productsForWidthFilter = applyFilters(allProducts, 'width');
    const productsForLengthFilter = applyFilters(allProducts, 'length');
    const productsForThicknessFilter = applyFilters(allProducts, 'thickness');
    const productsForQualityFilter = applyFilters(allProducts, 'qualityGrade');
    const productsForTypeFilter = applyFilters(allProducts, 'type');
    const productsForHumidityFilter = applyFilters(allProducts, 'humidity');

    const dynamicFilterOptions: FilterOptions = {
      products: [...new Set(productsForProductFilter.map(p => p.name))].sort(),
      species: [...new Set(productsForSpeciesFilter.map(p => p.species))].sort(),
      widths: [...new Set(productsForWidthFilter.map(p => p.width))].sort((a, b) => a - b),
      lengths: [...new Set(productsForLengthFilter.map(p => p.length))].sort((a, b) => a - b),
      thicknesses: [...new Set(productsForThicknessFilter.map(p => p.thickness))].sort((a, b) => a - b),
      qualityGrades: [...new Set(productsForQualityFilter.map(p => p.quality_grade).filter(Boolean))].sort(),
      types: [...new Set(productsForTypeFilter.map(p => p.type_original).filter(Boolean))].sort() as ProductType[],
      humidities: [...new Set(productsForHumidityFilter.map(p => p.humidity).filter(Boolean))].sort() as string[],
      processings: [...new Set(products.map(p => p.processing).filter(Boolean))].sort() as string[],
    };

    return {
      success: true,
      data: {
        products,
        total: products.length,
        page,
        pageSize: PAGE_SIZE,
        filterOptions: dynamicFilterOptions,
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching products:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getFilterOptions(): Promise<ActionResult<FilterOptions>> {
  try {
    const supabase = await createClient();

    // Get inventory packages with resolved references
    const { data, error } = await supabase
      .from("inventory_packages")
      .select(`
        thickness,
        width,
        length,
        ref_product_names!inventory_packages_product_name_id_fkey(value),
        ref_wood_species!inventory_packages_wood_species_id_fkey(value),
        ref_humidity!inventory_packages_humidity_id_fkey(value),
        ref_types!inventory_packages_type_id_fkey(value),
        ref_processing!inventory_packages_processing_id_fkey(value),
        ref_quality!inventory_packages_quality_id_fkey(value)
      `)
      .eq("status", "available");

    if (error) {
      console.error("Failed to fetch filter options:", error);
      return { success: false, error: error.message };
    }

    type FilterRow = {
      thickness: string | null;
      width: string | null;
      length: string | null;
      ref_product_names: { value: string } | null;
      ref_wood_species: { value: string } | null;
      ref_humidity: { value: string } | null;
      ref_types: { value: string } | null;
      ref_processing: { value: string } | null;
      ref_quality: { value: string } | null;
    };

    const rows = data as FilterRow[];

    // Helper to safely parse dimension strings
    const parseDimension = (value: string | null): number | null => {
      if (!value) return null;
      const parts = value.split('-');
      const parsed = parseInt(parts[0] || '0');
      return isNaN(parsed) ? null : parsed;
    };

    // Extract unique values from inventory packages
    const products = [...new Set(rows.map(p => p.ref_product_names?.value).filter(Boolean))].sort() as string[];
    const species = [...new Set(rows.map(p => p.ref_wood_species?.value).filter(Boolean))].sort() as string[];
    const widths = [...new Set(rows.map(p => parseDimension(p.width)).filter((v): v is number => v !== null))].sort((a, b) => a - b);
    const lengths = [...new Set(rows.map(p => parseDimension(p.length)).filter((v): v is number => v !== null))].sort((a, b) => a - b);
    const thicknesses = [...new Set(rows.map(p => parseDimension(p.thickness)).filter((v): v is number => v !== null))].sort((a, b) => a - b);
    const qualityGrades = [...new Set(rows.map(p => p.ref_quality?.value).filter(Boolean))].sort() as string[];
    const types = [...new Set(rows.map(p => p.ref_types?.value).filter(Boolean))].sort() as ProductType[];
    const humidities = [...new Set(rows.map(p => p.ref_humidity?.value).filter(Boolean))].sort() as string[];
    const processings = [...new Set(rows.map(p => p.ref_processing?.value).filter(Boolean))].sort() as string[];

    return {
      success: true,
      data: {
        products,
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
