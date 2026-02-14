import { Link } from "react-router-dom";

export default function StartScreen() {
  return (
    <div
      className="min-h-dvh bg-slate-950 text-slate-50 flex items-center"
      data-testid="screen-start"
    >
      <div
        className="w-full max-w-md mx-auto p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow"
        data-testid="start-card"
      >
        <h1 className="text-2xl font-semibold" data-testid="start-title">
          Contours
        </h1>
        <p className="text-slate-400 text-sm mt-1" data-testid="start-subtitle">
          Connect the dots
        </p>
        <div className="mt-6 grid gap-3" data-testid="start-actions">
          <Link
            to="/match?mode=PVP"
            className="rounded-lg bg-slate-600 hover:bg-slate-500 px-4 py-3 text-center font-medium transition-colors"
            data-testid="link-pvp"
          >
            Player vs Player
          </Link>
          <Link
            to="/match?mode=PVC"
            className="rounded-lg bg-slate-600 hover:bg-slate-500 px-4 py-3 text-center font-medium transition-colors"
            data-testid="link-pvc"
          >
            Player vs Computer
          </Link>
          <Link
            to="/settings"
            className="rounded-lg border border-slate-600 hover:bg-slate-800 px-4 py-3 text-center font-medium transition-colors"
            data-testid="link-settings"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
