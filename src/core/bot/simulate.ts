/**
 * Simulate a move and return the number of points captured by the mover.
 * Used by bot strategies without mutating state.
 */

import type { GameState, PlayerId } from "../model/types";
import { setCell } from "../model/board";
import { computeCapturesAfterMove } from "../capture/computeCapturesAfterMove";

export function getImmediateCaptures(
  state: GameState,
  x: number,
  y: number
): number {
  const player = state.currentPlayer;
  const nextBoard = setCell(state.board, x, y, {
    type: "point",
    owner: player,
    captured: false,
  });
  const nextPlayer: PlayerId = player === 1 ? 2 : 1;
  const stateAfterPlace = {
    ...state,
    board: nextBoard,
    currentPlayer: nextPlayer,
    moveHistory: [...state.moveHistory, { x, y, player }],
  };
  const { scoreDelta } = computeCapturesAfterMove(stateAfterPlace);
  return scoreDelta;
}
