# Agent instructions for tilemap-io

Standing conventions for any agent (human-directed or autonomous) working in
this repo. Read this before making changes.

## Conventions

- **Keep game logic framework-free.** Anything that's a rule (grid bounds,
  legal moves, occupancy) belongs in a plain TypeScript module like
  `tilemap.ts` — no Phaser imports there. Phaser code (`main.ts` and future
  scene files) should only call into that logic and handle rendering/input.
  This is what makes the logic unit-testable without a browser/DOM.
- **Every new rule/behavior needs a test.** Add it to `*.test.ts` next to the
  module it tests. Run `npm test` before considering a change done.
- **Before finishing any change:** `npm test` and `npm run build` must both
  pass clean. Treat a failing build or test as blocking, not a nice-to-have.
- **Commit messages:** short imperative summary line (`Add diagonal move
  support`, not `Added` or `Adding`).

## Branch policy

- `main` is **protected**: no direct pushes, requires a pull request, and
  requires green CI. Nobody (human or agent) pushes to `main` directly.
- `dev` is the working integration branch. Agents branch feature work off
  `dev` (`git checkout -b feature/x dev`) and open PRs **against `dev`**,
  not `main`.
- PRs targeting `dev` auto-merge (squash) once CI AND `ai-review` both go
  green — see `.github/workflows/auto-merge.yml`. This is the safety-gate
  trade-off described below.
- PRs targeting `main` (i.e. promoting `dev` → `main`) do **not**
  auto-merge, even on green CI — those are reviewed and merged by a human
  only. This is the deliberate human checkpoint before anything ships to
  the protected branch.

## PRs auto-merge into dev on green CI + ai-review -- the real safety gate

Any PR opened against `dev` auto-merges (squash) once BOTH required status
checks pass: CI (`test-and-build`) and `ai-review` (an automated review
pass, webhook-triggered on PR open/update -- see `.github/workflows/`,
`check_workflow_auth.py`, and the Hermes cron job backing it). There is
**no human review step** in between. This means:

- **Do not rely on "someone will catch it in review."** If a test doesn't
  exist for a behavior, that behavior is NOT verified before it ships to
  main -- write the test. `ai-review` catches scope creep, secrets, and
  obviously broken code, but it is not a substitute for real test coverage.
- **Never weaken or skip a test to make CI pass.** That directly defeats the
  gate standing between a broken change and main.
- A failing/red CI or `ai-review` run simply never merges -- the PR sits
  open. That's the intended failure mode; don't force-merge around it.
- `ai-review`'s credential is deliberately narrower than everything else in
  this pipeline -- it can read PRs and post commit statuses, nothing else
  (verified merge-incapable and PR-comment-incapable). Don't "fix"
  review-token limitations by handing it broader scope -- that defeats the
  reason it's separate.
- Merge + changelog-push authority inside GitHub Actions lives in the
  **`tilemap-io-ci` GitHub App** (repo-scoped to just this repo, Contents +
  Pull requests write only), not a personal token -- `secrets.PERSONAL_GH_TOKEN`
  was retired once the App path was verified end-to-end (real merge
  succeeded, and critically the resulting push still triggered `deploy.yml`
  -- GitHub's GITHUB_TOKEN loop-prevention does not apply to third-party App
  installation tokens, confirmed empirically, not assumed from docs).
  `auto-merge.yml` and `changelog.yml` each mint a fresh ~1h installation
  token via `actions/create-github-app-token@v1` at the start of the job.
- Opening feature-branch PRs from local agent/cron work (outside Actions)
  uses a separate fine-grained PAT (`tilemap-io-agent-pr`, repo-scoped to
  just this repo, Contents + Pull requests write only, ~90 day expiry),
  exported as `GH_TOKEN` only for tilemap-io sessions -- never Henry's
  personal `gh` CLI login. Verified: it can open a real PR on this repo
  (succeeds) and cannot write to an unrelated repo (403), confirming the
  repo-scoping actually took effect rather than just displaying narrow in
  the UI (see `project-bootstrap`'s `references/known-gotchas.md` for why
  that distinction matters -- a prior token's displayed scope didn't match
  real behavior until regenerated).

## Testing changes to .github/workflows/ -- don't trust a read-through

**Incident (2026-10-19/20):** `auto-merge.yml` had a literal `***` string
hardcoded in 3 Authorization headers instead of referencing `$GH_TOKEN`.
Every automated merge silently 401'd for an unknown period -- every merge
that looked like it worked was actually a human manually merging via curl.
The bug was invisible on a read-through, and went undetected because GET
calls on this public repo don't need auth (so they kept "working" and
masked the one call that did need it). Nothing tested the workflow files
themselves; only application code had CI coverage.

Since then: `.github/workflows/lint-workflows.yml` runs `actionlint` +
`.github/scripts/check_workflow_auth.py` (a regression guard for this exact
bug class) on any change under `.github/workflows/**`. Still --

- **Any non-trivial change to `.github/workflows/` needs a real throwaway-PR
  test before being trusted**, not just "looks right on read." Workflow
  bugs are invisible until exercised; a clean diff review is not enough.
- **Separately confirmed:** this machine has a display-rendering bug where
  some tools (seen in both a terminal cat/grep and read_file) can show a
  MANGLED/COLLAPSED version of file content that is actually correct on
  disk -- e.g. a real regex alternation rendering back as incomplete. This
  already caused one false "the code is broken" conclusion (by both a human
  session and an `ai-review` run) on code that was correct all along. If you
  suspect a bug in any script, **run it and observe real output/exit code**
  before concluding it's broken -- never conclude "broken" from a text read
  alone on this machine.

## Traceability

- **Every PR uses `.github/PULL_REQUEST_TEMPLATE.md`**, which has a
  "Hermes session ID" field. If you're an AI agent (subagent, delegated
  task, local model), fill it in with `echo $HERMES_SESSION_ID` before
  opening the PR — this is what lets anyone trace a shipped change back to
  the full reasoning/tool-call transcript that produced it, not just the
  diff.
- **`CHANGELOG.md` is auto-generated** on every `dev` → `main` promotion PR
  (`.github/workflows/changelog.yml`) — don't hand-edit it; it's derived
  from commit messages, which is another reason commit messages need to be
  real sentences describing the actual change, not "wip" or "fix".

## Deployment

- `dev` pushes deploy to the **preview** environment, `main` pushes deploy
  to **production** — see `.github/workflows/deploy.yml`.
- Infra: S3 (private, OAC-gated — never public) + CloudFront, in AWS account
  803872155074, region us-west-2. Auth is GitHub OIDC → a scoped IAM role
  (`tilemap-io-github-deploy`) — no long-lived AWS keys anywhere.
- **GOTCHA (burned real time once, don't repeat it):** this GitHub org's
  OIDC subject claim format is NOT the usual `repo:OWNER/REPO:ref:refs/heads/BRANCH`.
  It's `repo:OWNER@USER_ID/REPO@REPO_ID:ref:refs/heads/BRANCH` (confirmed via
  CloudTrail `userIdentity.principalId` on a rejected AssumeRoleWithWebIdentity
  call — GitHub's own generic docs don't mention this variant). If you ever
  need to touch the IAM role's trust policy again, verify the REAL subject
  via CloudTrail rather than assuming the standard format — a `StringLike`
  wildcard on the wrong format fails silently with a generic "Not authorized"
  error that gives no hint the pattern itself is wrong.
- Also learned here: `auto-merge.yml` and `changelog.yml` MUST merge/push
  using a personal token (`secrets.PERSONAL_GH_TOKEN`), never
  `secrets.GITHUB_TOKEN` — GitHub's loop-prevention means GITHUB_TOKEN-authored
  pushes never trigger downstream `push`-triggered workflows (like this
  deploy workflow), which fails *silently* (no error anywhere, it just never
  runs) and is easy to miss without actively checking for the expected run.

## Known state (update this section as the project evolves)

- Board is a fixed 8x8 grid, pieces move one orthogonal or diagonal tile at a
  time to an empty tile only (no captures, no multi-tile moves yet).
- CI (test + build) + `ai-review` run on every push/PR; both green auto-merges the PR.
- Deployed: preview (dev) at https://d23r2fvbfqt1xo.cloudfront.net/,
  production (main) deploys to its own CloudFront URL once promoted.
- No game rules beyond movement — this is a substrate, not a finished game.
