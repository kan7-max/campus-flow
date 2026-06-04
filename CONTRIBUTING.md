# Contributing

Campus Flow is a student assignment and timetable management app. Contributions should preserve the core invariant: assignment saving must remain reliable even when AI extraction, calendar sync, notifications, or external services fail.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Keep `TASKFLOW_DEMO_MODE=1` for local work unless you intentionally connect your own Supabase project.
4. Run `npm run dev`.

## Privacy Rules

- Use synthetic assignment text, synthetic course names, and synthetic users in tests and screenshots.
- Do not commit `.env.local`, `.vercel`, `.taskflow-demo-store*.json`, `data/`, `content/`, local logs, or generated QA folders.
- Do not paste real user submissions, school LMS content, OAuth tokens, Supabase service-role keys, OpenAI keys, or web-push private keys into issues or pull requests.
- Redact email addresses unless they are public project contact addresses.

## Pull Requests

Before opening a PR, run:

```bash
npm run lint
npm run typecheck
npm run check
```

For UI work, include the affected route and whether mobile widths were checked. For security-sensitive work, describe the threat model and the data that should remain private.
