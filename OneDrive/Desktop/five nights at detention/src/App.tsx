import { useEffect, useMemo, useRef, useState } from "react";
import { audio } from "./audio/engine";
import { NightView } from "./game/NightView";
import { MAX_NIGHT } from "./game/systems/ai";
import { Credits } from "./screens/Credits";
import { EnrollModal } from "./screens/EnrollModal";
import { FeedbackModal } from "./screens/FeedbackModal";
import { HomePage } from "./screens/HomePage";
import { Leaderboard } from "./screens/Leaderboard";
import { Settings } from "./screens/Settings";
import { WarningNote } from "./screens/WarningNote";
import { Tutorial } from "./screens/Tutorial";
import { loadSave, writeSave } from "./store/save";
import { ReplyNote } from "./screens/ReplyNote";
import {
  fetchReplies,
  markRepliesSeen,
  postScore,
  reportSuggestion,
  type SuggestionReply
} from "./suggestions";
import type { SaveData, SettingsData, View } from "./types";

const SEEN_KEY = "fnad-seen-replies";

function readSeen(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(Number).filter((n) => !Number.isNaN(n)) : [];
  } catch {
    return [];
  }
}

function pushSeen(id: number): void {
  try {
    const next = readSeen();
    if (!next.includes(id)) next.push(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-60)));
  } catch {
    return;
  }
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [view, setView] = useState<View>("home");
  const [fromGame, setFromGame] = useState(false);
  const night = useMemo(
    () => Math.min(MAX_NIGHT, Math.max(1, save.nightsCleared + 1)),
    [save.nightsCleared]
  );

  const [reply, setReply] = useState<SuggestionReply | null>(null);
  const replyRef = useRef<SuggestionReply | null>(null);
  replyRef.current = reply;

  const persist = (next: SaveData) => {
    setSave(writeSave(next));
  };

  useEffect(() => {
    const name = save.username;
    if (!name) return;
    let alive = true;
    const check = async () => {
      if (!alive || replyRef.current) return;
      const seen = readSeen();
      const rows = await fetchReplies(name);
      if (!alive || replyRef.current) return;
      const fresh = rows.find((n) => !seen.includes(n.id));
      if (fresh) setReply(fresh);
    };
    void check();
    const id = window.setInterval(check, 8000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [save.username]);

  const dismissReply = () => {
    const note = reply;
    if (!note) return;
    pushSeen(note.id);
    void markRepliesSeen(save.username, [note.id]);
    setReply(null);
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
    const cleared =
      result === "win" ? Math.min(MAX_NIGHT, save.nightsCleared + 1) : save.nightsCleared;
    persist({
      ...save,
      nightsCleared: cleared,
      leaderboard: [row, ...save.leaderboard].slice(0, 40)
    });
    void postScore(row);
    if (result === "win" && cleared > save.nightsCleared && cleared < MAX_NIGHT) return;
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
          onTutorial={() => setView("tutorial")}
          onFeedback={() => {
            setFromGame(false);
            setView("feedback");
          }}
        />
      )}
      {reply && <ReplyNote note={reply} onClose={dismissReply} />}
      {view === "enroll" && <EnrollModal onEnroll={enroll} onBack={() => setView("home")} />}
      {view === "warning" && (
        <WarningNote onOk={() => setView("night")} onBack={() => setView("home")} />
      )}
      {view === "tutorial" && <Tutorial onClose={() => setView("home")} />}
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
          key={night}
          username={save.username}
          night={night}
          settings={save.settings}
          paused={view === "feedback" || Boolean(reply)}
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
