import { Routes, Route } from "react-router-dom";
import { GameRouteGuard, ResultRouteGuard } from "./app/router/guards";
import StartScreen from "./screens/StartScreen";
import MatchScreen from "./screens/MatchScreen";
import GameScreen from "./screens/GameScreen";
import ResultScreen from "./screens/ResultScreen";
import SettingsScreen from "./screens/SettingsScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartScreen />} />
      <Route path="/match" element={<MatchScreen />} />
      <Route
        path="/game"
        element={
          <GameRouteGuard>
            <GameScreen />
          </GameRouteGuard>
        }
      />
      <Route
        path="/result"
        element={
          <ResultRouteGuard>
            <ResultScreen />
          </ResultRouteGuard>
        }
      />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  );
}
