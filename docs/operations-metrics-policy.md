# Campus TaskFlow Operations Metrics Policy

## Scope
- This document defines **what to monitor** for Campus TaskFlow operations.
- GO / No-Go and release-gate procedures are handled in separate documents and are out of scope here.

## Priority Tiers

### Tier 1: Monitor From Day 1
1. Registered users
2. Login users (daily)
3. Active users (DAU / WAU)
4. AI extraction count
5. AI extraction success / failure
6. Assignment saves (total)
7. Assignment saves from AI (vs manual)
8. `/today` page usage
9. Google Calendar sync failures
10. Application error count
11. Inquiry count

### Tier 2: Monitor After User Growth
1. Retention (D1 / D7 / D30)
2. AI extraction latency (p50 / p95)
3. Save latency (p50 / p95)
4. Notification queue backlog / failure ratio
5. Push subscription rate
6. Drop-off points in AI flow (`/ai` -> preview -> save)
7. Data deletion / account deletion requests

### Tier 3: Monitor for Monetization / Partnerships
1. AI usage per active user (credits / month)
2. Power-user segment (high weekly completion)
3. Feature adoption by cohort
4. Conversion candidates (free -> paid)
5. Cost per active user (OpenAI + infra)
6. Revenue readiness KPIs (if paid plans start)

## Core Metrics Definitions

| Metric | Definition | Primary Source |
|---|---|---|
| Registered users | Total unique accounts | Supabase Auth |
| Login users | Unique users who logged in by day/week | Supabase Auth + app events |
| Active users | Unique users with key actions (`/today`, save, AI) | PostHog candidate / server logs |
| AI extraction count | Number of extraction requests | `ai_extraction_logs` |
| AI extraction success/failure | Success/failure of extraction pipeline | `ai_extraction_logs` + app error logs |
| Assignment saves | Total saved assignments | `assignments` |
| Manual vs AI saves | Split by save source | `assignments` + source flags |
| `/today` usage | Page visits / unique users | PostHog candidate / server logs |
| Calendar sync success/failure | Outbox dispatch results | `sync_outbox` |
| Error count | Server/client runtime exceptions | Sentry candidate + Vercel logs |
| Inquiry count | Number of support requests | Spreadsheet + Resend inbox |
| Deletion requests | Account/data deletion requests | Spreadsheet + support log |
| OpenAI usage | Tokens / requests / cost | OpenAI dashboard + `ai_usage_logs` |
| Supabase usage | DB usage, auth usage, storage, egress | Supabase project dashboard |
| Vercel usage | Function invocations, bandwidth, build/runtime errors | Vercel dashboard |

## Tool Ownership (What to Check Where)

- Supabase:
  - User counts, assignments, AI logs, sync outbox, RLS-sensitive tables.
- Vercel:
  - Deploy status, runtime failures, function errors, cron execution.
- Sentry (candidate):
  - Production exception grouping and trend monitoring.
- PostHog (candidate):
  - Funnel and behavioral analysis with strict data minimization.
- Resend (candidate):
  - Operations emails / inquiry responses.
- Stripe (future):
  - Billing and subscription metrics (not enabled in MVP).
- Spreadsheet:
  - Early-stage inquiry ledger, incident notes, weekly ops review.

## Privacy and Data Safety Rules

1. Do not send assignment body/raw text/class notes/PDF extracted text to analytics events.
2. Do not include API keys, tokens, or user secrets in Sentry breadcrumbs or error payloads.
3. Do not send raw user content to PostHog.
4. Use minimal fields for operational counting (IDs, status, timestamp).
5. Support logs should avoid unnecessary personal data.
6. Data deletion requests must be tracked with request date, requester identity check, completion date.

## Explicitly Out of Scope in This Pass
- Admin dashboard implementation
- Schema migration for analytics
- Stripe checkout/webhooks
- Resend sending API
- Sentry/PostHog production SDK integration
