// Pure, framework-free tilemap/move logic — kept separate from Phaser so it's
// trivially unit-testable without spinning up a renderer or DOM.

export interface GridPos {
  col: number;
  row: number;
}

export interface Piece {
  id: string;
  pos: GridPos;
  /** Owning player/side. Pieces with the same owner (including both
   * undefined) cannot move onto each other; different owners can capture. */
  owner?: string;
}

/** Snapshot of a single movePiece call, enough to fully revert it. */
interface MoveRecord {
  pieceId: string;
  from: GridPos;
  to: GridPos;
  /** The captured piece, if the move was a capture, so it can be restored. */
  captured?: Piece;
}

export class TileGrid {
  readonly cols: number;
  readonly rows: number;
  private pieces: Map<string, Piece> = new Map();
  private _moveCount = 0;
  private lastMove: MoveRecord | undefined;

  constructor(cols: number, rows: number) {
    if (cols <= 0 || rows <= 0) {
      throw new Error("Grid dimensions must be positive");
    }
    this.cols = cols;
    this.rows = rows;
  }

  /** Number of successful movePiece calls since the grid was created or last reset. */
  get moveCount(): number {
    return this._moveCount;
  }

  /** Resets the move counter to zero without touching piece positions. */
  resetMoveCount(): void {
    this._moveCount = 0;
  }

  isInBounds(pos: GridPos): boolean {
    return pos.col >= 0 && pos.col < this.cols && pos.row >= 0 && pos.row < this.rows;
  }

  addPiece(piece: Piece): void {
    if (!this.isInBounds(piece.pos)) {
      throw new Error(`Piece ${piece.id} placed out of bounds`);
    }
    if (this.pieceAt(piece.pos)) {
      throw new Error(`Tile ${piece.pos.col},${piece.pos.row} already occupied`);
    }
    this.pieces.set(piece.id, piece);
  }

  pieceAt(pos: GridPos): Piece | undefined {
    for (const piece of this.pieces.values()) {
      if (piece.pos.col === pos.col && piece.pos.row === pos.row) return piece;
    }
    return undefined;
  }

  getPiece(id: string): Piece | undefined {
    return this.pieces.get(id);
  }

  allPieces(): Piece[] {
    return [...this.pieces.values()];
  }

  /** Removes every piece from the grid, leaving all tiles empty. */
  clear(): void {
    this.pieces.clear();
  }

  /** Removes every piece and resets the move counter — a full board reset. */
  resetBoard(): void {
    this.clear();
    this.resetMoveCount();
  }

  /**
   * Returns true and moves the piece if the move is legal; false otherwise.
   * A destination occupied by an opponent's piece (different `owner`) is a
   * capture: the occupant is removed and the moving piece takes its place.
   * A destination occupied by a piece with the same `owner` (including when
   * both are undefined) remains illegal — no stacking on your own piece.
   */
  movePiece(id: string, to: GridPos): boolean {
    const piece = this.pieces.get(id);
    if (!piece) return false;
    if (!this.isInBounds(to)) return false;
    const occupant = this.pieceAt(to);
    if (occupant) {
      if (occupant.owner === piece.owner) return false; // own piece — no stacking
      this.pieces.delete(occupant.id); // capture
    }
    const from = { ...piece.pos };
    piece.pos = to;
    this._moveCount++;
    this.lastMove = {
      pieceId: id,
      from,
      to: { ...to },
      captured: occupant ? { ...occupant, pos: { ...occupant.pos } } : undefined,
    };
    return true;
  }

  /**
   * Reverts the most recent successful movePiece call: moves the piece back
   * to its origin and restores any piece it captured. A safe no-op (returns
   * false, throws nothing) if no move has been made yet, or if it was
   * already undone. Only the single most recent move can be undone.
   */
  undo(): boolean {
    const move = this.lastMove;
    if (!move) return false;
    const piece = this.pieces.get(move.pieceId);
    if (!piece) return false;
    piece.pos = { ...move.from };
    if (move.captured) {
      this.pieces.set(move.captured.id, { ...move.captured, pos: { ...move.captured.pos } });
    }
    this._moveCount = Math.max(0, this._moveCount - 1);
    this.lastMove = undefined;
    return true;
  }

  /** Orthogonal neighbors only (no diagonals) — the original legal move shape. */
  isAdjacent(a: GridPos, b: GridPos): boolean {
    const dCol = Math.abs(a.col - b.col);
    const dRow = Math.abs(a.row - b.row);
    return (dCol === 1 && dRow === 0) || (dCol === 0 && dRow === 1);
  }

  /** Diagonal neighbors only (the 4 diagonal tiles one step away). */
  isAdjacentDiagonal(a: GridPos, b: GridPos): boolean {
    const dCol = Math.abs(a.col - b.col);
    const dRow = Math.abs(a.row - b.row);
    return dCol === 1 && dRow === 1;
  }

  /** Any of the 8 surrounding tiles — orthogonal or diagonal, one step away. */
  isAdjacentAny(a: GridPos, b: GridPos): boolean {
    return this.isAdjacent(a, b) || this.isAdjacentDiagonal(a, b);
  }
}

/**
 * Pure helper: counts how many pieces each owner currently has, given a
 * snapshot of pieces (e.g. from `TileGrid.allPieces()`). Pieces with no
 * `owner` set are grouped under the `"unowned"` key. No grid/DOM coupling —
 * this is just a tally over whatever piece list is passed in, so callers
 * (like a per-player piece-count readout) can call it after any move or
 * capture without re-deriving ownership logic.
 */
export function countPiecesByOwner(pieces: Piece[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const piece of pieces) {
    const owner = piece.owner ?? "unowned";
    counts[owner] = (counts[owner] ?? 0) + 1;
  }
  return counts;
}

/**
 * Pure helper: total number of pieces currently remaining on the board,
 * given a snapshot of pieces (e.g. from `TileGrid.allPieces()`). No
 * grid/DOM coupling — just the count of the list passed in, so callers
 * (like a total-pieces-remaining readout) can call it after any move or
 * capture without re-deriving anything.
 */
export function totalRemainingPieces(pieces: Piece[]): number {
  return pieces.length;
}
