/**
 * Pure helper for the board-flip (rotate view) button.
 *
 * Framework-free by design (no DOM/Phaser), per AGENTS.md -- `main.ts` just
 * calls this to compute the next boolean state and applies it to a CSS
 * class. Purely a presentation toggle: it carries no grid/game-logic
 * meaning, it's just kept out of `main.ts` so it's unit-testable without a
 * browser/DOM.
 */
export function nextBoardFlippedState(isFlipped: boolean): boolean {
  return !isFlipped;
}
