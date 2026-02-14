import { Link } from "react-router-dom";
import { usePrefersReducedMotion } from "../app/hooks/usePrefersReducedMotion";
import { useUISettings } from "../app/state/uiSettingsContext";

export default function SettingsScreen() {
  const { settings, applySettings } = useUISettings();
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="min-h-dvh bg-slate-950 text-slate-50"
      data-testid="screen-settings"
    >
      <div className="max-w-3xl mx-auto p-4 sm:p-6 grid gap-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-slate-400 hover:text-slate-50"
            data-testid="link-back"
          >
            Back
          </Link>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800"
          data-testid="settings-row-animations"
        >
          <span className="text-sm">Animations</span>
          <button
            type="button"
            onClick={() => applySettings({ animations: !settings.animations })}
            className="rounded border border-slate-600 px-3 py-1 text-sm"
            data-testid="toggle-animations"
          >
            {settings.animations ? "On" : "Off"}
          </button>
        </div>
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800"
          data-testid="settings-row-highlight"
        >
          <span className="text-sm">Highlight potential capture</span>
          <button
            type="button"
            onClick={() =>
              applySettings({ highlightCapture: !settings.highlightCapture })
            }
            className="rounded border border-slate-600 px-3 py-1 text-sm"
            data-testid="toggle-highlight-capture"
          >
            {settings.highlightCapture ? "On" : "Off"}
          </button>
        </div>
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800"
          data-testid="settings-row-point-size"
        >
          <span className="text-sm">Point size</span>
          <input
            type="range"
            min="0.18"
            max="0.35"
            step="0.01"
            value={settings.pointSize}
            onChange={(e) =>
              applySettings({ pointSize: Number(e.target.value) })
            }
            className="w-32 accent-slate-500"
            data-testid="slider-point-size"
          />
          <span className="text-slate-400 text-sm w-10 tabular-nums">
            {settings.pointSize.toFixed(2)}
          </span>
        </div>
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800"
          data-testid="settings-row-line-thickness"
        >
          <span className="text-sm">Line thickness</span>
          <input
            type="range"
            min="0.04"
            max="0.15"
            step="0.01"
            value={settings.lineThickness}
            onChange={(e) =>
              applySettings({ lineThickness: Number(e.target.value) })
            }
            className="w-32 accent-slate-500"
            data-testid="slider-line-thickness"
          />
          <span className="text-slate-400 text-sm w-10 tabular-nums">
            {settings.lineThickness.toFixed(2)}
          </span>
        </div>
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800"
          data-testid="settings-row-reduced-motion"
        >
          <span className="text-sm">
            Reduced motion
            {prefersReducedMotion && (
              <span className="ml-2 text-slate-500" data-testid="reduced-motion-system-note">
                (System prefers reduced motion)
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() =>
              applySettings({ reducedMotion: !settings.reducedMotion })
            }
            className="rounded border border-slate-600 px-3 py-1 text-sm"
            data-testid="toggle-reduced-motion"
          >
            {settings.reducedMotion ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}
