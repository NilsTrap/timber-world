"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Globe, Link, Map as MapIcon, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from "@timber/ui";
import { getMarketingTexts, updateMarketingText } from "../actions";
import type { MarketingText } from "../types";

/**
 * Page definitions for meta tags
 */
const PAGES = [
  { key: "home", label: "Home", path: "/" },
  { key: "products", label: "Products", path: "/products" },
  { key: "stock", label: "In Stock", path: "/stock" },
  { key: "quote", label: "Request Quote", path: "/quote" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "privacy", label: "Privacy Policy", path: "/privacy" },
  { key: "terms", label: "Terms of Service", path: "/terms" },
  { key: "about", label: "About Us", path: "/about" },
];

interface PageMeta {
  page: string;
  slug: string;
  title: string;
  description: string;
  sitemapInclude: boolean;
  sitemapPriority: string;
  sitemapChangeFreq: string;
}

const PRIORITY_OPTIONS = [
  { value: "1.0", label: "1.0 (Highest)" },
  { value: "0.8", label: "0.8 (High)" },
  { value: "0.6", label: "0.6 (Medium)" },
  { value: "0.4", label: "0.4 (Low)" },
  { value: "0.2", label: "0.2 (Lowest)" },
];

const CHANGE_FREQ_OPTIONS = [
  { value: "always", label: "Always" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "never", label: "Never" },
];

/**
 * MetaTab
 *
 * Tab for editing page meta titles and descriptions.
 */
const DEFAULT_ROBOTS_TXT = `# robots.txt for timber-international.com
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://timber-international.com/sitemap.xml`;

export function MetaTab() {
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [robotsTxt, setRobotsTxt] = useState(DEFAULT_ROBOTS_TXT);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Fetch meta texts
  const fetchMeta = useCallback(async () => {
    setIsLoading(true);
    const result = await getMarketingTexts("meta", "en");
    if (result.success) {
      // Group by page
      const textMap = new Map<string, string>();
      for (const text of result.data) {
        textMap.set(`${text.section}.${text.key}`, text.value);
      }

      // Get robots.txt content
      const robotsContent = textMap.get("global.robotsTxt");
      if (robotsContent) {
        setRobotsTxt(robotsContent);
      }

      const grouped: PageMeta[] = PAGES.map((page) => ({
        page: page.key,
        slug: textMap.get(`${page.key}.slug`) || page.path,
        title: textMap.get(`${page.key}.title`) || "",
        description: textMap.get(`${page.key}.description`) || "",
        sitemapInclude: textMap.get(`${page.key}.sitemapInclude`) !== "false",
        sitemapPriority: textMap.get(`${page.key}.sitemapPriority`) || "0.8",
        sitemapChangeFreq: textMap.get(`${page.key}.sitemapChangeFreq`) || "monthly",
      }));

      setPages(grouped);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // Save a single field
  const saveField = async (page: string, key: string, value: string) => {
    const saveKey = `${page}.${key}`;
    setSavingKeys((prev) => new Set(prev).add(saveKey));

    const result = await updateMarketingText("meta", page, key, value, "en");

    setSavingKeys((prev) => {
      const next = new Set(prev);
      next.delete(saveKey);
      return next;
    });

    if (result.success) {
      toast.success("Saved");
    } else {
      toast.error(result.error);
    }
  };

  // Update local state
  const updateLocal = (page: string, field: keyof PageMeta, value: string | boolean) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.page !== page) return p;
        return { ...p, [field]: value };
      })
    );
  };

  // Save and update local state for select/switch (auto-save)
  const saveAndUpdateLocal = async (page: string, field: string, value: string | boolean) => {
    updateLocal(page, field as keyof PageMeta, value);
    await saveField(page, field, String(value));
  };

  // Save robots.txt
  const saveRobotsTxt = async () => {
    setSavingKeys((prev) => new Set(prev).add("global.robotsTxt"));

    const result = await updateMarketingText("meta", "global", "robotsTxt", robotsTxt, "en");

    setSavingKeys((prev) => {
      const next = new Set(prev);
      next.delete("global.robotsTxt");
      return next;
    });

    if (result.success) {
      toast.success("Saved");
    } else {
      toast.error(result.error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage URL slugs, SEO meta tags, XML sitemap, and robots.txt settings for the website.
      </p>

      {/* Robots.txt Configuration */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">robots.txt</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configure crawler access rules. This file tells search engine bots which pages to crawl or ignore.
        </p>
        <div className="space-y-2">
          <Textarea
            value={robotsTxt}
            onChange={(e) => setRobotsTxt(e.target.value)}
            rows={8}
            className="font-mono text-sm"
            placeholder="User-agent: *&#10;Allow: /"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Available at: timber-international.com/robots.txt
            </p>
            <Button
              size="sm"
              onClick={saveRobotsTxt}
              disabled={savingKeys.has("global.robotsTxt")}
            >
              {savingKeys.has("global.robotsTxt") ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save robots.txt
            </Button>
          </div>
        </div>
      </Card>

      {pages.map((page) => {
        const pageInfo = PAGES.find((p) => p.key === page.page);

        return (
          <Card key={page.page} className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{pageInfo?.label || page.page}</h3>
              <span className="text-sm text-muted-foreground">{pageInfo?.path}</span>
            </div>

            <div className="space-y-4">
              {/* URL Slug */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  URL Slug
                </label>
                <div className="flex gap-2">
                  <div className="flex flex-1">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground whitespace-nowrap">
                      timber-international.com
                    </span>
                    <Input
                      value={page.slug}
                      onChange={(e) => updateLocal(page.page, "slug", e.target.value)}
                      placeholder="/page-path"
                      className="rounded-l-none font-mono"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveField(page.page, "slug", page.slug)}
                    disabled={savingKeys.has(`${page.page}.slug`)}
                  >
                    {savingKeys.has(`${page.page}.slug`) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  URL path for this page (e.g., /about, /contact)
                </p>
              </div>

              {/* Meta Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Meta Title</label>
                <div className="flex gap-2">
                  <Input
                    value={page.title}
                    onChange={(e) => updateLocal(page.page, "title", e.target.value)}
                    placeholder="Page title for search engines"
                    maxLength={60}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveField(page.page, "title", page.title)}
                    disabled={savingKeys.has(`${page.page}.title`)}
                  >
                    {savingKeys.has(`${page.page}.title`) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {page.title.length}/60 characters (recommended max)
                </p>
              </div>

              {/* Meta Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Meta Description</label>
                <div className="flex gap-2">
                  <Textarea
                    value={page.description}
                    onChange={(e) => updateLocal(page.page, "description", e.target.value)}
                    placeholder="Brief description for search engine results"
                    rows={2}
                    maxLength={160}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveField(page.page, "description", page.description)}
                    disabled={savingKeys.has(`${page.page}.description`)}
                  >
                    {savingKeys.has(`${page.page}.description`) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {page.description.length}/160 characters (recommended max)
                </p>
              </div>

              {/* Sitemap Settings */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">XML Sitemap</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Include in Sitemap */}
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor={`sitemap-${page.page}`} className="text-sm">
                      Include in sitemap
                    </Label>
                    <Switch
                      id={`sitemap-${page.page}`}
                      checked={page.sitemapInclude}
                      onCheckedChange={(checked) => saveAndUpdateLocal(page.page, "sitemapInclude", checked)}
                      disabled={savingKeys.has(`${page.page}.sitemapInclude`)}
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label className="text-sm">Priority</Label>
                    <Select
                      value={page.sitemapPriority}
                      onValueChange={(value) => saveAndUpdateLocal(page.page, "sitemapPriority", value)}
                      disabled={!page.sitemapInclude || savingKeys.has(`${page.page}.sitemapPriority`)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Change Frequency */}
                  <div className="space-y-2">
                    <Label className="text-sm">Change Frequency</Label>
                    <Select
                      value={page.sitemapChangeFreq}
                      onValueChange={(value) => saveAndUpdateLocal(page.page, "sitemapChangeFreq", value)}
                      disabled={!page.sitemapInclude || savingKeys.has(`${page.page}.sitemapChangeFreq`)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANGE_FREQ_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
