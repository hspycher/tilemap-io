# Changelog

## 2026-10-18 — PR #2: Add changelog automation + PR session traceability

- Add CHANGELOG automation, PR template with session traceability (537d79c)


All notable changes to this project are logged here, newest first. Entries
are generated automatically when a `dev` → `main` promotion PR is opened
(see `.github/workflows/changelog.yml`) — one entry per promotion, listing
the individual commits that shipped.

Format per entry: `## YYYY-MM-DD — PR #N: <promotion PR title>` followed by
the list of commits included.
