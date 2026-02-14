/**
 * Unit tests for move legality and applyMove. No capture.
 */

import { describe, expect, it } from "vitest";
import { applyMove, endConditions, isMoveLegal } from "./move";
import type { CellState, GameState } from "../model/types";
import { setCell } from "../model/board";

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    settings: { width: 5, height: 5, mode: "PVP", playerColors: { 1: "#000", 2: "#fff" } },
    board: new Map(),
    score: { 1: 0, 2: 0 },
    currentPlayer: 1,
    status: "playing",
    winner: null,
    moveHistory: [],
    ...overrides,
  };
}

describe("isMoveLegal", () => {
  it("returns true for empty cell in bounds", () => {
    const state = makeState();
    expect(isMoveLegal(state, 0, 0)).toBe(true);
    expect(isMoveLegal(state, 2, 2)).toBe(true);
    expect(isMoveLegal(state, 4, 4)).toBe(true);
  });

  it("returns false when out of bounds", () => {
    const state = makeState();
    expect(isMoveLegal(state, -1, 0)).toBe(false);
    expect(isMoveLegal(state, 0, -1)).toBe(false);
    expect(isMoveLegal(state, 5, 0)).toBe(false);
    expect(isMoveLegal(state, 0, 5)).toBe(false);
  });

  it("returns false when cell has a point (any owner)", () => {
    const board = setCell(new Map<string, CellState>(), 1, 1, { type: "point", owner: 1, captured: false });
    const state = makeState({ board });
    expect(isMoveLegal(state, 1, 1)).toBe(false);
  });

  it("returns false when cell is opponent territory", () => {
    const board = setCell(new Map<string, CellState>(), 2, 2, { type: "territory", owner: 2 });
    const state = makeState({ board, currentPlayer: 1 });
    expect(isMoveLegal(state, 2, 2)).toBe(false);
  });

  it("returns true when cell is own territory", () => {
    const board = setCell(new Map<string, CellState>(), 2, 2, { type: "territory", owner: 1 });
    const state = makeState({ board, currentPlayer: 1 });
    expect(isMoveLegal(state, 2, 2)).toBe(true);
  });

  it("returns false when status is not playing", () => {
    const state = makeState({ status: "finished" });
    expect(isMoveLegal(state, 0, 0)).toBe(false);
  });
});

describe("applyMove", () => {
  it("places point, appends moveHistory, toggles currentPlayer", () => {
    const state = makeState();
    const next = applyMove(state, 1, 2);
    expect(next.board.get("1,2")).toEqual({ type: "point", owner: 1, captured: false });
    expect(next.moveHistory).toEqual([{ x: 1, y: 2, player: 1 }]);
    expect(next.currentPlayer).toBe(2);
    expect(state.board.has("1,2")).toBe(false);
    expect(state.currentPlayer).toBe(1);
  });

  it("second move keeps history and toggles back to 1", () => {
    let state = makeState();
    state = applyMove(state, 0, 0);
    state = applyMove(state, 1, 1);
    expect(state.moveHistory).toHaveLength(2);
    expect(state.moveHistory[1]).toEqual({ x: 1, y: 1, player: 2 });
    expect(state.currentPlayer).toBe(1);
  });
});

describe("endConditions", () => {
  it("returns not finished when there is at least one legal move", () => {
    const state = makeState();
    expect(endConditions(state)).toEqual({ finished: false, winner: null });
  });

  it("returns finished with opponent as winner when current player has no legal moves", () => {
    let board = new Map<string, CellState>();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) board = setCell(board, x, y, { type: "point", owner: 1, captured: false });
    const state = makeState({ board, currentPlayer: 2 });
    expect(endConditions(state)).toEqual({ finished: true, winner: 1 });
  });

  it("when player 1 has no moves, winner is 2", () => {
    let board = new Map<string, CellState>();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) board = setCell(board, x, y, { type: "point", owner: 2, captured: false });
    const state = makeState({ board, currentPlayer: 1 });
    expect(endConditions(state)).toEqual({ finished: true, winner: 2 });
  });

  it("passes through when status is already finished", () => {
    const state = makeState({ status: "finished", winner: 1 });
    expect(endConditions(state)).toEqual({ finished: true, winner: 1 });
  });
});
