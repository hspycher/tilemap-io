import "./style.css";
import Phaser from "phaser";
import { TileGrid, type GridPos } from "./tilemap";
import { appendMove, lastNMoveDescriptions, type MoveRecord } from "./moveHistory";

const TILE_SIZE = 64;
const GRID_COLS = 8;
const GRID_ROWS = 8;

const PIECE_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71];

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "tilemap-io-theme";

const BOARD_COLORS: Record<Theme, [number, number]> = {
  light: [0x2c3e50, 0x34495e],
  dark: [0x05050a, 0x0d0d14],
};
const CANVAS_BACKGROUND: Record<Theme, string> = {
  light: "#1a1a2e",
  dark: "#000000",
};

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

let currentTheme: Theme = loadTheme();

const STARTING_POSITIONS: GridPos[] = [
  { col: 1, row: 1 },
  { col: 6, row: 1 },
  { col: 1, row: 6 },
  { col: 6, row: 6 },
];

function colToX(col: number): number {
  return col * TILE_SIZE + TILE_SIZE / 2;
}
function rowToY(row: number): number {
  return row * TILE_SIZE + TILE_SIZE / 2;
}
function pixelToGrid(x: number, y: number): GridPos {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}

const moveCounterEl = document.getElementById("move-counter");
const moveHistoryListEl = document.getElementById("move-history-list");

let moveHistory: MoveRecord[] = [];

function renderMoveHistory(): void {
  if (!moveHistoryListEl) return;
  moveHistoryListEl.innerHTML = "";
  for (const description of lastNMoveDescriptions(moveHistory)) {
    const li = document.createElement("li");
    li.textContent = description;
    moveHistoryListEl.appendChild(li);
  }
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
    this.updateMoveCounterDisplay();
    renderMoveHistory();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleClick(pointer.x, pointer.y);
    });
  }

  private updateMoveCounterDisplay(): void {
    if (moveCounterEl) moveCounterEl.textContent = `Moves: ${this.grid.moveCount}`;
  }

  private boardGraphics?: Phaser.GameObjects.Graphics;

  private drawBoard(): void {
    this.boardGraphics?.destroy();
    const g = this.add.graphics();
    const [darkTile, lightTile] = BOARD_COLORS[currentTheme];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isDark = (row + col) % 2 === 0;
        g.fillStyle(isDark ? darkTile : lightTile, 1);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this.boardGraphics = g;
  }

  /** Re-renders the board tiles and canvas background for the current theme. */
  applyTheme(): void {
    this.drawBoard();
    this.cameras.main.setBackgroundColor(CANVAS_BACKGROUND[currentTheme]);
  }

  private spawnPieces(): void {
    STARTING_POSITIONS.forEach((pos, i) => {
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

    const fromPos: GridPos = { col: selected.pos.col, row: selected.pos.row };
    if (this.grid.isAdjacentAny(selected.pos, clicked) && this.grid.movePiece(this.selectedId, clicked)) {
      const sprite = this.pieceSprites.get(this.selectedId)!;
      this.tweens.add({
        targets: sprite,
        x: colToX(clicked.col),
        y: rowToY(clicked.row),
        duration: 150,
        ease: "Quad.easeOut",
      });
      this.updateMoveCounterDisplay();
      moveHistory = appendMove(moveHistory, { from: fromPos, to: clicked });
      renderMoveHistory();
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

  /** Clears the board and re-spawns all pieces at their original starting layout. */
  resetBoard(): void {
    this.clearSelection();
    for (const sprite of this.pieceSprites.values()) {
      sprite.destroy();
    }
    this.pieceSprites.clear();
    this.grid.resetBoard();
    this.spawnPieces();
    this.updateMoveCounterDisplay();
    moveHistory = [];
    renderMoveHistory();
  }
}

document.body.dataset.theme = currentTheme;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GRID_COLS * TILE_SIZE,
  height: GRID_ROWS * TILE_SIZE,
  backgroundColor: CANVAS_BACKGROUND[currentTheme],
  scene: [MainScene],
});

const resetButton = document.getElementById("reset-button");
resetButton?.addEventListener("click", () => {
  const scene = game.scene.getScene("main") as MainScene;
  scene.resetBoard();
});

function updateThemeToggleLabel(button: HTMLElement): void {
  button.textContent = currentTheme === "dark" ? "Light mode" : "Dark mode";
}

const themeToggleButton = document.getElementById("theme-toggle-button");
if (themeToggleButton) {
  updateThemeToggleLabel(themeToggleButton);
  themeToggleButton.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    document.body.dataset.theme = currentTheme;
    updateThemeToggleLabel(themeToggleButton);

    const scene = game.scene.getScene("main") as MainScene;
    scene.applyTheme();
  });
}
