import { describe, it, expect } from "vitest";
import { nextBoardFlippedState } from "./boardFlip";

describe("board flip toggle state", () => {
  it("flips false to true", () => {
    expect(nextBoardFlippedState(false)).toBe(true);
  });

  it("flips true back to false", () => {
    expect(nextBoardFlippedState(true)).toBe(false);
  });
});
