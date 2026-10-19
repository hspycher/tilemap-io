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

  it("correctly identifies diagonal adjacency (true cases)", () => {
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 2, row: 2 })).toBe(true);
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 0, row: 0 })).toBe(true);
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 2, row: 0 })).toBe(true);
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 0, row: 2 })).toBe(true);
  });

  it("correctly identifies diagonal adjacency (false cases)", () => {
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 1, row: 1 })).toBe(false); // same tile
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 3, row: 3 })).toBe(false); // 2 tiles away
    expect(grid.isAdjacentDiagonal({ col: 1, row: 1 }, { col: 1, row: 2 })).toBe(false); // orthogonal, not diagonal
  });

  it("isAdjacentAny accepts both orthogonal and diagonal neighbors", () => {
    expect(grid.isAdjacentAny({ col: 1, row: 1 }, { col: 1, row: 2 })).toBe(true); // orthogonal
    expect(grid.isAdjacentAny({ col: 1, row: 1 }, { col: 2, row: 2 })).toBe(true); // diagonal
    expect(grid.isAdjacentAny({ col: 1, row: 1 }, { col: 3, row: 3 })).toBe(false); // 2 tiles away
    expect(grid.isAdjacentAny({ col: 1, row: 1 }, { col: 1, row: 1 })).toBe(false); // same tile
  });

  it("refuses to move diagonally onto an occupied tile", () => {
    grid.addPiece({ id: "p1", pos: { col: 1, row: 1 } });
    grid.addPiece({ id: "p2", pos: { col: 2, row: 2 } });
    expect(grid.isAdjacentDiagonal(grid.getPiece("p1")!.pos, { col: 2, row: 2 })).toBe(true);
    const moved = grid.movePiece("p1", { col: 2, row: 2 });
    expect(moved).toBe(false);
    expect(grid.getPiece("p1")?.pos).toEqual({ col: 1, row: 1 });
  });

  it("pieceAt finds the right piece and ignores empty tiles", () => {
    grid.addPiece({ id: "p1", pos: { col: 3, row: 3 } });
    expect(grid.pieceAt({ col: 3, row: 3 })?.id).toBe("p1");
    expect(grid.pieceAt({ col: 0, row: 0 })).toBeUndefined();
  });

  it("clear removes every piece from the grid", () => {
    grid.addPiece({ id: "p1", pos: { col: 1, row: 1 } });
    grid.addPiece({ id: "p2", pos: { col: 2, row: 2 } });
    grid.clear();
    expect(grid.allPieces()).toEqual([]);
    expect(grid.getPiece("p1")).toBeUndefined();
    expect(grid.pieceAt({ col: 1, row: 1 })).toBeUndefined();
  });

  it("allows re-adding pieces at their original spots after clear", () => {
    grid.addPiece({ id: "p1", pos: { col: 1, row: 1 } });
    grid.clear();
    expect(() => grid.addPiece({ id: "p1", pos: { col: 1, row: 1 } })).not.toThrow();
    expect(grid.getPiece("p1")?.pos).toEqual({ col: 1, row: 1 });
  });

  it("starts with a move count of zero", () => {
    expect(grid.moveCount).toBe(0);
  });

  it("increments moveCount on every successful move", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    grid.movePiece("p1", { col: 1, row: 0 });
    expect(grid.moveCount).toBe(1);
    grid.movePiece("p1", { col: 1, row: 1 });
    expect(grid.moveCount).toBe(2);
  });

  it("does not increment moveCount on a failed move", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    grid.addPiece({ id: "p2", pos: { col: 1, row: 0 } });
    const moved = grid.movePiece("p1", { col: 1, row: 0 }); // occupied
    expect(moved).toBe(false);
    expect(grid.moveCount).toBe(0);
    expect(grid.movePiece("ghost", { col: 2, row: 2 })).toBe(false);
    expect(grid.moveCount).toBe(0);
  });

  it("resetMoveCount zeroes the counter without affecting piece positions", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    grid.movePiece("p1", { col: 1, row: 0 });
    expect(grid.moveCount).toBe(1);
    grid.resetMoveCount();
    expect(grid.moveCount).toBe(0);
    expect(grid.getPiece("p1")?.pos).toEqual({ col: 1, row: 0 });
  });

  it("resetBoard clears pieces and the move counter together", () => {
    grid.addPiece({ id: "p1", pos: { col: 0, row: 0 } });
    grid.movePiece("p1", { col: 1, row: 0 });
    grid.resetBoard();
    expect(grid.moveCount).toBe(0);
    expect(grid.allPieces()).toEqual([]);
  });
});
