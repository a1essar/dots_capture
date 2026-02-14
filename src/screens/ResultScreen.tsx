import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useGame } from "../app/state/gameContext";

export default function ResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameState, startMatch, clearGame } = useGame();

  useEffect(() => {
    if (
      gameState?.status === "playing" &&
      location.pathname === "/result"
    ) {
      navigate("/game", { replace: true });
    }
  }, [gameState?.status, location.pathname, navigate]);

  if (!gameState || gameState.status !== "finished") return null;

  const { score, winner } = gameState;
  const title =
    winner === null || winner === "draw"
      ? "Draw"
      : `Winner: Player ${winner}`;

  const handleRematch = () => {
    startMatch(gameState.settings, () => navigate("/game", { replace: true }));
  };

  const handleBackToMenu = () => {
    clearGame();
    navigate("/");
  };

  return (
    <div
      className="min-h-dvh bg-slate-950 text-slate-50 flex items-center"
      data-testid="screen-result"
    >
      <div className="w-full max-w-lg mx-auto p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
        <h1 className="text-2xl font-semibold" data-testid="result-title">
          {title}
        </h1>
        <p className="text-slate-400 text-sm mt-2" data-testid="result-score">
          Final score: {score[1]} : {score[2]}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleRematch}
            className="rounded-lg bg-slate-600 hover:bg-slate-500 px-4 py-3 text-center font-medium"
            data-testid="link-rematch"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={handleBackToMenu}
            className="rounded-lg border border-slate-600 hover:bg-slate-800 px-4 py-3 text-center font-medium"
            data-testid="link-back-menu"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
