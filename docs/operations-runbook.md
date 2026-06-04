# Campus TaskFlow Operations Runbook

## Daily Checklist
1. Vercel:
   - New runtime errors, failed requests, cron execution health.
2. Core product health:
   - AI extraction requests/success/failure trend.
   - Assignment save count and major error spikes.
   - `/today` usage baseline.
3. Sync and notifications:
   - Google sync failure count.
   - Notification queue stuck/failed ratio.
4. Support:
   - New inquiries and urgent user-blocking reports.

## Weekly Checklist
1. User trend:
   - Registered users, login users, active users.
2. Experience quality:
   - AI extraction failure ratio.
   - Save latency and action response latency.
3. Funnel checks:
   - `/ai` input -> preview -> save completion rate.
4. Incident review:
   - Top recurring errors and mitigations.

## Monthly Checklist
1. Cost review:
   - OpenAI usage and cost trend.
   - Supabase usage trend.
   - Vercel usage trend.
2. Product direction:
   - AI-saved assignments share vs manual share.
   - Repeated failure classes (PDF/long text/sync).
3. Monetization readiness:
   - Credits usage distribution.
   - High-frequency user segment size.

## Incident Playbooks

### A) Inquiry Received
1. Confirm impacted user/session and timestamp.
2. Check Vercel logs around the same time.
3. Check related data rows in Supabase (`assignments`, `inbox_items`, `sync_outbox`).
4. Respond with impact scope + workaround + ETA.

### B) Error Spike
1. Confirm if deploy changed recently.
2. Check Vercel function logs and grouped stack traces.
3. If auth-related, check callback URL/redirect consistency and cookie issuance.
4. Roll back deploy if severe and widespread.

### C) AI Extraction Failure Increase
1. Check OpenAI API status, quota, error code mix.
2. Confirm `OPENAI_API_KEY`/model env in Vercel.
3. Sample failed inputs (without exposing personal content externally).
4. Validate parser fallback still returns actionable message and preserves input.

### D) Calendar Sync Failure Increase
1. Check `sync_outbox` failed reasons.
2. Confirm Google token validity and refresh behavior.
3. Confirm OAuth redirect URIs and env consistency.
4. Retry queue after fixing root cause.

### E) Cost Spike
1. OpenAI:
   - requests/tokens by feature and day.
2. Supabase:
   - DB/storage/egress spikes.
3. Vercel:
   - function invocation spikes and hot paths.
4. Apply temporary limits if needed (AI feature gating, stricter input size caps).

## Data Deletion Request Checklist
1. Verify requester identity.
2. Record request date and requested scope.
3. Identify user-linked records (auth + app tables).
4. Execute deletion according to policy.
5. Record completion date and notify requester.

## Non-Negotiable Product Rule
- External integration failures (AI/Calendar/notifications) must not be treated as assignment-save failure.
- Assignment save remains primary and must succeed whenever possible.
