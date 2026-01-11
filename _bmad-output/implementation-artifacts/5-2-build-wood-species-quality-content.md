# Story 5.2: Build Wood Species and Quality Content

Status: ready-for-dev

## Story

As a **visitor**,
I want **to learn about wood species characteristics and quality standards**,
So that **I understand what I'm purchasing** (FR28, FR29).

## Acceptance Criteria

1. **Given** the resources page exists, **When** species and quality sections are rendered, **Then** wood species section covers oak characteristics, properties, and applications (FR28)

2. **Given** the resources page, **Then** quality standards section explains grading criteria and what each grade means (FR29)

3. **Given** the content sections, **Then** content includes visual aids (images, comparison tables)

4. **Given** the content sections, **Then** technical specifications are presented clearly

5. **Given** the content sections, **Then** content links to relevant products in the catalog

6. **Given** all content, **Then** all content text is stored in i18n translation files

## Tasks / Subtasks

- [ ] Task 1: Create Detailed Species Content (AC: #1, #3, #4)
  - [ ] Create `src/components/features/resources/SpeciesDetail.tsx`
  - [ ] Add oak properties table (hardness, density, workability)
  - [ ] Add grain pattern images placeholder
  - [ ] Add color variation examples
  - [ ] Add application recommendations

- [ ] Task 2: Create Quality Grades Comparison (AC: #2, #3, #4)
  - [ ] Create `src/components/features/resources/QualityComparison.tsx`
  - [ ] Build comparison table for grades A, B, C
  - [ ] Add visual examples placeholder for each grade
  - [ ] Explain defects allowed per grade
  - [ ] Add recommended uses per grade

- [ ] Task 3: Create Technical Specifications Table (AC: #4)
  - [ ] Create `src/components/features/resources/SpecsTable.tsx`
  - [ ] Add dimensions available
  - [ ] Add moisture content specifications
  - [ ] Add finish options
  - [ ] Add FSC certification info

- [ ] Task 4: Add Product Catalog Links (AC: #5)
  - [ ] Link oak section to species=oak filter
  - [ ] Link each grade to grade filter
  - [ ] Link finish types to finish filter
  - [ ] Style as CTAs within content

- [ ] Task 5: Add Comprehensive Translations (AC: #6)
  - [ ] Species properties and descriptions
  - [ ] Grade criteria explanations
  - [ ] Technical specification labels
  - [ ] Table headers and values

## Dev Notes

### SpeciesDetail Component

```tsx
// src/components/features/resources/SpeciesDetail.tsx
'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface SpeciesDetailProps {
  locale: string
}

export function SpeciesDetail({ locale }: SpeciesDetailProps) {
  const t = useTranslations('resources.species_detail')

  const properties = [
    { key: 'hardness', value: t('oak.hardness_value'), unit: t('oak.hardness_unit') },
    { key: 'density', value: t('oak.density_value'), unit: t('oak.density_unit') },
    { key: 'stability', value: t('oak.stability_value'), unit: '' },
    { key: 'durability', value: t('oak.durability_value'), unit: '' },
  ]

  return (
    <div className="space-y-8">
      {/* Hero Image */}
      <div className="relative h-64 md:h-80 rounded-lg overflow-hidden">
        <Image
          src="/images/resources/oak-grain.webp"
          alt={t('oak.grain_alt')}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <h3 className="text-2xl font-bold text-white font-playfair">
            {t('oak.title')}
          </h3>
          <p className="text-white/80">{t('oak.scientific_name')}</p>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {properties.map((prop) => (
          <Card key={prop.key}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-stone-500 mb-1">
                {t(`properties.${prop.key}`)}
              </p>
              <p className="text-xl font-semibold text-forest-600">
                {prop.value}
              </p>
              {prop.unit && (
                <p className="text-xs text-stone-400">{prop.unit}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Description */}
      <div className="prose prose-lg max-w-none">
        <h4>{t('oak.about_title')}</h4>
        <p>{t('oak.about_description')}</p>

        <h4>{t('oak.characteristics_title')}</h4>
        <ul>
          <li><strong>{t('oak.char_grain')}:</strong> {t('oak.char_grain_desc')}</li>
          <li><strong>{t('oak.char_color')}:</strong> {t('oak.char_color_desc')}</li>
          <li><strong>{t('oak.char_workability')}:</strong> {t('oak.char_workability_desc')}</li>
          <li><strong>{t('oak.char_finish')}:</strong> {t('oak.char_finish_desc')}</li>
        </ul>
      </div>

      {/* Applications */}
      <div>
        <h4 className="text-xl font-semibold mb-4">{t('oak.applications_title')}</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['furniture', 'flooring', 'cabinetry', 'millwork'].map((app) => (
            <div key={app} className="bg-cream-50 rounded-lg p-4 text-center">
              <p className="font-medium text-charcoal">{t(`oak.app_${app}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Button asChild size="lg">
        <Link href={`/${locale}/products?species=oak`}>
          {t('oak.view_products')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
```

### QualityComparison Component

```tsx
// src/components/features/resources/QualityComparison.tsx
'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import Link from 'next/link'

interface QualityComparisonProps {
  locale: string
}

const GRADES = ['A', 'B', 'C'] as const

const CRITERIA = [
  'knots',
  'sapwood',
  'color_variation',
  'cracks',
  'mineral_streaks',
] as const

export function QualityComparison({ locale }: QualityComparisonProps) {
  const t = useTranslations('resources.quality')

  // Define what's allowed per grade
  const gradeAllowances: Record<string, Record<string, 'none' | 'limited' | 'allowed'>> = {
    A: {
      knots: 'none',
      sapwood: 'none',
      color_variation: 'limited',
      cracks: 'none',
      mineral_streaks: 'limited',
    },
    B: {
      knots: 'limited',
      sapwood: 'limited',
      color_variation: 'allowed',
      cracks: 'none',
      mineral_streaks: 'allowed',
    },
    C: {
      knots: 'allowed',
      sapwood: 'allowed',
      color_variation: 'allowed',
      cracks: 'limited',
      mineral_streaks: 'allowed',
    },
  }

  const renderAllowance = (value: 'none' | 'limited' | 'allowed') => {
    switch (value) {
      case 'none':
        return <X className="h-5 w-5 text-red-500" />
      case 'limited':
        return <span className="text-amber-500 text-sm font-medium">{t('limited')}</span>
      case 'allowed':
        return <Check className="h-5 w-5 text-green-500" />
    }
  }

  return (
    <div className="space-y-8">
      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-forest-200">
              <th className="text-left p-4 font-semibold text-charcoal">
                {t('criteria')}
              </th>
              {GRADES.map((grade) => (
                <th key={grade} className="text-center p-4 font-semibold text-charcoal">
                  <Badge variant={grade === 'A' ? 'default' : 'secondary'} className="text-lg">
                    {t(`grade_${grade.toLowerCase()}.label`)}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((criterion, idx) => (
              <tr key={criterion} className={idx % 2 === 0 ? 'bg-cream-50' : ''}>
                <td className="p-4 font-medium text-charcoal">
                  {t(`criteria_${criterion}`)}
                </td>
                {GRADES.map((grade) => (
                  <td key={grade} className="p-4 text-center">
                    {renderAllowance(gradeAllowances[grade][criterion])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grade Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {GRADES.map((grade) => (
          <Card key={grade} className={grade === 'A' ? 'border-forest-500 border-2' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={grade === 'A' ? 'default' : 'secondary'}>
                  {t(`grade_${grade.toLowerCase()}.label`)}
                </Badge>
                {grade === 'A' && (
                  <span className="text-sm text-forest-600">{t('premium')}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-stone-600">
                {t(`grade_${grade.toLowerCase()}.full_description`)}
              </p>

              <div>
                <p className="font-medium text-sm mb-2">{t('ideal_for')}</p>
                <p className="text-sm text-stone-600">
                  {t(`grade_${grade.toLowerCase()}.ideal_uses`)}
                </p>
              </div>

              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}/products?grade=${grade}`}>
                  {t('view_grade_products', { grade })}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 justify-center text-sm text-stone-600">
        <div className="flex items-center gap-2">
          <X className="h-4 w-4 text-red-500" />
          {t('legend_not_allowed')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-500 font-medium">{t('limited')}</span>
          {t('legend_limited')}
        </div>
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          {t('legend_allowed')}
        </div>
      </div>
    </div>
  )
}
```

### SpecsTable Component

```tsx
// src/components/features/resources/SpecsTable.tsx
'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SpecsTable() {
  const t = useTranslations('resources.specs')

  const specs = [
    {
      category: 'dimensions',
      items: [
        { label: t('width'), value: '200mm - 1200mm' },
        { label: t('length'), value: '1000mm - 4000mm' },
        { label: t('thickness'), value: '18mm, 20mm, 26mm, 30mm, 40mm' },
      ],
    },
    {
      category: 'technical',
      items: [
        { label: t('moisture'), value: '8-12%' },
        { label: t('type_fj'), value: t('type_fj_desc') },
        { label: t('type_fs'), value: t('type_fs_desc') },
      ],
    },
    {
      category: 'finishes',
      items: [
        { label: t('finish_raw'), value: t('finish_raw_desc') },
        { label: t('finish_sanded'), value: t('finish_sanded_desc') },
        { label: t('finish_oiled'), value: t('finish_oiled_desc') },
        { label: t('finish_lacquered'), value: t('finish_lacquered_desc') },
      ],
    },
  ]

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {specs.map((spec) => (
        <Card key={spec.category}>
          <CardHeader>
            <CardTitle className="text-lg">
              {t(`category_${spec.category}`)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {spec.items.map((item, idx) => (
                <div key={idx}>
                  <dt className="text-sm text-stone-500">{item.label}</dt>
                  <dd className="font-medium text-charcoal">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### Additional Translation Keys

```json
{
  "resources": {
    "species_detail": {
      "oak": {
        "title": "European Oak",
        "scientific_name": "Quercus robur / Quercus petraea",
        "grain_alt": "European oak wood grain pattern",
        "hardness_value": "1360",
        "hardness_unit": "Janka lbf",
        "density_value": "720",
        "density_unit": "kg/m³",
        "stability_value": "Good",
        "durability_value": "Very High",
        "about_title": "About European Oak",
        "about_description": "European Oak is one of the most versatile and sought-after hardwoods, prized for its strength, durability, and distinctive appearance. Native to European forests, it has been used for centuries in furniture, construction, and decorative applications.",
        "characteristics_title": "Wood Characteristics",
        "char_grain": "Grain Pattern",
        "char_grain_desc": "Distinctive open grain with prominent medullary rays that create attractive figure patterns, especially in quarter-sawn material.",
        "char_color": "Color",
        "char_color_desc": "Light golden brown to medium brown with warm undertones. Darkens naturally with age and exposure to light.",
        "char_workability": "Workability",
        "char_workability_desc": "Excellent machining properties. Takes stains, oils, and lacquers exceptionally well. Ideal for CNC operations.",
        "char_finish": "Finishing",
        "char_finish_desc": "Accepts all types of finishes beautifully. Natural oils enhance grain. Can be stained to achieve various tones.",
        "applications_title": "Common Applications",
        "app_furniture": "Furniture",
        "app_flooring": "Flooring",
        "app_cabinetry": "Cabinetry",
        "app_millwork": "Millwork",
        "view_products": "View Oak Products"
      },
      "properties": {
        "hardness": "Hardness",
        "density": "Density",
        "stability": "Stability",
        "durability": "Durability"
      }
    },

    "quality": {
      "criteria": "Characteristic",
      "limited": "Limited",
      "premium": "Premium",
      "ideal_for": "Ideal for:",
      "view_grade_products": "View Grade {grade} Products",
      "legend_not_allowed": "Not allowed",
      "legend_limited": "Limited occurrence",
      "legend_allowed": "Allowed",

      "criteria_knots": "Knots",
      "criteria_sapwood": "Sapwood",
      "criteria_color_variation": "Color Variation",
      "criteria_cracks": "Cracks",
      "criteria_mineral_streaks": "Mineral Streaks",

      "grade_a": {
        "label": "Grade A",
        "full_description": "Premium grade with minimal natural characteristics. Ideal for high-end furniture, visible surfaces, and applications requiring the finest appearance.",
        "ideal_uses": "Premium furniture, high-end cabinetry, architectural millwork, luxury interiors"
      },
      "grade_b": {
        "label": "Grade B",
        "full_description": "Standard grade allowing minor natural characteristics. Excellent balance of quality and value for most professional applications.",
        "ideal_uses": "General furniture, flooring, cabinetry, commercial interiors"
      },
      "grade_c": {
        "label": "Grade C",
        "full_description": "Rustic grade with natural character marks, knots, and color variation. Perfect for rustic, industrial, or character-driven designs.",
        "ideal_uses": "Rustic furniture, character flooring, industrial design, creative projects"
      }
    },

    "specs": {
      "category_dimensions": "Available Dimensions",
      "category_technical": "Technical Specs",
      "category_finishes": "Finish Options",
      "width": "Width Range",
      "length": "Length Range",
      "thickness": "Thickness Options",
      "moisture": "Moisture Content",
      "type_fj": "Finger-Jointed (FJ)",
      "type_fj_desc": "Shorter pieces joined for stability",
      "type_fs": "Full Stave (FS)",
      "type_fs_desc": "Continuous lengths for traditional look",
      "finish_raw": "Raw",
      "finish_raw_desc": "Unfinished, ready for custom treatment",
      "finish_sanded": "Sanded",
      "finish_sanded_desc": "Smooth finish, ready to apply coating",
      "finish_oiled": "Oiled",
      "finish_oiled_desc": "Natural oil finish, enhances grain",
      "finish_lacquered": "Lacquered",
      "finish_lacquered_desc": "Protective clear coat applied"
    }
  }
}
```

### Project Structure Notes

Files to create:
- `src/components/features/resources/SpeciesDetail.tsx`
- `src/components/features/resources/QualityComparison.tsx`
- `src/components/features/resources/SpecsTable.tsx`

### Image Assets Needed

- `/public/images/resources/oak-grain.webp` - Oak wood grain close-up
- Grade example images (can be added later)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Story-5.2]
- [Source: _bmad-output/planning-artifacts/prd.md#FR28-FR29]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
