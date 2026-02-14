"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@timber/ui";
import { Search, Building2, Users, Loader2, Download, Globe, Landmark, Sparkles, CheckCircle2 } from "lucide-react";
import type { DiscoveryResult, SearchSource } from "../types";
import { searchCompaniesHouse, searchWeb, importDiscoveredCompanies } from "../actions";

interface SearchStats {
  searchCount: number;
  totalFound: number;
  duplicatesFiltered: number;
  source: SearchSource;
}

export function DiscoverTab() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("UK");
  const [searchSource, setSearchSource] = useState<SearchSource>("web");
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setSearchStats(null);
    setSelected(new Set());
    setImportSuccess(null);

    let result;
    if (searchSource === "government") {
      result = await searchCompaniesHouse({
        query: query.trim(),
        country,
      });
    } else if (searchSource === "web") {
      result = await searchWeb({
        query: query.trim(),
        country,
      });
    } else {
      // Enrichment - not implemented yet
      setError("Enrichment with Claude API coming soon");
      setIsSearching(false);
      return;
    }

    if (result.success) {
      setResults(result.data.results);
      setSearchStats({
        searchCount: result.data.searchCount,
        totalFound: result.data.totalFound,
        duplicatesFiltered: result.data.duplicatesFiltered,
        source: result.data.source,
      });
      // Select all by default
      setSelected(new Set(result.data.results.map((_, i) => i)));
    } else {
      setError(result.error);
    }

    setIsSearching(false);
  };

  const toggleSelect = (index: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    const selectedResults = results.filter((_, i) => selected.has(i));
    if (selectedResults.length === 0) return;

    setIsImporting(true);
    setError(null);
    const result = await importDiscoveredCompanies(selectedResults);

    if (result.success) {
      setImportSuccess(result.imported);
      setResults([]);
      setSelected(new Set());
      setSearchStats(null);
      setQuery("");
    } else {
      setError(result.error);
    }

    setIsImporting(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Source Tabs */}
      <Tabs value={searchSource} onValueChange={(v) => setSearchSource(v as SearchSource)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="web" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Web Search
          </TabsTrigger>
          <TabsTrigger value="government" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Government
          </TabsTrigger>
          <TabsTrigger value="enrichment" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Enrichment
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Source info */}
      <p className="text-sm text-muted-foreground">
        {searchSource === "web"
          ? "Searches the web (Brave API) for companies matching your keywords. $5/1000 queries, 2000 free/month."
          : searchSource === "government"
            ? "Searches official company registries (UK Companies House). Returns verified company data with directors."
            : "Uses Claude AI to find and enrich company data from the web. $10/1000 searches + token costs."}
      </p>

      {/* Search Form */}
      <div className="flex gap-2 max-w-2xl">
        <div className="flex-1">
          <Label htmlFor="search-query" className="sr-only">
            Search query
          </Label>
          <Input
            id="search-query"
            placeholder={
              searchSource === "web"
                ? "Search keywords (e.g., 'oak staircase manufacturer')"
                : searchSource === "government"
                  ? "Company name or industry (e.g., 'stairs', 'timber')"
                  : "Company name to enrich"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="border rounded px-3 py-2 bg-background text-sm"
        >
          <option value="UK">UK</option>
          <option value="SE">Sweden</option>
          <option value="NO">Norway</option>
          <option value="DK">Denmark</option>
          <option value="FI">Finland</option>
          <option value="NL">Netherlands</option>
          <option value="BE">Belgium</option>
          <option value="IE">Ireland</option>
          <option value="DE">Germany</option>
        </select>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Search
        </Button>
      </div>

      {/* Success message */}
      {importSuccess !== null && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-md">
          <CheckCircle2 className="h-5 w-5" />
          <span>Successfully imported {importSuccess} {importSuccess === 1 ? "company" : "companies"}. View them in the Companies tab.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Search Statistics */}
      {searchStats && (
        <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-md px-4 py-3">
          <span>
            <strong>{searchStats.searchCount}</strong> API {searchStats.searchCount === 1 ? "query" : "queries"}
          </span>
          <span className="text-muted-foreground">•</span>
          <span>
            <strong>{searchStats.totalFound}</strong> found
          </span>
          {searchStats.duplicatesFiltered > 0 && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-orange-600">
                <strong>{searchStats.duplicatesFiltered}</strong> already in database
              </span>
            </>
          )}
          <span className="text-muted-foreground">•</span>
          <span className="text-green-600">
            <strong>{results.length}</strong> new
          </span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === results.length}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="text-sm">
                Select all ({results.length} new companies)
              </Label>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                onClick={handleImport}
                disabled={isImporting || selected.size === 0}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Import {selected.size} {selected.size === 1 ? "Company" : "Companies"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border bg-card ${
                  selected.has(index) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(index)}
                    onCheckedChange={() => toggleSelect(index)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{result.company.name}</span>
                      {result.company.registration_number && (
                        <span className="text-xs text-muted-foreground">
                          ({result.company.registration_number})
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {[result.company.city, result.company.country]
                        .filter(Boolean)
                        .join(", ")}
                      {result.company.founded_year && (
                        <span> · Founded {result.company.founded_year}</span>
                      )}
                    </div>
                    {result.company.industry && (
                      <div className="mt-1 text-sm">{result.company.industry}</div>
                    )}
                    {result.company.website && (
                      <a
                        href={result.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-xs text-blue-600 hover:underline inline-block"
                      >
                        {result.company.website}
                      </a>
                    )}
                    {result.officers.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>
                          {result.officers.length} contact
                          {result.officers.length !== 1 ? "s" : ""}:
                        </span>
                        <span>
                          {result.officers
                            .slice(0, 3)
                            .map((o) => `${o.first_name} ${o.last_name}`)
                            .join(", ")}
                          {result.officers.length > 3 && ` +${result.officers.length - 3} more`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!isSearching && searchStats && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground rounded-lg border bg-card">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No new companies found for &quot;{query}&quot;</p>
          {searchStats.duplicatesFiltered > 0 && (
            <p className="text-sm mt-1">
              All {searchStats.duplicatesFiltered} results are already in your database
            </p>
          )}
          <p className="text-sm mt-1">Try different keywords or another search source</p>
        </div>
      )}

      {/* Initial state */}
      {!isSearching && !searchStats && !importSuccess && (
        <div className="text-center py-12 text-muted-foreground rounded-lg border bg-card">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Search for companies by industry or keywords</p>
          <p className="text-sm mt-1">
            {searchSource === "web"
              ? "Web search finds companies from websites and directories"
              : searchSource === "government"
                ? "Government registry searches official company databases"
                : "Enrichment uses AI to find detailed company information"}
          </p>
        </div>
      )}
    </div>
  );
}
