"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn, Button, Input, Label, Textarea } from "@timber/ui";
import { submitQuoteRequest } from "@/lib/actions/quote";

interface QuoteFormProps {
  preselectedProducts?: string;
}

export function QuoteForm({ preselectedProducts }: QuoteFormProps) {
  const t = useTranslations("quote");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await submitQuoteRequest(formData);

    setIsSubmitting(false);

    if (result.success) {
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
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">{t("company")}</Label>
            <Input id="company" name="company" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")} *</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
        </div>
      </div>

      {/* Product Specifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-charcoal">{t("productSpecs")}</h3>

        <div className="space-y-2">
          <Label htmlFor="product">{t("product")}</Label>
          <Input id="product" name="product" placeholder={t("productPlaceholder")} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="species">{t("species")}</Label>
            <Input id="species" name="species" placeholder={t("speciesPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">{t("type")}</Label>
            <Input id="type" name="type" placeholder={t("typePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quality">{t("quality")}</Label>
            <Input id="quality" name="quality" placeholder={t("qualityPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="humidity">{t("humidity")}</Label>
            <Input id="humidity" name="humidity" placeholder="%" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="thickness">{t("thickness")}</Label>
            <Input id="thickness" name="thickness" placeholder="mm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="width">{t("width")}</Label>
            <Input id="width" name="width" placeholder="mm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="length">{t("length")}</Label>
            <Input id="length" name="length" placeholder="mm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pieces">{t("pieces")}</Label>
            <Input id="pieces" name="pieces" type="number" min="1" />
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
          defaultValue={preselectedProducts ? `Selected products: ${preselectedProducts}` : ""}
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
