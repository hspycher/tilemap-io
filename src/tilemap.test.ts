import { describe, it, expect, beforeEach } from "vitest";
import { TileGrid } from "./tilemap";

describe("TileGrid", () => {
  let grid: TileGrid;

  beforeEach(() => {
    grid = new TileGrid(5, 5);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => new TileGrid(0, 5)).toThrow();
    expect(() => new TileGrid(5, -1)).toThrow();
  });

  it("places a piece within bounds", () => {
    grid.addPiece({ id: "p1", pos: { col: 2, row: 2 } });
    expect(grid.getPiece("p1")?.pos).toEqual({ col: 2, row: 2 });
  });

  it("rejects placing a piece out of bounds", () => {
    expect(() => grid.addPiece({ id: "p1", pos: { col: 9, row: 0 } })).toThrow();
  });

  it("rejects placing a piece on an occupied tile", () => {
    grid.addPiece({ id: "p1", pos: { col: 1, row: 1 } });
    expect(() => grid.addPiece({ id: "p2", pos: { col: 1, row: 1 } })).toThrow();
  });

  it("moves a piece to an empty in-bounds tile", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    const moved = grid.movePiece("p1", { col: 1, row: 0 });
    expect(moved).toBe(true);
    expect(grid.getPiece("p1")?.pos).toEqual({ col: 1, row: 0 });
  });

  it("refuses to move a piece out of bounds", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    const moved = grid.movePiece("p1", { col: -1, row: 0 });
    expect(moved).toBe(false);
    expect(grid.getPiece("p1")?.pos).toEqual({ col: 0, row: 0 });
  });

  it("refuses to move onto an occupied tile", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    grid.addPiece({ id: "p2", pos: { col: 1, row: 0 } });
    const moved = grid.movePiece("p1", { col: 1, row: 0 });
    expect(moved).toBe(false);
  });

  it("refuses to move a nonexistent piece", () => {
    expect(grid.movePiece("ghost", { col: 0, row: 0 })).toBe(false);
  });

  it("correctly identifies orthogonal adjacency", () => {
    expect(grid.isAdjacent({ col: 1, row: 1 }, { col: 1, row: 2 })).toBe(true);
    expect(grid.isAdjacent({ col: 1, row: 1 }, { col: 2, row: 1 })).toBe(true);
    expect(grid.isAdjacent({ col: 1, row: 1 }, { col: 2, row: 2 })).toBe(false); // diagonal
    expect(grid.isAdjacent({ col: 1, row: 1 }, { col: 1, row: 1 })).toBe(false); // same tile
  });

  it("pieceAt finds the right piece and ignores empty tiles", () => {
    grid.addPiece({ id: "p1", pos: { col: 3, row: 3 } });
    expect(grid.pieceAt({ col: 3, row: 3 })?.id).toBe("p1");
    expect(grid.pieceAt({ col: 0, row: 0 })).toBeUndefined();
  });
});
