# Backlog workflow: agents pull work automatically

Before this doc, every feature in this repo was manually dispatched inside a
live chat with Henry. There was no mechanism for work to get picked up on its
own. This is that mechanism — intentionally minimal: GitHub Issues as the
backlog, two labels, and a recurring Hermes cron job that polls and acts.

## How to queue work for an agent

1. File a GitHub issue on `hspycher/tilemap-io` with a clear, scoped spec —
   the kind of detail you'd give an agent in a live conversation: what to
   build, where (ideally one file/area), and what "done" looks like
   (tests, build passing, etc). See issue #39 for a template example.
2. Label it `agent-ready`.
3. That's it. Within the next 2 hours (the worker's polling interval), it
   will be picked up automatically — or run it immediately yourself with
   `hermes cron run <job-id>` (see below).

## What happens automatically

A recurring Hermes cron job, **"tilemap-io backlog worker"**, runs every 2
hours. On each run it:

1. Lists open issues labeled `agent-ready` that are **not** already labeled
   `agent-working`, oldest first.
2. Skips (does not touch) any issue whose title/body mentions deploy, auth,
   infra, credentials, AWS, secrets, or `main` — those need a human, not an
   autonomous pickup.
3. Picks **exactly one** eligible issue (never more — avoids two agents
   colliding on overlapping work).
4. Labels it `agent-working` immediately, as a pickup lock so a parallel run
   (or a manual trigger) won't grab the same issue twice.
5. Creates an isolated git worktree off `dev`:
   `git worktree add ../tilemap-io-wt-issue-<N> -b fix/issue-<N> origin/dev`
6. Dispatches an implementation agent (via `delegate_task`, or a background
   `hermes chat` process as a fallback) with the issue's title + body as the
   spec, inside that worktree, following `AGENTS.md` conventions.
7. Verifies — for real, against the GitHub API and the worktree's git log —
   that a commit was actually pushed, rather than trusting the sub-agent's
   self-report.
8. Opens a PR against `dev` whose body includes `Closes #<N>` (so merging it
   auto-closes the issue) and a Hermes session ID for traceability.
9. Removes the `agent-working` label once the PR is open (merged or not —
   the existing CI + ai-review + auto-merge-into-`dev` gate handles the rest).
10. Cleans up the worktree.

From there, nothing changes about this repo's normal flow: CI must pass, the
ai-review bot reviews it, and PRs into `dev` auto-merge on green. PRs from
`dev` into `main` still always require a manual merge.

## How to check on progress

- `hermes cron list` — shows the job, its schedule, and last/next run.
- `hermes cron runs` (or `hermes cron history`) — shows past executions and
  their output/status.
- On GitHub: an issue with `agent-working` is currently being worked (or a
  run died mid-flight without cleaning up — see Failure modes below); an
  issue that dropped both labels and gained a linked PR was handed off
  successfully; look for the PR with `Closes #<N>` in its body.
- Discord: the worker's run output is delivered to the configured home
  channel after each run (including a plain "no ready issues" no-op), per
  its `--deliver discord` cron setting.

## Limitations (v1, intentionally minimal)

- **Polling, not event-driven.** The job runs on a fixed 2-hour schedule.
  Webhook-triggering (fire a run the moment an issue is labeled
  `agent-ready`) would close the latency gap but isn't required for v1 —
  trigger a run on demand with `hermes cron run <job-id>` if you don't want
  to wait.
- **One issue per run, always.** By design — this repo has no per-worktree
  conflict resolution beyond "only one agent touches `dev` at a time via
  this path." Filing many `agent-ready` issues at once just queues them;
  they drain one per cycle (or run the job repeatedly on demand to drain
  faster).
- **No comment capability.** The worker's GitHub credential can label and
  open PRs but not comment on issues. If it skips an issue (guardrail match)
  or a run fails partway, that only shows up in the cron run output/Discord
  delivery — not as a comment on the issue itself.
- **Guardrail is a keyword filter**, not real judgment. An issue that avoids
  the trigger words but is still deploy/infra/credential-adjacent could slip
  through. Scope issues narrowly and review what gets picked, especially
  early on.
- **Failure modes:** if a run dies after labeling `agent-working` but before
  opening a PR (e.g. the implementation subagent fails), the issue is left
  labeled `agent-working` with no PR and no worktree cleanup guaranteed.
  Check `hermes cron runs` for the failure, manually remove the
  `agent-working` label, and `git worktree remove` any stale
  `../tilemap-io-wt-issue-<N>` directory before re-queuing.
