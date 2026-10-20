# Production rollback runbook

How to roll back a bad deploy on `tilemap-io`. This exists because, before
this doc, there was no documented procedure at all — only the forward deploy
path (`.github/workflows/deploy.yml`) was written down.

## 1. Mechanics recap (what a deploy actually does)

Every push to `main` or `dev` runs `.github/workflows/deploy.yml`:

1. `npm ci && npm test && npm run build`
2. Assumes `tilemap-io-github-deploy` via GitHub OIDC (no stored AWS keys)
3. `aws s3 sync dist/ s3://<bucket> --delete` — **this is destructive**: any
   object not in the new `dist/` is deleted from the bucket, not versioned
   into history by default (see the versioning gap in §3).
4. `aws cloudfront create-invalidation --distribution-id <dist> --paths "/*"`
5. Posts a Discord notification either way (success or failure)

Environments (confirmed live via AWS CLI 2026-10-20, not just read off the
workflow file):

| | `main` → production | `dev` → preview |
|---|---|---|
| S3 bucket | `tilemap-io-prod-803872155074` | `tilemap-io-preview-803872155074` |
| CloudFront distribution | `E2B1T2HWD9AMCG` | `E1VBGKH9AEI6XE` |
| Live URL | https://d3qyytktu2cbue.cloudfront.net | https://d23r2fvbfqt1xo.cloudfront.net |
| AWS account / region | 803872155074 / us-west-2 | same |

This doc focuses on **production** (`main`); the same mechanics apply to
preview with the preview bucket/distribution substituted in.

## 2. Path A — normal rollback: revert PR (always available, use by default)

This is the only path that goes through CI, `ai-review`, and leaves a clean
git history. **It is not instant** — `main` is protected, so a revert still
needs a human to merge it (per `AGENTS.md` branch policy: PRs into `main`
never auto-merge, even on green CI). Budget for however long it takes Henry
to notice and click merge, on top of CI runtime.

1. Identify the bad commit(s) on `main`:
   ```
   git log --oneline -10 origin/main
   ```
2. Branch off **dev** (never off main directly) and revert the commit(s):
   ```
   git fetch origin
   git checkout -b fix/revert-<short-sha> origin/dev
   git revert --no-edit <bad-sha>          # repeat per commit, oldest-first if several
   git push -u origin fix/revert-<short-sha>
   ```
3. Open a PR **from that branch into `dev`** first (normal flow — it will
   auto-merge on green CI + ai-review, same as any feature PR). This gets
   the fix into preview and verified before it touches prod.
4. Once merged into `dev`, open the `dev` → `main` promotion PR as usual.
   This is the one that requires a **human to merge manually** — ping
   Henry; there is no way to make this step instant without weakening the
   branch protection, which is the whole point of the gate.
5. On merge to `main`, `deploy.yml` runs automatically and re-syncs
   `dist/` (the reverted build) to the prod bucket + invalidates
   CloudFront. No extra manual deploy step needed.

Expect this path to take **minutes-to-hours** depending on how fast a human
merges the promotion PR — not an emergency-response timescale.

## 3. Path B — emergency direct S3 restore (bypasses CI)

**Status as of 2026-10-20 (verified via `aws s3api get-bucket-versioning`,
not assumed): S3 versioning is NOT enabled on either the prod bucket
(`tilemap-io-prod-803872155074`) or the preview bucket.** `aws s3api
get-bucket-versioning` returns an empty response (no `Status` field) for
both — this is the AWS CLI's way of saying versioning was never turned on.

### What this means in practice

- `aws s3 sync --delete` is a one-way street right now. Once a bad deploy's
  `sync` runs, the previous build's objects are gone from the bucket with
  **no built-in way to list or restore a prior object version** —
  `aws s3api list-object-versions` will only ever show the single current
  version of each key.
- The only way to "restore" the previous build today is to **rebuild it from
  git and redeploy it** — i.e., there is no faster-than-CI emergency path
  available right now. Path A (revert PR) *is* the fastest available option
  until versioning is turned on.

### Gap + recommendation (not acted on — Henry's call)

This is a real gap for an emergency where the promotion-PR human-merge delay
in Path A is unacceptable (e.g. prod is actively broken for users). The fix
is to **enable S3 bucket versioning** on the prod bucket (and optionally
preview). This is an infra change with real implications, so it is
*recommended, not applied*:

- Versioning has a modest storage-cost impact: every `sync --delete` would
  retain old object versions instead of deleting them, so storage grows
  over time unless paired with a lifecycle rule that expires noncurrent
  versions after N days.
- `--delete` in the sync step would then create delete markers instead of
  hard-deleting, which is exactly what you want for rollback but changes
  what "the bucket" means operationally (current objects vs. all versions).
- Decision needed from Henry: enable versioning + add a lifecycle rule
  (e.g. expire noncurrent versions after 30 days) to bound the cost. Until
  then, treat Path A as the only rollback path and plan emergency response
  time accordingly.

### If/when versioning IS enabled, here is the emergency procedure

(Not usable today — documented now so it's ready the moment Henry turns
versioning on. Verify versioning is actually "Enabled" first — see §4 —
before trusting this path.)

1. List versions of everything currently in the bucket, newest first:
   ```
   aws s3api list-object-versions \
     --bucket tilemap-io-prod-803872155074 \
     --output json > /tmp/versions.json
   ```
2. For each key, find the version that was current *before* the bad deploy
   (by `LastModified` timestamp, just before the bad deploy's `sync` ran —
   cross-check against the Discord deploy notification timestamp or the
   GitHub Actions run time for the bad commit).
3. Restore a prior version of a single key by copying that version onto
   itself as the new current version (this does NOT delete the bad
   version — it adds a new current version on top, so it's non-destructive
   and itself revertible):
   ```
   aws s3api copy-object \
     --bucket tilemap-io-prod-803872155074 \
     --copy-source "tilemap-io-prod-803872155074/<key>?versionId=<prior-version-id>" \
     --key "<key>"
   ```
4. Repeat per key, or script it over the full `dist/` manifest. There is no
   single "restore whole bucket to timestamp T" AWS API call — it's
   per-object.
5. Invalidate CloudFront after restoring the objects (see §4 — invalidation
   is required either way, restoring S3 alone does not bust the CDN cache).
6. **Still open the proper revert PR afterward** (Path A) so `main`'s git
   history matches what's actually live. The emergency S3 restore is a
   stopgap to stop user-facing breakage fast; it is not a substitute for
   fixing the source of truth.

## 4. CloudFront propagation during any rollback

Applies to both Path A and Path B — restoring S3 objects alone does not
make the fix visible to users, because CloudFront edge caches still hold
the old (bad, post-rollback-also-bad... confusingly, whichever was cached
last) response.

- `deploy.yml`'s own invalidation step (`create-invalidation --paths "/*"`)
  already runs on every deploy via CI, so Path A gets this for free.
- For Path B (manual S3 restore), you must invalidate manually — it is not
  automatic:
  ```
  aws cloudfront create-invalidation --distribution-id E2B1T2HWD9AMCG --paths "/*"
  ```
- Invalidation completion time: checked live history on this distribution —
  the two most recent invalidations both completed in well under 15 minutes
  (`aws cloudfront list-invalidations --distribution-id E2B1T2HWD9AMCG` /
  `get-invalidation` for status). Budget **up to ~15 minutes** for
  `/*` to fully propagate to all edge locations before declaring the
  rollback visible everywhere; it is often faster.
- Distribution price class is `PriceClass_All` (all edge locations
  worldwide), so there's no shortcut by restricting the invalidation to a
  subset of regions — a full `/*` invalidation is the right tool.
- A hard-refresh / incognito check from your own browser may show the fix
  before a stale client does — browsers and intermediate proxies can also
  cache responses independently of CloudFront's own cache.

## 5. Verifying a rollback actually worked

Do not consider a rollback done because the `aws` commands or the CI run
exited 0 — verify what's actually being served:

1. Hit the live URL directly, bypassing local/browser cache:
   ```
   curl -s -i https://d3qyytktu2cbue.cloudfront.net/ | head -30
   ```
   Check for the expected content/behavior, and look at response headers
   (`x-cache`, `age`) — `age: 0` or a low value plus `x-cache: Miss from
   cloudfront` suggests you're seeing freshly-fetched content, not a stale
   cached copy.
2. If the change is in a JS/asset bundle rather than the HTML shell, check
   the actual built asset, since `index.html` may reference a new hashed
   filename only after the rollback:
   ```
   curl -s https://d3qyytktu2cbue.cloudfront.net/ | grep -o 'assets/[^"]*\.js'
   ```
   then `curl -s -I https://d3qyytktu2cbue.cloudfront.net/assets/<that file>`
   to confirm it 200s.
3. Confirm the invalidation is actually `Completed`, not just `Created`:
   ```
   aws cloudfront get-invalidation --distribution-id E2B1T2HWD9AMCG --id <invalidation-id>
   ```
4. Open the URL in an actual browser (private/incognito window) as a final
   human sanity check — automated header checks can be fooled by
   intermediate caches that `curl` doesn't see the same way a real browser
   session does.
5. For Path A, also confirm the merge actually landed on `main` and the
   `deploy.yml` run for that push shows green in the Actions tab — a
   rollback PR that's merged but whose deploy run failed is not a
   completed rollback.

## 6. Summary decision table

| Situation | Use |
|---|---|
| Routine bad deploy, no active user-facing emergency | Path A (revert PR) |
| Active production emergency, versioning enabled | Path B (direct S3 restore) + invalidation, then still open the Path A PR afterward for history |
| Active production emergency, versioning NOT enabled (current state) | Path A is the only option — there is no faster path today; this is the documented gap in §3 |

**Open gap for Henry to decide on:** enable S3 bucket versioning (+ a
noncurrent-version-expiration lifecycle rule to bound storage cost) on at
least the prod bucket, to make Path B actually usable. Not enabled by this
change — left as a recommendation per the task that produced this doc.
