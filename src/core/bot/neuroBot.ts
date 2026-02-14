/**
 * Neuro bot: softmax policy over legal moves using learned weights (GDS §6).
 * Features per move: bias, isEmpty, isOurTerritory, wouldCapture, nearOpponent.
 */

import type { GameState, PlayerId } from "../model/types";
import { getCell } from "../model/board";
import { getEmptyLegalMoves, getLegalMoves } from "./getLegalMoves";
import { getImmediateCaptures } from "./simulate";
import { NEURO_WEIGHTS } from "./neuroWeights";

const FEATURE_COUNT = 5;

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function getOpponentActivePoints(state: GameState, opponent: PlayerId): Array<[number, number]> {
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
function getMoveFeatures(
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

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/** Softmax then argmax over scores; returns index of chosen move. */
function softmaxArgmax(scores: number[]): number {
  const max = Math.max(...scores);
  let sum = 0;
  const exp: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    const e = Math.exp(scores[i]! - max);
    exp.push(e);
    sum += e;
  }
  let bestIdx = 0;
  let bestProb = 0;
  for (let i = 0; i < exp.length; i++) {
    const p = exp[i]! / sum;
    if (p > bestProb) {
      bestProb = p;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function getNeuroMove(state: GameState): [number, number] | null {
  let moves = getEmptyLegalMoves(state);
  if (moves.length === 0) moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  const weights = NEURO_WEIGHTS;
  if (weights.length !== FEATURE_COUNT) return moves[0] ?? null;

  const opponent: PlayerId = state.currentPlayer === 1 ? 2 : 1;
  const opponentPoints = getOpponentActivePoints(state, opponent);

  const scores = moves.map(([x, y]) => {
    const feats = getMoveFeatures(state, x, y, opponentPoints);
    return dot(weights, feats);
  });

  const idx = softmaxArgmax(scores);
  const chosen = moves[idx];
  return chosen ?? moves[0] ?? null;
}
