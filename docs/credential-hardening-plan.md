# Credential hardening plan — splitting the broad personal token

**Status:** proposal / not yet implemented. This document is planning +
scaffolding only. No credential referenced here has been created, rotated,
or swapped into any live workflow or secret. Implementing it requires
Henry's explicit go-ahead, because the tokens it replaces are tied to his
own personal GitHub account.

## 1. Current state

Two distinct automation duties in this repo's pipeline both currently run
on **the same broad credential** — Henry's personal GitHub OAuth token
(`~/.config/gh/hosts.yml`, `hspycher` user, full account scope) or an
equivalently broad classic PAT:

1. **In-repo, inside GitHub Actions**, `secrets.PERSONAL_GH_TOKEN` is used
   by two workflows:
   - `.github/workflows/auto-merge.yml` — merges a green `dev`-target PR
     (needs `contents:write` to merge + trigger downstream push workflows,
     `pull-requests:write` to merge via the API, read access to
     commits/branches/PRs).
   - `.github/workflows/changelog.yml` — commits a generated
     `CHANGELOG.md` onto a `dev`→`main` promotion PR's branch and pushes it
     (needs `contents:write` on this repo only).
   Both deliberately avoid `secrets.GITHUB_TOKEN` because GitHub's loop
   prevention means a `GITHUB_TOKEN`-authored push never triggers
   downstream `push`-triggered workflows (silently — no error, see
   `AGENTS.md`). That constraint must be preserved by whatever replaces it.

2. **Outside Actions, on Henry's own machine** — opening feature-branch
   PRs during agent/cron work (`gh pr create` invocations run by Hermes
   subagents or cron jobs working in this repo) uses the **same** personal
   OAuth token via the default `gh` CLI auth (`hosts.yml`), because that's
   simply whatever `gh` is logged in as on this machine. There is no
   separate credential for this duty today — it rides on Henry's full
   personal account token, identical in blast radius to what controls his
   own day-to-day GitHub usage.

**The problem:** one leaked credential (committed by accident, exfiltrated
from an agent's environment, logged somewhere) would not just compromise
this one repo's automation — it would hand over everything Henry's own
account can do across every repo and org he belongs to. This is the same
class of problem `ai-review`'s credential already solved (see `AGENTS.md`
§"PRs auto-merge into dev..." — that token is verified merge-incapable and
scoped to commit-statuses + PR-read only). The two duties above are the
remaining broad-scope blind spot.

## 2. Research: GitHub App vs. second fine-grained PAT, per duty

### Duty A — merge + changelog-push inside Actions (`secrets.PERSONAL_GH_TOKEN`)

| | Fine-grained PAT (2nd one) | GitHub App installed on this repo |
|---|---|---|
| Identity | Still Henry's account | Independent identity, not tied to any human account |
| Scope | Per-repo, per-permission (e.g. `tilemap-io` only, Contents: RW, Pull requests: RW) | Per-repo at install time + per-permission; narrowest of the three options |
| Lifetime | Up to 1 year, **manual expiry+renewal**, tied to account staying active | Installation token auto-expires in **~1 hour**; private key itself doesn't expire but is the one long-lived secret to protect |
| Minting inside Actions | Store the PAT value directly as the secret; used as-is | Store only the App's private key (PEM) + App ID as secrets; each job mints a fresh ~1h installation token via `actions/create-github-app-token@v1` (official GitHub Action) — no long-lived token ever sits in a secret slot that could leak and still be usable tomorrow |
| Triggers downstream push workflows? | **Yes** — commits/pushes authored by a PAT (tied to a real user identity) are NOT subject to the `GITHUB_TOKEN` loop-prevention rule, so `deploy.yml`'s push trigger still fires normally. | **Yes, also** — a GitHub App's installation token acts as a distinct bot identity (e.g. `your-app-name[bot]`), separate from the built-in `github-actions[bot]` that owns `GITHUB_TOKEN`. GitHub's loop-prevention only suppresses the default `GITHUB_TOKEN`'s own commits from re-triggering workflows; third-party App commits trigger normally. **This is the one thing that must be verified empirically before trusting it (see §4) — don't take it on faith even though it's documented, per this repo's own "test workflow changes for real" policy.** |
| Rotation story | Regenerate via web UI, manually update the GH secret, manually revoke old one — a real but infrequent manual chore (recommended ~90 day cadence) | Rotate the **private key** (web UI → App settings → "Generate a private key", delete the old one) and update one GH secret; every subsequent installation-token mint automatically uses the new key. No per-token secret-copying since tokens are minted fresh every run anyway. |
| Setup complexity | Low — one web UI form, same flow as the `ai-review` token already set up for this repo | Higher — register the App (web UI), generate+download a private key, install it on just this repo, wire `actions/create-github-app-token` into both workflows, store 2 secrets (App ID + private key) instead of 1 token |
| Revocation blast radius if leaked | Leak = that repo's contents+PR write for up to a year (or until manually revoked) — still tied to Henry's account existing/being in good standing | Leak of a **minted installation token** = max ~1h of that repo's contents+PR write. Leak of the **private key** = attacker can mint tokens for as long as the key lives (bounded by how fast Henry notices and rotates it) — meaningfully worse than a token leak only if the key leak goes unnoticed for a long time, but the blast radius is still capped to repos the App is installed on (just this one) |

**Recommendation for Duty A: GitHub App.** It fully satisfies the
stated requirement — scoped to just this repo, `contents:write` +
`pull-requests:write` only, not riding on Henry's account, short-lived
minted tokens, and (per GitHub's documented bot-identity behavior) a
different-committer-identity path that should preserve the
push-trigger behavior the current token provides. The setup cost is
higher than a PAT but it's a one-time cost, and it directly removes the
"same credential as my personal GitHub login" risk that a second PAT
would not remove (a PAT is still Henry's own account, just more narrowly
scoped — it doesn't address "doesn't ride on Henry's own account").

### Duty B — opening feature-branch PRs during agent/cron work (local `gh` usage)

| | Fine-grained PAT (2nd one) | GitHub App |
|---|---|---|
| Fits how it's used | Yes — `gh` CLI (and any direct REST call) accepts a token override via the `GH_TOKEN` env var, no code change needed, just export the narrower token before `gh` commands run in a tilemap-io agent/cron context | Possible but awkward — `gh` CLI has no first-class "run as this App installation" mode for interactive/cron use outside Actions; would require a small wrapper script to mint an installation token via the Apps API (JWT-sign with the private key, exchange for an installation token, set `GH_TOKEN` to that) and re-mint it roughly hourly for longer-running cron sessions |
| Setup complexity | Low — same web UI flow as Duty A's PAT option, repo-scoped to `tilemap-io` only, `Contents: Read and write` + `Pull requests: Read and write`, nothing else | Meaningfully higher for this specific duty — no official first-class "App token for local scripts" tool the way `actions/create-github-app-token` exists for Actions; would need bespoke token-minting code running in the agent/cron environment |
| Matches the actual need | A fine-grained PAT **fully replaces** the broad personal OAuth token for this duty: opening a PR only ever needs `contents:write` (to push the branch) + `pull-requests:write` (to open the PR) on this one repo — nothing else `gh pr create` does touches broader account scope | A GitHub App *could* do this too, but the question specifically asked "can a 2nd fine-grained PAT fully replace it" — yes, it can, with no loss of capability for this duty |

**Recommendation for Duty B: a second fine-grained PAT**, scoped to
`tilemap-io` only, `Contents: Read and write` + `Pull requests: Read and
write`, nothing else. A GitHub App buys real benefits inside Actions
(short-lived tokens, official minting action, distinct bot identity) but
for a credential used directly by local `gh` CLI calls outside Actions,
there's no comparably mature tooling, and the PAT is already narrow enough
to fully satisfy the "not the same blast radius as my personal login"
goal — it just can't do anything outside this one repo's contents/PRs,
which is the actual property being bought here, not "is it an App".

## 3. Proposed design

```
Duty                         Current credential         Proposed credential
─────────────────────────────────────────────────────────────────────────────
Merge dev PRs (auto-merge)   PERSONAL_GH_TOKEN           tilemap-io-ci GitHub App
Push changelog (changelog)   PERSONAL_GH_TOKEN           installation token, minted
                                                          fresh per job via
                                                          actions/create-github-app-token
                                                          (App ID + private key in 2
                                                          new repo secrets)

Open feature-branch PRs      Henry's personal OAuth      tilemap-io-agent-pr
(local gh CLI, agent/cron    token (hosts.yml default)   fine-grained PAT, repo-scoped
work on Henry's machine)                                 to tilemap-io only,
                                                          Contents RW + Pull requests RW,
                                                          exported as GH_TOKEN env var
                                                          only for tilemap-io work
                                                          (never written into hosts.yml,
                                                          never becomes gh's default)
```

Henry's personal OAuth token in `hosts.yml` continues to exist for his own
`gh` usage and any other repo, but after this change it is **no longer
used for any tilemap-io automation duty** — a leak of either new
credential is bounded to this one repo's contents + PRs, nothing else
Henry's account can reach.

## 4. Exact manual steps (Henry — web UI only, cannot be API-automated)

GitHub explicitly does not expose App registration or fine-grained PAT
creation via the REST/GraphQL API — both require the web UI.

### 4a. Register the GitHub App (Duty A)

1. Go to **github.com/settings/apps** (or the org's equivalent if this
   ever moves into an org) → **New GitHub App**.
2. **GitHub App name:** something unique account-wide, e.g.
   `tilemap-io-ci`.
3. **Homepage URL:** the repo URL
   (`https://github.com/hspycher/tilemap-io`) is fine — not functionally
   used.
4. **Webhook:** uncheck **Active** — this App is only used for minting
   installation tokens, not receiving events.
5. **Permissions → Repository permissions:**
   - **Contents:** Read and write
   - **Pull requests:** Read and write
   - Leave every other permission at **No access**.
6. **Where can this GitHub App be installed?** → "Only on this account".
7. Create the App. On the App's settings page:
   - Note the **App ID** (top of the page) — this is NOT secret but is
     needed for the minting step.
   - Under **Private keys**, click **Generate a private key** — downloads
     a `.pem` file. Treat this file itself as the sensitive artifact; it's
     the one long-lived secret in this whole design.
8. **Install the App:** from the App's settings page → **Install App** →
   select the `hspycher` account → **Only select repositories** →
   `tilemap-io` only → Install.
9. Note the **Installation ID** shown in the install's URL
   (`github.com/settings/installations/<ID>`) — also not secret, but
   useful for the verification step in §5.
10. In the `tilemap-io` repo → **Settings → Secrets and variables →
    Actions**, add two new repository secrets:
    - `TILEMAP_APP_ID` — the App ID from step 7.
    - `TILEMAP_APP_PRIVATE_KEY` — the full contents of the `.pem` file
      from step 7.
    Do **not** remove `PERSONAL_GH_TOKEN` yet — keep both in place until
    the new App has been verified working end-to-end (§5), so there's an
    instant rollback if the App path doesn't behave as expected.

### 4b. Create the fine-grained PAT (Duty B)

1. Go to **github.com/settings/personal-access-tokens/new** (fine-grained
   PATs, not classic).
2. **Token name:** `tilemap-io-agent-pr`.
3. **Expiration:** pick the longest offered that still forces a reminder
   to rotate (90 days is a reasonable default — short enough to bound a
   silent leak, long enough not to need re-creation every few weeks).
4. **Resource owner:** `hspycher`.
5. **Repository access:** "Only select repositories" → `tilemap-io` only.
6. **Permissions → Repository permissions:**
   - **Contents:** Read and write
   - **Pull requests:** Read and write
   - Leave every other permission at its default (**No access**/**Read-only**
     where GitHub forces a minimum — e.g. Metadata is always Read-only and
     can't be turned off, that's fine, it's harmless).
7. Generate the token, copy the `github_pat_...` value immediately (it's
   shown once).
8. Store it somewhere Henry controls outside chat/code — e.g. a new entry
   in `C:\Users\Henry\AppData\Local\hermes\.env` as
   `TILEMAP_IO_AGENT_PAT=github_pat_...` (same file that already holds the
   Discord bot token, per existing convention), or a password manager
   entry if preferred. **Do not paste the value into a Hermes chat
   message, commit it, or put it in any file this agent writes** — hand it
   to the agent only via an env var it reads, the same pattern as the
   Discord token.

## 5. Exact steps the agent can do once Henry has created the above

Once `TILEMAP_APP_ID` + `TILEMAP_APP_PRIVATE_KEY` secrets exist and/or
`TILEMAP_IO_AGENT_PAT` is set in the env file:

1. **Wire the App token into the two Actions workflows** (Duty A):
   - Add a step before the existing merge/commit step in both
     `auto-merge.yml` and `changelog.yml`:
     ```yaml
     - uses: actions/create-github-app-token@v1
       id: app-token
       with:
         app-id: ${{ secrets.TILEMAP_APP_ID }}
         private-key: ${{ secrets.TILEMAP_APP_PRIVATE_KEY }}
     ```
   - Change `GH_TOKEN: ${{ secrets.PERSONAL_GH_TOKEN }}` (and the
     `checkout`'s `token:` input in `changelog.yml`) to
     `${{ steps.app-token.outputs.token }}`.
   - Leave `secrets.PERSONAL_GH_TOKEN` itself untouched/still present in
     repo secrets for now (rollback path) until step 2 below passes.

2. **Verify the App token's real capability boundary before trusting it**
   — the same pattern already used to confirm the `ai-review` token is
   merge-incapable (`AGENTS.md`), but checking the *opposite* direction
   here (confirm it CAN do what it needs, not that it can't):
   - Open a real throwaway PR against `dev` (a trivial, reversible change)
     and confirm the modified `auto-merge.yml` actually merges it — not a
     read-through, a real run with a real green CI + `ai-review` pass.
   - **Specifically confirm the merge's resulting push triggers
     `deploy.yml`** (check the Actions tab for a new `deploy.yml` run
     right after the merge) — this is the one behavior this whole plan
     depends on (loop-prevention not applying to App-authored pushes) and
     it must be seen actually happening, not assumed from documentation,
     per this repo's "test workflow changes for real" policy.
   - Confirm a direct negative too: call the merge endpoint with the new
     token against a PR that intentionally has a failing check, expect a
     real 405/422, same shape as today.
   - Only after both the positive and negative checks pass: remove
     `PERSONAL_GH_TOKEN` from repo secrets (Settings → Secrets and
     variables → Actions → delete), closing the rollback path.

3. **Switch local agent/cron PR-opening to the new PAT** (Duty B):
   - In whatever script/profile sets up the environment before an
     agent/cron session runs `gh` commands inside `tilemap-io` (not
     globally — this token should never become the default for
     unrelated repos), export
     `GH_TOKEN="$TILEMAP_IO_AGENT_PAT"` (read from the env file, never
     hardcoded) before invoking `gh pr create`/`gh pr view`/etc.
   - Verify the real capability boundary before trusting it: with
     `GH_TOKEN` set to the new PAT, run `gh pr create` for a real
     throwaway branch and confirm it succeeds; then confirm the same
     token genuinely CANNOT touch an unrelated repo (`gh repo view
     some-other-repo-you-own` or similar) — proving the repo-scoping
     actually took effect, not just that the permission page displays a
     narrow scope (this repo's own incident history includes a case
     where a displayed permission didn't match actual behavior until the
     token was regenerated — see `project-bootstrap`'s
     `references/known-gotchas.md`).
   - Leave Henry's own `hosts.yml` default token untouched throughout —
     this only affects the env var scoped to tilemap-io sessions, never
     overwrites his personal `gh` login.

4. **Update `AGENTS.md`** once both are live: replace the
   "`secrets.PERSONAL_GH_TOKEN`... Don't 'fix' review-token limitations by
   handing it broader scope" paragraph with a note that merge/changelog
   authority now lives in the `tilemap-io-ci` GitHub App (not a personal
   token) and feature-branch-PR authority lives in the
   `tilemap-io-agent-pr` fine-grained PAT — so future agents don't
   rediscover "why is this a personal token" as a question, because it
   won't be one anymore.

## 6. What this plan deliberately does NOT do

- It does not create, rotate, or revoke any live token, key, or secret.
- It does not change which secret any workflow currently reads from.
- It does not touch `secrets.PERSONAL_GH_TOKEN`'s current value or usage.
- It does not touch Henry's personal `gh` CLI login
  (`~/.config/gh/hosts.yml`).

All of §5 is scaffolding for Henry (or an agent, once Henry has completed
§4 and given explicit go-ahead) to execute later — this document is the
reviewable plan, not the change itself.
