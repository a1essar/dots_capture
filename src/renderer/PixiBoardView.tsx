/**
 * PixiJS board view: mount Application in DOM container, layers, resize, pointer → (x,y) intent.
 * Read-only over GameState; no rule logic. Calls placePoint(x,y) on valid pointerup.
 */

import { Application, Container } from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "../core/model/types";
import type { UISettings } from "../persistence/uiSettings";
import { computeLayout, pixelsToIntersection, distanceToIntersection } from "./layout";
import {
  drawGrid,
  drawTerritory,
  drawPoints,
  drawHover,
  drawPotentialCaptureOverlay,
  type PotentialCaptureOverlayData,
} from "./draw";

const MAX_DPR = 2;

export interface PixiBoardViewProps {
  gameState: GameState | null;
  uiSettings: UISettings;
  /** When false, effects layer stays empty (no animations). Respects settings + prefers-reduced-motion. */
  effectiveAnimations?: boolean;
  placePoint: (x: number, y: number) => void;
  isMoveValid: (x: number, y: number) => boolean;
  inputBlocked: boolean;
  /** When highlight capture is on: returns would-be territory/captured points for hover (x,y). Omitted when disabled. */
  getPotentialCapture?: (x: number, y: number) => PotentialCaptureOverlayData | null;
}

export function PixiBoardView({
  gameState,
  uiSettings,
  effectiveAnimations = false,
  placePoint,
  isMoveValid,
  inputBlocked,
  getPotentialCapture,
}: PixiBoardViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cameraRef = useRef<Container | null>(null);
  const gridLayerRef = useRef<Container | null>(null);
  const territoryLayerRef = useRef<Container | null>(null);
  const pointsLayerRef = useRef<Container | null>(null);
  const hoverLayerRef = useRef<Container | null>(null);
  const potentialCaptureLayerRef = useRef<Container | null>(null);
  const effectsLayerRef = useRef<Container | null>(null);
  const layoutRef = useRef<ReturnType<typeof computeLayout> | null>(null);
  const redrawRef = useRef<() => void>(() => {});
  const initCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const placePointRef = useRef(placePoint);
  const isMoveValidRef = useRef(isMoveValid);
  const inputBlockedRef = useRef(inputBlocked);
  const gameStateRef = useRef(gameState);
  const uiSettingsRef = useRef(uiSettings);
  const effectiveAnimationsRef = useRef(effectiveAnimations);
  const getPotentialCaptureRef = useRef(getPotentialCapture);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  placePointRef.current = placePoint;
  isMoveValidRef.current = isMoveValid;
  inputBlockedRef.current = inputBlocked;
  gameStateRef.current = gameState;
  uiSettingsRef.current = uiSettings;
  effectiveAnimationsRef.current = effectiveAnimations;
  getPotentialCaptureRef.current = getPotentialCapture;

  const redraw = useCallback(() => {
    try {
      const app = appRef.current;
      const layout = layoutRef.current;
      const camera = cameraRef.current;
      const gridLayer = gridLayerRef.current;
      const territoryLayer = territoryLayerRef.current;
      const pointsLayer = pointsLayerRef.current;
      const hover = hoverLayerRef.current;
      if (!app || !layout || !camera || !gridLayer || !territoryLayer || !pointsLayer || !hover) return;
      if (!gameState?.board || !gameState?.settings?.playerColors) return;
      const { board, currentPlayer, settings } = gameState;
      const { width, height, playerColors } = settings;
      if (typeof width !== "number" || typeof height !== "number" || width < 1 || height < 1) return;
      drawGrid(gridLayer, layout, width, height);
      drawTerritory(territoryLayer, layout, board, width, height, playerColors);
      drawPoints(pointsLayer, layout, board, width, height, playerColors);
      const valid = hoverCell ? isMoveValidRef.current(hoverCell.x, hoverCell.y) : false;
      drawHover(hover, layout, hoverCell, currentPlayer, playerColors, valid);

      const potentialLayer = potentialCaptureLayerRef.current;
      const getPotentialCaptureFn = getPotentialCaptureRef.current;
      const highlightOn = uiSettingsRef.current.highlightCapture && getPotentialCaptureFn;
      if (potentialLayer && highlightOn && hoverCell && getPotentialCaptureFn) {
        const result = getPotentialCaptureFn(hoverCell.x, hoverCell.y);
        if (result && (result.territory.length > 0 || result.capturedPoints.length > 0)) {
          drawPotentialCaptureOverlay(potentialLayer, layout, result, currentPlayer, playerColors);
        } else {
          potentialLayer.removeChildren();
        }
      } else if (potentialLayer) {
        potentialLayer.removeChildren();
      }

      if (!effectiveAnimationsRef.current && effectsLayerRef.current) {
        effectsLayerRef.current.removeChildren();
      }
      const container = containerRef.current;
      if (container && layout) {
        container.dataset.boardOriginX = String(layout.originX);
        container.dataset.boardOriginY = String(layout.originY);
        container.dataset.boardStep = String(layout.step);
        container.dataset.boardWidth = String(width);
        container.dataset.boardHeight = String(height);
      }
    } catch (err) {
      if (typeof console !== "undefined" && console.error) {
        console.error("[PixiBoardView] redraw error", err);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- highlightCapture must trigger redraw when setting toggles
  }, [gameState, hoverCell, uiSettings.highlightCapture]);
  redrawRef.current = redraw;

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    mountedRef.current = true;

    const safeDestroyApp = (instance: Application) => {
      // Pixi may throw on destroy if init failed mid-way (plugins not initialized yet).
      // We never want unmount cleanup to crash the whole screen.
      try {
        instance.destroy(true, true);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[PixiBoardView] app.destroy failed (ignored)", err);
        }
      }
    };

    let app: Application;
    const camera = new Container();
    const gridLayer = new Container();
    const territoryLayer = new Container();
    const pointsLayer = new Container();
    const hoverLayer = new Container();
    const potentialCaptureLayer = new Container();
    const effectsLayer = new Container();
    camera.addChild(gridLayer, territoryLayer, pointsLayer, hoverLayer, potentialCaptureLayer, effectsLayer);

    const init = async (): Promise<() => void> => {
      app = new Application();
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, MAX_DPR);
      await app.init({
        width: w,
        height: h,
        resolution: dpr,
        autoDensity: true,
        // Use numeric hex; Pixi ColorSource strings prefer "#rrggbb".
        background: 0x0f172a,
      });
      appRef.current = app;
      app.stage.addChild(camera);
      // React 18 StrictMode may mount/unmount effects twice in dev; make sure we don't accumulate canvases.
      container.querySelectorAll("canvas").forEach((el) => el.remove());
      const canvas = app.canvas as HTMLCanvasElement;
      container.appendChild(canvas);
      cameraRef.current = camera;
      gridLayerRef.current = gridLayer;
      territoryLayerRef.current = territoryLayer;
      pointsLayerRef.current = pointsLayer;
      hoverLayerRef.current = hoverLayer;
      potentialCaptureLayerRef.current = potentialCaptureLayer;
      effectsLayerRef.current = effectsLayer;

      const uiSettings = uiSettingsRef.current;
      const updateLayout = () => {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        app.renderer.resize(width, height);
        const state = gameStateRef.current;
        const gw = state?.settings?.width;
        const gh = state?.settings?.height;
        if (state && typeof gw === "number" && typeof gh === "number" && gw >= 1 && gh >= 1) {
          layoutRef.current = computeLayout({
            viewportWidthPx: width,
            viewportHeightPx: height,
            width: gw,
            height: gh,
            pointSizeFactor: uiSettingsRef.current.pointSize,
            lineThicknessFactor: uiSettingsRef.current.lineThickness,
          });
        }
      };

      const state = gameStateRef.current;
      const gw0 = state?.settings?.width;
      const gh0 = state?.settings?.height;
      if (state && typeof gw0 === "number" && typeof gh0 === "number" && gw0 >= 1 && gh0 >= 1) {
        layoutRef.current = computeLayout({
          viewportWidthPx: w,
          viewportHeightPx: h,
          width: gw0,
          height: gh0,
          pointSizeFactor: uiSettings.pointSize,
          lineThicknessFactor: uiSettings.lineThickness,
        });
      }

      const ro = new ResizeObserver(() => {
        updateLayout();
        redrawRef.current();
      });
      ro.observe(container);
      updateLayout();
      redrawRef.current();

      const getLocal = (e: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        return { px: e.clientX - rect.left, py: e.clientY - rect.top };
      };

      const handlePointerMove = (e: PointerEvent) => {
        const layout = layoutRef.current;
        const state = gameStateRef.current;
        if (!layout || !state) return;
        const { px, py } = getLocal(e);
        const { x, y } = pixelsToIntersection(layout, px, py, state.settings.width, state.settings.height);
        setHoverCell((prev) => (prev?.x === x && prev?.y === y ? prev : { x, y }));
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (inputBlockedRef.current) return;
        const layout = layoutRef.current;
        const state = gameStateRef.current;
        if (!layout || !state) return;
        const { px, py } = getLocal(e);
        const { x, y } = pixelsToIntersection(layout, px, py, state.settings.width, state.settings.height);
        const dist = distanceToIntersection(layout, px, py, x, y);
        if (dist <= layout.hitRadiusPx) placePointRef.current(x, y);
      };

      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerup", handlePointerUp);

      return () => {
        ro.disconnect();
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        if (canvas.parentNode === container) container.removeChild(canvas);
      };
    };

    init().then((c) => {
      if (!mountedRef.current) {
        c();
        // At this point init succeeded, so destroy should be safe.
        safeDestroyApp(app);
        appRef.current = null;
        return;
      }
      initCleanupRef.current = c;
    }).catch((err) => {
      // If init failed, app might be only partially constructed; avoid crashing while cleaning up.
      if (appRef.current) safeDestroyApp(appRef.current);
      appRef.current = null;
      cameraRef.current = null;
      gridLayerRef.current = null;
      territoryLayerRef.current = null;
      pointsLayerRef.current = null;
      hoverLayerRef.current = null;
      potentialCaptureLayerRef.current = null;
      effectsLayerRef.current = null;
      layoutRef.current = null;
      if (typeof console !== "undefined" && console.error) {
        console.error("[PixiBoardView] init failed", err);
      }
    });

    return () => {
      mountedRef.current = false;
      const cleanup = initCleanupRef.current;
      if (typeof cleanup === "function") {
        cleanup();
        initCleanupRef.current = null;
      }
      if (appRef.current) {
        safeDestroyApp(appRef.current);
        appRef.current = null;
      }
      cameraRef.current = null;
      gridLayerRef.current = null;
      territoryLayerRef.current = null;
      pointsLayerRef.current = null;
      hoverLayerRef.current = null;
      potentialCaptureLayerRef.current = null;
      effectsLayerRef.current = null;
      layoutRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      const container = containerRef.current;
      const app = appRef.current;
      const settings = gameState?.settings;
      const gw = settings?.width;
      const gh = settings?.height;
      if (
        !container ||
        !app ||
        !settings?.playerColors ||
        typeof gw !== "number" ||
        typeof gh !== "number" ||
        gw < 1 ||
        gh < 1
      )
        return;
      layoutRef.current = computeLayout({
        viewportWidthPx: Math.max(1, container.clientWidth),
        viewportHeightPx: Math.max(1, container.clientHeight),
        width: gw,
        height: gh,
        pointSizeFactor: uiSettings.pointSize,
        lineThicknessFactor: uiSettings.lineThickness,
      });
      redrawRef.current();
    } catch (err) {
      if (typeof console !== "undefined" && console.error) {
        console.error("[PixiBoardView] layout effect error", err);
      }
    }
  }, [gameState, uiSettings.pointSize, uiSettings.lineThickness]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-0"
      style={{ touchAction: "none" }}
    />
  );
}
