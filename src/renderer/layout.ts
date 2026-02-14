/**
 * Board layout: mapping grid intersections to pixels and back.
 * Spec §3.2: padding, step, origin, minStep; §3.3 pointRadius, lineThickness, hitRadiusPx.
 */

const MIN_STEP = 12;
const PADDING_MIN = 12;
const PADDING_MAX = 24;
const POINT_RADIUS_MIN = 3;
const POINT_RADIUS_MAX_FACTOR = 0.45;
const LINE_THICKNESS_MIN = 1;
const LINE_THICKNESS_MAX = 6;
const HIT_RADIUS_MIN_PX = 16;
const TERRITORY_ALPHA = 0.22;
const CAPTURED_ALPHA = 0.45;

export interface BoardLayout {
  viewportWidthPx: number;
  viewportHeightPx: number;
  paddingPx: number;
  step: number;
  originX: number;
  originY: number;
  boardPxW: number;
  boardPxH: number;
  pointRadius: number;
  lineThickness: number;
  hitRadiusPx: number;
  territoryAlpha: number;
  capturedAlpha: number;
}

export interface LayoutInput {
  viewportWidthPx: number;
  viewportHeightPx: number;
  width: number;
  height: number;
  pointSizeFactor: number;
  lineThicknessFactor: number;
}

export function computeLayout(input: LayoutInput): BoardLayout {
  const { viewportWidthPx, viewportHeightPx, width, height, pointSizeFactor, lineThicknessFactor } = input;
  const minView = Math.min(viewportWidthPx, viewportHeightPx);
  const paddingPx = Math.max(PADDING_MIN, Math.min(minView / 30, PADDING_MAX));
  const availW = viewportWidthPx - 2 * paddingPx;
  const availH = viewportHeightPx - 2 * paddingPx;
  const intervalsX = width - 1;
  const intervalsY = height - 1;
  const stepRaw = Math.min(availW / Math.max(1, intervalsX), availH / Math.max(1, intervalsY));
  const step = Math.max(MIN_STEP, Math.floor(stepRaw));
  const boardPxW = step * intervalsX;
  const boardPxH = step * intervalsY;
  const originX = Math.floor((viewportWidthPx - boardPxW) / 2);
  const originY = Math.floor((viewportHeightPx - boardPxH) / 2);
  const pointRadius = Math.max(
    POINT_RADIUS_MIN,
    Math.min(step * pointSizeFactor, step * POINT_RADIUS_MAX_FACTOR)
  );
  const lineThickness = Math.max(
    LINE_THICKNESS_MIN,
    Math.min(step * lineThicknessFactor, LINE_THICKNESS_MAX)
  );
  const hitRadiusPx = Math.max(pointRadius, HIT_RADIUS_MIN_PX);

  return {
    viewportWidthPx,
    viewportHeightPx,
    paddingPx,
    step,
    originX,
    originY,
    boardPxW,
    boardPxH,
    pointRadius,
    lineThickness,
    hitRadiusPx,
    territoryAlpha: TERRITORY_ALPHA,
    capturedAlpha: CAPTURED_ALPHA,
  };
}

export function intersectionToPixels(layout: BoardLayout, x: number, y: number): { px: number; py: number } {
  return {
    px: layout.originX + x * layout.step,
    py: layout.originY + y * layout.step,
  };
}

export function pixelsToIntersection(
  layout: BoardLayout,
  px: number,
  py: number,
  width: number,
  height: number
): { x: number; y: number } {
  let x = Math.round((px - layout.originX) / layout.step);
  let y = Math.round((py - layout.originY) / layout.step);
  x = Math.max(0, Math.min(width - 1, x));
  y = Math.max(0, Math.min(height - 1, y));
  return { x, y };
}

export function distanceToIntersection(
  layout: BoardLayout,
  px: number,
  py: number,
  x: number,
  y: number
): number {
  const { px: cx, py: cy } = intersectionToPixels(layout, x, y);
  return Math.hypot(px - cx, py - cy);
}
