/**
 * Unit tests for getLegalMoves and getEmptyLegalMoves.
 */

import { describe, expect, it } from "vitest";
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

describe("getLegalMoves", () => {
  it("returns all empty cells when board is empty", () => {
    const state = makeState();
    const moves = getLegalMoves(state);
    expect(moves.length).toBe(25);
    expect(moves).toContainEqual([0, 0]);
    expect(moves).toContainEqual([2, 2]);
  });

  it("returns empty when status is not playing", () => {
    const state = makeState({ status: "finished" });
    expect(getLegalMoves(state)).toEqual([]);
  });
});

describe("getEmptyLegalMoves", () => {
  it("returns only moves on empty cells", () => {
    const state = makeState();
    const empty = getEmptyLegalMoves(state);
    const legal = getLegalMoves(state);
    expect(empty.length).toBe(legal.length);
    expect(empty.every(([x, y]) => state.board.get(`${x},${y}`) == null)).toBe(true);
  });

  it("excludes own territory when empty cells exist", () => {
    let board = setCell(new Map(), 1, 1, { type: "territory", owner: 2 });
    const state = makeState({ board });
    const empty = getEmptyLegalMoves(state);
    const legal = getLegalMoves(state);
    expect(legal.some(([x, y]) => x === 1 && y === 1)).toBe(true);
    expect(empty.some(([x, y]) => x === 1 && y === 1)).toBe(false);
    expect(empty.length).toBe(24);
  });

  it("returns empty when no empty cells (only own territory)", () => {
    const board = new Map<string, import("../model/types").CellState>();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        board.set(`${x},${y}`, { type: "territory", owner: 2 });
      }
    }
    const state = makeState({ board });
    const empty = getEmptyLegalMoves(state);
    expect(empty.length).toBe(0);
    const legal = getLegalMoves(state);
    expect(legal.length).toBe(25);
  });
});
