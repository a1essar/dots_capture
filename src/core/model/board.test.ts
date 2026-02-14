/**
 * Unit tests for core board helpers. No React/Pixi imports.
 */

import { describe, expect, it } from "vitest";
import {
  fromKey,
  getCell,
  setCell,
  setCells,
  toKey,
} from "./board";
import type { CellState } from "./types";

describe("toKey", () => {
  it("returns 'x,y' for integer coordinates", () => {
    expect(toKey(0, 0)).toBe("0,0");
    expect(toKey(5, 10)).toBe("5,10");
    expect(toKey(19, 19)).toBe("19,19");
  });
});

describe("fromKey", () => {
  it("parses 'x,y' to [x, y]", () => {
    expect(fromKey("0,0")).toEqual([0, 0]);
    expect(fromKey("5,10")).toEqual([5, 10]);
  });

  it("returns undefined for invalid format", () => {
    expect(fromKey("")).toBeUndefined();
    expect(fromKey("1")).toBeUndefined();
    expect(fromKey("1,2,3")).toBeUndefined();
    expect(fromKey("a,1")).toBeUndefined();
    expect(fromKey("1,1.5")).toBeUndefined();
  });
});

describe("getCell", () => {
  it("returns empty when key is absent", () => {
    const board = new Map<string, CellState>();
    expect(getCell(board, 0, 0)).toEqual({ type: "empty" });
  });

  it("returns stored state when key exists", () => {
    const board = new Map<string, CellState>([
      ["1,2", { type: "point", owner: 1, captured: false }],
    ]);
    expect(getCell(board, 1, 2)).toEqual({
      type: "point",
      owner: 1,
      captured: false,
    });
  });
});

describe("setCell", () => {
  it("returns new map with cell set; original unchanged", () => {
    const board = new Map<string, CellState>();
    const point: CellState = { type: "point", owner: 1, captured: false };
    const next = setCell(board, 2, 3, point);
    expect(next).not.toBe(board);
    expect(next.get("2,3")).toEqual(point);
    expect(board.has("2,3")).toBe(false);
  });

  it("returns same map when setting empty and key absent", () => {
    const board = new Map<string, CellState>();
    const next = setCell(board, 0, 0, { type: "empty" });
    expect(next).toBe(board);
  });

  it("returns new map with key removed when setting empty over existing", () => {
    const board = new Map<string, CellState>([
      ["1,1", { type: "point", owner: 2, captured: false }],
    ]);
    const next = setCell(board, 1, 1, { type: "empty" });
    expect(next.has("1,1")).toBe(false);
    expect(board.has("1,1")).toBe(true);
  });
});

describe("setCells", () => {
  it("applies multiple updates immutably", () => {
    const board = new Map<string, CellState>();
    const next = setCells(board, [
      { x: 0, y: 0, state: { type: "point", owner: 1, captured: false } },
      { x: 1, y: 0, state: { type: "territory", owner: 1 } },
    ]);
    expect(next.size).toBe(2);
    expect(getCell(next, 0, 0).type).toBe("point");
    expect(getCell(next, 1, 0).type).toBe("territory");
    expect(board.size).toBe(0);
  });

  it("returns same map when updates is empty", () => {
    const board = new Map<string, CellState>();
    expect(setCells(board, [])).toBe(board);
  });
});
