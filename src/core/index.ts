export type { CellState, GameSettings, GameState, PlayerId } from "./model/types";
export {
  fromKey,
  getCell,
  setCell,
  setCells,
  toKey,
} from "./model/board";
export {
  applyMove,
  endConditions,
  isMoveLegal,
  type EndConditionsResult,
} from "./rules/move";
export {
  computeCapturesAfterMove,
  type CaptureResult,
} from "./capture/computeCapturesAfterMove";
export {
  getPotentialCapture,
  type PotentialCaptureResult,
} from "./capture/getPotentialCapture";
export {
  getBotMove,
  type BotDifficulty,
  type BotMoveResult,
} from "./bot";
