"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge } from "@timber/ui";
import { getJourneyTextsGrouped, getHeroTexts, getProductTexts, updateMarketingText } from "../actions";
import { JOURNEY_STAGES, PRODUCT_SLOTS, type JourneySectionTexts, type HeroTexts, type ProductTexts } from "../types";

/**
 * Heading hierarchy badge component
 */
function HeadingBadge({ level }: { level: "H1" | "H2" | "H3" | "P" }) {
  const colors = {
    H1: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    H2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    H3: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    P: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-bold ${colors[level]}`}>
      {level}
    </span>
  );
}

/**
 * TextsTab
 *
 * Tab for editing journey text content (titles and descriptions).
 */
export function TextsTab() {
  const [heroTexts, setHeroTexts] = useState<HeroTexts>({ slogan: "", subtitle: "" });
  const [products, setProducts] = useState<ProductTexts[]>([]);
  const [sections, setSections] = useState<JourneySectionTexts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Fetch texts
  const fetchTexts = useCallback(async () => {
    setIsLoading(true);

    // Fetch hero, products, and journey texts in parallel
    const [heroResult, productsResult, journeyResult] = await Promise.all([
      getHeroTexts("en"),
      getProductTexts("en"),
      getJourneyTextsGrouped("en"),
    ]);

    if (heroResult.success) {
      setHeroTexts(heroResult.data);
    } else {
      toast.error(heroResult.error);
    }

    if (productsResult.success) {
      setProducts(productsResult.data);
    } else {
      toast.error(productsResult.error);
    }

    if (journeyResult.success) {
      setSections(journeyResult.data);
    } else {
      toast.error(journeyResult.error);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchTexts();
  }, [fetchTexts]);

  // Save hero text field
  const saveHeroText = async (key: "slogan" | "subtitle", value: string) => {
    const saveKey = `hero.${key}`;
    setSavingKeys((prev) => new Set(prev).add(saveKey));

    const result = await updateMarketingText("hero", "main", key, value, "en");

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

  // Save product text field
  const saveProductText = async (productKey: string, field: "title" | "description", value: string) => {
    const saveKey = `product.${productKey}.${field}`;
    setSavingKeys((prev) => new Set(prev).add(saveKey));

    const result = await updateMarketingText("products", productKey, field, value, "en");

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

  // Update local product state
  const updateLocalProduct = (productKey: string, field: "title" | "description", value: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.key !== productKey) return p;
        return { ...p, [field]: value };
      })
    );
  };

  // Save a single journey text field
  const saveText = async (section: string, key: string, value: string) => {
    const saveKey = `${section}.${key}`;
    setSavingKeys((prev) => new Set(prev).add(saveKey));

    const result = await updateMarketingText("journey", section, key, value, "en");

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
  const updateLocalText = (sectionKey: string, textKey: string, value: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.section !== sectionKey) return section;

        if (textKey === "title") {
          return { ...section, title: value };
        }
        if (textKey === "description") {
          return { ...section, description: value };
        }

        // Substage text
        const substageKey = textKey.replace("Title", "").replace("Description", "");
        const isTitle = textKey.endsWith("Title");

        return {
          ...section,
          substages: section.substages.map((sub) => {
            if (sub.key !== substageKey) return sub;
            return {
              ...sub,
              title: isTitle ? value : sub.title,
              description: !isTitle ? value : sub.description,
            };
          }),
        };
      })
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Hero</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Main headline and subtitle shown on the homepage hero section.
        </p>

        <div className="space-y-4">
          {/* Hero Slogan (H1) */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <HeadingBadge level="H1" />
              Slogan
            </label>
            <div className="flex gap-2">
              <Input
                value={heroTexts.slogan}
                onChange={(e) => setHeroTexts((prev) => ({ ...prev, slogan: e.target.value }))}
                placeholder="From Forest to Product"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveHeroText("slogan", heroTexts.slogan)}
                disabled={savingKeys.has("hero.slogan")}
              >
                {savingKeys.has("hero.slogan") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Hero Subtitle */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <HeadingBadge level="P" />
              Subtitle
            </label>
            <div className="flex gap-2">
              <Input
                value={heroTexts.subtitle}
                onChange={(e) => setHeroTexts((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="We Take Care of It"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveHeroText("subtitle", heroTexts.subtitle)}
                disabled={savingKeys.has("hero.subtitle")}
              >
                {savingKeys.has("hero.subtitle") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Products Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Products</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Titles and descriptions for products shown on the Products page.
        </p>

        <div className="space-y-4">
          {products.map((product) => {
            const slotInfo = PRODUCT_SLOTS.find((s) => s.key === product.key);

            return (
              <div key={product.key} className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-sm font-medium">{slotInfo?.label || product.key}</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground flex items-center gap-2">
                      <HeadingBadge level="H3" />
                      Title
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={product.title}
                        onChange={(e) => updateLocalProduct(product.key, "title", e.target.value)}
                        placeholder="Product title"
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveProductText(product.key, "title", product.title)}
                        disabled={savingKeys.has(`product.${product.key}.title`)}
                      >
                        {savingKeys.has(`product.${product.key}.title`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground flex items-center gap-2">
                    <HeadingBadge level="P" />
                    Description
                  </label>
                  <div className="flex gap-2">
                    <Textarea
                      value={product.description}
                      onChange={(e) => updateLocalProduct(product.key, "description", e.target.value)}
                      placeholder="Product description"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveProductText(product.key, "description", product.description)}
                      disabled={savingKeys.has(`product.${product.key}.description`)}
                    >
                      {savingKeys.has(`product.${product.key}.description`) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Journey Sections */}
      {sections.map((section) => {
        const stageInfo = JOURNEY_STAGES.find((s) => s.key === section.section);

        return (
          <Card key={section.section} className="p-6">
            <h3 className="text-lg font-semibold mb-4">{stageInfo?.label || section.section}</h3>

            {/* Stage title and description */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <HeadingBadge level="H2" />
                    Stage Title
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) => updateLocalText(section.section, "title", e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveText(section.section, "title", section.title)}
                      disabled={savingKeys.has(`${section.section}.title`)}
                    >
                      {savingKeys.has(`${section.section}.title`) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <HeadingBadge level="P" />
                  Stage Description
                </label>
                <div className="flex gap-2">
                  <Textarea
                    value={section.description}
                    onChange={(e) => updateLocalText(section.section, "description", e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveText(section.section, "description", section.description)}
                    disabled={savingKeys.has(`${section.section}.description`)}
                  >
                    {savingKeys.has(`${section.section}.description`) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Substages */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Gallery Images</h4>
              <div className="space-y-4">
                {section.substages.map((substage) => (
                  <div key={substage.key} className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="text-sm font-medium capitalize">{substage.key}</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground flex items-center gap-2">
                          <HeadingBadge level="H3" />
                          Title
                        </label>
                        <div className="flex gap-2">
                          <Input
                            value={substage.title}
                            onChange={(e) =>
                              updateLocalText(section.section, `${substage.key}Title`, e.target.value)
                            }
                            className="text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              saveText(section.section, `${substage.key}Title`, substage.title)
                            }
                            disabled={savingKeys.has(`${section.section}.${substage.key}Title`)}
                          >
                            {savingKeys.has(`${section.section}.${substage.key}Title`) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-2">
                        <HeadingBadge level="P" />
                        Description
                      </label>
                      <div className="flex gap-2">
                        <Textarea
                          value={substage.description}
                          onChange={(e) =>
                            updateLocalText(section.section, `${substage.key}Description`, e.target.value)
                          }
                          rows={2}
                          className="flex-1 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            saveText(section.section, `${substage.key}Description`, substage.description)
                          }
                          disabled={savingKeys.has(`${section.section}.${substage.key}Description`)}
                        >
                          {savingKeys.has(`${section.section}.${substage.key}Description`) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
