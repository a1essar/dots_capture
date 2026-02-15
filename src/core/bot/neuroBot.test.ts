/**
 * Unit tests for neuro bot: legal move only, null when no moves;
 * defense probability formula and deterministic RNG.
 */

import { describe, expect, it } from "vitest";
import { getNeuroMove, getDefenseProbability, stateRandom01, getRelevantMoves } from "./neuroBot";
import { getEmptyLegalMoves, getLegalMoves } from "./getLegalMoves";
import type { GameState } from "../model/types";
import { setCell } from "../model/board";
import { isMoveLegal } from "../rules/move";

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    settings: {
      width: 5,
      height: 5,
      mode: "PVC",
      playerColors: { 1: "#000", 2: "#fff" },
    },
    board: new Map(),
    score: { 1: 0, 2: 0 },
    currentPlayer: 2,
    status: "playing",
    winner: null,
    moveHistory: [],
    ...overrides,
  };
}

describe("getNeuroMove", () => {
  it("returns null when no legal moves", () => {
    const state = makeState({ status: "finished" });
    expect(getNeuroMove(state)).toBeNull();
  });

  it("prefers empty over own territory when both are legal", () => {
    const board = setCell(new Map(), 1, 1, { type: "territory", owner: 2 });
    const state = makeState({ board });
    const emptyMoves = getEmptyLegalMoves(state);
    expect(emptyMoves.length).toBeGreaterThan(0);
    const move = getNeuroMove(state);
    expect(move).not.toBeNull();
    expect(emptyMoves.some(([x, y]) => move![0] === x && move![1] === y)).toBe(
      true
    );
  });

  it("returns a legal move when only territory cells available", () => {
    const board = new Map<string, import("../model/types").CellState>();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (x !== 2 || y !== 2) {
          board.set(`${x},${y}`, { type: "territory", owner: 2 });
        }
      }
    }
    const state = makeState({ board });
    const move = getNeuroMove(state);
    expect(move).not.toBeNull();
    const legal = getLegalMoves(state);
    expect(legal.some(([x, y]) => move![0] === x && move![1] === y)).toBe(true);
  });
});

describe("getDefenseProbability", () => {
  it("returns pDef 0 when lostNextTurn is 0", () => {
    const state = makeState();
    const { pDef, lostNextTurn } = getDefenseProbability(state);
    expect(lostNextTurn).toBe(0);
    expect(pDef).toBe(0);
  });

  it("pDef satisfies formula: 0 when no threat, 1 when bot cannot capture next, else lost/(lost+botNext)", () => {
    const state = makeState();
    const { pDef, lostNextTurn, botBestCaptureNextTurn } = getDefenseProbability(state);
    const expected =
      lostNextTurn === 0
        ? 0
        : botBestCaptureNextTurn === 0
          ? 1
          : lostNextTurn / (lostNextTurn + botBestCaptureNextTurn);
    expect(pDef).toBe(expected);
  });
});

describe("stateRandom01", () => {
  it("returns value in [0, 1)", () => {
    const state = makeState();
    const u = stateRandom01(state);
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(1);
  });

  it("is deterministic for the same state", () => {
    const state = makeState();
    expect(stateRandom01(state)).toBe(stateRandom01(state));
  });

  it("differs for different moveHistory (different seed)", () => {
    const a = makeState({ moveHistory: [] });
    const b = makeState({ moveHistory: [{ x: 0, y: 0, player: 1 }] });
    expect(stateRandom01(a)).not.toBe(stateRandom01(b));
  });
});

describe("getRelevantMoves", () => {
  it("on empty board falls back to full legal moves (same count as getEmptyLegalMoves)", () => {
    const state = makeState();
    const relevant = getRelevantMoves(state, 2);
    const empty = getEmptyLegalMoves(state);
    expect(relevant.length).toBe(empty.length);
    expect(relevant.length).toBeGreaterThan(0);
  });

  it("all returned moves are legal", () => {
    const state = makeState();
    const relevant = getRelevantMoves(state, 3);
    for (const [x, y] of relevant) {
      expect(isMoveLegal(state, x, y)).toBe(true);
    }
  });
});
