/**
 * Neuro bot: softmax policy over legal moves using learned weights (GDS §6).
 * Features per move: bias, isEmpty, isOurTerritory, wouldCapture, nearOpponent.
 * Extended: prefer moves close to opponent points (pressure), probabilistic defense when threat of loss exists.
 */

import type { GameState, PlayerId } from "../model/types";
import type { GameSettings } from "../model/types";
import { getCell } from "../model/board";
import { getEmptyLegalMoves, getLegalMoves } from "./getLegalMoves";
import { getImmediateCaptures } from "./simulate";
import { applyMove, isMoveLegal } from "../rules/move";
import { NEURO_WEIGHTS } from "./neuroWeights";

const FEATURE_COUNT = 5;

function getBoardSizeParams(settings: GameSettings): { K: number; radius: number; budgetMs: number } {
  const N = settings.width * settings.height;
  if (N <= 100) return { K: 60, radius: 6, budgetMs: 120 };
  if (N <= 200) return { K: 40, radius: 2, budgetMs: 80 };
  return { K: 20, radius: 2, budgetMs: 50 };
}

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function minChebyshevDistanceToOpponent(
  x: number,
  y: number,
  opponentPoints: Array<[number, number]>
): number {
  if (opponentPoints.length === 0) return 0;
  return Math.min(...opponentPoints.map(([px, py]) => chebyshev(x, y, px, py)));
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

/** All active (non-captured) points on the board, both players. */
function getAllActivePoints(state: GameState): Array<[number, number]> {
  const { board, settings } = state;
  const { width, height } = settings;
  const out: Array<[number, number]> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = getCell(board, x, y);
      if (cell.type === "point" && !cell.captured) {
        out.push([x, y]);
      }
    }
  }
  return out;
}

/** Moves within Chebyshev radius of any active point; fallback to full legal moves when no anchors. Exported for tests. */
export function getRelevantMoves(state: GameState, radius: number): Array<[number, number]> {
  const anchors = getAllActivePoints(state);
  if (anchors.length === 0) {
    let m = getEmptyLegalMoves(state);
    if (m.length === 0) m = getLegalMoves(state);
    return m;
  }
  const { width, height } = state.settings;
  const candidateSet = new Set<string>();
  for (const [ax, ay] of anchors) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (chebyshev(0, 0, dx, dy) > radius) continue;
        const x = ax + dx;
        const y = ay + dy;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        candidateSet.add(`${x},${y}`);
      }
    }
  }
  const result: Array<[number, number]> = [];
  for (const key of candidateSet) {
    const parts = key.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (Number.isInteger(x) && Number.isInteger(y) && isMoveLegal(state, x, y)) {
      result.push([x, y]);
    }
  }
  return result;
}

function isNearOpponent(
  x: number,
  y: number,
  opponentPoints: Array<[number, number]>
): boolean {
  return opponentPoints.some(([px, py]) => chebyshev(x, y, px, py) <= 2);
}

/** Feature vector for (x,y): [bias, isEmpty, isOurTerritory, wouldCapture, nearOpponent]. wouldCapturePrecomputed avoids redundant getImmediateCaptures. */
function getMoveFeatures(
  state: GameState,
  x: number,
  y: number,
  opponentPoints: Array<[number, number]>,
  wouldCapturePrecomputed: number
): number[] {
  const cell = getCell(state.board, x, y);
  const isEmpty = cell.type === "empty" ? 1 : 0;
  const isOurTerritory =
    cell.type === "territory" && cell.owner === state.currentPlayer ? 1 : 0;
  const wouldCapture = wouldCapturePrecomputed;
  const nearOpponent = isNearOpponent(x, y, opponentPoints) ? 1 : 0;
  return [1, isEmpty, isOurTerritory, wouldCapture, nearOpponent];
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/** Max immediate captures for a given player; state must have currentPlayer === player for legal moves. When radius is set, only considers relevant moves. */
function maxImmediateCapturesForPlayer(
  state: GameState,
  player: PlayerId,
  radius?: number
): number {
  const stateAsPlayer: GameState = { ...state, currentPlayer: player };
  const candidateMoves =
    radius !== undefined
      ? getRelevantMoves(stateAsPlayer, radius)
      : (() => {
          let m = getEmptyLegalMoves(stateAsPlayer);
          if (m.length === 0) m = getLegalMoves(stateAsPlayer);
          return m;
        })();
  if (candidateMoves.length === 0) return 0;
  let maxCap = 0;
  for (const [x, y] of candidateMoves) {
    const cap = getImmediateCaptures(stateAsPlayer, x, y);
    if (cap > maxCap) maxCap = cap;
  }
  return maxCap;
}

/** Best capture bot can get on its next turn after bot move then opponent best response. When radius is set, uses relevant moves for opponent and bot follow-up. */
function estimateBotBestCaptureNextTurn(
  state: GameState,
  candidateMoves: Array<[number, number]>,
  deadline?: number,
  radius?: number
): number {
  let best = 0;
  for (const [bx, by] of candidateMoves) {
    if (deadline !== undefined && Date.now() > deadline) break;
    const stateAfterBot = applyMove(state, bx, by);
    const oppMoves =
      radius !== undefined
        ? getRelevantMoves(stateAfterBot, radius)
        : (() => {
            let m = getEmptyLegalMoves(stateAfterBot);
            if (m.length === 0) m = getLegalMoves(stateAfterBot);
            return m;
          })();
    let oppBestCap = 0;
    let oppBestMove: [number, number] | null = null;
    for (const [ox, oy] of oppMoves) {
      const c = getImmediateCaptures(stateAfterBot, ox, oy);
      if (c > oppBestCap) {
        oppBestCap = c;
        oppBestMove = [ox, oy];
      }
    }
    const stateAfterOpp = oppBestMove
      ? applyMove(stateAfterBot, oppBestMove[0], oppBestMove[1])
      : stateAfterBot;
    const botNext = maxImmediateCapturesForPlayer(stateAfterOpp, 2, radius);
    if (botNext > best) best = botNext;
  }
  return best;
}

/** Deterministic [0, 1) from state for reproducible defense/offense choice. Exported for tests. */
export function stateRandom01(state: GameState): number {
  let seed = state.moveHistory.length * 31 + (state.score[1] ?? 0) * 17 + (state.score[2] ?? 0) * 7;
  state.moveHistory.forEach((m, i) => {
    seed = (seed * 31 + m.x * 3 + m.y * 5 + (m.player === 1 ? 1 : 2) + i) >>> 0;
  });
  seed = seed || 1;
  const xorshift = (s: number) => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  const u = xorshift(seed) / (0xffffffff + 1);
  return u;
}

/** Defense probability and inputs. Exported for tests. */
export function getDefenseProbability(state: GameState): {
  pDef: number;
  lostNextTurn: number;
  botBestCaptureNextTurn: number;
} {
  let moves = getEmptyLegalMoves(state);
  if (moves.length === 0) moves = getLegalMoves(state);
  const { K, radius } = getBoardSizeParams(state.settings);
  const lostNextTurn = maxImmediateCapturesForPlayer({ ...state, currentPlayer: 1 }, 1, radius);
  const topKMoves = moves.slice(0, K);
  const botBestCaptureNextTurn = estimateBotBestCaptureNextTurn(state, topKMoves, undefined, radius);
  let pDef: number;
  if (lostNextTurn === 0) pDef = 0;
  else if (botBestCaptureNextTurn === 0) pDef = 1;
  else pDef = lostNextTurn / (lostNextTurn + botBestCaptureNextTurn);
  return { pDef, lostNextTurn, botBestCaptureNextTurn };
}

export interface GetNeuroMoveOptions {
  timeBudgetMs?: number;
}

export function getNeuroMove(state: GameState, options?: GetNeuroMoveOptions): [number, number] | null {
  let moves = getEmptyLegalMoves(state);
  if (moves.length === 0) moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  const weights = NEURO_WEIGHTS;
  if (weights.length !== FEATURE_COUNT) return moves[0] ?? null;

  const { K, radius, budgetMs } = getBoardSizeParams(state.settings);
  const deadline = Date.now() + (options?.timeBudgetMs ?? budgetMs);

  const opponent: PlayerId = state.currentPlayer === 1 ? 2 : 1;
  const opponentPoints = getOpponentActivePoints(state, opponent);

  const captureCounts = moves.map(([x, y]) => getImmediateCaptures(state, x, y));
  const distances = moves.map(([x, y]) => minChebyshevDistanceToOpponent(x, y, opponentPoints));
  const neuroScores = moves.map(([x, y], i) => {
    const wouldCapture = (captureCounts[i] ?? 0) > 0 ? 1 : 0;
    const feats = getMoveFeatures(state, x, y, opponentPoints, wouldCapture);
    return dot(weights, feats);
  });

  const offensiveScore = (i: number): number => {
    const cap = captureCounts[i] ?? 0;
    const dist = distances[i] ?? 0;
    const neuro = neuroScores[i] ?? 0;
    return cap * 1e6 - dist * 1e3 + neuro;
  };

  const indices = moves.map((_, i) => i);
  indices.sort((a, b) => offensiveScore(b) - offensiveScore(a));
  const topKIndices = indices.slice(0, K);
  const topKMoves = topKIndices.map((i) => moves[i]!);

  const lostNextTurn = maxImmediateCapturesForPlayer({ ...state, currentPlayer: 1 }, 1, radius);
  const botBestCaptureNextTurn = estimateBotBestCaptureNextTurn(state, topKMoves, deadline, radius);

  let pDef: number;
  if (lostNextTurn === 0) pDef = 0;
  else if (botBestCaptureNextTurn === 0) pDef = 1;
  else pDef = lostNextTurn / (lostNextTurn + botBestCaptureNextTurn);

  const shouldDefend = stateRandom01(state) < pDef;

  if (shouldDefend) {
    let bestIdx = topKIndices[0] ?? 0;
    let bestRisk = Infinity;
    for (const idx of topKIndices) {
      if (Date.now() > deadline) break;
      const [bx, by] = moves[idx]!;
      const stateAfterBot = applyMove(state, bx, by);
      const risk = maxImmediateCapturesForPlayer(stateAfterBot, opponent, radius);
      if (risk < bestRisk) {
        bestRisk = risk;
        bestIdx = idx;
      } else if (risk === bestRisk) {
        const cap = captureCounts[idx] ?? 0;
        const dist = distances[idx] ?? 0;
        const neuro = neuroScores[idx] ?? 0;
        const prevCap = captureCounts[bestIdx] ?? 0;
        const prevDist = distances[bestIdx] ?? 0;
        const prevNeuro = neuroScores[bestIdx] ?? 0;
        if (
          cap > prevCap ||
          (cap === prevCap && dist < prevDist) ||
          (cap === prevCap && dist === prevDist && neuro > prevNeuro)
        ) {
          bestIdx = idx;
        }
      }
    }
    const chosen = moves[bestIdx];
    return chosen ?? moves[0] ?? null;
  }

  const idx = indices[0];
  const chosen = idx !== undefined ? moves[idx] : moves[0];
  return chosen ?? null;
}
