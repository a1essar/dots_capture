/**
 * Unit tests for computeCapturesAfterMove (flood-fill capture + territory).
 */

import { describe, expect, it } from "vitest";
import { computeCapturesAfterMove } from "./computeCapturesAfterMove";
import type { CellState, GameState } from "../model/types";
import { getCell, setCell } from "../model/board";

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    settings: {
      width: 5,
      height: 5,
      mode: "PVP",
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

describe("computeCapturesAfterMove", () => {
  it("returns unchanged board and 0 delta when no opponent active points", () => {
    const state = makeState({ currentPlayer: 2 });
    const { board, scoreDelta } = computeCapturesAfterMove(state);
    expect(scoreDelta).toBe(0);
    expect(board).toBe(state.board);
  });

  it("does not capture when opponent point touches edge (flood reaches edge)", () => {
    let board = new Map<string, CellState>();
    board = setCell(board, 0, 0, { type: "point", owner: 2, captured: false });
    board = setCell(board, 1, 0, { type: "point", owner: 1, captured: false });
    const state = makeState({ board, currentPlayer: 2 });
    const { board: nextBoard, scoreDelta } = computeCapturesAfterMove(state);
    expect(scoreDelta).toBe(0);
    expect(getCell(nextBoard, 0, 0).type).toBe("point");
    const c = getCell(nextBoard, 0, 0);
    expect(c.type === "point" && !c.captured).toBe(true);
  });

  it("captures enclosed opponent point and marks empty as territory", () => {
    let board = new Map<string, CellState>();
    board = setCell(board, 2, 0, { type: "point", owner: 1, captured: false });
    board = setCell(board, 1, 1, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 1, { type: "point", owner: 1, captured: false });
    board = setCell(board, 1, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 1, 3, { type: "point", owner: 1, captured: false });
    board = setCell(board, 2, 3, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 3, { type: "point", owner: 1, captured: false });
    board = setCell(board, 2, 1, { type: "point", owner: 2, captured: false });
    const state = makeState({ board, currentPlayer: 2 });
    const { board: nextBoard, scoreDelta } = computeCapturesAfterMove(state);
    expect(scoreDelta).toBe(1);
    const p = getCell(nextBoard, 2, 1);
    expect(p.type).toBe("point");
    expect(p.type === "point" && p.captured).toBe(true);
    if (p.type === "point" && p.captured) expect(p.capturedBy).toBe(1);
    const territoryCell = getCell(nextBoard, 2, 2);
    expect(territoryCell.type).toBe("territory");
    expect(territoryCell.type === "territory" && territoryCell.owner).toBe(1);
  });

  it("awards +1 per newly captured point in one enclosed region", () => {
    let board = new Map<string, CellState>();
    board = setCell(board, 1, 1, { type: "point", owner: 2, captured: false });
    board = setCell(board, 2, 1, { type: "point", owner: 2, captured: false });
    board = setCell(board, 1, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 2, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 1, 0, { type: "point", owner: 1, captured: false });
    board = setCell(board, 2, 0, { type: "point", owner: 1, captured: false });
    board = setCell(board, 0, 1, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 1, { type: "point", owner: 1, captured: false });
    board = setCell(board, 0, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 2, { type: "point", owner: 1, captured: false });
    const state = makeState({ board, currentPlayer: 2 });
    const { scoreDelta } = computeCapturesAfterMove(state);
    expect(scoreDelta).toBe(2);
  });

  it("does not treat captured points as walls (fill passes through them)", () => {
    let board = new Map<string, CellState>();
    board = setCell(board, 2, 2, { type: "point", owner: 2, captured: false });
    board = setCell(board, 2, 1, { type: "point", owner: 1, captured: true, capturedBy: 2 });
    board = setCell(board, 1, 1, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 1, { type: "point", owner: 1, captured: false });
    board = setCell(board, 1, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 3, 2, { type: "point", owner: 1, captured: false });
    board = setCell(board, 2, 3, { type: "point", owner: 1, captured: false });
    board = setCell(board, 2, 0, { type: "point", owner: 1, captured: false });
    const state = makeState({ board, currentPlayer: 2 });
    const { board: nextBoard, scoreDelta } = computeCapturesAfterMove(state);
    expect(scoreDelta).toBe(1);
    const p = getCell(nextBoard, 2, 2);
    expect(p.type === "point" && p.captured).toBe(true);
  });
});
