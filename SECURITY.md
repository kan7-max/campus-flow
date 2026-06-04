# Security Policy

Campus Flow handles student assignment text, timetable data, OAuth sessions, and notification subscriptions. Do not publish real user data, production secrets, OAuth client secrets, Supabase service-role keys, web-push private keys, or raw assignment/PDF text in issues, pull requests, logs, screenshots, or fixtures.

## Supported Scope

Security reports should focus on the current `main` branch and production-facing code paths:

- Authentication and session handling
- Supabase RLS-sensitive access paths
- AI extraction and file upload flows
- Google Calendar OAuth and sync flows
- Notification dispatch and push subscription handling
- Admin and operations pages

## Reporting

Please report security issues privately to `campusflow.official@gmail.com`.

Include:

- A short description of the issue
- Affected route, file, or feature
- Reproduction steps using synthetic data
- Potential impact

Do not include real student data, production tokens, private logs, or third-party confidential data.

## Public Disclosure

Please do not open a public GitHub issue for suspected vulnerabilities until the issue has been triaged. Public issues are fine for general bugs and feature requests when they use synthetic data only.
