/**
 * Draw grid, territory markers, points (active + captured), and hover ghost.
 * Uses Pixi Graphics; no rule logic, only visual representation of board state.
 */

import { Container, Graphics } from "pixi.js";
import type { BoardLayout } from "./layout";
import type { CellState, PlayerId } from "../core/model/types";

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

const CONTOUR_ALPHA = 0.9;

/** Filled for player P: territory owner P or point captured by P. */
function isFilledForPlayer(cell: CellState | undefined, player: PlayerId): boolean {
  if (!cell) return false;
  if (cell.type === "territory" && cell.owner === player) return true;
  if (cell.type === "point" && cell.captured && cell.capturedBy === player) return true;
  return false;
}

/** Marching squares: for each cell (i,j), 4 corner bits TL|TR|BR|BL -> 0..15. Output segments as pairs of edge midpoints in doubled coords. */
const MS_EDGES = ["L", "R", "T", "B"] as const;
type MSEdge = (typeof MS_EDGES)[number];

function edgeMidpoint(i: number, j: number, edge: MSEdge): [number, number] {
  switch (edge) {
    case "L":
      return [2 * i, 2 * j + 1];
    case "R":
      return [2 * i + 2, 2 * j + 1];
    case "T":
      return [2 * i + 1, 2 * j];
    case "B":
      return [2 * i + 1, 2 * j + 2];
  }
}

const MARCHING_SQUARES: ReadonlyArray<ReadonlyArray<[MSEdge, MSEdge]>> = [
  [],
  [["L", "B"]],
  [["R", "B"]],
  [["L", "R"]],
  [["T", "R"]],
  [
    ["L", "T"],
    ["B", "R"],
  ],
  [["T", "B"]],
  [["L", "T"]],
  [["T", "L"]],
  [["T", "B"]],
  [
    ["T", "R"],
    ["L", "B"],
  ],
  [["T", "R"]],
  [["L", "R"]],
  [["L", "B"]],
  [["B", "T"]],
  [],
];

function buildCaptureMask(
  board: Map<string, CellState>,
  width: number,
  height: number,
  player: PlayerId
): boolean[][] {
  const mask: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const cell = board.get(`${x},${y}`);
      row.push(isFilledForPlayer(cell, player));
    }
    mask.push(row);
  }
  return mask;
}

function marchingSquares(
  mask: boolean[][],
  width: number,
  height: number
): Array<[[number, number], [number, number]]> {
  const segments: Array<[[number, number], [number, number]]> = [];
  for (let j = 0; j < height - 1; j++) {
    const row0 = mask[j];
    const row1 = mask[j + 1];
    if (!row0 || !row1) continue;
    for (let i = 0; i < width - 1; i++) {
      const tl = row0[i];
      const tr = row0[i + 1];
      const br = row1[i + 1];
      const bl = row1[i];
      const idx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      const edges = MARCHING_SQUARES[idx];
      if (!edges || edges.length === 0) continue;
      for (const [e0, e1] of edges) {
        segments.push([edgeMidpoint(i, j, e0), edgeMidpoint(i, j, e1)]);
      }
    }
  }
  return segments;
}

function key2(x: number, y: number): string {
  return `${x},${y}`;
}

const EIGHT_NEIGHBORS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** Active points of player P that are 8-adjacent to at least one filled cell (territory or capturedBy P). */
function getWallPoints(
  board: Map<string, CellState>,
  width: number,
  height: number,
  player: PlayerId,
  filledMask: boolean[][]
): Set<string> {
  const W = new Set<string>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cell = board.get(`${x},${y}`);
      if (cell?.type !== "point" || cell.owner !== player || cell.captured) continue;
      for (const [dx, dy] of EIGHT_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const row = filledMask[ny];
        if (row?.[nx]) {
          W.add(key2(x, y));
          break;
        }
      }
    }
  }
  return W;
}

function is8Neighbor(ax: number, ay: number, bx: number, by: number): boolean {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0);
}

/** Project a marching-squares loop (doubled coords) to an ordered list of grid points (wall centers). */
function projectLoopToWallPoints(
  loop: Array<[number, number]>,
  wallSet: Set<string>,
  width: number,
  height: number
): Array<[number, number]> {
  const out: [number, number][] = [];
  let prev: [number, number] | null = null;
  for (let i = 0; i < loop.length; i++) {
    const [dx, dy] = loop[i]!;
    const vx = dx / 2;
    const vy = dy / 2;
    let cand1: [number, number];
    let cand2: [number, number];
    if (dx % 2 === 0) {
      const ix = dx / 2;
      cand1 = [ix, Math.floor(vy)];
      cand2 = [ix, Math.ceil(vy)];
    } else {
      const iy = dy / 2;
      cand1 = [Math.floor(vx), iy];
      cand2 = [Math.ceil(vx), iy];
    }
    const c1In = cand1[0] >= 0 && cand1[0] < width && cand1[1] >= 0 && cand1[1] < height && wallSet.has(key2(cand1[0], cand1[1]));
    const c2In = cand2[0] >= 0 && cand2[0] < width && cand2[1] >= 0 && cand2[1] < height && wallSet.has(key2(cand2[0], cand2[1]));
    let chosen: [number, number] | null = null;
    if (c1In && c2In) {
      if (prev && is8Neighbor(prev[0], prev[1], cand1[0], cand1[1])) chosen = cand1;
      else if (prev && is8Neighbor(prev[0], prev[1], cand2[0], cand2[1])) chosen = cand2;
      else chosen = cand1;
    } else if (c1In) chosen = cand1;
    else if (c2In) chosen = cand2;
    if (chosen && (!prev || chosen[0] !== prev[0] || chosen[1] !== prev[1])) {
      out.push(chosen);
      prev = chosen;
    }
  }
  const deduped: [number, number][] = [];
  for (let i = 0; i < out.length; i++) {
    const p = out[i]!;
    const next = out[(i + 1) % out.length]!;
    if (p[0] !== next[0] || p[1] !== next[1]) deduped.push(p);
  }
  return deduped;
}

function stitchSegments(
  segments: Array<[[number, number], [number, number]]>
): Array<Array<[number, number]>> {
  const adj = new Map<string, [number, number][]>();
  const add = (a: [number, number], b: [number, number]) => {
    const ka = key2(a[0], a[1]);
    if (!adj.has(ka)) adj.set(ka, []);
    adj.get(ka)!.push(b);
  };
  for (const [p, q] of segments) {
    add(p, q);
    add(q, p);
  }
  const loops: Array<Array<[number, number]>> = [];
  const consumed = new Set<string>();
  for (const [p, q] of segments) {
    const segKey = key2(p[0], p[1]) + "|" + key2(q[0], q[1]);
    if (consumed.has(segKey)) continue;
    const loop: [number, number][] = [];
    let current = p;
    let next = q;
    loop.push(current);
    consumed.add(key2(current[0], current[1]) + "|" + key2(next[0], next[1]));
    consumed.add(key2(next[0], next[1]) + "|" + key2(current[0], current[1]));
    while (true) {
      loop.push(next);
      const neighbors = adj.get(key2(next[0], next[1])) ?? [];
      let found = false;
      const nextKey = key2(next[0], next[1]);
      for (const n of neighbors) {
        const [nx, ny] = n;
        const nKey = key2(nx, ny);
        const nk = nextKey + "|" + nKey;
        if (consumed.has(nk)) continue;
        current = next;
        next = n;
        consumed.add(key2(current[0], current[1]) + "|" + nKey);
        consumed.add(nKey + "|" + key2(current[0], current[1]));
        found = true;
        break;
      }
      if (!found) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

export function drawCaptureContours(
  container: Container,
  layout: BoardLayout,
  board: Map<string, CellState>,
  width: number,
  height: number,
  playerColors: Record<1 | 2, string>
): void {
  container.removeChildren();
  if (width < 2 || height < 2) return;
  const g = new Graphics();
  const { originX, originY, step } = layout;
  const thickness = Math.max(1, Math.min(layout.lineThickness + 1, 6));

  for (const player of [1, 2] as const) {
    const mask = buildCaptureMask(board, width, height, player);
    const wallSet = getWallPoints(board, width, height, player, mask);
    const segments = marchingSquares(mask, width, height);
    if (segments.length === 0) continue;
    const loops = stitchSegments(segments);
    const color = cssColorToHex(playerColors[player]);
    g.setStrokeStyle({ width: thickness, color, alpha: CONTOUR_ALPHA });
    for (const loop of loops) {
      const pts = projectLoopToWallPoints(loop, wallSet, width, height);
      if (pts.length < 3) continue;
      const p0 = pts[0]!;
      g.moveTo(originX + p0[0] * step, originY + p0[1] * step);
      for (let i = 1; i < pts.length; i++) {
        const pt = pts[i]!;
        g.lineTo(originX + pt[0] * step, originY + pt[1] * step);
      }
      g.closePath().stroke();
    }
  }
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
