# Database Schema Reference

## Overview

PostgreSQL via Neon. ORM: Prisma.

Every table that belongs to a business carries a `businessId` foreign key.
This is the foundation of multi-tenancy — no query should ever omit this filter.

## Tables

### `businesses` — Tenant Root

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String | Business display name |
| slug | String | Unique URL-friendly identifier |
| industry | Enum | SALON, AUTO_REPAIR, CLEANING, etc. |
| status | Enum | ACTIVE, TRIAL, SUSPENDED, CANCELLED |
| email, phone, website | String? | Contact info |
| address, city, state, postalCode | String? | Location |
| timezone | String | IANA timezone, e.g. "America/Chicago" |
| bookingLeadTimeMinutes | Int | Min notice before booking |
| bookingMaxDaysAhead | Int | How far ahead customers can book |
| cancellationPolicyHours | Int | Hours notice required to cancel |
| stripeCustomerId | String? | For platform billing |

### `users` — Dashboard Users

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| businessId | String | FK → businesses (CASCADE DELETE) |
| email | String | Unique per business |
| role | Enum | SUPER_ADMIN, BUSINESS_OWNER, STAFF |
| passwordHash | String? | Null if OAuth |

Unique: `(businessId, email)`

### `customers` — End-Users

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| businessId | String | FK → businesses |
| name | String? | May be collected progressively |
| phone | String? | E.164 format, unique per business |
| email | String? | Unique per business |
| smsOptIn | Boolean | TCPA compliance |

Unique: `(businessId, phone)`, `(businessId, email)`

### `staff` — Service Providers

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| businessId | String | FK → businesses |
| name, email, title | String | Profile |
| isActive | Boolean | Soft delete |
| acceptsBookings | Boolean | Can be scheduled |

### `services` — What the Business Offers

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| businessId | String | FK → businesses |
| name | String | Display name |
| durationMinutes | Int | Length of appointment |
| price | Decimal(10,2) | Price in configured currency |
| category | String? | Grouping (e.g. "Hair", "Color") |
| bufferMinutes | Int | Cleanup time after appointment |

### `staff_services` — Join Table

| Column | Type |
|---|---|
| staffId | FK → staff |
| serviceId | FK → services |

PK: `(staffId, serviceId)`

### `business_hours` — Weekly Schedule

| Column | Type | Notes |
|---|---|---|
| businessId | FK | |
| dayOfWeek | Enum | MONDAY…SUNDAY |
| isOpen | Boolean | |
| openTime | String | "09:00" (24h) |
| closeTime | String | "18:00" (24h) |

Unique: `(businessId, dayOfWeek)`

### `appointments` — Bookings

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| businessId | String | FK |
| customerId | String | FK |
| serviceId | String | FK |
| staffId | String? | FK (optional) |
| conversationId | String? | Link to creating conversation |
| status | Enum | PENDING, CONFIRMED, CANCELLED, etc. |
| startTime | DateTime | UTC |
| endTime | DateTime | UTC |
| timezone | String | Customer's timezone at booking time |
| price | Decimal | Captured at booking time |
| googleCalendarEventId | String? | Unique — for calendar sync |
| idempotencyKey | String? | Unique — prevents duplicate bookings |
| reminderSentAt | DateTime? | |
| cancellationReason | String? | |

### `conversations` — Interaction Sessions

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| businessId | String | FK |
| customerId | String? | Null until customer identified |
| channel | Enum | WEBCHAT, SMS, VOICE, EMAIL |
| status | Enum | ACTIVE, RESOLVED, ESCALATED |
| channelIdentifier | String? | Phone number or chat token |
| agentState | Json | Structured booking state |
| summary | String? | AI-generated summary on close |

### `messages` — Conversation Turns

| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| conversationId | String | FK → conversations |
| role | Enum | CUSTOMER, AGENT, SYSTEM, HUMAN_AGENT |
| content | String (Text) | Message content |
| aiProvider | String? | Which provider generated this |
| aiModel | String? | Which model |
| inputTokens | Int? | For usage tracking |
| outputTokens | Int? | For usage tracking |
| toolCalls | Json? | Array of tool calls made |
| toolResults | Json? | Array of tool results |
| durationMs | Int? | Latency |

### `ai_configurations` — Per-Business AI Settings

| Column | Type | Notes |
|---|---|---|
| businessId | String | Unique FK → businesses |
| agentName | String | e.g. "Sunny" |
| agentPersonality | String? | Personality description |
| systemPromptOverride | String? | Full system prompt override |
| aiProvider | String | Default: "gemini" |
| aiModel | String | Default: "gemini-1.5-flash" |
| humanHandoffEnabled | Boolean | |
| humanHandoffPhone | String? | Escalation contact |
| welcomeMessage | String? | First message to customer |

### `knowledge_items` — FAQs and Policies

| Column | Type | Notes |
|---|---|---|
| businessId | String | FK |
| category | String | "faq", "policy", "service_info" |
| question | String | |
| answer | String | |
| isActive | Boolean | |
| priority | Int | Lower = injected first into context |

### `integrations` — External Service Config

| Column | Type | Notes |
|---|---|---|
| businessId | String | FK |
| type | Enum | GOOGLE_CALENDAR, SQUARE, TWILIO, etc. |
| isEnabled | Boolean | |
| configJson | Json | Encrypted credentials |

Unique: `(businessId, type)`

### `usage_records` — Cost Tracking

| Column | Type | Notes |
|---|---|---|
| businessId | String | FK |
| usageType | String | "ai_request", "sms", "voice_minute" |
| quantity | Int | |
| aiProvider, aiModel | String? | |
| inputTokens, outputTokens | Int? | |
| estimatedCostCents | Int? | USD cents |
| conversationId | String? | |
| appointmentId | String? | |

### `audit_logs` — Immutable Action Log

| Column | Type | Notes |
|---|---|---|
| businessId | String | FK |
| actorType | String | "user", "agent", "system" |
| actorId | String? | userId or "agent" |
| action | String | "appointment.created" |
| resourceType | String? | "appointment" |
| resourceId | String? | appointmentId |
| metadata | Json | Safe snapshot of change |
| requestId | String? | For correlation |
| ipAddress | String? | |

## Index Strategy

Key indexes for expected query patterns:

- `appointments(businessId, startTime)` — availability checking
- `appointments(staffId, startTime)` — staff schedule lookup
- `conversations(businessId, channelIdentifier)` — finding active SMS conversations
- `knowledge_items(businessId, isActive)` — loading FAQ context
- `usage_records(businessId, recordedAt)` — billing summaries

## Data Retention Notes

- `audit_logs` — never deleted, retained for compliance
- `messages` — retained for 2 years (configurable)
- `usage_records` — retained for 2 years (billing purposes)
- `appointments` — soft status changes (CANCELLED), never hard-deleted
