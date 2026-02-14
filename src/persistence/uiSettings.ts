/**
 * Load/save UI settings to localStorage. Key: contours.uiSettings.v1
 */

const STORAGE_KEY = "contours.uiSettings.v1";

export interface UISettings {
  animations: boolean;
  highlightCapture: boolean;
  pointSize: number;
  lineThickness: number;
  reducedMotion: boolean;
  canvasQuality: "auto" | "low" | "high";
}

const defaults: UISettings = {
  animations: true,
  highlightCapture: true,
  pointSize: 0.25,
  lineThickness: 0.08,
  reducedMotion: false,
  canvasQuality: "auto",
};

export function loadUISettings(): UISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<UISettings>;
    return {
      animations: typeof parsed.animations === "boolean" ? parsed.animations : defaults.animations,
      highlightCapture: typeof parsed.highlightCapture === "boolean" ? parsed.highlightCapture : defaults.highlightCapture,
      pointSize: typeof parsed.pointSize === "number" ? parsed.pointSize : defaults.pointSize,
      lineThickness: typeof parsed.lineThickness === "number" ? parsed.lineThickness : defaults.lineThickness,
      reducedMotion: typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : defaults.reducedMotion,
      canvasQuality:
        parsed.canvasQuality === "auto" || parsed.canvasQuality === "low" || parsed.canvasQuality === "high"
          ? parsed.canvasQuality
          : defaults.canvasQuality,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveUISettings(settings: UISettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
