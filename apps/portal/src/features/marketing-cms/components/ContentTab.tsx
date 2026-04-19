"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Input,
  Textarea,
  Card,
} from "@timber/ui";
import { getMarketingMedia, getHeroTexts, getProductTexts, getJourneyTextsGrouped, updateMarketingText, updateMarketingMedia } from "../actions";
import { MediaCard } from "./MediaCard";
import { MediaUploadDialog } from "./MediaUploadDialog";
import {
  JOURNEY_STAGES,
  PRODUCT_SLOTS,
  type MarketingMedia,
  type HeroTexts,
  type ProductTexts,
  type JourneySectionTexts,
} from "../types";

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
 * ContentTab
 *
 * Combined Photos/Videos + Texts tab with sub-tabs for each section.
 * Shows media and text fields together for easier editing.
 */
export function ContentTab() {
  // Media state
  const [media, setMedia] = useState<MarketingMedia[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MarketingMedia | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Text state
  const [heroTexts, setHeroTexts] = useState<HeroTexts>({ slogan: "", subtitle: "" });
  const [products, setProducts] = useState<ProductTexts[]>([]);
  const [journeySections, setJourneySections] = useState<JourneySectionTexts[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [togglingSlots, setTogglingSlots] = useState<Set<string>>(new Set());

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const [mediaResult, heroResult, productsResult, journeyResult] = await Promise.all([
      getMarketingMedia(),
      getHeroTexts("en"),
      getProductTexts("en"),
      getJourneyTextsGrouped("en"),
    ]);

    if (mediaResult.success) setMedia(mediaResult.data);
    else toast.error(mediaResult.error);

    if (heroResult.success) setHeroTexts(heroResult.data);
    else toast.error(heroResult.error);

    if (productsResult.success) setProducts(productsResult.data);
    else toast.error(productsResult.error);

    if (journeyResult.success) setJourneySections(journeyResult.data);
    else toast.error(journeyResult.error);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Media handlers
  const handleReplace = useCallback((m: MarketingMedia) => {
    setSelectedMedia(m);
    setUploadDialogOpen(true);
  }, []);

  const handleUploadSuccess = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Text save helpers
  const saveText = async (category: string, section: string, key: string, value: string) => {
    const saveKey = `${category}.${section}.${key}`;
    setSavingKeys((prev) => new Set(prev).add(saveKey));

    const result = await updateMarketingText(category, section, key, value, "en");

    setSavingKeys((prev) => {
      const next = new Set(prev);
      next.delete(saveKey);
      return next;
    });

    if (result.success) toast.success("Saved");
    else toast.error(result.error);
  };

  // Split media by category
  const heroMedia = media.filter((m) => m.category === "hero");
  const productMedia = media.filter((m) => m.category === "product");
  const journeyMedia = media.filter((m) => m.category === "journey");
  const logoMedia = media.filter((m) => m.category === "logo");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="hero" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
        </TabsList>

        {/* Hero Sub-tab */}
        <TabsContent value="hero" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Hero Section</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Background video/image and headline text for the homepage hero.
            </p>

            {/* Hero Media */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {heroMedia.map((m) => (
                <MediaCard key={m.id} media={m} onReplace={handleReplace} />
              ))}
            </div>

            {/* Hero Texts */}
            <div className="space-y-4 border-t pt-6">
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
                    onClick={() => saveText("hero", "main", "slogan", heroTexts.slogan)}
                    disabled={savingKeys.has("hero.main.slogan")}
                  >
                    {savingKeys.has("hero.main.slogan") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

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
                    onClick={() => saveText("hero", "main", "subtitle", heroTexts.subtitle)}
                    disabled={savingKeys.has("hero.main.subtitle")}
                  >
                    {savingKeys.has("hero.main.subtitle") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Products Sub-tab */}
        <TabsContent value="products" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Products</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Product images, titles, and descriptions for the Products page.
            </p>

            <div className="space-y-6">
              {PRODUCT_SLOTS.map((slot) => {
                const mediaItem = productMedia.find((m) => m.slotKey === slot.key);
                const productText = products.find((p) => p.key === slot.key) || {
                  key: slot.key,
                  title: "",
                  description: "",
                  specification: "",
                };

                const isActive = mediaItem?.isActive ?? true;

                return (
                  <div key={slot.key} className={`border rounded-lg p-4 space-y-4 ${!isActive ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{slot.label}</div>
                      {mediaItem && (
                        <button
                          onClick={async () => {
                            setTogglingSlots((prev) => new Set(prev).add(slot.key));
                            const result = await updateMarketingMedia(slot.key, { isActive: !isActive });
                            if (result.success) {
                              setMedia((prev) =>
                                prev.map((m) =>
                                  m.slotKey === slot.key ? { ...m, isActive: !isActive } : m
                                )
                              );
                              toast.success(isActive ? "Hidden from website" : "Visible on website");
                            } else {
                              toast.error(result.error);
                            }
                            setTogglingSlots((prev) => {
                              const next = new Set(prev);
                              next.delete(slot.key);
                              return next;
                            });
                          }}
                          disabled={togglingSlots.has(slot.key)}
                          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          style={{ backgroundColor: isActive ? "#16a34a" : "#d1d5db" }}
                          title={isActive ? "Visible on website — click to hide" : "Hidden from website — click to show"}
                        >
                          {togglingSlots.has(slot.key) ? (
                            <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                          ) : (
                            <span
                              className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                              style={{ transform: isActive ? "translateX(18px)" : "translateX(3px)" }}
                            />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Image */}
                      <div>
                        {mediaItem && (
                          <MediaCard media={mediaItem} onReplace={handleReplace} />
                        )}
                      </div>

                      {/* Text fields */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <HeadingBadge level="H3" />
                            Title
                          </label>
                          <div className="flex gap-2">
                            <Input
                              value={productText.title}
                              onChange={(e) =>
                                setProducts((prev) =>
                                  prev.map((p) =>
                                    p.key === slot.key ? { ...p, title: e.target.value } : p
                                  )
                                )
                              }
                              placeholder="Product title"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveText("products", slot.key, "title", productText.title)}
                              disabled={savingKeys.has(`products.${slot.key}.title`)}
                            >
                              {savingKeys.has(`products.${slot.key}.title`) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <HeadingBadge level="P" />
                            Description
                          </label>
                          <div className="flex gap-2">
                            <Textarea
                              value={productText.description}
                              onChange={(e) =>
                                setProducts((prev) =>
                                  prev.map((p) =>
                                    p.key === slot.key ? { ...p, description: e.target.value } : p
                                  )
                                )
                              }
                              placeholder="Product description"
                              rows={2}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveText("products", slot.key, "description", productText.description)}
                              disabled={savingKeys.has(`products.${slot.key}.description`)}
                            >
                              {savingKeys.has(`products.${slot.key}.description`) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <HeadingBadge level="P" />
                            Specification
                          </label>
                          <div className="flex gap-2">
                            <Textarea
                              value={productText.specification}
                              onChange={(e) =>
                                setProducts((prev) =>
                                  prev.map((p) =>
                                    p.key === slot.key ? { ...p, specification: e.target.value } : p
                                  )
                                )
                              }
                              placeholder="Product specification (shown when user clicks Specification button)"
                              rows={4}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveText("products", slot.key, "specification", productText.specification)}
                              disabled={savingKeys.has(`products.${slot.key}.specification`)}
                            >
                              {savingKeys.has(`products.${slot.key}.specification`) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Journey Sub-tab */}
        <TabsContent value="journey" className="space-y-6">
          {JOURNEY_STAGES.map((stage) => {
            const stageBackground = journeyMedia.find((m) => m.slotKey === stage.key);
            const substageMedia = journeyMedia.filter(
              (m) => m.slotKey.startsWith(`${stage.key}-`) && m.slotKey !== stage.key
            );
            const sectionTexts = journeySections.find((s) => s.section === stage.key) || {
              section: stage.key,
              title: "",
              description: "",
              substages: [],
            };

            return (
              <Card key={stage.key} className="p-6">
                <h3 className="text-lg font-semibold mb-2">{stage.label}</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Stage background, gallery images, and text content.
                </p>

                {/* Stage background and main texts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Stage Background</p>
                    {stageBackground && (
                      <MediaCard media={stageBackground} onReplace={handleReplace} />
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <HeadingBadge level="H2" />
                        Stage Title
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={sectionTexts.title}
                          onChange={(e) =>
                            setJourneySections((prev) =>
                              prev.map((s) =>
                                s.section === stage.key ? { ...s, title: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Stage title"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveText("journey", stage.key, "title", sectionTexts.title)}
                          disabled={savingKeys.has(`journey.${stage.key}.title`)}
                        >
                          {savingKeys.has(`journey.${stage.key}.title`) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <HeadingBadge level="P" />
                        Stage Description
                      </label>
                      <div className="flex gap-2">
                        <Textarea
                          value={sectionTexts.description}
                          onChange={(e) =>
                            setJourneySections((prev) =>
                              prev.map((s) =>
                                s.section === stage.key ? { ...s, description: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Stage description"
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveText("journey", stage.key, "description", sectionTexts.description)}
                          disabled={savingKeys.has(`journey.${stage.key}.description`)}
                        >
                          {savingKeys.has(`journey.${stage.key}.description`) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Substages */}
                {substageMedia.length > 0 && (
                  <div className="border-t pt-6 space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Gallery Images</h4>

                    {substageMedia.map((m) => {
                      const substageKey = m.slotKey.replace(`${stage.key}-`, "");
                      const substageTexts = sectionTexts.substages.find((s) => s.key === substageKey) || {
                        key: substageKey,
                        title: "",
                        description: "",
                      };

                      return (
                        <div key={m.id} className="border rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <MediaCard media={m} onReplace={handleReplace} />
                            </div>

                            <div className="md:col-span-2 space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <HeadingBadge level="H3" />
                                  Title
                                </label>
                                <div className="flex gap-2">
                                  <Input
                                    value={substageTexts.title}
                                    onChange={(e) =>
                                      setJourneySections((prev) =>
                                        prev.map((s) =>
                                          s.section === stage.key
                                            ? {
                                                ...s,
                                                substages: s.substages.map((sub) =>
                                                  sub.key === substageKey
                                                    ? { ...sub, title: e.target.value }
                                                    : sub
                                                ),
                                              }
                                            : s
                                        )
                                      )
                                    }
                                    placeholder="Image title"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      saveText("journey", stage.key, `${substageKey}Title`, substageTexts.title)
                                    }
                                    disabled={savingKeys.has(`journey.${stage.key}.${substageKey}Title`)}
                                  >
                                    {savingKeys.has(`journey.${stage.key}.${substageKey}Title`) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <HeadingBadge level="P" />
                                  Description
                                </label>
                                <div className="flex gap-2">
                                  <Textarea
                                    value={substageTexts.description}
                                    onChange={(e) =>
                                      setJourneySections((prev) =>
                                        prev.map((s) =>
                                          s.section === stage.key
                                            ? {
                                                ...s,
                                                substages: s.substages.map((sub) =>
                                                  sub.key === substageKey
                                                    ? { ...sub, description: e.target.value }
                                                    : sub
                                                ),
                                              }
                                            : s
                                        )
                                      )
                                    }
                                    placeholder="Image description"
                                    rows={2}
                                    className="flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      saveText("journey", stage.key, `${substageKey}Description`, substageTexts.description)
                                    }
                                    disabled={savingKeys.has(`journey.${stage.key}.${substageKey}Description`)}
                                  >
                                    {savingKeys.has(`journey.${stage.key}.${substageKey}Description`) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* Logos Sub-tab */}
        <TabsContent value="logos" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Logos</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Brand logos used throughout the website.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {logoMedia.map((m) => (
                <MediaCard key={m.id} media={m} onReplace={handleReplace} />
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <MediaUploadDialog
        media={selectedMedia}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}
