# Story 4.4: Integrate AI Chatbot for Conversational Quotes

Status: ready-for-dev

## Story

As a **visitor**,
I want **to request a quote through a conversational chat interface**,
So that **I can describe my needs naturally** (FR18, FR19, FR20).

## Acceptance Criteria

1. **Given** the chat tab is active on the quote page, **When** the chatbot interface renders, **Then** a welcome message introduces the quote assistant

2. **Given** the chatbot is displayed, **Then** the chatbot uses Vercel AI SDK with Anthropic Claude

3. **Given** a conversation, **Then** the chatbot guides users through required information (~10 fields) (FR19)

4. **Given** a user question, **Then** the chatbot can answer common questions about products, pricing, and processes (FR20)

5. **Given** information is collected, **Then** collected information auto-populates the quote form fields

6. **Given** the chat interface, **Then** a progress indicator shows completion percentage

7. **Given** user preference, **Then** users can switch to form view to review/edit collected data

8. **Given** chatbot unavailable, **Then** graceful fallback to form-only mode (NFR41)

9. **Given** conversation started, **Then** chat history is maintained within the session

## Tasks / Subtasks

- [ ] Task 1: Set Up AI Infrastructure (AC: #2)
  - [ ] Create `src/lib/ai/anthropic.ts` - Anthropic client setup
  - [ ] Create `src/lib/ai/prompts.ts` - System prompts for quote assistant
  - [ ] Add environment variables for ANTHROPIC_API_KEY
  - [ ] Configure Vercel AI SDK with Anthropic provider

- [ ] Task 2: Create Chat API Route (AC: #2, #3, #4)
  - [ ] Create `src/app/api/chat/route.ts`
  - [ ] Implement streaming chat endpoint
  - [ ] Include system prompt for quote guidance
  - [ ] Add context about products and pricing

- [ ] Task 3: Create ChatMessage Component (AC: #1, #9)
  - [ ] Create `src/components/features/quote/ChatMessage.tsx`
  - [ ] Style user messages (right-aligned, green)
  - [ ] Style assistant messages (left-aligned, neutral)
  - [ ] Add timestamp display
  - [ ] Handle markdown formatting in responses

- [ ] Task 4: Create ChatbotInterface Component (AC: #1, #6, #9)
  - [ ] Create `src/components/features/quote/ChatbotInterface.tsx`
  - [ ] Add message history display area
  - [ ] Add text input field with send button
  - [ ] Add typing indicator during response
  - [ ] Implement progress bar for quote completion

- [ ] Task 5: Implement Data Extraction (AC: #3, #5)
  - [ ] Create `src/lib/ai/extractors.ts` - Field extraction logic
  - [ ] Parse conversation for contact information
  - [ ] Parse conversation for product specifications
  - [ ] Parse conversation for delivery location
  - [ ] Sync extracted data to form state

- [ ] Task 6: Add Form Sync and Switch (AC: #5, #7)
  - [ ] Create shared state between chat and form
  - [ ] Auto-populate form fields from chat data
  - [ ] Allow seamless switch to form view
  - [ ] Maintain extracted data on tab switch

- [ ] Task 7: Implement Fallback (AC: #8)
  - [ ] Detect chatbot availability
  - [ ] Show fallback message if unavailable
  - [ ] Auto-switch to form mode on error
  - [ ] Add retry option

- [ ] Task 8: Add Translation Keys
  - [ ] Welcome message
  - [ ] Progress labels
  - [ ] Error messages
  - [ ] Fallback messages

## Dev Notes

### Anthropic Client Setup

```typescript
// src/lib/ai/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropic } from '@ai-sdk/anthropic'

// For Vercel AI SDK
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Direct client (if needed)
export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

### System Prompt

```typescript
// src/lib/ai/prompts.ts
export const QUOTE_ASSISTANT_SYSTEM_PROMPT = `You are a helpful quote assistant for Timber International, a premium oak panel and wood products supplier.

Your role is to help visitors request quotes by collecting the following information through natural conversation:

REQUIRED INFORMATION:
1. Contact name
2. Email address
3. Phone number
4. Company name
5. Quote type (stock products or custom production)
6. Product specifications (species, dimensions, quality grade)
7. Quantity needed
8. Delivery country/region

OPTIONAL INFORMATION:
- Project description
- Timeline/urgency
- Special requirements
- CNC machining needs

CONVERSATION GUIDELINES:
- Be warm, professional, and helpful
- Ask one question at a time
- Acknowledge and confirm information as you receive it
- If the user asks about products or pricing, provide helpful information
- For stock products, mention we have oak panels in various sizes and grades
- For custom production, explain we offer CNC machining, custom finishes, and made-to-order dimensions
- Prices are available in the catalog, quotes provide final pricing including delivery

AVAILABLE PRODUCTS:
- Oak panels (finger-jointed and full stave)
- Dimensions: various widths (200-1200mm), lengths (1000-4000mm), thicknesses (18-40mm)
- Quality grades: A, B, C
- Finishes: raw, sanded, oiled, lacquered
- FSC certified options available

When you have collected all required information, summarize what you've gathered and ask if they'd like to submit the quote.

IMPORTANT: Never make up specific prices. Say "You can see our stock prices in the catalog, and we'll provide final pricing in your quote."

When extracting information, format it clearly so it can be parsed:
[EXTRACTED: fieldName=value]`

export const PRODUCT_CONTEXT = `
Timber International produces premium oak panels at our vertically integrated facility.
We control the entire production chain from forest to finished product.
Our products include:
- Stock panels in standard sizes
- Custom production with specific dimensions
- CNC machining services
- Various finish options
Delivery to all European countries.
`
```

### Chat API Route

```typescript
// src/app/api/chat/route.ts
import { streamText } from 'ai'
import { anthropic } from '@/lib/ai/anthropic'
import { QUOTE_ASSISTANT_SYSTEM_PROMPT, PRODUCT_CONTEXT } from '@/lib/ai/prompts'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const result = streamText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      system: `${QUOTE_ASSISTANT_SYSTEM_PROMPT}\n\n${PRODUCT_CONTEXT}`,
      messages,
      maxTokens: 1024,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[Chat API Error]', error)
    return new Response(
      JSON.stringify({ error: 'Chat service unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
```

### ChatbotInterface Component

```tsx
// src/components/features/quote/ChatbotInterface.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'
import { Send, AlertCircle, Loader2 } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { extractQuoteData, QuoteFields } from '@/lib/ai/extractors'

interface ChatbotInterfaceProps {
  onDataExtracted: (data: Partial<QuoteFields>) => void
  onSwitchToForm: () => void
}

const REQUIRED_FIELDS = [
  'contactName',
  'email',
  'phone',
  'companyName',
  'quoteType',
  'products',
  'deliveryCountry',
]

export function ChatbotInterface({ onDataExtracted, onSwitchToForm }: ChatbotInterfaceProps) {
  const t = useTranslations('quote.chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set())
  const [isAvailable, setIsAvailable] = useState(true)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: t('welcome_message'),
      },
    ],
    onError: () => {
      setIsAvailable(false)
    },
    onFinish: (message) => {
      // Extract data from assistant responses
      const extracted = extractQuoteData(message.content)
      if (Object.keys(extracted).length > 0) {
        onDataExtracted(extracted)
        setExtractedFields(prev => {
          const updated = new Set(prev)
          Object.keys(extracted).forEach(key => updated.add(key))
          return updated
        })
      }
    },
  })

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Calculate progress
  const progress = (extractedFields.size / REQUIRED_FIELDS.length) * 100

  if (!isAvailable || error) {
    return (
      <div className="text-center py-8 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('unavailable_message')}</AlertDescription>
        </Alert>
        <Button onClick={onSwitchToForm}>{t('switch_to_form')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Progress Bar */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-stone-500">{t('progress_label')}</span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('typing')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={t('input_placeholder')}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <button
          type="button"
          onClick={onSwitchToForm}
          className="mt-2 text-sm text-forest-600 hover:underline"
        >
          {t('prefer_form')}
        </button>
      </div>
    </div>
  )
}
```

### ChatMessage Component

```tsx
// src/components/features/quote/ChatMessage.tsx
'use client'

import { cn } from '@/lib/utils'
import { User, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'

  // Remove extraction markers from display
  const displayContent = content.replace(/\[EXTRACTED:.*?\]/g, '').trim()

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-forest-500 text-white' : 'bg-stone-100 text-stone-600'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Bubble */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isUser
            ? 'bg-forest-500 text-white rounded-tr-sm'
            : 'bg-stone-100 text-charcoal rounded-tl-sm'
        )}
      >
        <ReactMarkdown
          className={cn(
            'prose prose-sm max-w-none',
            isUser && 'prose-invert'
          )}
        >
          {displayContent}
        </ReactMarkdown>
      </div>
    </div>
  )
}
```

### Data Extraction Logic

```typescript
// src/lib/ai/extractors.ts
export interface QuoteFields {
  contactName?: string
  email?: string
  phone?: string
  companyName?: string
  quoteType?: 'stock' | 'custom'
  products?: Array<{ description: string; quantity: number }>
  deliveryCountry?: string
  deliveryRegion?: string
  projectDescription?: string
  timeline?: string
  specialRequirements?: string
}

// Extract structured data from chat messages
export function extractQuoteData(content: string): Partial<QuoteFields> {
  const extracted: Partial<QuoteFields> = {}

  // Parse [EXTRACTED: field=value] markers
  const extractRegex = /\[EXTRACTED:\s*(\w+)=(.*?)\]/g
  let match

  while ((match = extractRegex.exec(content)) !== null) {
    const [, field, value] = match
    switch (field) {
      case 'contactName':
      case 'email':
      case 'phone':
      case 'companyName':
      case 'deliveryCountry':
      case 'deliveryRegion':
      case 'projectDescription':
      case 'timeline':
      case 'specialRequirements':
        extracted[field as keyof QuoteFields] = value.trim()
        break
      case 'quoteType':
        if (value.includes('stock') || value.includes('custom')) {
          extracted.quoteType = value.includes('stock') ? 'stock' : 'custom'
        }
        break
    }
  }

  return extracted
}

// Alternative: Use AI to extract fields from conversation history
export async function extractFieldsWithAI(
  messages: Array<{ role: string; content: string }>
): Promise<Partial<QuoteFields>> {
  // This would call the AI with a specific extraction prompt
  // For now, rely on the inline extraction markers
  return {}
}
```

### Translation Keys

```json
{
  "quote": {
    "chat": {
      "welcome_message": "Hello! I'm here to help you request a quote. I'll ask you a few questions to understand your needs. Let's start - what's your name and company?",
      "progress_label": "Quote completion",
      "typing": "Typing...",
      "input_placeholder": "Type your message...",
      "prefer_form": "Prefer to fill out a form instead?",
      "unavailable_message": "Our chat assistant is currently unavailable. Please use the form to submit your quote request.",
      "switch_to_form": "Switch to Form"
    }
  }
}
```

### Dependencies

```bash
npm install ai @ai-sdk/anthropic react-markdown
```

### Environment Variables

```env
# .env.local
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Architecture Compliance

| Pattern | Compliance |
|---------|------------|
| Vercel AI SDK | Used with Anthropic provider |
| Edge runtime | API route uses edge for streaming |
| Server Actions shape | N/A (streaming response) |
| Error handling | Graceful fallback to form mode |
| Session state | Chat history in useChat hook |

### Testing Considerations

- Test fallback behavior when API is unavailable
- Test data extraction from various message formats
- Test progress calculation accuracy
- Test seamless form sync on tab switch

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/epics.md#Epic-4-Story-4.4]
- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#AI-Chatbot]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#ChatbotInterface]
- [Source: _bmad-output/project-context.md#Technology-Stack]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
