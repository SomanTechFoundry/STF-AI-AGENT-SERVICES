# Architecture — STF AI Agent Services Platform

## Overview

The STF AI Agent Services Platform is a **multi-tenant, modular monolith** built on Next.js.

It is designed for a solo founder to operate AI-powered customer-facing agents for multiple local-business clients simultaneously, with low operating cost, strong security, and minimal infrastructure complexity.

## Guiding Principles

1. **Multi-tenancy by design** — every data record is associated with a `businessId`. Client A's data is completely isolated from Client B's.
2. **Configuration over code** — adding a new client requires data entry, not code deployment.
3. **Modular monolith** — one deployable application with clean internal module boundaries. No microservices until scale demands it.
4. **AI provider abstraction** — the application talks to a common interface, not directly to any AI SDK.
5. **Tool-based agent** — the AI calls approved, validated tools. It never directly touches the database.
6. **Defense in depth** — validation at every layer (API, service, tool, database).
7. **Structured observability** — every request is traceable to a client, customer, and action.

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Application                       │
│                                                                  │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ App Router │  │ API Routes   │  │   Admin Dashboard (P6)   │ │
│  │  (pages)  │  │  /api/*      │  │   /dashboard/*           │ │
│  └───────────┘  └──────────────┘  └──────────────────────────┘ │
│                        │                                         │
│  ┌─────────────────────▼────────────────────────────────────┐  │
│  │                    Service Layer                           │  │
│  │  BusinessService | CustomerService | AppointmentService   │  │
│  │  ConversationService | NotificationService                │  │
│  └─────────────────────┬──────────────────────────────────  ┘  │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │                   Agent Core (Phase 3)                   │   │
│  │                                                          │   │
│  │   ┌──────────┐   ┌──────────────┐   ┌──────────────┐   │   │
│  │   │ AI       │   │ Tool         │   │ Conversation │   │   │
│  │   │ Service  │   │ Framework    │   │ State        │   │   │
│  │   └────┬─────┘   └──────┬───────┘   └──────────────┘   │   │
│  │        │                │                                │   │
│  │   ┌────▼─────┐   ┌──────▼───────────────────────────┐  │   │
│  │   │ Gemini   │   │ Tools:                            │  │   │
│  │   │ OpenAI   │   │ getBusinessInfo, getServices,     │  │   │
│  │   │ Anthropic│   │ checkAvailability, createAppt,    │  │   │
│  │   └──────────┘   │ cancelAppt, handoffToHuman, etc.  │  │   │
│  │                  └──────────────────────────────────  ┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Integration Layer                        │   │
│  │  Google Calendar | Twilio | Resend | Square (future)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Cross-Cutting Concerns                      │   │
│  │   Logger | Errors | Config | Auth | UsageTracking        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Neon PostgreSQL      │
              │  (Prisma ORM)         │
              └───────────────────────┘
```

## Data Flow — Customer Booking Conversation

```
Customer (SMS/Chat)
       │
       ▼
  Webhook/API endpoint
       │
       ▼
  ConversationService
  (load/create conversation, apply businessId)
       │
       ▼
  Agent Core
  ├── Load business configuration
  ├── Load AI configuration
  ├── Load conversation history
  ├── Build system prompt (includes business info, services, FAQs)
  └── Call AI provider
           │
           ▼
      AI Provider (Gemini)
      ├── Understands customer intent
      ├── Decides to call a tool (e.g. checkAvailability)
      └── Returns tool call request
           │
           ▼
      Tool Framework
      ├── Validate tool inputs
      ├── Enforce businessId isolation
      ├── Call service layer
      └── Return structured result
           │
           ▼
      Service Layer
      ├── AppointmentService.checkAvailability(businessId, ...)
      └── Returns available slots
           │
           ▼
      AI Provider (Gemini)
      ├── Receives tool result
      └── Generates customer-facing response
           │
           ▼
  Response sent to customer
  Conversation state updated
  Usage recorded
```

## Multi-Tenancy Design

Every service method accepts `businessId` as its first parameter:

```typescript
// CORRECT: business-scoped query
async getServices(businessId: string): Promise<Service[]> {
  return prisma.service.findMany({ where: { businessId, isActive: true } });
}

// NEVER: unscoped query
async getServices(): Promise<Service[]> {
  return prisma.service.findMany(); // ❌ Returns all clients' services
}
```

The `TenantIsolationError` is thrown when a cross-tenant access attempt is detected.

## AI Provider Abstraction

```
Application code
      │
      ▼
AIService (factory + common interface)
      │
      ├── GeminiProvider   implements AIProvider
      ├── OpenAIProvider   implements AIProvider
      └── AnthropicProvider implements AIProvider
```

`AIProvider` interface defines:
- `complete(request: AICompletionRequest): Promise<AICompletionResponse>`
- `healthCheck(): Promise<boolean>`

All provider-specific SDK calls are isolated inside their respective provider class.

## Agent Tool Architecture

```
AI decides to call: checkAvailability({ date: "2024-01-15", service: "Women's Haircut" })
                    │
                    ▼
             Tool Framework
             ├── Validate inputs with Zod schema
             ├── Inject businessId from conversation context
             ├── Call AppointmentService.checkAvailability()
             ├── Handle errors gracefully
             └── Return structured result to AI
```

Tools are pure functions with explicit input validation. They never expose raw database errors to the AI or customer.

## Error Handling Strategy

```
External service failure
          │
          ▼
   ExternalServiceError (typed, with service name)
          │
          ▼
   errorResponse() helper
   ├── Logs full details (with correlation ID)
   └── Returns safe JSON to client:
       { error: { code: "SMS_ERROR", message: "Unable to send confirmation" } }
```

Customer-facing error messages are always generic. Internal details are logged only.

## Database Schema Summary

See `docs/DATABASE.md` for the full schema reference.

Key entities:

| Entity | Purpose |
|---|---|
| `Business` | Tenant root — every record traces here |
| `User` | Dashboard/admin users (business owners, staff) |
| `Customer` | End-users who interact with the AI agent |
| `Staff` | Stylists/technicians who perform services |
| `Service` | What the business offers (with pricing/duration) |
| `BusinessHours` | Weekly schedule per business |
| `Appointment` | Booking records |
| `Conversation` | A customer interaction session |
| `Message` | Individual turns within a conversation |
| `AIConfiguration` | Per-business AI agent settings |
| `KnowledgeItem` | FAQs and policies for the AI |
| `Integration` | External service credentials per business |
| `UsageRecord` | AI/API usage for cost allocation |
| `AuditLog` | Immutable record of significant actions |

## Deployment Architecture

```
GitHub → Vercel (Next.js)
              │
              └── Neon PostgreSQL (serverless Postgres)
              └── Sentry (error monitoring)
              └── Twilio (SMS/voice webhooks)
              └── Google Calendar API
              └── Resend (transactional email)
```

Vercel handles:
- Automatic deployments on git push
- Preview environments per branch
- Edge network / CDN
- Serverless function scaling

## Security Architecture

1. **Secrets** — All in environment variables, never in code or git
2. **API Authentication** — Phase 2 will add JWT/session-based auth for dashboard
3. **Tenant Isolation** — Enforced at service layer, not just ORM
4. **Input Validation** — Zod schemas at every API entry point
5. **Tool Validation** — Each AI tool validates its own inputs
6. **Rate Limiting** — Applied to agent endpoints (Phase 2)
7. **Audit Logging** — All significant actions recorded with actor, resource, and metadata
8. **Error Exposure** — Internal details never sent to clients

## Scaling Path

Current design supports 10-50 clients on Vercel's free/hobby tier + Neon's free tier.

When scale demands:
1. Upgrade Neon to a paid plan (connection pooling, more compute)
2. Upgrade Vercel to a paid plan (more function execution)
3. Add a job queue (e.g. Inngest) for async operations
4. Add caching (Vercel KV) for frequently-read business config

Kubernetes, Redis, Kafka, and microservices are **not needed** for the first 50 clients.
