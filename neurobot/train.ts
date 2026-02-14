/**
 * Train neuro policy: easy vs easy self-play, SGD on cross-entropy vs easy target.
 * Writes neurobot/weights.json and overwrites src/core/bot/neuroWeights.ts.
 */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { GameState, GameSettings } from "../src/core/model/types";
import { applyMove, endConditions } from "../src/core";
import {
  FEATURE_COUNT,
  getMoveFeatures,
  getEasyTargetDistribution,
  getCandidateMoves,
  getOpponentActivePoints,
} from "./features";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function createInitialState(settings: GameSettings): GameState {
  return {
    settings,
    board: new Map(),
    score: { 1: 0, 2: 0 },
    currentPlayer: 1,
    status: "playing",
    winner: null,
    moveHistory: [],
  };
}

/** Sample index from discrete distribution. */
function sampleIndex(probs: number[]): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]!;
    if (r < acc) return i;
  }
  return probs.length - 1;
}

/** Expand easy target to full move list: same order as getCandidateMoves, 0 for non-candidates. */
function expandTarget(
  allMoves: Array<[number, number]>,
  easyMoves: Array<[number, number]>,
  easyProbs: number[]
): number[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const easySet = new Map<string, number>();
  for (let i = 0; i < easyMoves.length; i++) {
    const [x, y] = easyMoves[i]!;
    easySet.set(key(x, y), easyProbs[i]!);
  }
  return allMoves.map(([x, y]) => easySet.get(key(x, y)) ?? 0);
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exp = scores.map((s) => Math.exp(s - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((e) => e / sum);
}

/** Cross-entropy loss and gradient of loss w.r.t. scores (logits). */
function crossEntropyGrad(
  probs: number[],
  target: number[]
): { loss: number; gradScores: number[] } {
  let loss = 0;
  const gradScores: number[] = [];
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i]!;
    const t = target[i]!;
    loss -= t * Math.log(p + 1e-10);
    gradScores.push(p - t);
  }
  return { loss, gradScores };
}

const WIDTH = 20;
const HEIGHT = 20;
const NUM_GAMES = 50;
const LEARNING_RATE = 0.1;
const MAX_MOVES_PER_GAME = 200;

const defaultSettings: GameSettings = {
  width: WIDTH,
  height: HEIGHT,
  mode: "PVC",
  playerColors: { 1: "#000", 2: "#fff" },
};

function main(): void {
  console.log("Neurobot training: easy vs easy self-play...");
  let weights = [0, 0.5, -0.3, 1.2, 0.4];
  if (weights.length !== FEATURE_COUNT) {
    throw new Error(`weights length must be ${FEATURE_COUNT}`);
  }

  let totalLoss = 0;
  let steps = 0;

  for (let g = 0; g < NUM_GAMES; g++) {
    let state = createInitialState(defaultSettings);
    let movesInGame = 0;

    while (
      state.status === "playing" &&
      movesInGame < MAX_MOVES_PER_GAME
    ) {
      const moves = getCandidateMoves(state);
      if (moves.length === 0) break;

      const { moves: easyMoves, probs: easyProbs } =
        getEasyTargetDistribution(state);
      const target = expandTarget(moves, easyMoves, easyProbs);

      const opponent = state.currentPlayer === 1 ? 2 : 1;
      const opponentPoints = getOpponentActivePoints(state, opponent);

      const features = moves.map(([x, y]) =>
        getMoveFeatures(state, x, y, opponentPoints)
      );
      const scores = features.map((f) => {
        let s = 0;
        for (let i = 0; i < FEATURE_COUNT; i++) s += weights[i]! * f[i]!;
        return s;
      });
      const probs = softmax(scores);
      const { loss, gradScores } = crossEntropyGrad(probs, target);

      for (let k = 0; k < FEATURE_COUNT; k++) {
        let grad = 0;
        for (let i = 0; i < moves.length; i++) {
          grad += gradScores[i]! * features[i]![k]!;
        }
        weights[k] = weights[k]! - LEARNING_RATE * grad;
      }

      totalLoss += loss;
      steps += 1;

      const chosenIdx = sampleIndex(easyProbs);
      const [mx, my] = easyMoves[chosenIdx]!;
      state = applyMove(state, mx, my);
      const end = endConditions(state);
      if (end.finished) {
        state = { ...state, status: "finished", winner: end.winner };
        break;
      }
      movesInGame += 1;
    }

    if ((g + 1) % 25 === 0 || g === NUM_GAMES - 1) {
      const avg = steps > 0 ? totalLoss / steps : 0;
      console.log(`Game ${g + 1}/${NUM_GAMES} avg loss=${avg.toFixed(4)} steps=${steps}`);
    }
  }

  const weightsPath = join(ROOT, "neurobot", "weights.json");
  writeFileSync(
    weightsPath,
    JSON.stringify(weights, null, 2),
    "utf-8"
  );
  console.log(`Wrote ${weightsPath}`);

  const neuroWeightsPath = join(ROOT, "src", "core", "bot", "neuroWeights.ts");
  const tsContent = `/**
 * Runtime weights for neuro policy. Overwritten by neurobot training output.
 * Feature order: bias, isEmpty, isOurTerritory, wouldCapture, nearOpponent.
 */
export const NEURO_WEIGHTS: number[] = ${JSON.stringify(weights)};
`;
  writeFileSync(neuroWeightsPath, tsContent, "utf-8");
  console.log(`Wrote ${neuroWeightsPath}`);
}

main();
