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

The board is kept in sync **one-way, label → board**, by a recurring Hermes
cron job (`Kanban board sync`, `sync_kanban_board.py`, every 15 minutes,
`no_agent` — cheap and mechanical, no LLM needed): for every open or
recently-closed issue, it computes the "correct" Status from the issue's
current labels/state and corrects the board if it's drifted
(`agent-ready`→Ready, `agent-working`/`agent-stuck-N`→In Progress,
`agent-review`→In Review, no agent label→Backlog, closed→Done), and adds
any open issue missing from the board entirely.

This is still **one-way only**: moving a card's Status column on the board
does **not** change the issue's label, and the dispatcher never reads the
board. The practical effect is the board now accurately reflects reality
within 15 minutes of any label change, but it is a read-only view of the
real state, not an alternate way to control it. Making the board the actual
source of truth (dispatcher reads Status via GraphQL instead of labels)
would be a bigger rewrite and isn't planned unless labels prove insufficient.

## How it was built

- Created via the GitHub GraphQL API (Projects v2: `createProjectV2`,
  `linkProjectV2ToRepository`, `updateProjectV2Field`,
  `addProjectV2ItemById`, `updateProjectV2ItemFieldValue`).
- Status options were reconfigured from the GitHub defaults
  (Todo/In Progress/Done) to the five columns above.
- As of this writing, 2 open issues carried an `agent-ready` label (#48, #49)
  and were added to the board with Status = Ready; no open issues currently
  carry `agent-working` or `agent-review`.
