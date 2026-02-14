/**
 * Game state reducer. Actions: NEW_MATCH, CLEAR_GAME, PLACE_POINT, RESTART, SURRENDER, FINISH.
 * Core rules (isMoveLegal, applyMove, capture) live in core/ and are wired in TASK-004/TASK-005.
 */

import type { GameState, GameSettings } from "../../core/model/types";
import { applyMove, endConditions, isMoveLegal } from "../../core";

export type GameStateOrNull = GameState | null;

export type GameAction =
  | { type: "NEW_MATCH"; payload: GameSettings }
  | { type: "CLEAR_GAME" }
  | { type: "PLACE_POINT"; payload: { x: number; y: number } }
  | { type: "RESTART" }
  | { type: "SURRENDER" }
  | { type: "FINISH"; payload?: { winner: 1 | 2 | "draw" | null } };

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

export function gameReducer(state: GameStateOrNull, action: GameAction): GameStateOrNull {
  switch (action.type) {
    case "NEW_MATCH":
      return createInitialState(action.payload);

    case "CLEAR_GAME":
      return null;

    case "PLACE_POINT": {
      if (!state || state.status !== "playing") return state;
      const { x, y } = action.payload;
      if (!isMoveLegal(state, x, y)) return state;
      const nextState = applyMove(state, x, y);
      const end = endConditions(nextState);
      if (end.finished)
        return { ...nextState, status: "finished" as const, winner: end.winner };
      return nextState;
    }

    case "RESTART":
      if (!state) return null;
      return createInitialState(state.settings);

    case "SURRENDER":
      if (!state || state.status !== "playing") return state;
      return {
        ...state,
        status: "finished",
        winner: state.currentPlayer === 1 ? 2 : 1,
      };

    case "FINISH":
      if (!state) return state;
      return {
        ...state,
        status: "finished",
        winner: action.payload?.winner ?? null,
      };

    default:
      return state;
  }
}
