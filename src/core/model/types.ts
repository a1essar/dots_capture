/**
 * Core model types from GDS. Board key format: "x,y"; absence = empty.
 */

export type PlayerId = 1 | 2;

export type CellState =
  | { type: "empty" }
  | { type: "point"; owner: PlayerId; captured: false }
  | { type: "point"; owner: PlayerId; captured: true; capturedBy: PlayerId }
  | { type: "territory"; owner: PlayerId };

export interface GameSettings {
  width: number;
  height: number;
  mode: "PVP" | "PVC";
  botDifficulty?: "neuro";
  playerColors: Record<PlayerId, string>;
}

export interface GameState {
  settings: GameSettings;
  board: Map<string, CellState>;
  score: Record<PlayerId, number>;
  currentPlayer: PlayerId;
  status: "playing" | "finished";
  winner: PlayerId | "draw" | null;
  moveHistory: Array<{ x: number; y: number; player: PlayerId }>;
}
