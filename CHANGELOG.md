# Changelog

## 2026-10-19 — PR #10: Promote dev to main: live game URL in Discord deploy notifications

- Include live game URL in Discord deploy notifications (#9) (e7b299c)
- docs: update CHANGELOG.md for PR #8 (917d3a6)
- Document AWS deployment setup, OIDC gotcha, and token-type lesson in AGENTS.md (cef3c46)
- test: verify deploy triggers correctly after auto-merge fix (#7) (28e91e7)
- Fix auto-merge: use personal token so post-merge push events actually trigger (deploy was silently never firing) (#6) (10748e5)
- Add automated deploy to AWS S3+CloudFront (prod on main, preview on dev) (#5) (6ae9c9d)


## 2026-10-18 — PR #8: Promote dev to main: Discord notifications + automated AWS deploy

- Document AWS deployment setup, OIDC gotcha, and token-type lesson in AGENTS.md (cef3c46)
- test: verify deploy triggers correctly after auto-merge fix (#7) (28e91e7)
- Fix auto-merge: use personal token so post-merge push events actually trigger (deploy was silently never firing) (#6) (10748e5)
- Add automated deploy to AWS S3+CloudFront (prod on main, preview on dev) (#5) (6ae9c9d)


## 2026-10-18 — PR #4: Promote dev to main: Discord notifications

- Add Discord notifications: PR opened, CI failure, merge failure (#3) (29bd48d)


## 2026-10-18 — PR #2: Add changelog automation + PR session traceability

- Add CHANGELOG automation, PR template with session traceability (537d79c)


All notable changes to this project are logged here, newest first. Entries
are generated automatically when a `dev` → `main` promotion PR is opened
(see `.github/workflows/changelog.yml`) — one entry per promotion, listing
the individual commits that shipped.

Format per entry: `## YYYY-MM-DD — PR #N: <promotion PR title>` followed by
the list of commits included.
