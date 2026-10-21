// Plain, framework-free helper for tracking and describing recent moves —
// no DOM/Phaser deps so it's unit-testable without a browser.

import type { GridPos } from "./tilemap";

export interface MoveRecord {
  from: GridPos;
  to: GridPos;
}

const MAX_HISTORY = 5;

/** Human-readable description for a single move, e.g. "piece moved from (2,3) to (3,4)". */
export function describeMove(move: MoveRecord): string {
  return `piece moved from (${move.from.col},${move.from.row}) to (${move.to.col},${move.to.row})`;
}

/**
 * Appends a move to history, keeping only the most recent MAX_HISTORY
 * entries (oldest entries are dropped from the front). Does not mutate the
 * input array; returns a new array.
 */
export function appendMove(history: MoveRecord[], move: MoveRecord): MoveRecord[] {
  const next = [...history, move];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

/** Returns human-readable descriptions for at most the last N (default MAX_HISTORY) moves. */
export function lastNMoveDescriptions(history: MoveRecord[], n: number = MAX_HISTORY): string[] {
  const recent = n >= history.length ? history : history.slice(history.length - n);
  return recent.map(describeMove);
}
