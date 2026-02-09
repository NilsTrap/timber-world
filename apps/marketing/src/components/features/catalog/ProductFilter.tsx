"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, X } from "lucide-react";
import { cn, Checkbox, Badge } from "@timber/ui";
import type { ProductFilters, FilterOptions } from "@/lib/actions/products";

interface ProductFilterProps {
  filters: ProductFilters;
  filterOptions: FilterOptions;
  activeFilterCount: number;
  onFilterChange: (key: keyof ProductFilters, values: string[]) => void;
  onFscChange: (value: boolean | undefined) => void;
  onClearFilters: () => void;
}

interface FilterSectionProps {
  title: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  defaultOpen?: boolean;
}

function FilterSection({ title, options, selected, onChange, defaultOpen = false }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectedCount = selected.length;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-3 text-left"
      >
        <span className="text-sm font-medium text-charcoal flex items-center gap-2">
          {title}
          {selectedCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
              {selectedCount}
            </Badge>
          )}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>
      {isOpen && (
        <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
          {options.length > 0 ? (
            options.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => handleToggle(option)}
                />
                <span>{option}</span>
              </label>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">No options available</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProductFilter({
  filters,
  filterOptions,
  activeFilterCount,
  onFilterChange,
  onFscChange,
  onClearFilters,
}: ProductFilterProps) {
  const t = useTranslations("catalog");

  // Collapsible state for all sections
  const [productOpen, setProductOpen] = useState(false);
  const [speciesOpen, setSpeciesOpen] = useState(true);
  const [humidityOpen, setHumidityOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [processingOpen, setProcessingOpen] = useState(false);
  const [fscOpen, setFscOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [thicknessOpen, setThicknessOpen] = useState(false);
  const [widthOpen, setWidthOpen] = useState(false);
  const [lengthOpen, setLengthOpen] = useState(false);

  return (
    <div className="bg-background rounded-lg border flex flex-col h-full overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4 pb-2 border-b rounded-t-lg bg-background">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-charcoal flex items-center gap-2">
            {t("filters")}
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-xs bg-forest-green">
                {activeFilterCount}
              </Badge>
            )}
          </h2>
          {activeFilterCount > 0 && (
            <button
              onClick={onClearFilters}
              className="text-xs text-muted-foreground hover:text-charcoal flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-border p-4 pt-2">
        {/* 1. Product - no filter, just placeholder */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setProductOpen(!productOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal">{t("product")}</span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              productOpen && "rotate-180"
            )} />
          </button>
          {productOpen && (
            <div className="pb-3">
              <p className="text-xs text-muted-foreground italic">Search not available</p>
            </div>
          )}
        </div>

        {/* 2. Species */}
        <FilterSection
          title={t("species")}
          options={filterOptions.species}
          selected={filters.species ?? []}
          onChange={(values) => onFilterChange("species", values)}
          defaultOpen={speciesOpen}
        />

        {/* 3. Humidity */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setHumidityOpen(!humidityOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("humidity")}
              {(filters.humidity?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.humidity?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              humidityOpen && "rotate-180"
            )} />
          </button>
          {humidityOpen && (
            <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.humidities.length > 0 ? (
                filterOptions.humidities.map(humidity => (
                  <label
                    key={humidity}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                  >
                    <Checkbox
                      checked={filters.humidity?.includes(humidity) ?? false}
                      onCheckedChange={() => {
                        const current = filters.humidity ?? [];
                        if (current.includes(humidity)) {
                          onFilterChange("humidity", current.filter(h => h !== humidity));
                        } else {
                          onFilterChange("humidity", [...current, humidity]);
                        }
                      }}
                    />
                    <span>{humidity}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No options available</p>
              )}
            </div>
          )}
        </div>

        {/* 4. Type */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setTypeOpen(!typeOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("type")}
              {(filters.type?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.type?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              typeOpen && "rotate-180"
            )} />
          </button>
          {typeOpen && (
            <div className="pb-3 space-y-2">
              {filterOptions.types.map(type => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                >
                  <Checkbox
                    checked={filters.type?.includes(type) ?? false}
                    onCheckedChange={() => {
                      const current = filters.type ?? [];
                      if (current.includes(type)) {
                        onFilterChange("type", current.filter(t => t !== type));
                      } else {
                        onFilterChange("type", [...current, type]);
                      }
                    }}
                  />
                  <span>{type === "FJ" ? t("typeFJ") : t("typeFS")}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 5. Processing */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setProcessingOpen(!processingOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("processing")}
              {(filters.processing?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.processing?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              processingOpen && "rotate-180"
            )} />
          </button>
          {processingOpen && (
            <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.processings.length > 0 ? (
                filterOptions.processings.map(processing => (
                  <label
                    key={processing}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                  >
                    <Checkbox
                      checked={filters.processing?.includes(processing) ?? false}
                      onCheckedChange={() => {
                        const current = filters.processing ?? [];
                        if (current.includes(processing)) {
                          onFilterChange("processing", current.filter(p => p !== processing));
                        } else {
                          onFilterChange("processing", [...current, processing]);
                        }
                      }}
                    />
                    <span>{processing}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No options available</p>
              )}
            </div>
          )}
        </div>

        {/* 6. FSC Certified */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setFscOpen(!fscOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("fsc")}
              {filters.fscCertified !== undefined && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  1
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              fscOpen && "rotate-180"
            )} />
          </button>
          {fscOpen && (
            <div className="pb-3 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground">
                <Checkbox
                  checked={filters.fscCertified === true}
                  onCheckedChange={(checked) => onFscChange(checked ? true : undefined)}
                />
                <span>{t("fscYes")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground">
                <Checkbox
                  checked={filters.fscCertified === false}
                  onCheckedChange={(checked) => onFscChange(checked ? false : undefined)}
                />
                <span>{t("fscNo")}</span>
              </label>
            </div>
          )}
        </div>

        {/* 7. Quality */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setQualityOpen(!qualityOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("quality")}
              {(filters.qualityGrade?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.qualityGrade?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              qualityOpen && "rotate-180"
            )} />
          </button>
          {qualityOpen && (
            <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.qualityGrades.length > 0 ? (
                filterOptions.qualityGrades.map(grade => (
                  <label
                    key={grade}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                  >
                    <Checkbox
                      checked={filters.qualityGrade?.includes(grade) ?? false}
                      onCheckedChange={() => {
                        const current = filters.qualityGrade ?? [];
                        if (current.includes(grade)) {
                          onFilterChange("qualityGrade", current.filter(g => g !== grade));
                        } else {
                          onFilterChange("qualityGrade", [...current, grade]);
                        }
                      }}
                    />
                    <span>{grade}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No options available</p>
              )}
            </div>
          )}
        </div>

        {/* 8. Thickness */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setThicknessOpen(!thicknessOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("thickness")}
              {(filters.thickness?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.thickness?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              thicknessOpen && "rotate-180"
            )} />
          </button>
          {thicknessOpen && (
            <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.thicknesses.length > 0 ? (
                filterOptions.thicknesses.map(thickness => (
                  <label
                    key={thickness}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                  >
                    <Checkbox
                      checked={filters.thickness?.includes(String(thickness)) ?? false}
                      onCheckedChange={() => {
                        const current = filters.thickness ?? [];
                        const value = String(thickness);
                        if (current.includes(value)) {
                          onFilterChange("thickness", current.filter(t => t !== value));
                        } else {
                          onFilterChange("thickness", [...current, value]);
                        }
                      }}
                    />
                    <span>{thickness} {t("mm")}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No options available</p>
              )}
            </div>
          )}
        </div>

        {/* 9. Width */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setWidthOpen(!widthOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("width")}
              {(filters.width?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.width?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              widthOpen && "rotate-180"
            )} />
          </button>
          {widthOpen && (
            <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.widths.length > 0 ? (
                filterOptions.widths.map(width => (
                  <label
                    key={width}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                  >
                    <Checkbox
                      checked={filters.width?.includes(String(width)) ?? false}
                      onCheckedChange={() => {
                        const current = filters.width ?? [];
                        const value = String(width);
                        if (current.includes(value)) {
                          onFilterChange("width", current.filter(w => w !== value));
                        } else {
                          onFilterChange("width", [...current, value]);
                        }
                      }}
                    />
                    <span>{width} {t("mm")}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No options available</p>
              )}
            </div>
          )}
        </div>

        {/* 10. Length */}
        <div>
          <button
            type="button"
            onClick={() => setLengthOpen(!lengthOpen)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-sm font-medium text-charcoal flex items-center gap-2">
              {t("length")}
              {(filters.length?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {filters.length?.length}
                </Badge>
              )}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              lengthOpen && "rotate-180"
            )} />
          </button>
          {lengthOpen && (
            <div className="pb-3 space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.lengths.length > 0 ? (
                filterOptions.lengths.map(length => (
                  <label
                    key={length}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-charcoal text-muted-foreground"
                  >
                    <Checkbox
                      checked={filters.length?.includes(String(length)) ?? false}
                      onCheckedChange={() => {
                        const current = filters.length ?? [];
                        const value = String(length);
                        if (current.includes(value)) {
                          onFilterChange("length", current.filter(l => l !== value));
                        } else {
                          onFilterChange("length", [...current, value]);
                        }
                      }}
                    />
                    <span>{length} {t("mm")}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No options available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
