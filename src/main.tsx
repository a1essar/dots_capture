import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GameProvider } from "./app/state/gameContext";
import { UISettingsProvider } from "./app/state/uiSettingsContext";
import { loadUISettings } from "./persistence/uiSettings";
import App from "./App";
import "./index.css";

const initialUISettings = loadUISettings();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <UISettingsProvider initial={initialUISettings}>
        <GameProvider>
          <App />
        </GameProvider>
      </UISettingsProvider>
    </BrowserRouter>
  </StrictMode>
);
