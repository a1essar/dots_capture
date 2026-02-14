/**
 * Board key helpers and immutable update patterns.
 * Key format: "x,y". Absence of key means cell is empty.
 */

import type { CellState } from "./types";

const EMPTY: CellState = { type: "empty" };

/** Serialize (x, y) to board key "x,y". */
export function toKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Parse "x,y" to [x, y]. Returns undefined if key format is invalid. */
export function fromKey(key: string): [number, number] | undefined {
  const parts = key.split(",");
  if (parts.length !== 2) return undefined;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return undefined;
  return [x, y];
}

/** Get cell state; missing key returns empty. */
export function getCell(
  board: Map<string, CellState>,
  x: number,
  y: number
): CellState {
  return board.get(toKey(x, y)) ?? EMPTY;
}

/** Return a new board with cell at (x,y) set. Omits key if state is empty. */
export function setCell(
  board: Map<string, CellState>,
  x: number,
  y: number,
  state: CellState
): Map<string, CellState> {
  const key = toKey(x, y);
  if (state.type === "empty") {
    if (!board.has(key)) return board;
    const next = new Map(board);
    next.delete(key);
    return next;
  }
  if (board.get(key) === state) return board;
  const next = new Map(board);
  next.set(key, state);
  return next;
}

/** Return a new board with multiple cells set. Batched immutable update. */
export function setCells(
  board: Map<string, CellState>,
  updates: Array<{ x: number; y: number; state: CellState }>
): Map<string, CellState> {
  if (updates.length === 0) return board;
  const next = new Map(board);
  for (const { x, y, state } of updates) {
    const key = toKey(x, y);
    if (state.type === "empty") next.delete(key);
    else next.set(key, state);
  }
  return next;
}
