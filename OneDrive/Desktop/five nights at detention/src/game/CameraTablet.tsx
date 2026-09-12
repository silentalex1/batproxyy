import type React from "react";
import type { CamId, NightState, TeacherId } from "../types";
import { asset } from "../paths";
import {
  CAM_ROOMS,
  formatStamp,
  LOUNGE_SEATS,
  loungeHas,
  overlaySpot,
  sprintStage,
  teachersIn
} from "./systems/ai";

type Props = {
  state: NightState;
  onCam: (id: CamId) => void;
  onClose: () => void;
  onRefill: (held: boolean) => void;
};

const LOUNGE_ORDER: TeacherId[] = ["history", "math", "gym", "principal"];

export function CameraTablet({ state, onCam, onClose, onRefill }: Props) {
  const cam = CAM_ROOMS.find((c) => c.id === state.currentCam)!;
  const present = teachersIn(state, state.currentCam);
  const isLounge = state.currentCam === "lounge";
  const sprinting = state.sprintRun > 0;
  const stage = sprintStage(state);
  const dead = state.signalLoss > 0.05;
  const blocked = state.currentCam === "basement" && (state.teachers.history.room === "basement" || sprinting);

  return (
    <div className="tablet">
      <div className="tablet-bezel">
        <div className="feed">
          <div className="stage" style={{ "--ar": cam.ratio } as React.CSSProperties}>
            <img className="feed-bg" src={cam.file} alt="" />

            {isLounge &&
              LOUNGE_ORDER.map((id) =>
                loungeHas(state, id) ? (
                  <img
                    key={id}
                    className={`seat-fig ${id}`}
                    src={asset(`assets/cameras/lounge-${id}.png`)}
                    style={LOUNGE_SEATS[id]}
                    alt=""
                  />
                ) : (
                  <div key={id} className="seat-void" style={LOUNGE_SEATS[id]} />
                )
              )}

            {!isLounge &&
              present.map((id, i) => {
                if (id === "history" && sprinting) return null;
                const spot = overlaySpot(state.currentCam, i);
                return (
                  <img
                    key={id}
                    className={`teacher-move ${id}`}
                    src={state.teachers[id].body}
                    style={{ left: spot.left, bottom: spot.bottom, height: spot.height }}
                    alt=""
                  />
                );
              })}

            {isLounge && state.mathLook === "staring" && (
              <img className="look-slam" src={state.teachers.math.scare} alt="" />
            )}

            <div className="feed-grain" />
            <div className="feed-scan" />
            <div className="feed-roll" />

            {(state.mathLook === "glitch" || state.staticBurst > 0.05) && (
              <div
                className="static-blast"
                style={{
                  opacity: state.mathLook === "glitch" ? 1 : Math.min(0.9, state.staticBurst * 1.5)
                }}
              />
            )}
            {dead && (
              <div className="signal-lost">
                <span>SIGNAL INTERRUPTED</span>
              </div>
            )}

            <div className="feed-hud">
              <div>
                <p>CAM {cam.short}</p>
                <p className="feed-sub">{cam.label}</p>
              </div>
              <div className="feed-right">
                <p>{formatStamp(state)}</p>
                <p className="feed-sub">{cam.place}</p>
              </div>
            </div>
            <p className="rec">
              <span /> REC
            </p>
          </div>
        </div>

        <div className="map">
          <p className="map-title">RIVERDALE HIGH · B1–L1</p>
          <div className="map-grid">
            {CAM_ROOMS.map((room) => (
              <button
                key={room.id}
                className={`cam-node ${state.currentCam === room.id ? "live" : ""}`}
                onClick={() => onCam(room.id)}
              >
                <b>CAM {room.short}</b>
                <em>{room.label}</em>
              </button>
            ))}
          </div>

          <div className="map-meter">
            <span>STAIRWELL ACTIVITY</span>
            <div className="stage-bar">
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={stage > i ? `on s${stage}` : ""} />
              ))}
            </div>
          </div>

          <div className="map-power">
            <span>GENERATOR {Math.round(state.generator)}%</span>
            <div className="gen-bar">
              <div style={{ width: `${state.generator}%` }} />
            </div>
          </div>
        </div>

        {state.currentCam === "basement" && (
          <button
            className={`refill ${blocked ? "blocked" : ""}`}
            onMouseDown={() => onRefill(true)}
            onMouseUp={() => onRefill(false)}
            onMouseLeave={() => onRefill(false)}
            onTouchStart={() => onRefill(true)}
            onTouchEnd={() => onRefill(false)}
          >
            {sprinting
              ? "ROOM EMPTY — FEED UNSTABLE"
              : blocked
                ? "SOMEONE IS IN THERE"
                : state.refillHold
                  ? "REFUELLING…"
                  : "HOLD TO REFUEL GENERATOR"}
          </button>
        )}

        <button className="close-cams" onClick={onClose}>
          ▼ LOWER MONITOR
        </button>
      </div>
    </div>
  );
}
