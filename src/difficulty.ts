// Plain, framework-free helper for computing a cosmetic difficulty label —
// no DOM/Phaser deps so it's unit-testable without a browser.

export type DifficultyLabel = "Easy" | "Medium" | "Hard";

/**
 * Computes a purely cosmetic difficulty label from a move count.
 * <10 moves = Easy, 10-25 (inclusive) = Medium, >25 = Hard.
 * Has no gameplay effect.
 */
export function difficultyFromMoveCount(moveCount: number): DifficultyLabel {
  if (moveCount < 10) return "Easy";
  if (moveCount <= 25) return "Medium";
  return "Hard";
}
