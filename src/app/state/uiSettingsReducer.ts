/**
 * UI settings reducer. Single action: APPLY_SETTINGS.
 */

import type { UISettings } from "../../persistence/uiSettings";

export type UISettingsAction = { type: "APPLY_SETTINGS"; payload: Partial<UISettings> };

export function uiSettingsReducer(state: UISettings, action: UISettingsAction): UISettings {
  if (action.type !== "APPLY_SETTINGS") return state;
  return { ...state, ...action.payload };
}
