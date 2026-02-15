/**
 * Capture after move per GDS §4: flood-fill from active opponent points,
 * 4-directional; walls = only active points of the player who just moved.
 * Closed region => mark enclosed opponent active as captured (+1 each), empty as territory.
 */

import type { GameState, PlayerId } from "../model/types";
import { getCell, setCells, toKey, fromKey } from "../model/board";
import type { CellState } from "../model/types";

const ORTH: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export interface CaptureResult {
  board: Map<string, CellState>;
  scoreDelta: number;
}

/**
 * Compute captures after a move. State must be the state *after* the point
 * was placed and currentPlayer was toggled. The capturing player is the one
 * who just moved (opponent of state.currentPlayer).
 */
export function computeCapturesAfterMove(state: GameState): CaptureResult {
  const { board, settings, currentPlayer } = state;
  const { width, height } = settings;
  const capturingPlayer: PlayerId = currentPlayer === 1 ? 2 : 1;
  const opponent: PlayerId = currentPlayer;

  const isWall = (x: number, y: number): boolean => {
    const cell = getCell(board, x, y);
    return (
      cell.type === "point" &&
      cell.owner === capturingPlayer &&
      !cell.captured
    );
  };

  const canPass = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return !isWall(x, y);
  };

  const isEdge = (x: number, y: number): boolean =>
    x === 0 || x === width - 1 || y === 0 || y === height - 1;

  const activeOpponentPoints: [number, number][] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cell = getCell(board, x, y);
      if (
        cell.type === "point" &&
        cell.owner === opponent &&
        !cell.captured
      ) {
        activeOpponentPoints.push([x, y]);
      }
    }
  }

  const processed = new Set<string>();
  const pointsToCapture: Array<{ x: number; y: number }> = [];
  const emptyToTerritory: Array<{ x: number; y: number }> = [];

  for (const [sx, sy] of activeOpponentPoints) {
    const key = toKey(sx, sy);
    if (processed.has(key)) continue;

    const visited = new Set<string>();
    let reachedEdge = false;
    const queue: [number, number][] = [[sx, sy]];
    visited.add(key);

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      if (isEdge(x, y)) {
        reachedEdge = true;
      }
      for (const [dx, dy] of ORTH) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = toKey(nx, ny);
        if (!canPass(nx, ny) || visited.has(nk)) continue;
        visited.add(nk);
        queue.push([nx, ny]);
      }
    }

    if (!reachedEdge) {
      for (const k of visited) {
        const coords = fromKey(k);
        if (!coords) continue;
        const [x, y] = coords;
        const cell = getCell(board, x, y);
        if (
          cell.type === "point" &&
          cell.owner === opponent &&
          !cell.captured
        ) {
          pointsToCapture.push({ x, y });
          processed.add(k);
        } else if (cell.type === "empty") {
          emptyToTerritory.push({ x, y });
        }
      }
    }
  }

  if (pointsToCapture.length === 0 && emptyToTerritory.length === 0) {
    return { board, scoreDelta: 0 };
  }

  const updates: Array<{ x: number; y: number; state: CellState }> = [];
  for (const { x, y } of pointsToCapture) {
    updates.push({
      x,
      y,
      state: { type: "point", owner: opponent, captured: true, capturedBy: capturingPlayer },
    });
  }
  for (const { x, y } of emptyToTerritory) {
    updates.push({
      x,
      y,
      state: { type: "territory", owner: capturingPlayer },
    });
  }

  const nextBoard = setCells(board, updates);
  return {
    board: nextBoard,
    scoreDelta: pointsToCapture.length,
  };
}
