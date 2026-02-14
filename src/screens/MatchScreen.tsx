import { useSearchParams, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import type { GameSettings, PlayerId } from "../core/model/types";
import { useGame } from "../app/state/gameContext";

const PRESETS = [
  { width: 10, height: 10, label: "10×10" },
  { width: 10, height: 20, label: "10×20" },
  { width: 20, height: 20, label: "20×20" },
] as const;

const PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const DEFAULT_COLOR_1 = "#3b82f6";
const DEFAULT_COLOR_2 = "#ef4444";

export default function MatchScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { startMatch, clearGame } = useGame();
  const mode = (searchParams.get("mode") === "PVC" ? "PVC" : "PVP") as "PVP" | "PVC";

  const [presetIndex, setPresetIndex] = useState(0);
  const [color1, setColor1] = useState(DEFAULT_COLOR_1);
  const [color2, setColor2] = useState(DEFAULT_COLOR_2);

  const preset = PRESETS[presetIndex] ?? PRESETS[0];
  const colorsDiffer = color1.toLowerCase() !== color2.toLowerCase();
  const canStart = colorsDiffer;

  const settings: GameSettings = useMemo(
    () => ({
      width: preset.width,
      height: preset.height,
      mode,
      playerColors: { 1: color1, 2: color2 } as Record<PlayerId, string>,
      ...(mode === "PVC" ? { botDifficulty: "neuro" as const } : {}),
    }),
    [preset.width, preset.height, mode, color1, color2]
  );

  const handleStartGame = () => {
    if (!canStart) return;
    startMatch(settings, () => navigate("/game", { replace: true }));
  };

  const handleBackToMenu = () => {
    clearGame();
    navigate("/");
  };

  return (
    <div
      className="min-h-dvh bg-slate-950 text-slate-50"
      data-testid="screen-match"
    >
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={handleBackToMenu}
            className="text-slate-400 hover:text-slate-50"
            data-testid="link-back"
          >
            Back
          </button>
          <h1 className="text-2xl font-semibold" data-testid="match-title">
            New Match
          </h1>
        </div>

        <div className="grid gap-6" data-testid="match-form">
          <section>
            <h2 className="text-sm font-medium text-slate-400 mb-2">
              Board size
            </h2>
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              data-testid="match-presets"
            >
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPresetIndex(i)}
                  className={`rounded-lg border px-4 py-3 text-center font-medium transition-colors ${
                    presetIndex === i
                      ? "border-slate-500 bg-slate-700 text-slate-50"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                  data-testid={`preset-${p.width}x${p.height}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-slate-400 mb-2">
              Player 1 color
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex gap-1 flex-wrap"
                role="group"
                aria-label="Player 1 color"
                data-testid="match-color-p1"
              >
                {PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor1(hex)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      color1.toLowerCase() === hex.toLowerCase()
                        ? "border-slate-50 scale-110"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                    style={{ backgroundColor: hex }}
                    data-testid={`color-p1-${hex.replace("#", "")}`}
                    title={hex}
                  />
                ))}
              </div>
              <div
                className="h-8 w-8 rounded-full border border-slate-600 shrink-0"
                style={{ backgroundColor: color1 }}
                data-testid="match-preview-p1"
                aria-hidden
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-slate-400 mb-2">
              Player 2 {mode === "PVC" ? "/ Bot" : ""} color
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex gap-1 flex-wrap"
                role="group"
                aria-label="Player 2 color"
                data-testid="match-color-p2"
              >
                {PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor2(hex)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      color2.toLowerCase() === hex.toLowerCase()
                        ? "border-slate-50 scale-110"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                    style={{ backgroundColor: hex }}
                    data-testid={`color-p2-${hex.replace("#", "")}`}
                    title={hex}
                  />
                ))}
              </div>
              <div
                className="h-8 w-8 rounded-full border border-slate-600 shrink-0"
                style={{ backgroundColor: color2 }}
                data-testid="match-preview-p2"
                aria-hidden
              />
            </div>
            {!colorsDiffer && (
              <p
                className="mt-2 text-sm text-amber-400"
                data-testid="match-error-colors"
              >
                Player colors must differ.
              </p>
            )}
          </section>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={handleStartGame}
              disabled={!canStart}
              className="rounded-lg bg-slate-600 hover:bg-slate-500 px-4 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-600 transition-colors"
              data-testid="link-start-game"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
