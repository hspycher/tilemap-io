# tilemap-io

A minimal 2D tilemap prototype: an 8x8 grid with pieces you can select and
move to an adjacent tile. Starting point for an agentic dev pipeline testbed
(not a full game yet).

## Stack

- TypeScript + [Phaser](https://phaser.io/) 4 for rendering/input
- [Vite](https://vite.dev/) for dev server + build
- [Vitest](https://vitest.dev/) for unit tests

## Structure

- `src/tilemap.ts` — pure grid/move logic, framework-free, fully unit tested
- `src/tilemap.test.ts` — Vitest suite for the above
- `src/main.ts` — Phaser scene: renders the board, wires up click-to-select
  / click-to-move using `tilemap.ts`

## Commands

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
npm test         # run the unit test suite (vitest run)
npm run build    # typecheck + production build to dist/
```

## Status

- [x] Grid rendering
- [x] Click-to-select / click-to-move pieces (orthogonal, one tile at a time)
- [x] Unit tests for move legality
- [ ] Deployment pipeline (not wired up yet)
- [ ] Actual game rules (this is just the movement substrate)

<!-- deploy pipeline verification commit -->

See AGENTS.md for repo conventions.

Deploy pipeline: GitHub Actions -> S3 -> CloudFront.

Review automation is now event-driven via a GitHub webhook, not polling.
