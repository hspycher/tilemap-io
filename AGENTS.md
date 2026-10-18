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

## PRs auto-merge on green CI — CI is the real safety gate

Any PR opened against `main` auto-merges (squash) the moment its CI run
succeeds — see `.github/workflows/auto-merge.yml`. There is **no human
review step** in between. This means:

- **Do not rely on "someone will catch it in review."** If a test doesn't
  exist for a behavior, that behavior is NOT verified before it ships to
  main — write the test.
- **Never weaken or skip a test to make CI pass.** That directly defeats the
  only gate standing between a broken change and main.
- A failing/red CI run simply never merges — the PR sits open. That's the
  intended failure mode; don't force-merge around it.

## Known state (update this section as the project evolves)

- Board is a fixed 8x8 grid, pieces move one orthogonal or diagonal tile at a
  time to an empty tile only (no captures, no multi-tile moves yet).
- CI (test + build) runs on every push/PR; green CI auto-merges the PR.
- No deployment pipeline configured yet.
- No game rules beyond movement — this is a substrate, not a finished game.
