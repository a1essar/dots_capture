import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../app/state/gameContext";
import { usePrefersReducedMotion } from "../app/hooks/usePrefersReducedMotion";
import { useUISettings } from "../app/state/uiSettingsContext";
import { isMoveLegal, getPotentialCapture } from "../core";
import { PixiBoardView } from "../renderer";

export default function GameScreen() {
  const navigate = useNavigate();
  const { gameState, dispatch, clearGame, botThinking, placePoint } = useGame();
  const { settings: uiSettings } = useUISettings();
  const prefersReducedMotion = usePrefersReducedMotion();
  const effectiveAnimations =
    uiSettings.animations && !uiSettings.reducedMotion && !prefersReducedMotion;

  const isMoveValid = useCallback(
    (x: number, y: number) => Boolean(gameState && isMoveLegal(gameState, x, y)),
    [gameState]
  );

  const getPotentialCaptureCallback = useCallback(
    (x: number, y: number) =>
      gameState && uiSettings.highlightCapture ? getPotentialCapture(gameState, x, y) : null,
    [gameState, uiSettings.highlightCapture]
  );

  const inputBlocked = useMemo(
    () => botThinking || !gameState || gameState.status !== "playing",
    [botThinking, gameState]
  );

  if (!gameState) return null;

  const { score, currentPlayer, settings } = gameState;
  const title = `${settings.mode} ${settings.width}×${settings.height}`;

  const handleBackToMenu = () => {
    clearGame();
    navigate("/");
  };

  const handleSurrender = () => {
    dispatch({ type: "SURRENDER" });
    navigate("/result");
  };

  const handleRestart = () => {
    dispatch({ type: "RESTART" });
  };

  return (
    <div
      className="h-dvh bg-slate-950 text-slate-50 flex flex-col"
      data-testid="screen-game"
    >
      <header className="shrink-0 h-12 px-3 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <button
          type="button"
          onClick={handleBackToMenu}
          className="text-slate-400 hover:text-slate-50"
          data-testid="link-back-menu"
        >
          Back to Menu
        </button>
        <span className="text-sm font-medium">{title}</span>
      </header>
      <div className="shrink-0 px-3 py-2 flex items-center justify-between gap-3">
        <span className="text-slate-400" data-testid="game-score">
          Score: {score[1]} : {score[2]}
        </span>
        <span className="text-sm flex items-center gap-2" data-testid="game-turn">
          {botThinking ? (
            "Bot thinking…"
          ) : (
            <>
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full border border-slate-600"
                style={{ backgroundColor: settings.playerColors[currentPlayer] }}
                aria-hidden
              />
              <span>Player {currentPlayer} turn</span>
            </>
          )}
        </span>
      </div>
      <div className="flex-1 min-h-0 px-2 pb-2">
        <div
          className="w-full h-full rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden"
          data-testid="canvas-container"
        >
          <PixiBoardView
            gameState={gameState}
            uiSettings={uiSettings}
            effectiveAnimations={effectiveAnimations}
            placePoint={placePoint}
            isMoveValid={isMoveValid}
            inputBlocked={inputBlocked}
            getPotentialCapture={
              uiSettings.highlightCapture ? getPotentialCaptureCallback : undefined
            }
          />
        </div>
      </div>
      <div className="shrink-0 p-3 grid grid-cols-3 gap-2 border-t border-slate-800 bg-slate-950/80 backdrop-blur">
        <button
          type="button"
          onClick={handleSurrender}
          className="rounded-lg border border-slate-600 py-2 text-sm"
          data-testid="button-surrender"
        >
          Surrender
        </button>
        <button
          type="button"
          onClick={handleRestart}
          className="rounded-lg border border-slate-600 py-2 text-sm"
          data-testid="button-restart"
        >
          Restart
        </button>
      </div>
    </div>
  );
}
