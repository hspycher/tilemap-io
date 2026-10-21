import { describe, it, expect } from "vitest";
import { appendMove, describeMove, lastNMoveDescriptions, type MoveRecord } from "./moveHistory";

describe("moveHistory", () => {
  it("formats a move description as 'piece moved from (c,r) to (c,r)'", () => {
    const move: MoveRecord = { from: { col: 2, row: 3 }, to: { col: 3, row: 4 } };
    expect(describeMove(move)).toBe("piece moved from (2,3) to (3,4)");
  });

  it("appends a move to an empty history", () => {
    const move: MoveRecord = { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } };
    const history = appendMove([], move);
    expect(history).toEqual([move]);
  });

  it("appends a move to existing history without mutating the input", () => {
    const first: MoveRecord = { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } };
    const second: MoveRecord = { from: { col: 1, row: 0 }, to: { col: 2, row: 0 } };
    const original = [first];
    const history = appendMove(original, second);
    expect(history).toEqual([first, second]);
    expect(original).toEqual([first]); // unchanged
  });

  it("caps history at the 5 most recent moves, dropping the oldest", () => {
    let history: MoveRecord[] = [];
    const moves: MoveRecord[] = Array.from({ length: 7 }, (_, i) => ({
      from: { col: i, row: 0 },
      to: { col: i + 1, row: 0 },
    }));
    for (const move of moves) {
      history = appendMove(history, move);
    }
    expect(history).toHaveLength(5);
    // Should contain only the last 5 (indices 2..6)
    expect(history).toEqual(moves.slice(2));
  });

  it("lastNMoveDescriptions returns at most the last 5 formatted descriptions", () => {
    let history: MoveRecord[] = [];
    const moves: MoveRecord[] = Array.from({ length: 6 }, (_, i) => ({
      from: { col: i, row: 0 },
      to: { col: i + 1, row: 1 },
    }));
    for (const move of moves) {
      history = appendMove(history, move);
    }
    const descriptions = lastNMoveDescriptions(history);
    expect(descriptions).toHaveLength(5);
    expect(descriptions[0]).toBe("piece moved from (1,0) to (2,1)");
    expect(descriptions[4]).toBe("piece moved from (5,0) to (6,1)");
  });

  it("lastNMoveDescriptions returns fewer than N when history is shorter", () => {
    const move: MoveRecord = { from: { col: 0, row: 0 }, to: { col: 1, row: 1 } };
    const history = appendMove([], move);
    const descriptions = lastNMoveDescriptions(history);
    expect(descriptions).toEqual(["piece moved from (0,0) to (1,1)"]);
  });
});
