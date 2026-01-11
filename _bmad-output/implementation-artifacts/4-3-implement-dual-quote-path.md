# Story 4.3: Implement Dual Quote Path (Stock vs Custom)

Status: ready-for-dev

## Story

As a **visitor**,
I want **to specify whether I need stock products or custom production**,
So that **my quote is routed correctly** (FR22, FR23, FR25).

## Acceptance Criteria

1. **Given** the quote form is displayed, **When** quote type selection is rendered, **Then** two clear options are available: "Stock Products" and "Custom/Production Order"

2. **Given** "Stock Products" is selected, **Then** the Stock path shows: product selection, quantity, delivery location

3. **Given** "Custom/Production Order" is selected, **Then** the Custom path adds: custom dimensions fields, finish selection, CNC requirements textarea, file upload for drawings (FR24)

4. **Given** form submission, **Then** the system tags the quote as "standard" or "custom" based on selection (FR25)

5. **Given** custom quote selected, **Then** custom quotes display note: "Custom quotes require manual review"

6. **Given** file upload needed, **Then** file upload accepts common formats (PDF, DWG, images) with size limit

## Tasks / Subtasks

- [ ] Task 1: Create Quote Type Selector (AC: #1)
  - [ ] Create `src/components/features/quote/QuoteTypeSelector.tsx`
  - [ ] Add "Stock Products" option with description
  - [ ] Add "Custom/Production Order" option with description
  - [ ] Style as prominent toggle/radio cards
  - [ ] Default to "Stock Products"

- [ ] Task 2: Update Quote Form Schema for Custom Fields (AC: #3, #4)
  - [ ] Extend quote schema with quoteType discriminator
  - [ ] Add custom dimensions fields (width, length, thickness)
  - [ ] Add finish type selection
  - [ ] Add CNC requirements field
  - [ ] Add file attachments array

- [ ] Task 3: Create Stock Quote Fields (AC: #2)
  - [ ] Create `src/components/features/quote/StockQuoteFields.tsx`
  - [ ] Product selection from catalog
  - [ ] Quantity per product
  - [ ] Already integrated with QuoteProductFields

- [ ] Task 4: Create Custom Quote Fields (AC: #3)
  - [ ] Create `src/components/features/quote/CustomQuoteFields.tsx`
  - [ ] Custom dimensions inputs (width, length, thickness)
  - [ ] Wood species selector
  - [ ] Finish type dropdown (raw, oiled, lacquered, etc.)
  - [ ] CNC requirements textarea
  - [ ] Manual review notice message

- [ ] Task 5: Implement File Upload (AC: #6)
  - [ ] Create `src/components/features/quote/FileUpload.tsx`
  - [ ] Accept PDF, DWG, PNG, JPG formats
  - [ ] Max file size: 10MB per file
  - [ ] Max files: 5
  - [ ] Show upload progress
  - [ ] Preview uploaded files with remove option

- [ ] Task 6: Integrate Quote Type in Form (AC: #1, #4, #5)
  - [ ] Add QuoteTypeSelector to QuoteForm
  - [ ] Conditionally render Stock or Custom fields
  - [ ] Set quoteType in form data
  - [ ] Add review note for custom quotes

- [ ] Task 7: Add Translation Keys
  - [ ] Add quote type labels
  - [ ] Add custom fields translations
  - [ ] Add file upload messages

## Dev Notes

### Extended Quote Schema

```typescript
// src/lib/validations/quote.ts - Extended version
import { z } from 'zod'

// Base schema for common fields
const baseQuoteSchema = z.object({
  // Contact Information
  contactName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  companyName: z.string().min(2, 'Company name is required'),

  // Delivery Location
  deliveryCountry: z.string().min(1, 'Please select a country'),
  deliveryRegion: z.string().optional(),
  deliveryAddress: z.string().optional(),

  // Optional Details
  projectDescription: z.string().optional(),
  timeline: z.enum(['urgent', 'standard', 'flexible']).optional(),
  specialRequirements: z.string().optional(),
})

// Stock quote schema
export const stockQuoteSchema = baseQuoteSchema.extend({
  quoteType: z.literal('stock'),
  products: z.array(z.object({
    productId: z.string(),
    sku: z.string(),
    quantity: z.number().min(1),
    unit: z.enum(['m2', 'm3', 'pieces']),
  })).min(1, 'At least one product is required'),
})

// Custom quote schema
export const customQuoteSchema = baseQuoteSchema.extend({
  quoteType: z.literal('custom'),
  customSpecs: z.object({
    species: z.string().min(1, 'Please select wood species'),
    width: z.number().min(1, 'Width is required'),
    length: z.number().min(1, 'Length is required'),
    thickness: z.number().min(1, 'Thickness is required'),
    finish: z.string().min(1, 'Please select finish type'),
    cncRequirements: z.string().optional(),
  }),
  attachments: z.array(z.object({
    filename: z.string(),
    url: z.string(),
    size: z.number(),
    type: z.string(),
  })).optional(),
})

// Discriminated union
export const quoteRequestSchema = z.discriminatedUnion('quoteType', [
  stockQuoteSchema,
  customQuoteSchema,
])

export type StockQuoteFormData = z.infer<typeof stockQuoteSchema>
export type CustomQuoteFormData = z.infer<typeof customQuoteSchema>
export type QuoteRequestFormData = z.infer<typeof quoteRequestSchema>
```

### QuoteTypeSelector Component

```tsx
// src/components/features/quote/QuoteTypeSelector.tsx
'use client'

import { useFormContext } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Package, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuoteType = 'stock' | 'custom'

export function QuoteTypeSelector() {
  const t = useTranslations('quote.type')
  const { watch, setValue } = useFormContext()
  const quoteType = watch('quoteType') as QuoteType

  const options: { value: QuoteType; icon: React.ReactNode; title: string; description: string }[] = [
    {
      value: 'stock',
      icon: <Package className="h-8 w-8" />,
      title: t('stock_title'),
      description: t('stock_description'),
    },
    {
      value: 'custom',
      icon: <Wrench className="h-8 w-8" />,
      title: t('custom_title'),
      description: t('custom_description'),
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setValue('quoteType', option.value)}
          className={cn(
            'flex flex-col items-center p-6 rounded-lg border-2 transition-all',
            'hover:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2',
            quoteType === option.value
              ? 'border-forest-500 bg-forest-50 text-forest-700'
              : 'border-stone-200 bg-white text-stone-600'
          )}
        >
          <div className={cn(
            'mb-3',
            quoteType === option.value ? 'text-forest-600' : 'text-stone-400'
          )}>
            {option.icon}
          </div>
          <h3 className="font-semibold text-lg mb-1">{option.title}</h3>
          <p className="text-sm text-center text-stone-500">{option.description}</p>
        </button>
      ))}
    </div>
  )
}
```

### CustomQuoteFields Component

```tsx
// src/components/features/quote/CustomQuoteFields.tsx
'use client'

import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'
import { Info } from 'lucide-react'
import { FileUpload } from './FileUpload'

const WOOD_SPECIES = ['Oak', 'Ash', 'Beech', 'Walnut']
const FINISH_TYPES = [
  { value: 'raw', label: 'Raw / Unfinished' },
  { value: 'sanded', label: 'Sanded' },
  { value: 'oiled', label: 'Oiled' },
  { value: 'lacquered', label: 'Lacquered' },
  { value: 'stained', label: 'Stained' },
  { value: 'custom', label: 'Custom Finish' },
]

export function CustomQuoteFields() {
  const t = useTranslations('quote.custom')
  const { register, setValue, watch, formState: { errors } } = useFormContext()

  const customErrors = errors.customSpecs as Record<string, { message?: string }> | undefined

  return (
    <div className="space-y-6">
      {/* Manual Review Notice */}
      <Alert className="bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          {t('manual_review_notice')}
        </AlertDescription>
      </Alert>

      {/* Wood Species */}
      <div className="space-y-2">
        <Label htmlFor="species">
          {t('species')} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={watch('customSpecs.species')}
          onValueChange={(value) => setValue('customSpecs.species', value)}
        >
          <SelectTrigger id="species">
            <SelectValue placeholder={t('select_species')} />
          </SelectTrigger>
          <SelectContent>
            {WOOD_SPECIES.map((species) => (
              <SelectItem key={species} value={species.toLowerCase()}>
                {species}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {customErrors?.species && (
          <p className="text-sm text-red-500">{customErrors.species.message}</p>
        )}
      </div>

      {/* Dimensions */}
      <div className="space-y-2">
        <Label>{t('dimensions')}</Label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="width" className="text-sm text-stone-500">{t('width_mm')}</Label>
            <Input
              id="width"
              type="number"
              {...register('customSpecs.width', { valueAsNumber: true })}
              placeholder="200"
            />
          </div>
          <div>
            <Label htmlFor="length" className="text-sm text-stone-500">{t('length_mm')}</Label>
            <Input
              id="length"
              type="number"
              {...register('customSpecs.length', { valueAsNumber: true })}
              placeholder="2000"
            />
          </div>
          <div>
            <Label htmlFor="thickness" className="text-sm text-stone-500">{t('thickness_mm')}</Label>
            <Input
              id="thickness"
              type="number"
              {...register('customSpecs.thickness', { valueAsNumber: true })}
              placeholder="20"
            />
          </div>
        </div>
      </div>

      {/* Finish Type */}
      <div className="space-y-2">
        <Label htmlFor="finish">
          {t('finish_type')} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={watch('customSpecs.finish')}
          onValueChange={(value) => setValue('customSpecs.finish', value)}
        >
          <SelectTrigger id="finish">
            <SelectValue placeholder={t('select_finish')} />
          </SelectTrigger>
          <SelectContent>
            {FINISH_TYPES.map((finish) => (
              <SelectItem key={finish.value} value={finish.value}>
                {finish.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* CNC Requirements */}
      <div className="space-y-2">
        <Label htmlFor="cncRequirements">{t('cnc_requirements')}</Label>
        <Textarea
          id="cncRequirements"
          {...register('customSpecs.cncRequirements')}
          placeholder={t('cnc_placeholder')}
          rows={4}
        />
        <p className="text-sm text-stone-500">{t('cnc_hint')}</p>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <Label>{t('attachments')}</Label>
        <FileUpload
          onFilesChange={(files) => setValue('attachments', files)}
        />
        <p className="text-sm text-stone-500">{t('attachments_hint')}</p>
      </div>
    </div>
  )
}
```

### FileUpload Component

```tsx
// src/components/features/quote/FileUpload.tsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTranslations } from 'next-intl'
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/dwg': ['.dwg'],
  'application/dxf': ['.dxf'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5

interface UploadedFile {
  filename: string
  url: string
  size: number
  type: string
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void
}

export function FileUpload({ onFilesChange }: FileUploadProps) {
  const t = useTranslations('quote.upload')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > MAX_FILES) {
      // Show error toast
      return
    }

    setUploading(true)
    setProgress(0)

    // Simulate upload (replace with actual upload logic)
    const newFiles: UploadedFile[] = []
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      // In real implementation, upload to storage (e.g., Supabase Storage)
      await new Promise(resolve => setTimeout(resolve, 500))
      setProgress(((i + 1) / acceptedFiles.length) * 100)

      newFiles.push({
        filename: file.name,
        url: URL.createObjectURL(file), // Replace with actual URL
        size: file.size,
        type: file.type,
      })
    }

    const updatedFiles = [...files, ...newFiles]
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
    setUploading(false)
  }, [files, onFilesChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES - files.length,
    disabled: files.length >= MAX_FILES,
  })

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index)
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5" />
    return <FileText className="h-5 w-5" />
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-forest-500 bg-forest-50' : 'border-stone-300 hover:border-stone-400',
          files.length >= MAX_FILES && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-stone-400" />
        <p className="text-stone-600">{t('drag_drop')}</p>
        <p className="text-sm text-stone-400 mt-1">{t('formats')}</p>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-stone-500 text-center">{t('uploading')}</p>
        </div>
      )}

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-stone-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="text-stone-400">{getFileIcon(file.type)}</div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {file.filename}
                  </p>
                  <p className="text-xs text-stone-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
                className="h-8 w-8 text-stone-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Updated QuoteForm with Type Selection

```tsx
// Update to QuoteForm.tsx
export function QuoteForm({ selectedProductIds = [], onSubmit }: QuoteFormProps) {
  const t = useTranslations('quote.form')
  const quoteType = watch('quoteType')

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Quote Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('type_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteTypeSelector />
          </CardContent>
        </Card>

        {/* Conditional Product/Custom Fields */}
        {quoteType === 'stock' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('products_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteProductFields selectedProductIds={selectedProductIds} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('custom_specs_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomQuoteFields />
            </CardContent>
          </Card>
        )}

        {/* Rest of the form... */}
      </form>
    </FormProvider>
  )
}
```

### Translation Keys

```json
{
  "quote": {
    "type": {
      "stock_title": "Stock Products",
      "stock_description": "Select from our available inventory",
      "custom_title": "Custom / Production Order",
      "custom_description": "Custom dimensions, finishes, or CNC work"
    },
    "custom": {
      "manual_review_notice": "Custom quotes require manual review. We'll respond within 24 hours with a detailed proposal.",
      "species": "Wood Species",
      "select_species": "Select species",
      "dimensions": "Dimensions",
      "width_mm": "Width (mm)",
      "length_mm": "Length (mm)",
      "thickness_mm": "Thickness (mm)",
      "finish_type": "Finish Type",
      "select_finish": "Select finish",
      "cnc_requirements": "CNC / Machining Requirements",
      "cnc_placeholder": "Describe any CNC machining, routing, or special cuts needed...",
      "cnc_hint": "Include measurements, quantities, and any reference drawings",
      "attachments": "Project Drawings / Reference Images",
      "attachments_hint": "Upload PDF, DWG, or images (max 10MB each, up to 5 files)"
    },
    "upload": {
      "drag_drop": "Drag & drop files here, or click to browse",
      "formats": "PDF, DWG, PNG, JPG (max 10MB each)",
      "uploading": "Uploading..."
    }
  }
}
```

### Dependencies

- `react-dropzone` for file upload: `npm install react-dropzone`
- Supabase Storage for file hosting (configure in Story 4.5)

### Project Structure Notes

Files to create/update:
- `src/lib/validations/quote.ts` - Extended with discriminated union
- `src/components/features/quote/QuoteTypeSelector.tsx` - New
- `src/components/features/quote/CustomQuoteFields.tsx` - New
- `src/components/features/quote/FileUpload.tsx` - New
- `src/components/features/quote/QuoteForm.tsx` - Updated

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4-Story-4.3]
- [Source: _bmad-output/planning-artifacts/prd.md#FR22-FR25]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dual-Quote-Paths]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
