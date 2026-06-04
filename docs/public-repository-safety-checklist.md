# Public Repository Safety Checklist

Use this before changing the GitHub repository visibility to public.

## OpenAI Codex for Open Source Form Readiness

- GitHub profile visibility is public.
- Repository visibility is public.
- The applicant is a primary or core maintainer.
- The repository has an open-source license.
- The repository shows active maintenance through issues, pull requests, checks, release notes, or maintenance docs.
- The application can explain why the project matters and how Codex/API credits will support maintainer work.
- OpenAI Organization ID is ready for the form.

## Privacy and Security Gate

- `.env.local`, `.env`, `.vercel`, and production service settings are not tracked.
- Supabase service-role keys, Google client secrets, OpenAI keys, web-push private keys, GitHub tokens, and cron secrets are not present in tracked files.
- Local demo state files such as `.taskflow-demo-store*.json` are not tracked.
- Generated local data folders such as `data/`, `content/`, `.tmp-*`, `.next*`, `.codegraph/`, and local QA outputs are ignored.
- Issues, docs, screenshots, and fixtures use synthetic student/course data only.
- Public contact email is intentional and does not expose a private address.
- Production Supabase migrations and external service settings are not changed as part of publication.

## Recommended Commands

```bash
git status --short
git grep -n -E "([s]k-[A-Za-z0-9_-]{20,}|[g]hp_[A-Za-z0-9_]{20,}|[g]ithub_pat_[A-Za-z0-9_]{20,}|[S]UPABASE_SERVICE_ROLE_KEY=[^[:space:]]+|[G]OOGLE_CLIENT_SECRET=[^[:space:]]+|[O]PENAI_API_KEY=[^[:space:]]+|[W]EB_PUSH_PRIVATE_KEY=[^[:space:]]+|[C]RON_SECRET=[^[:space:]]+)" -- . ':!package-lock.json'
npm run lint
npm run typecheck
npm run check
npm audit --audit-level=moderate
```

## Clean Public Export

Do not make the existing private repository public if old Git history contains local state files. Create a history-free export instead:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-public-release-export.ps1
powershell -ExecutionPolicy Bypass -File scripts/verify-public-release-export.ps1
```

Then create a new empty public GitHub repository and push from the generated export directory:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

## Manual GitHub Checks

- Confirm repository description and topics are accurate.
- Confirm Actions permissions are appropriate for a public repository.
- Confirm branch protection requires `Check` before merging.
- Confirm GitHub secret scanning and Dependabot alerts are enabled.
- Confirm no old public branches contain private files before making them visible.
