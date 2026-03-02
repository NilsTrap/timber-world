"use client";

import { useState, useEffect } from "react";
import { Button, Checkbox, Label } from "@timber/ui";
import { ChevronDown, Loader2, Settings } from "lucide-react";
import { getScraperConfig, updateScraperConfig } from "../actions";
import type { ScraperConfig } from "../types";
import { SCRAPER_OPTIONS } from "../types";

interface ScraperConfigFormProps {
  source?: string;
}

export function ScraperConfigForm({ source = "mass.ee" }: ScraperConfigFormProps) {
  const [config, setConfig] = useState<ScraperConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Local form state
  const [isEnabled, setIsEnabled] = useState(true);
  const [species, setSpecies] = useState<string[]>([]);
  const [thicknesses, setThicknesses] = useState<number[]>([]);
  const [widths, setWidths] = useState<number[]>([]);
  const [lengths, setLengths] = useState<number[]>([]);
  const [panelTypes, setPanelTypes] = useState<string[]>([]);
  const [qualities, setQualities] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, [source]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    const result = await getScraperConfig(source);
    if (result.success) {
      setConfig(result.data);
      setIsEnabled(result.data.isEnabled);
      setSpecies(result.data.species);
      setThicknesses(result.data.thicknesses);
      setWidths(result.data.widths);
      setLengths(result.data.lengths);
      setPanelTypes(result.data.panelTypes);
      setQualities(result.data.qualities);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const result = await updateScraperConfig({
      source,
      isEnabled,
      species,
      thicknesses,
      widths,
      lengths,
      panelTypes,
      qualities,
    });

    if (result.success) {
      setConfig(result.data);
    } else {
      setError(result.error);
    }

    setSaving(false);
  }

  function toggleSpecies(value: string) {
    setSpecies((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  function toggleThickness(value: number) {
    setThicknesses((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  }

  function toggleWidth(value: number) {
    setWidths((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  }

  function toggleLength(value: number) {
    setLengths((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  }

  function togglePanelType(value: string) {
    setPanelTypes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  function toggleQuality(value: string) {
    setQualities((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Scraper Configuration</span>
          <span className="text-sm text-muted-foreground">({source})</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t p-4 space-y-6">
          {/* Enabled toggle */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="enabled"
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(checked === true)}
            />
            <Label htmlFor="enabled" className="font-medium">
              Enabled
            </Label>
          </div>

          {/* Species */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Species</Label>
            <div className="flex flex-wrap gap-4">
              {SCRAPER_OPTIONS.species.map((s) => (
                <div key={s.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`species-${s.value}`}
                    checked={species.includes(s.value)}
                    onCheckedChange={() => toggleSpecies(s.value)}
                  />
                  <Label htmlFor={`species-${s.value}`} className="text-sm">
                    {s.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Thicknesses */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Thicknesses</Label>
            <div className="flex flex-wrap gap-4">
              {SCRAPER_OPTIONS.thicknesses.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <Checkbox
                    id={`thickness-${t}`}
                    checked={thicknesses.includes(t)}
                    onCheckedChange={() => toggleThickness(t)}
                  />
                  <Label htmlFor={`thickness-${t}`} className="text-sm">
                    {t}mm
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Widths */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Widths</Label>
            <div className="flex flex-wrap gap-4">
              {SCRAPER_OPTIONS.widths.map((w) => (
                <div key={w} className="flex items-center gap-2">
                  <Checkbox
                    id={`width-${w}`}
                    checked={widths.includes(w)}
                    onCheckedChange={() => toggleWidth(w)}
                  />
                  <Label htmlFor={`width-${w}`} className="text-sm">
                    {w}mm
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Lengths */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Lengths</Label>
            <div className="flex flex-wrap gap-4">
              {SCRAPER_OPTIONS.lengths.map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <Checkbox
                    id={`length-${l}`}
                    checked={lengths.includes(l)}
                    onCheckedChange={() => toggleLength(l)}
                  />
                  <Label htmlFor={`length-${l}`} className="text-sm">
                    {l}mm
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Types and Qualities side by side */}
          <div className="grid grid-cols-2 gap-8">
            {/* Panel Types */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Panel Types</Label>
              <div className="flex flex-col gap-2">
                {SCRAPER_OPTIONS.panelTypes.map((pt) => (
                  <div key={pt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`panel-${pt.value}`}
                      checked={panelTypes.includes(pt.value)}
                      onCheckedChange={() => togglePanelType(pt.value)}
                    />
                    <Label htmlFor={`panel-${pt.value}`} className="text-sm">
                      {pt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Qualities */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Qualities</Label>
              <div className="flex flex-col gap-2">
                {SCRAPER_OPTIONS.qualities.map((q) => (
                  <div key={q} className="flex items-center gap-2">
                    <Checkbox
                      id={`quality-${q}`}
                      checked={qualities.includes(q)}
                      onCheckedChange={() => toggleQuality(q)}
                    />
                    <Label htmlFor={`quality-${q}`} className="text-sm">
                      {q}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
