import { useMemo, useState } from "react";
import { audio } from "./audio/engine";
import { NightView } from "./game/NightView";
import { Credits } from "./screens/Credits";
import { EnrollModal } from "./screens/EnrollModal";
import { FeedbackModal } from "./screens/FeedbackModal";
import { HomePage } from "./screens/HomePage";
import { Leaderboard } from "./screens/Leaderboard";
import { Settings } from "./screens/Settings";
import { WarningNote } from "./screens/WarningNote";
import { loadSave, writeSave } from "./store/save";
import { reportSuggestion } from "./suggestions";
import type { SaveData, SettingsData, View } from "./types";

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [view, setView] = useState<View>("home");
  const [fromGame, setFromGame] = useState(false);
  const night = useMemo(() => Math.max(1, save.nightsCleared + 1), [save.nightsCleared]);

  const persist = (next: SaveData) => {
    setSave(writeSave(next));
  };

  const play = () => {
    audio.ensure();
    audio.click();
    setView("enroll");
  };

  const enroll = (username: string) => {
    persist({ ...save, username });
    setView("warning");
  };

  const finishNight = (result: "win" | "lose" | "quit", minutes: number) => {
    if (result === "quit") {
      setView("home");
      return;
    }
    const row = {
      name: save.username,
      night,
      minutes,
      result: result === "win" ? ("survived" as const) : ("caught" as const),
      at: Date.now()
    };
    persist({
      ...save,
      nightsCleared: result === "win" ? save.nightsCleared + 1 : save.nightsCleared,
      leaderboard: [row, ...save.leaderboard].slice(0, 40)
    });
    setView("home");
  };

  const changeSettings = (settings: SettingsData) => {
    audio.setVolume(settings.volume);
    persist({ ...save, settings });
  };

  const sendFeedback = (text: string) => {
    persist({
      ...save,
      feedback: [{ text, at: Date.now(), name: save.username || "anonymous" }, ...save.feedback]
    });
    void reportSuggestion(text, save.username, night);
    setView(fromGame ? "night" : "home");
    setFromGame(false);
  };

  const nightLive = view === "night" || (view === "feedback" && fromGame);

  return (
    <div className="app">
      {!nightLive && (
        <HomePage
          onPlay={play}
          onCredits={() => setView("credits")}
          onLeaderboard={() => setView("leaderboard")}
          onSettings={() => setView("settings")}
          onFeedback={() => {
            setFromGame(false);
            setView("feedback");
          }}
        />
      )}
      {view === "enroll" && <EnrollModal onEnroll={enroll} onBack={() => setView("home")} />}
      {view === "warning" && (
        <WarningNote onOk={() => setView("night")} onBack={() => setView("home")} />
      )}
      {view === "credits" && <Credits onClose={() => setView("home")} />}
      {view === "leaderboard" && (
        <Leaderboard rows={save.leaderboard} onClose={() => setView("home")} />
      )}
      {view === "settings" && (
        <Settings value={save.settings} onChange={changeSettings} onClose={() => setView("home")} />
      )}
      {view === "feedback" && (
        <FeedbackModal
          onSend={sendFeedback}
          onClose={() => {
            setView(fromGame ? "night" : "home");
            setFromGame(false);
          }}
        />
      )}
      {nightLive && (
        <NightView
          username={save.username}
          night={night}
          settings={save.settings}
          paused={view === "feedback"}
          onExit={finishNight}
          onFeedback={() => {
            setFromGame(true);
            setView("feedback");
          }}
        />
      )}
    </div>
  );
}
