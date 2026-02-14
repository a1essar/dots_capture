/**
 * Move legality and apply (one point per turn). Capture applied after each move per GDS §4.
 * GDS §3.1: cannot place on occupied intersection or on opponent territory.
 */

import type { GameState, PlayerId } from "../model/types";
import { getCell, setCell } from "../model/board";
import { computeCapturesAfterMove } from "../capture/computeCapturesAfterMove";

/** Returns true iff (x,y) is in bounds and placement is legal: empty, not opponent territory. */
export function isMoveLegal(state: GameState, x: number, y: number): boolean {
  const { settings, board, currentPlayer, status } = state;
  if (status !== "playing") return false;

  const { width, height } = settings;
  if (x < 0 || x >= width || y < 0 || y >= height) return false;

  const cell = getCell(board, x, y);
  if (cell.type === "point") return false;
  if (cell.type === "territory" && cell.owner !== currentPlayer) return false;
  return true;
}

/** Returns new state with point placed at (x,y), moveHistory updated, currentPlayer toggled, then capture applied. Call only when isMoveLegal. */
export function applyMove(state: GameState, x: number, y: number): GameState {
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
  const { board: boardAfterCapture, scoreDelta } = computeCapturesAfterMove(stateAfterPlace);
  const capturingPlayer: PlayerId = nextPlayer === 1 ? 2 : 1;
  return {
    ...stateAfterPlace,
    board: boardAfterCapture,
    score: {
      ...stateAfterPlace.score,
      [capturingPlayer]: stateAfterPlace.score[capturingPlayer] + scoreDelta,
    },
  };
}

export interface EndConditionsResult {
  finished: boolean;
  winner: PlayerId | "draw" | null;
}

/** No legal moves for current player => game finished; winner is the opponent. */
export function endConditions(state: GameState): EndConditionsResult {
  if (state.status !== "playing") {
    return { finished: state.status === "finished", winner: state.winner };
  }
  const { settings, currentPlayer } = state;
  const { width, height } = settings;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isMoveLegal(state, x, y)) return { finished: false, winner: null };
    }
  }
  const opponent: PlayerId = currentPlayer === 1 ? 2 : 1;
  return { finished: true, winner: opponent };
}
