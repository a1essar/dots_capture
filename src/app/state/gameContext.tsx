import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import type { GameSettings } from "../../core/model/types";
import type { GameState } from "../../core/model/types";
import { applyMove, getBotMove, isMoveLegal } from "../../core";
import { gameReducer, type GameAction, type GameStateOrNull } from "./gameReducer";

export type PlacePointResult =
  | { accepted: true; state: GameState }
  | { accepted: false };

interface GameContextValue {
  gameState: GameStateOrNull;
  dispatch: React.Dispatch<GameAction>;
  /** Optional onReady called after state is committed (for navigate after Start Game). */
  startMatch: (settings: GameSettings, onReady?: () => void) => void;
  clearGame: () => void;
  placePoint: (x: number, y: number) => PlacePointResult;
  botThinking: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, dispatch] = useReducer(gameReducer, null);
  const [botThinking, setBotThinking] = useState(false);
  const botScheduledRef = useRef(false);

  const startMatch = useCallback((settings: GameSettings, onReady?: () => void) => {
    flushSync(() => dispatch({ type: "NEW_MATCH", payload: settings }));
    if (onReady) onReady();
  }, []);

  const clearGame = useCallback(() => {
    dispatch({ type: "CLEAR_GAME" });
  }, []);

  const placePoint = useCallback(
    (x: number, y: number): PlacePointResult => {
      if (botThinking) return { accepted: false };
      if (!gameState || gameState.status !== "playing") return { accepted: false };
      if (!isMoveLegal(gameState, x, y)) return { accepted: false };
      const nextState = applyMove(gameState, x, y);
      dispatch({ type: "PLACE_POINT", payload: { x, y } });
      return { accepted: true, state: nextState };
    },
    [gameState, dispatch, botThinking]
  );

  useEffect(() => {
    if (
      !gameState ||
      gameState.status !== "playing" ||
      gameState.settings.mode !== "PVC" ||
      gameState.currentPlayer !== 2 ||
      botThinking ||
      botScheduledRef.current
    ) {
      return;
    }
    botScheduledRef.current = true;
    setBotThinking(true);

    const stateSnapshot = gameState;
    const difficulty = gameState.settings.botDifficulty ?? "neuro";

    const timerId = setTimeout(() => {
      const move = getBotMove(stateSnapshot, difficulty, { timeBudgetMs: 200 });
      if (move) {
        dispatch({ type: "PLACE_POINT", payload: { x: move.x, y: move.y } });
      } else {
        dispatch({ type: "FINISH", payload: { winner: 1 } });
      }
      setBotThinking(false);
      botScheduledRef.current = false;
    }, 0);

    return () => clearTimeout(timerId);
  }, [gameState]);

  const value: GameContextValue = {
    gameState,
    dispatch,
    startMatch,
    clearGame,
    placePoint,
    botThinking,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider are coupled
export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
