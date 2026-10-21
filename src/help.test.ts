import { describe, it, expect } from "vitest";
import { nextHelpOverlayVisibility } from "./help";

describe("nextHelpOverlayVisibility", () => {
  it("flips hidden to visible", () => {
    expect(nextHelpOverlayVisibility(false)).toBe(true);
  });

  it("flips visible to hidden", () => {
    expect(nextHelpOverlayVisibility(true)).toBe(false);
  });

  it("is a pure toggle (double flip returns original state)", () => {
    const original = false;
    const flippedTwice = nextHelpOverlayVisibility(nextHelpOverlayVisibility(original));
    expect(flippedTwice).toBe(original);
  });
});
