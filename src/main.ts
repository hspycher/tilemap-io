import "./style.css";
import Phaser from "phaser";
import { TileGrid, type GridPos } from "./tilemap";

const TILE_SIZE = 64;
const GRID_COLS = 8;
const GRID_ROWS = 8;

const PIECE_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71];

function colToX(col: number): number {
  return col * TILE_SIZE + TILE_SIZE / 2;
}
function rowToY(row: number): number {
  return row * TILE_SIZE + TILE_SIZE / 2;
}
function pixelToGrid(x: number, y: number): GridPos {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}

class MainScene extends Phaser.Scene {
  private grid = new TileGrid(GRID_COLS, GRID_ROWS);
  private pieceSprites = new Map<string, Phaser.GameObjects.Arc>();
  private selectedId: string | null = null;
  private selectionRing?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("main");
  }

  create(): void {
    this.drawBoard();
    this.spawnPieces();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleClick(pointer.x, pointer.y);
    });
  }

  private drawBoard(): void {
    const g = this.add.graphics();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isDark = (row + col) % 2 === 0;
        g.fillStyle(isDark ? 0x2c3e50 : 0x34495e, 1);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private spawnPieces(): void {
    const starts: GridPos[] = [
      { col: 1, row: 1 },
      { col: 6, row: 1 },
      { col: 1, row: 6 },
      { col: 6, row: 6 },
    ];
    starts.forEach((pos, i) => {
      const id = `piece-${i}`;
      this.grid.addPiece({ id, pos });
      const sprite = this.add.circle(
        colToX(pos.col),
        rowToY(pos.row),
        TILE_SIZE * 0.35,
        PIECE_COLORS[i % PIECE_COLORS.length],
      );
      sprite.setStrokeStyle(3, 0xffffff, 0.8);
      this.pieceSprites.set(id, sprite);
    });
  }

  private handleClick(x: number, y: number): void {
    const clicked = pixelToGrid(x, y);
    if (!this.grid.isInBounds(clicked)) return;

    const pieceHere = this.grid.pieceAt(clicked);

    if (this.selectedId === null) {
      if (pieceHere) this.selectPiece(pieceHere.id);
      return;
    }

    const selected = this.grid.getPiece(this.selectedId);
    if (!selected) {
      this.clearSelection();
      return;
    }

    if (pieceHere) {
      this.selectPiece(pieceHere.id);
      return;
    }

    if (this.grid.isAdjacent(selected.pos, clicked) && this.grid.movePiece(this.selectedId, clicked)) {
      const sprite = this.pieceSprites.get(this.selectedId)!;
      this.tweens.add({
        targets: sprite,
        x: colToX(clicked.col),
        y: rowToY(clicked.row),
        duration: 150,
        ease: "Quad.easeOut",
      });
    }
    this.clearSelection();
  }

  private selectPiece(id: string): void {
    this.selectedId = id;
    const piece = this.grid.getPiece(id)!;
    if (!this.selectionRing) {
      this.selectionRing = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE);
      this.selectionRing.setStrokeStyle(4, 0xffffff, 1);
      this.selectionRing.setFillStyle(0xffffff, 0.08);
    }
    this.selectionRing.setPosition(colToX(piece.pos.col), rowToY(piece.pos.row));
    this.selectionRing.setVisible(true);
  }

  private clearSelection(): void {
    this.selectedId = null;
    this.selectionRing?.setVisible(false);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GRID_COLS * TILE_SIZE,
  height: GRID_ROWS * TILE_SIZE,
  backgroundColor: "#1a1a2e",
  scene: [MainScene],
});
