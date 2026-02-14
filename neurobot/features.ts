/**
 * Feature computation for neuro policy. Must match runtime neuroBot.ts (bias, isEmpty, isOurTerritory, wouldCapture, nearOpponent).
 */

import type { GameState, PlayerId } from "../src/core/model/types";
import { getCell } from "../src/core/model/board";
import { getLegalMoves, getEmptyLegalMoves } from "../src/core/bot/getLegalMoves";
import { getImmediateCaptures } from "../src/core/bot/simulate";

export const FEATURE_COUNT = 5;

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function getOpponentActivePoints(
  state: GameState,
  opponent: PlayerId
): Array<[number, number]> {
  const { board, settings } = state;
  const { width, height } = settings;
  const out: Array<[number, number]> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = getCell(board, x, y);
      if (cell.type === "point" && cell.owner === opponent && !cell.captured) {
        out.push([x, y]);
      }
    }
  }
  return out;
}

function isNearOpponent(
  x: number,
  y: number,
  opponentPoints: Array<[number, number]>
): boolean {
  return opponentPoints.some(([px, py]) => chebyshev(x, y, px, py) <= 2);
}

/** Feature vector for (x,y): [bias, isEmpty, isOurTerritory, wouldCapture, nearOpponent]. */
export function getMoveFeatures(
  state: GameState,
  x: number,
  y: number,
  opponentPoints: Array<[number, number]>
): number[] {
  const cell = getCell(state.board, x, y);
  const isEmpty = cell.type === "empty" ? 1 : 0;
  const isOurTerritory =
    cell.type === "territory" && cell.owner === state.currentPlayer ? 1 : 0;
  const wouldCapture = getImmediateCaptures(state, x, y) > 0 ? 1 : 0;
  const nearOpponent = isNearOpponent(x, y, opponentPoints) ? 1 : 0;
  return [1, isEmpty, isOurTerritory, wouldCapture, nearOpponent];
}

/** Easy-bot target: uniform over capturing moves, else over near-opponent moves, else over all legal. */
export function getEasyTargetDistribution(
  state: GameState
): { moves: Array<[number, number]>; probs: number[] } {
  let moves = getEmptyLegalMoves(state);
  if (moves.length === 0) moves = getLegalMoves(state);
  if (moves.length === 0) return { moves: [], probs: [] };

  const opponent: PlayerId = state.currentPlayer === 1 ? 2 : 1;
  const opponentPoints = getOpponentActivePoints(state, opponent);

  const withCapture = moves.filter(
    ([x, y]) => getImmediateCaptures(state, x, y) > 0
  );
  let candidates = withCapture.length > 0 ? withCapture : moves;

  if (candidates.length > 1 && withCapture.length === 0) {
    const nearOpp = candidates.filter(([x, y]) =>
      opponentPoints.some(([px, py]) => chebyshev(x, y, px, py) <= 2)
    );
    if (nearOpp.length > 0) candidates = nearOpp;
  }

  const n = candidates.length;
  const probs = candidates.map(() => 1 / n);
  return { moves: candidates, probs };
}

/** All legal moves for current state (empty-first like runtime). */
export function getCandidateMoves(state: GameState): Array<[number, number]> {
  let moves = getEmptyLegalMoves(state);
  if (moves.length === 0) moves = getLegalMoves(state);
  return moves;
}
