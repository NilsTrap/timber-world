# Story 5.4: Complete Translation Files for All Languages

Status: ready-for-dev

## Story

As an **international visitor**,
I want **the website content available in my language**,
So that **I can understand everything without translation tools** (FR32, FR33, FR34).

## Acceptance Criteria

1. **Given** the i18n infrastructure exists with English base, **When** translation files are completed, **Then** all 8 language files are populated: en, fi, sv, no, da, nl, de, es

2. **Given** the translation files, **Then** translation keys cover: navigation, homepage, journey stages, catalog, quote form, resources, contact, common UI elements, error messages

3. **Given** the languages, **Then** English (en) serves as the complete base language (FR32)

4. **Given** other languages, **Then** other languages can be initially populated with English content for later translation

5. **Given** the translation system, **Then** a translation workflow is documented for updating content

6. **Given** locale conventions, **Then** date, number, and currency formats respect locale conventions

## Tasks / Subtasks

- [ ] Task 1: Complete English Translation File (AC: #2, #3)
  - [ ] Audit all components for translation keys
  - [ ] Complete `src/messages/en.json` with all keys
  - [ ] Organize keys by feature/page
  - [ ] Include all error messages

- [ ] Task 2: Create Translation File Template (AC: #1, #4)
  - [ ] Create base structure matching en.json
  - [ ] Document all keys with comments/description
  - [ ] Create script to sync structure across files

- [ ] Task 3: Create Language Files (AC: #1)
  - [ ] Create `src/messages/fi.json` (Finnish)
  - [ ] Create `src/messages/sv.json` (Swedish)
  - [ ] Create `src/messages/no.json` (Norwegian)
  - [ ] Create `src/messages/da.json` (Danish)
  - [ ] Create `src/messages/nl.json` (Dutch)
  - [ ] Create `src/messages/de.json` (German)
  - [ ] Create `src/messages/es.json` (Spanish)

- [ ] Task 4: Configure Locale Formatting (AC: #6)
  - [ ] Create `src/lib/utils/locale-formatters.ts`
  - [ ] Add date formatting per locale
  - [ ] Add number formatting per locale
  - [ ] Add currency formatting (EUR)

- [ ] Task 5: Document Translation Workflow (AC: #5)
  - [ ] Create translation guide document
  - [ ] Document key naming conventions
  - [ ] Document update process
  - [ ] Add validation script

- [ ] Task 6: Add Translation Validation
  - [ ] Create script to check missing keys
  - [ ] Add to CI/CD pipeline
  - [ ] Report incomplete translations

## Dev Notes

### Complete English Translation File

```json
// src/messages/en.json
{
  "common": {
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Try again",
    "cancel": "Cancel",
    "save": "Save",
    "submit": "Submit",
    "back": "Back",
    "next": "Next",
    "close": "Close",
    "search": "Search",
    "filter": "Filter",
    "clear": "Clear",
    "view_all": "View All",
    "learn_more": "Learn More",
    "currency": "EUR",
    "required": "Required"
  },

  "navigation": {
    "home": "Home",
    "products": "Products",
    "resources": "Resources",
    "contact": "Contact",
    "quote": "Request Quote",
    "language": "Language",
    "skip_to_content": "Skip to main content"
  },

  "home": {
    "hero": {
      "title": "From Forest to Finished Product",
      "subtitle": "Premium oak panels from Europe's trusted production orchestrator",
      "cta_products": "View Products",
      "cta_quote": "Request Quote",
      "scroll_hint": "Scroll to explore our journey"
    },
    "journey": {
      "progress": "{current} of {total}",
      "forest": {
        "title": "The Forest",
        "subtitle": "Sustainably managed European oak forests"
      },
      "sawmill": {
        "title": "The Sawmill",
        "subtitle": "Expert craftsmanship and precision cutting"
      },
      "kilns": {
        "title": "The Kilns",
        "subtitle": "Patient drying for perfect stability"
      },
      "panels": {
        "title": "Elements & Panels",
        "subtitle": "Hand-selected for quality and beauty"
      },
      "cnc": {
        "title": "CNC Machining",
        "subtitle": "Where craft meets technology"
      },
      "finishing": {
        "title": "Finishing",
        "subtitle": "Sustainable finishes for lasting beauty"
      },
      "quality": {
        "title": "Quality Control",
        "subtitle": "Every piece inspected before packing"
      },
      "delivery": {
        "title": "Delivery",
        "subtitle": "Reliable delivery across Europe"
      }
    },
    "cta": {
      "title": "Ready to work with us?",
      "products": "Browse Products",
      "quote": "Request Quote"
    }
  },

  "products": {
    "title": "Product Catalog",
    "subtitle": "Browse our complete range of oak panels",
    "count": "{count} products",
    "no_results": "No products match your filters",
    "clear_filters": "Clear all filters",

    "filter": {
      "title": "Filters",
      "active": "{count} active",
      "species": "Wood Species",
      "width": "Width",
      "length": "Length",
      "thickness": "Thickness",
      "grade": "Quality Grade",
      "type": "Panel Type",
      "type_fj": "Finger Jointed",
      "type_fs": "Full Stave",
      "moisture": "Moisture Content",
      "finish": "Finish",
      "fsc": "FSC Certified",
      "fsc_yes": "FSC Certified Only"
    },

    "table": {
      "product": "Product",
      "dimensions": "Dimensions",
      "quality": "Quality",
      "stock": "Stock",
      "price_m3": "€/m³",
      "price_piece": "€/piece",
      "price_m2": "€/m²"
    },

    "stock_status": {
      "in_stock": "In Stock",
      "low_stock": "Low Stock",
      "out_of_stock": "Out of Stock"
    },

    "selection": {
      "selected": "{count} products selected",
      "clear": "Clear selection",
      "request_quote": "Request Quote"
    }
  },

  "quote": {
    "title": "Request a Quote",
    "description": "Get competitive pricing for stock products or custom production orders",

    "tab_form": "Fill Out Form",
    "tab_chat": "Chat with Us",

    "selected_products": "Selected Products",
    "item": "item",
    "items": "items",
    "remove_product": "Remove product",

    "type": {
      "stock_title": "Stock Products",
      "stock_description": "Select from our available inventory",
      "custom_title": "Custom / Production Order",
      "custom_description": "Custom dimensions, finishes, or CNC work"
    },

    "form": {
      "type_title": "Quote Type",
      "contact_title": "Contact Information",
      "products_title": "Products",
      "custom_specs_title": "Custom Specifications",
      "delivery_title": "Delivery Location",
      "optional_title": "Additional Details (Optional)",

      "contact_name": "Your Name",
      "contact_name_placeholder": "John Smith",
      "email": "Email Address",
      "email_placeholder": "john@company.com",
      "phone": "Phone Number",
      "phone_placeholder": "+358 40 123 4567",
      "company_name": "Company Name",
      "company_name_placeholder": "Your Company Ltd",

      "add_product": "Add another product",
      "product_description": "Product Description",
      "quantity": "Quantity",
      "unit": "Unit",

      "delivery_country": "Country",
      "select_country": "Select a country",
      "delivery_region": "City / Region",
      "delivery_region_placeholder": "e.g., Helsinki",
      "delivery_address": "Full Delivery Address",
      "delivery_address_placeholder": "Street address (optional)",
      "delivery_address_hint": "Provide full address for accurate shipping estimates",

      "project_description": "Project Description",
      "project_description_placeholder": "Tell us about your project...",
      "timeline": "Timeline",
      "timeline_urgent": "Urgent (ASAP)",
      "timeline_standard": "Standard (2-4 weeks)",
      "timeline_flexible": "Flexible",
      "special_requirements": "Special Requirements",
      "special_requirements_placeholder": "Any specific requirements or questions...",

      "submit": "Submit Quote Request",
      "submitting": "Submitting...",
      "retry": "Try Again"
    },

    "custom": {
      "manual_review_notice": "Custom quotes require manual review. We'll respond within 24 hours.",
      "species": "Wood Species",
      "select_species": "Select species",
      "dimensions": "Dimensions",
      "width_mm": "Width (mm)",
      "length_mm": "Length (mm)",
      "thickness_mm": "Thickness (mm)",
      "finish_type": "Finish Type",
      "select_finish": "Select finish",
      "cnc_requirements": "CNC / Machining Requirements",
      "cnc_placeholder": "Describe any CNC machining needed...",
      "cnc_hint": "Include measurements, quantities, and reference drawings",
      "attachments": "Project Drawings / Images",
      "attachments_hint": "PDF, DWG, PNG, JPG (max 10MB each)"
    },

    "upload": {
      "drag_drop": "Drag & drop files here, or click to browse",
      "formats": "PDF, DWG, PNG, JPG (max 10MB each)",
      "uploading": "Uploading..."
    },

    "chat": {
      "welcome_message": "Hello! I'm here to help you request a quote. What products are you looking for?",
      "progress_label": "Quote completion",
      "typing": "Typing...",
      "input_placeholder": "Type your message...",
      "prefer_form": "Prefer to fill out a form instead?",
      "unavailable_message": "Chat is currently unavailable. Please use the form.",
      "switch_to_form": "Switch to Form"
    },

    "confirmation": {
      "title": "Quote Request Received!",
      "subtitle": "Thank you for your interest in Timber International.",
      "reference_label": "Your Reference Number",
      "when_response": "When will you hear from us?",

      "timeline": {
        "today": "We'll respond by this evening",
        "tomorrow": "We'll respond by tomorrow evening",
        "friday_evening": "We'll respond by Monday evening",
        "weekend": "We'll respond by Monday evening",
        "custom": "We'll respond within 24 hours"
      },

      "next_steps_title": "What happens next?",
      "next_step_1": "Our team reviews your request and prepares pricing",
      "next_step_2": "We send you a detailed quote via email",
      "next_step_3": "You review and we discuss any questions",

      "email_sent": "A confirmation email has been sent to your inbox.",
      "return_home": "Return to Homepage",
      "browse_products": "Browse Products"
    },

    "meta": {
      "title": "Request a Quote | Timber International",
      "description": "Request a quote for oak panels and custom production."
    }
  },

  "resources": {
    "title": "Industry Resources",
    "subtitle": "Learn about wood species, quality standards, and our process.",

    "meta": {
      "title": "Wood Industry Resources | Timber International",
      "description": "Educational resources about oak, quality grades, and production.",
      "keywords": "oak panels, wood quality, timber production"
    }
  },

  "contact": {
    "title": "Contact Us",
    "subtitle": "Get in touch with our team.",

    "meta": {
      "title": "Contact Timber International",
      "description": "Contact us for oak panels, quotes, and inquiries."
    },

    "info": {
      "title": "Get in Touch",
      "address_label": "Address",
      "address": "Timber International Oy\nTehtaankatu 123\n00100 Helsinki\nFinland",
      "phone_label": "Phone",
      "phone": "+358 9 123 4567",
      "email_label": "Email",
      "email": "info@timber-international.com",
      "hours_label": "Business Hours",
      "hours": "Monday - Friday\n8:00 - 17:00 (EET)",
      "response_note": "We typically respond within one business day."
    },

    "regions": {
      "title": "Regions We Serve",
      "description": "We deliver throughout Europe.",
      "region_nordic": "Nordic Countries",
      "region_western": "Western Europe",
      "region_southern": "Southern Europe",
      "region_other": "Other European Markets",
      "other_regions_note": "Contact us for delivery to other locations."
    },

    "quote_cta": {
      "title": "Need a Quote?",
      "description": "Get pricing for stock or custom orders.",
      "button": "Request a Quote"
    },

    "form": {
      "title": "Send us a Message",
      "name_label": "Your Name",
      "email_label": "Email Address",
      "subject_label": "Subject",
      "subject_placeholder": "Select a subject",
      "subject_general": "General Inquiry",
      "subject_products": "Product Questions",
      "subject_delivery": "Delivery & Shipping",
      "subject_partnership": "Partnership",
      "subject_other": "Other",
      "message_label": "Message",
      "message_placeholder": "How can we help?",
      "submit": "Send Message",
      "sending": "Sending...",
      "success_message": "Message sent. We'll respond soon!"
    }
  },

  "footer": {
    "company": "Timber International",
    "tagline": "Premium oak from forest to finished product",
    "quick_links": "Quick Links",
    "contact": "Contact",
    "copyright": "© {year} Timber International. All rights reserved.",
    "privacy": "Privacy Policy",
    "terms": "Terms of Service"
  },

  "errors": {
    "page_not_found": "Page not found",
    "page_not_found_description": "The page you're looking for doesn't exist.",
    "go_home": "Go to Homepage",
    "server_error": "Something went wrong",
    "server_error_description": "We're working to fix this. Please try again later.",
    "validation_error": "Please check your input",
    "network_error": "Connection error. Please check your internet.",
    "unauthorized": "Please log in to continue"
  }
}
```

### Locale Formatters

```typescript
// src/lib/utils/locale-formatters.ts

const LOCALE_CONFIG: Record<string, { dateFormat: Intl.DateTimeFormatOptions; numberFormat: Intl.NumberFormatOptions }> = {
  en: {
    dateFormat: { year: 'numeric', month: 'long', day: 'numeric' },
    numberFormat: { style: 'decimal', minimumFractionDigits: 0 },
  },
  fi: {
    dateFormat: { year: 'numeric', month: 'numeric', day: 'numeric' },
    numberFormat: { style: 'decimal', minimumFractionDigits: 0 },
  },
  de: {
    dateFormat: { year: 'numeric', month: 'numeric', day: 'numeric' },
    numberFormat: { style: 'decimal', minimumFractionDigits: 0 },
  },
  // Add other locales...
}

export function formatDate(date: Date, locale: string): string {
  const config = LOCALE_CONFIG[locale] || LOCALE_CONFIG.en
  return new Intl.DateTimeFormat(locale, config.dateFormat).format(date)
}

export function formatNumber(value: number, locale: string): string {
  const config = LOCALE_CONFIG[locale] || LOCALE_CONFIG.en
  return new Intl.NumberFormat(locale, config.numberFormat).format(value)
}

export function formatCurrency(value: number, locale: string, currency = 'EUR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatPrice(cents: number, locale: string): string {
  return formatCurrency(cents / 100, locale)
}
```

### Translation Sync Script

```typescript
// scripts/sync-translations.ts
import fs from 'fs'
import path from 'path'

const LOCALES = ['en', 'fi', 'sv', 'no', 'da', 'nl', 'de', 'es']
const MESSAGES_DIR = path.join(process.cwd(), 'src/messages')

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      return getAllKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

function syncTranslations() {
  // Load English as base
  const enPath = path.join(MESSAGES_DIR, 'en.json')
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'))
  const enKeys = getAllKeys(enContent)

  console.log(`English has ${enKeys.length} translation keys`)

  // Check each locale
  for (const locale of LOCALES) {
    if (locale === 'en') continue

    const localePath = path.join(MESSAGES_DIR, `${locale}.json`)

    if (!fs.existsSync(localePath)) {
      // Create file with English content
      fs.writeFileSync(localePath, JSON.stringify(enContent, null, 2))
      console.log(`Created ${locale}.json with English content`)
      continue
    }

    const localeContent = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
    const localeKeys = getAllKeys(localeContent)
    const missingKeys = enKeys.filter(key => !localeKeys.includes(key))

    if (missingKeys.length > 0) {
      console.log(`${locale}: Missing ${missingKeys.length} keys:`)
      missingKeys.forEach(key => console.log(`  - ${key}`))
    } else {
      console.log(`${locale}: Complete!`)
    }
  }
}

syncTranslations()
```

### Translation Guide Document

Create `docs/TRANSLATION_GUIDE.md`:

```markdown
# Translation Guide

## Overview

This project supports 8 languages:
- English (en) - Base language
- Finnish (fi)
- Swedish (sv)
- Norwegian (no)
- Danish (da)
- Dutch (nl)
- German (de)
- Spanish (es)

## File Structure

Translation files are located in `src/messages/`:
- Each language has its own JSON file
- Keys are organized by feature/page
- English serves as the complete reference

## Key Naming Convention

- Use dot notation: `page.section.element`
- Use snake_case for key names
- Keep keys descriptive but concise

Examples:
- `products.filter.species` - Species filter label
- `quote.form.submit` - Submit button on quote form
- `errors.validation_error` - Validation error message

## Adding New Keys

1. Add the key to `en.json` first
2. Run `npm run sync-translations` to find missing keys
3. Add translations to other locale files

## Placeholder Syntax

Use curly braces for variables:
- `{count} products selected`
- `Step {current} of {total}`

## Updating Translations

1. Make changes in the appropriate locale file
2. Test the changes in the browser
3. Commit changes with descriptive message
```

### Project Structure Notes

Files to create:
- Complete `src/messages/en.json`
- `src/messages/fi.json` (copy from en initially)
- `src/messages/sv.json`
- `src/messages/no.json`
- `src/messages/da.json`
- `src/messages/nl.json`
- `src/messages/de.json`
- `src/messages/es.json`
- `src/lib/utils/locale-formatters.ts`
- `scripts/sync-translations.ts`
- `docs/TRANSLATION_GUIDE.md`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Story-5.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR32-FR34]
- [Source: _bmad-output/planning-artifacts/architecture.md#i18n]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
