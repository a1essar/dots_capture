import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useGame } from "../state/gameContext";

function isValidGameState(
  state: { settings: { width: number; height: number } } | null
): state is NonNullable<typeof state> {
  if (!state?.settings) return false;
  const { width, height } = state.settings;
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  );
}

/**
 * Renders children only when there is a valid game state (from /match or rematch).
 * No state or invalid settings -> /match; finished state -> /result.
 */
export function GameRouteGuard({ children }: { children: ReactNode }) {
  const { gameState } = useGame();
  if (!gameState || !isValidGameState(gameState))
    return <Navigate to="/match" replace />;
  if (gameState.status === "finished") return <Navigate to="/result" replace />;
  return <>{children}</>;
}

/**
 * Renders children only when game is finished. Otherwise redirects to /game.
 */
export function ResultRouteGuard({ children }: { children: ReactNode }) {
  const { gameState } = useGame();
  if (!gameState) {
    return <Navigate to="/match" replace />;
  }
  if (gameState.status !== "finished") {
    return <Navigate to="/game" replace />;
  }
  return <>{children}</>;
}
