/**
 * Bot interface and strategies (GDS §6). Bot is always Player 2 in PVC.
 */

import type { GameState, GameSettings } from "../model/types";
import { getNeuroMove } from "./neuroBot";

export type BotDifficulty = NonNullable<GameSettings["botDifficulty"]>;

export interface BotMoveResult {
  x: number;
  y: number;
}

/**
 * Returns the bot's chosen move for the given state, or null if no legal moves.
 * Call only when state.currentPlayer === 2 and state.settings.mode === "PVC".
 */
export function getBotMove(
  state: GameState,
  _difficulty: BotDifficulty,
  _options?: { timeBudgetMs?: number }
): BotMoveResult | null {
  const move = getNeuroMove(state);
  return move ? { x: move[0], y: move[1] } : null;
}
