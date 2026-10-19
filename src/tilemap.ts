// Pure, framework-free tilemap/move logic — kept separate from Phaser so it's
// trivially unit-testable without spinning up a renderer or DOM.

export interface GridPos {
  col: number;
  row: number;
}

export interface Piece {
  id: string;
  pos: GridPos;
}

export class TileGrid {
  readonly cols: number;
  readonly rows: number;
  private pieces: Map<string, Piece> = new Map();

  constructor(cols: number, rows: number) {
    if (cols <= 0 || rows <= 0) {
      throw new Error("Grid dimensions must be positive");
    }
    this.cols = cols;
    this.rows = rows;
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

  /** Returns true and moves the piece if the move is legal; false otherwise. */
  movePiece(id: string, to: GridPos): boolean {
    const piece = this.pieces.get(id);
    if (!piece) return false;
    if (!this.isInBounds(to)) return false;
    if (this.pieceAt(to)) return false; // occupied — no stacking/capture yet
    piece.pos = to;
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
