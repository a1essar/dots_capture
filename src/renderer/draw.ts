/**
 * Draw grid, territory markers, points (active + captured), and hover ghost.
 * Uses Pixi Graphics; no rule logic, only visual representation of board state.
 */

import { Container, Graphics } from "pixi.js";
import type { BoardLayout } from "./layout";
import type { CellState } from "../core/model/types";

const GRID_COLOR = 0x475569;
const GRID_ALPHA = 0.5;
const HOVER_ALPHA = 0.4;
const INVALID_HOVER_COLOR = 0x94a3b8;

function cssColorToHex(css: unknown): number {
  if (typeof css !== "string") return 0x888888;
  if (css.startsWith("#")) {
    const hex = css.slice(1);
    if (hex.length === 6) return parseInt(hex, 16);
    if (hex.length === 3) {
      const r = hex[0] ?? "0";
      const g = hex[1] ?? "0";
      const b = hex[2] ?? "0";
      return parseInt(r + r + g + g + b + b, 16);
    }
  }
  return 0x888888;
}

export function drawGrid(container: Container, layout: BoardLayout, width: number, height: number): void {
  const g = new Graphics();
  const { originX, originY, step } = layout;
  g.setStrokeStyle({ width: layout.lineThickness, color: GRID_COLOR, alpha: GRID_ALPHA });
  for (let i = 0; i < width; i++) {
    const px = originX + i * step;
    g.moveTo(px, originY).lineTo(px, originY + (height - 1) * step).stroke();
  }
  for (let j = 0; j < height; j++) {
    const py = originY + j * step;
    g.moveTo(originX, py).lineTo(originX + (width - 1) * step, py).stroke();
  }
  container.removeChildren();
  container.addChild(g);
}

export function drawTerritory(
  container: Container,
  layout: BoardLayout,
  board: Map<string, CellState>,
  width: number,
  height: number,
  playerColors: Record<1 | 2, string>
): void {
  const g = new Graphics();
  const { originX, originY, step } = layout;
  const radius = step * 0.45;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const key = `${x},${y}`;
      const cell = board.get(key);
      if (cell?.type !== "territory") continue;
      const color = cssColorToHex(playerColors[cell.owner]);
      const px = originX + x * step;
      const py = originY + y * step;
      g.circle(px, py, radius).fill({ color, alpha: layout.territoryAlpha });
    }
  }
  container.removeChildren();
  container.addChild(g);
}

export function drawPoints(
  container: Container,
  layout: BoardLayout,
  board: Map<string, CellState>,
  width: number,
  height: number,
  playerColors: Record<1 | 2, string>
): void {
  const g = new Graphics();
  const { originX, originY, step } = layout;
  const r = layout.pointRadius;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const key = `${x},${y}`;
      const cell = board.get(key);
      if (cell?.type !== "point") continue;
      const color = cssColorToHex(playerColors[cell.owner]);
      const alpha = cell.captured ? layout.capturedAlpha : 1;
      const px = originX + x * step;
      const py = originY + y * step;
      g.circle(px, py, r).fill({ color, alpha });
      if (cell.captured) {
        const cross = step * 0.25;
        g.setStrokeStyle({ width: Math.max(1, r * 0.2), color: 0x1e293b, alpha: 0.9 });
        g.moveTo(px - cross, py - cross).lineTo(px + cross, py + cross).stroke();
        g.moveTo(px + cross, py - cross).lineTo(px - cross, py + cross).stroke();
      }
    }
  }
  container.removeChildren();
  container.addChild(g);
}

export function drawHover(
  container: Container,
  layout: BoardLayout,
  hoverCell: { x: number; y: number } | null,
  currentPlayer: 1 | 2,
  playerColors: Record<1 | 2, string>,
  isValid: boolean
): void {
  container.removeChildren();
  if (hoverCell === null) return;
  const g = new Graphics();
  const { originX, originY } = layout;
  const px = originX + hoverCell.x * layout.step;
  const py = originY + hoverCell.y * layout.step;
  const color = isValid ? cssColorToHex(playerColors[currentPlayer]) : INVALID_HOVER_COLOR;
  g.circle(px, py, layout.pointRadius).fill({ color, alpha: HOVER_ALPHA });
  container.addChild(g);
}

/** Unobtrusive overlay for would-be captured territory and points (potential capture highlight). */
const POTENTIAL_TERRITORY_ALPHA = 0.18;
const POTENTIAL_CAPTURED_ALPHA = 0.35;

export interface PotentialCaptureOverlayData {
  territory: Array<{ x: number; y: number }>;
  capturedPoints: Array<{ x: number; y: number }>;
}

export function drawPotentialCaptureOverlay(
  container: Container,
  layout: BoardLayout,
  data: PotentialCaptureOverlayData,
  currentPlayer: 1 | 2,
  playerColors: Record<1 | 2, string>
): void {
  container.removeChildren();
  const g = new Graphics();
  const { originX, originY, step } = layout;
  const radius = step * 0.45;
  const r = layout.pointRadius;

  const color = cssColorToHex(playerColors[currentPlayer]);
  for (const { x, y } of data.territory) {
    const px = originX + x * step;
    const py = originY + y * step;
    g.circle(px, py, radius).fill({ color, alpha: POTENTIAL_TERRITORY_ALPHA });
  }
  for (const { x, y } of data.capturedPoints) {
    const px = originX + x * step;
    const py = originY + y * step;
    g.circle(px, py, r).fill({ color, alpha: POTENTIAL_CAPTURED_ALPHA });
    const cross = step * 0.2;
    g.setStrokeStyle({ width: Math.max(1, r * 0.15), color: 0x1e293b, alpha: 0.7 });
    g.moveTo(px - cross, py - cross).lineTo(px + cross, py + cross).stroke();
    g.moveTo(px + cross, py - cross).lineTo(px - cross, py + cross).stroke();
  }
  container.addChild(g);
}
