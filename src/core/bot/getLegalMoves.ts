/**
 * Returns all legal (x, y) moves for the current player.
 */

import type { GameState } from "../model/types";
import { getCell } from "../model/board";
import { isMoveLegal } from "../rules/move";

export function getLegalMoves(state: GameState): Array<[number, number]> {
  if (state.status !== "playing") return [];
  const { width, height } = state.settings;
  const moves: Array<[number, number]> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isMoveLegal(state, x, y)) moves.push([x, y]);
    }
  }
  return moves;
}

/** Legal moves that are on empty cells only (not on our territory). Prefer these to avoid filling territory. */
export function getEmptyLegalMoves(state: GameState): Array<[number, number]> {
  const legal = getLegalMoves(state);
  const { board } = state;
  return legal.filter(([x, y]) => getCell(board, x, y).type === "empty");
}
