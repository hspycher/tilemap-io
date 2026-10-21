# tilemap-io Kanban Board

**Board URL:** https://github.com/users/hspycher/projects/2

This is a GitHub Projects v2 board, owned by `hspycher` and linked to the
`hspycher/tilemap-io` repository (repo-associated, not just owner-level
floating — issues/PRs from this repo can be added to it directly from the
repo UI).

## Columns (Status field)

The `Status` single-select field drives the board columns, in workflow order:

- **Backlog** — not yet triaged / not ready for an agent to pick up.
- **Ready** — triaged and labeled `agent-ready`; an agent can start this next.
- **In Progress** — an agent is actively working it; mirrors the
  `agent-working` label.
- **In Review** — implementation done, PR open, awaiting review/merge;
  mirrors the `agent-review` label.
- **Done** — merged/closed.

## Labels are still the real dispatcher mechanism

**Important:** the actual task dispatcher for agents still reads and writes
the `agent-ready` / `agent-working` / `agent-review` issue labels directly.
Those labels are the source of truth the automation acts on today.

This board is a **one-way snapshot/sync of that label state into a visual
Kanban view** — it was populated once by querying open issues carrying those
three labels and setting each item's `Status` field to match
(`agent-ready` → Ready, `agent-working` → In Progress, `agent-review` → In
Review). It is **not** bidirectionally synced: moving a card's Status column
on the board does **not** change the issue's label, and relabeling an issue
later does **not** automatically move its card.

Keeping the board in sync with reality (either by re-running the same
snapshot query periodically, or building an Actions workflow that reacts to
label changes and updates the Status field automatically) is future work,
tracked as a follow-up — it was deliberately scoped out of this initial pass
to avoid shipping an untested bidirectional-sync integration.

## How it was built

- Created via the GitHub GraphQL API (Projects v2: `createProjectV2`,
  `linkProjectV2ToRepository`, `updateProjectV2Field`,
  `addProjectV2ItemById`, `updateProjectV2ItemFieldValue`).
- Status options were reconfigured from the GitHub defaults
  (Todo/In Progress/Done) to the five columns above.
- As of this writing, 2 open issues carried an `agent-ready` label (#48, #49)
  and were added to the board with Status = Ready; no open issues currently
  carry `agent-working` or `agent-review`.
