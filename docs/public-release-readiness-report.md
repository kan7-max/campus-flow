# Public Release Readiness Report

Status date: 2026-06-04

This report tracks whether Campus Flow is ready to be published as a clean public GitHub repository for the OpenAI Codex for Open Source application.

Published public repository URL:

```text
https://github.com/kan7-max/campus-flow
```

## Official Requirement Mapping

OpenAI's current form asks for:

- Public GitHub username/profile.
- Public GitHub repository URL.
- Applicant role as primary or core maintainer.
- A short reason the repository qualifies, such as usage, ecosystem importance, or maintenance burden.
- Interest in Codex Security and/or API credits.
- OpenAI Organization ID.
- A short explanation of API credit usage.

OpenAI's Program Terms also require accurate application information, repository affiliation or control, and no confidential information in the submission.

## Current Repository Decision

Do not make the existing private repository public.

Reason: old Git history contains local demo state files. The safe path is a new public repository created from a history-free export of the current sanitized `HEAD`.

## Public Export Evidence

The clean public export is generated with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-public-release-export.ps1
```

The export gate is verified with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-public-release-export.ps1
```

Before publishing, record the exact source commit with:

```bash
git rev-parse --short HEAD
```

After generating the clean export, confirm the export history contains a single commit:

```bash
git log --oneline --all
```

## Verified Gates

- Clean export history contains one initial public commit.
- Export worktree is clean after generation.
- No tracked `.env`, `.env.local`, `.vercel`, `.taskflow-demo-store*`, local agent notes, local data folders, or local verification artifacts were found in the export.
- Secret scan for OpenAI keys, GitHub tokens, Supabase service-role values, Google client secret values, web-push private key values, cron secret values, local Windows user paths, and non-empty Obsidian vault paths returned no matches.
- `npm ci --ignore-scripts` passed.
- `npm run check` passed.
- `npm audit --audit-level=moderate` passed with zero vulnerabilities.

## OSS Maintenance Files Present

- `LICENSE`
- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/dependabot.yml`
- `docs/public-repository-safety-checklist.md`
- `docs/openai-codex-oss-application-draft.md`
- `scripts/create-public-release-export.ps1`
- `scripts/verify-public-release-export.ps1`

## Remaining External Steps

These steps change external/public state and should only be done after explicit maintainer confirmation. Repository creation and initial publication have been completed for `kan7-max/campus-flow`.

1. Confirm the GitHub profile is public.
2. Enable GitHub secret scanning and Dependabot alerts for the public repository.
3. Set branch protection so checks are required before merging.
4. Fill the OpenAI form using the clean public repository URL and the OpenAI Organization ID.
