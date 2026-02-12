"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Label, Textarea } from "@timber/ui";
import { submitQuoteRequest } from "@/lib/actions/quote";
import { useAnalyticsContext } from "@/lib/analytics";

interface QuoteFormProps {
  preselectedProducts?: string;
}

export function QuoteForm({ preselectedProducts }: QuoteFormProps) {
  const t = useTranslations("quote");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analytics = useAnalyticsContext();
  const formStartTimeRef = useRef<number>(0);
  const hasTrackedViewRef = useRef(false);
  const trackedFieldsRef = useRef<Set<string>>(new Set());

  // Parse preselected product IDs from the text
  const selectedProductIds = preselectedProducts
    ? preselectedProducts.split("\n").filter(Boolean)
    : [];

  // Track form view on mount
  useEffect(() => {
    if (!hasTrackedViewRef.current) {
      hasTrackedViewRef.current = true;
      formStartTimeRef.current = Date.now();
      analytics.trackQuoteFormView("quote_page", selectedProductIds.length, selectedProductIds);
    }
  }, [analytics, selectedProductIds]);

  const handleFieldFocus = useCallback((fieldName: string) => {
    if (!trackedFieldsRef.current.has(fieldName)) {
      trackedFieldsRef.current.add(fieldName);
      analytics.trackQuoteFieldFocus(fieldName);
    }
  }, [analytics]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const timeOnForm = Date.now() - formStartTimeRef.current;
    analytics.trackQuoteSubmit(selectedProductIds, timeOnForm);

    const formData = new FormData(e.currentTarget);
    const result = await submitQuoteRequest(formData);

    setIsSubmitting(false);

    if (result.success) {
      analytics.trackQuoteSuccess(timeOnForm);
      setIsSubmitted(true);
    } else {
      setError(result.error);
    }
  };

  if (isSubmitted) {
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <div className="mb-4 text-4xl">✓</div>
        <h3 className="text-xl font-semibold text-charcoal mb-2">{t("thankYou")}</h3>
        <p className="text-muted-foreground">{t("thankYouMessage")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-charcoal">{t("contactInfo")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")} *</Label>
            <Input id="name" name="name" required onFocus={() => handleFieldFocus("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">{t("company")}</Label>
            <Input id="company" name="company" onFocus={() => handleFieldFocus("company")} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")} *</Label>
            <Input id="email" name="email" type="email" required onFocus={() => handleFieldFocus("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" type="tel" onFocus={() => handleFieldFocus("phone")} />
          </div>
        </div>
      </div>

      {/* Product Specifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-charcoal">{t("productSpecs")}</h3>

        <div className="space-y-2">
          <Label htmlFor="product">{t("product")}</Label>
          <Input id="product" name="product" placeholder={t("productPlaceholder")} onFocus={() => handleFieldFocus("product")} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="species">{t("species")}</Label>
            <Input id="species" name="species" placeholder={t("speciesPlaceholder")} onFocus={() => handleFieldFocus("species")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">{t("type")}</Label>
            <Input id="type" name="type" placeholder={t("typePlaceholder")} onFocus={() => handleFieldFocus("type")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quality">{t("quality")}</Label>
            <Input id="quality" name="quality" placeholder={t("qualityPlaceholder")} onFocus={() => handleFieldFocus("quality")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="humidity">{t("humidity")}</Label>
            <Input id="humidity" name="humidity" placeholder="%" onFocus={() => handleFieldFocus("humidity")} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="thickness">{t("thickness")}</Label>
            <Input id="thickness" name="thickness" placeholder="mm" onFocus={() => handleFieldFocus("thickness")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="width">{t("width")}</Label>
            <Input id="width" name="width" placeholder="mm" onFocus={() => handleFieldFocus("width")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="length">{t("length")}</Label>
            <Input id="length" name="length" placeholder="mm" onFocus={() => handleFieldFocus("length")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pieces">{t("pieces")}</Label>
            <Input id="pieces" name="pieces" type="number" min="1" onFocus={() => handleFieldFocus("pieces")} />
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t("additionalNotes")}</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder={t("notesPlaceholder")}
          defaultValue={preselectedProducts ? `Selected products:\n${preselectedProducts}` : ""}
          onFocus={() => handleFieldFocus("notes")}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full bg-forest-green hover:bg-forest-green/90 text-white font-semibold py-3"
        disabled={isSubmitting}
      >
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
