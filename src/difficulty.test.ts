import { describe, it, expect } from "vitest";
import { difficultyFromMoveCount } from "./difficulty";

describe("difficultyFromMoveCount", () => {
  it("returns Easy for 0 moves", () => {
    expect(difficultyFromMoveCount(0)).toBe("Easy");
  });

  it("returns Easy for 9 moves (just under the Medium threshold)", () => {
    expect(difficultyFromMoveCount(9)).toBe("Easy");
  });

  it("returns Medium for 10 moves (lower Medium boundary)", () => {
    expect(difficultyFromMoveCount(10)).toBe("Medium");
  });

  it("returns Medium for 25 moves (upper Medium boundary)", () => {
    expect(difficultyFromMoveCount(25)).toBe("Medium");
  });

  it("returns Hard for 26 moves (just over the Medium threshold)", () => {
    expect(difficultyFromMoveCount(26)).toBe("Hard");
  });

  it("returns Hard for a large move count", () => {
    expect(difficultyFromMoveCount(100)).toBe("Hard");
  });
});
