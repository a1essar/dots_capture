/**
 * Unit tests for neuro bot: legal move only, null when no moves.
 */

import { describe, expect, it } from "vitest";
import { getNeuroMove } from "./neuroBot";
import { getEmptyLegalMoves, getLegalMoves } from "./getLegalMoves";
import type { GameState } from "../model/types";
import { setCell } from "../model/board";

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
