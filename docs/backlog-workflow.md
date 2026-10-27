# Backlog workflow: agents pull work automatically

Before this doc, every feature in this repo was manually dispatched inside a
live chat with Henry. This is the mechanism that replaced that: GitHub Issues
as the backlog, a few labels, and a recurring Hermes cron job — **"tilemap-io
kanban dispatcher"** — that polls and acts, picking up to 3 issues at once
and running them genuinely in parallel.

## How to queue work for an agent

1. File a GitHub issue on `hspycher/tilemap-io` with a clear, scoped spec —
   what to build, where (ideally one file/area), and what "done" looks like
   (tests, build passing, etc).
2. Label it `agent-ready`.
3. Within 30 minutes (the dispatcher's polling interval) it'll be picked up
   automatically — or trigger it immediately with `cronjob_manage(action=
   'run', job_id='0bae01012371')`.

A visual GitHub Projects v2 board exists (`tilemap-io Kanban`) as a snapshot
view, but **labels are still the real backing mechanism** the dispatcher
reads — moving a card on the board does nothing on its own yet.

## What happens automatically, each run

0. **Stuck-work watchdog** runs first: any issue labeled `agent-working`/
   `agent-review` for more than 2 hours with no corresponding PR activity is
   treated as abandoned (e.g. a prior dispatch died mid-session) and reset to
   `agent-ready` with an `agent-stuck-N` marker, up to 2 auto-retries before
   it's left alone for a human to look at.
0.5. **Issue-quality gate**: an `agent-ready` issue is skipped (not picked)
   if its body is too thin to infer real scope from, is pure vague intent
   with no named file/behavior, or its own text says it isn't actually
   ready (e.g. "needs a human decision first"). A label alone doesn't
   override what the issue's own content says.
1. Lists remaining eligible `agent-ready` issues, oldest first, up to 3.
2. Skips anything whose title/body contains a real instruction to touch
   deploy/auth/infra/credentials/AWS/`main` (substring matches like
   "main.ts" or "authoritative" don't count — real judgment, not keyword
   matching).
3. Locks each pick with `agent-working`, then dispatches **all** of them in
   one `delegate_task` call — true concurrent execution, each in its own
   isolated git worktree (`../tilemap-io-wt-issue-<N>`, branch
   `fix/issue-<N>`) off `dev`.
4. Each dispatched agent: implements, tests, builds, pushes, opens a PR with
   `Closes #<N>`, swaps `agent-working` → `agent-review`. Close verification
   is independent of the keyword — the dispatcher (or the agent itself)
   polls until the PR merges, then explicitly closes the issue and strips
   labels regardless of whether `Closes #N` already did it (it often
   doesn't — GitHub's auto-close via that keyword has proven unreliable for
   API/PAT-driven merges on this repo).
5. If two parallel PRs land in the same file and conflict: the dispatcher
   attempts auto-recovery for trivial "both sides independently added a
   block" conflicts (merge, keep both, re-test, force-push). Anything less
   obviously trivial goes through `discord_approval_gate.py` instead of
   being guessed at.
6. Verifies every outcome against the GitHub API, not subagent self-report.

From there, normal repo flow applies: CI + `ai-review` both green required,
PRs into `dev` auto-merge, `dev`→`main` promotion is always a manual merge.

## How to check on progress

- `cronjob_manage(action='list')` — shows the job, its schedule, and
  last/next run.
- Cron output files under `cron/output/0bae01012371/` — past executions and
  their output/status.
- On GitHub: an issue labeled `agent-working`/`agent-review` is currently
  being worked (or stuck — the watchdog handles that automatically now, no
  manual cleanup needed in the common case); an issue that closed with a
  linked merged PR was handed off successfully.
- Discord: the dispatcher's run output is delivered to the configured home
  channel after each run (a genuinely empty run stays silent).

## Known limitations

- **`TILEMAP_IO_AGENT_PAT` can't touch `.github/workflows/**`** (Contents+PRs
  scope only, no Workflows). An issue whose scope requires editing a
  workflow file will be correctly rolled back, not force-pushed with a
  broader credential. Add Workflows (write) scope to that PAT if this needs
  to change.
- **Self-graded tests, by design (accepted limitation, not a bug to fix
  blindly).** The same agent that implements a feature also writes its own
  tests for it — there is no independent second pass checking "does this
  behavior actually match what the issue asked for" versus "do the tests
  this agent wrote happen to pass." A genuinely misunderstood spec can
  produce code and tests that agree with each other while both being wrong.
  Mitigation for now is Henry's own spot-checks on anything load-bearing,
  not automation — an independent-verification pass was scoped but judged
  not worth the added complexity/cost yet given how rarely it's actually
  bitten this repo. Revisit if that stops being true.
- **Guardrail and quality gate are heuristics, not judgment.** Both can be
  fooled by an issue that's carefully worded to slip through. Review what
  gets picked, especially for anything that smells infra-adjacent.
- **Watchdog retries cap at 2.** A genuinely broken issue (spec the
  implementation keeps failing against, not just a flaky run) will stop
  auto-retrying and sit labeled `agent-stuck-2` until a human intervenes.
