/**
 * Given current state and a hypothetical move (x,y), compute whether it would
 * create a capture. Uses applyMove + computeCapturesAfterMove via simulation
 * without mutating real state. Returns would-be territory and captured points.
 */

import type { GameState, PlayerId } from "../model/types";
import { getCell, setCell, fromKey } from "../model/board";
import { isMoveLegal } from "../rules/move";
import { computeCapturesAfterMove } from "./computeCapturesAfterMove";

export interface PotentialCaptureResult {
  territory: Array<{ x: number; y: number }>;
  capturedPoints: Array<{ x: number; y: number }>;
}

/**
 * Returns would-be territory and captured points if current player placed at (x,y).
 * Returns null if move is illegal or would not result in a capture.
 */
export function getPotentialCapture(
  state: GameState,
  x: number,
  y: number
): PotentialCaptureResult | null {
  if (!isMoveLegal(state, x, y)) return null;

  const player = state.currentPlayer;
  const nextBoard = setCell(state.board, x, y, {
    type: "point",
    owner: player,
    captured: false,
  });
  const nextPlayer: PlayerId = player === 1 ? 2 : 1;
  const stateAfterPlace: GameState = {
    ...state,
    board: nextBoard,
    currentPlayer: nextPlayer,
    moveHistory: [...state.moveHistory, { x, y, player }],
  };

  const { board: boardAfterCapture, scoreDelta } = computeCapturesAfterMove(stateAfterPlace);
  if (scoreDelta === 0) return null;

  const territory: Array<{ x: number; y: number }> = [];
  const capturedPoints: Array<{ x: number; y: number }> = [];

  for (const key of boardAfterCapture.keys()) {
    const coords = fromKey(key);
    if (!coords) continue;
    const [cx, cy] = coords;
    const after = getCell(boardAfterCapture, cx, cy);
    const before = getCell(stateAfterPlace.board, cx, cy);

    if (after.type === "territory" && before.type === "empty") {
      territory.push({ x: cx, y: cy });
    }
    if (
      after.type === "point" &&
      after.captured &&
      before.type === "point" &&
      !before.captured
    ) {
      capturedPoints.push({ x: cx, y: cy });
    }
  }

  return { territory, capturedPoints };
}
