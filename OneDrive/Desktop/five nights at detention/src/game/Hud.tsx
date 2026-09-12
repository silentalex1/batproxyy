import type { NightState } from "../types";
import { formatClock } from "./systems/ai";

type Props = {
  state: NightState;
  username: string;
  onToggleDoor: (side: "left" | "right") => void;
  onLight: (side: "left" | "right", on: boolean) => void;
  onOpenCams: () => void;
  onFeedback: () => void;
  onQuit: () => void;
};

export function Hud({ state, username, onToggleDoor, onLight, onOpenCams, onFeedback, onQuit }: Props) {
  const usage =
    1 +
    (state.camerasOpen ? 1 : 0) +
    (state.leftDoor ? 1 : 0) +
    (state.rightDoor ? 1 : 0) +
    (state.leftLight ? 1 : 0) +
    (state.rightLight ? 1 : 0);
  const bars = Math.min(5, usage);
  const dead = state.powerOut;

  const panel = (side: "left" | "right") => {
    const shut = side === "left" ? state.leftDoor : state.rightDoor;
    const lit = side === "left" ? state.leftLight : state.rightLight;
    return (
      <div className={`door-panel ${side}`}>
        <button
          className={`plate door ${shut ? "on" : ""}`}
          disabled={dead}
          onClick={() => onToggleDoor(side)}
        >
          <b>DOOR</b>
          <em>{shut ? "CLOSED" : "OPEN"}</em>
        </button>
        <button
          className={`plate light ${lit ? "on" : ""}`}
          disabled={dead}
          onMouseDown={() => onLight(side, true)}
          onMouseUp={() => onLight(side, false)}
          onMouseLeave={() => onLight(side, false)}
          onTouchStart={() => onLight(side, true)}
          onTouchEnd={() => onLight(side, false)}
        >
          <b>LIGHT</b>
          <em>{side === "left" ? "HOLD A" : "HOLD D"}</em>
        </button>
      </div>
    );
  };

  return (
    <div className="hud">
      <div className="hud-top">
        <div>
          <p className="hud-name">{username || "DETAINEE"}</p>
          <p className="hud-night">NIGHT {state.night}</p>
        </div>
        <p className="hud-clock">{formatClock(state.minutes)}</p>
      </div>

      {panel("left")}
      {panel("right")}

      <button className="flip-bar" disabled={dead} onClick={onOpenCams}>
        <span className={`flip-screen ${!state.everOpened ? "pulse" : ""}`}>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <em>▲ RAISE MONITOR ▲</em>
      </button>

      <div className="hud-bottom">
        <div className="gen">
          <span>POWER LEFT: {Math.round(state.generator)}%</span>
          <div className="gen-bar">
            <div style={{ width: `${state.generator}%` }} />
          </div>
          <div className="usage">
            <small>USAGE</small>
            {Array.from({ length: 5 }).map((_, i) => (
              <b key={i} className={i < bars ? `on u${bars}` : ""} />
            ))}
          </div>
        </div>
        <div className="hud-links">
          <button type="button" onClick={onFeedback}>
            Feedback
          </button>
          <button type="button" onClick={onQuit}>
            Leave
          </button>
        </div>
      </div>

      {state.hint && <p className="hud-hint">{state.hint}</p>}
      {state.sprintBang > 0 && <div className="bang-flash" />}
    </div>
  );
}
