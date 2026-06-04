# OpenAI Codex for Open Source Application Draft

Official form: https://openai.com/form/codex-for-oss/

## Current Readiness

- Official OpenAI form and Program Terms reviewed on 2026-06-04.
- Repository code is prepared for public review from the current sanitized `HEAD`.
- The current `HEAD` no longer tracks local demo state files or local verification artifacts.
- A repository license, security policy, contribution guide, Dependabot config, and public safety checklist are present.
- A clean history-free public export workflow is available via `scripts/create-public-release-export.ps1`.
- Do not make the existing GitHub repository public, because earlier commits include local demo state files.

## Form Fields To Prepare

- GitHub username: set profile visibility to public.
- GitHub repository URL: use the final clean public repository URL created from the public export.
- Role: primary maintainer.
- OpenAI Organization ID: get from the OpenAI dashboard.
- Interest: Codex Security and API credits for the project, if both are relevant.

## Why This Repository Qualifies

Campus Flow is an active open-source student productivity app that turns LMS text, PDFs, timetable images, and manual notes into structured assignments, schedules, notifications, and study workflows. It demonstrates maintainer-heavy areas: AI extraction quality, privacy-safe file handling, mobile UX, Supabase/RLS operations, release gates, and issue-to-Codex automation.

## API Credit Usage

API credits would be used for core OSS maintenance: AI extraction evaluation, regression replay, pull request review support, issue triage, release checklist automation, and privacy/security review of student-data handling flows. Credits would not be used for production user data outside the app's documented privacy boundaries.

## Official Requirement Mapping

- Public GitHub profile: must be confirmed by the applicant in GitHub settings.
- Public repository URL: pending creation from the clean export.
- Maintainer role: applicant should select `Primary maintainer` if they own and administer the repository.
- Qualification evidence: explain active development, student-productivity domain importance, privacy/security-sensitive data handling, and Codex-supported maintainer workflows.
- OpenAI Organization ID: must be copied from the applicant's OpenAI dashboard.
- Confidentiality: do not submit private student data, secrets, customer data, or non-public company information in the form.

## Safe Publication Recommendation

Create a new public GitHub repository from the current sanitized `HEAD` using the clean export script. Rewriting the existing repository history is higher risk and unnecessary for the OpenAI application.
