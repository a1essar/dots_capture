import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { loadUISettings, saveUISettings, type UISettings } from "../../persistence/uiSettings";
import { uiSettingsReducer, type UISettingsAction } from "./uiSettingsReducer";

interface UISettingsContextValue {
  settings: UISettings;
  dispatch: React.Dispatch<UISettingsAction>;
  applySettings: (partial: Partial<UISettings>) => void;
}

const UISettingsContext = createContext<UISettingsContextValue | null>(null);

export function UISettingsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: UISettings;
}) {
  const [settings, dispatch] = useReducer(
    uiSettingsReducer,
    initial ?? loadUISettings()
  );

  useEffect(() => {
    saveUISettings(settings);
  }, [settings]);

  const applySettings = useCallback((partial: Partial<UISettings>) => {
    dispatch({ type: "APPLY_SETTINGS", payload: partial });
  }, []);

  const value: UISettingsContextValue = {
    settings,
    dispatch,
    applySettings,
  };

  return (
    <UISettingsContext.Provider value={value}>{children}</UISettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider are coupled
export function useUISettings() {
  const ctx = useContext(UISettingsContext);
  if (!ctx) throw new Error("useUISettings must be used within UISettingsProvider");
  return ctx;
}
