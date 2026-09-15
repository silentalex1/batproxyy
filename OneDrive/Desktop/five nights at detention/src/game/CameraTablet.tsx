import type React from "react";
import type { CamId, NightState, TeacherId } from "../types";
import { asset } from "../paths";
import {
  CAM_ROOMS,
  formatStamp,
  LOUNGE_SEATS,
  loungeHas,
  overlaySpot,
  huffWalking,
  scareReady,
  scareTarget,
  SCARE_SECONDS,
  sprintStage,
  teachersIn
} from "./systems/ai";

type Props = {
  state: NightState;
  onCam: (id: CamId) => void;
  onStep: (dir: -1 | 1) => void;
  onClose: () => void;
  onRefill: (held: boolean) => void;
  onScare: (held: boolean) => void;
};

const LOUNGE_ORDER: TeacherId[] = ["history", "math", "gym", "principal"];

const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = "hidden";
};

export function CameraTablet({ state, onCam, onStep, onClose, onRefill, onScare }: Props) {
  const index = CAM_ROOMS.findIndex((c) => c.id === state.currentCam);
  const cam = CAM_ROOMS[index];
  const present = teachersIn(state, state.currentCam);
  const isLounge = state.currentCam === "lounge";
  const sprinting = state.sprintRun > 0;
  const stage = sprintStage(state);
  const dead = state.signalLoss > 0.05;
  const inBasement = state.currentCam === "basement";
  const target = scareTarget(state);
  const canScare = scareReady(state);
  const scarePct = Math.min(100, (state.scareCharge / SCARE_SECONDS) * 100);
  const huff = state.teachers.huff;
  const huffHere = huff.room === state.currentCam;
  const shake = state.camShake > 0.02 && huffWalking(state) ? state.camShake : 0;

  return (
    <div className="tablet">
      <div className="tablet-bezel">
        <div className="feed">
          <div
            className={`stage ${shake > 0 ? "rattle" : ""}`}
            style={{ "--ar": cam.ratio, "--shake": shake } as React.CSSProperties}
          >
            <img className="feed-bg" src={cam.file} onError={hideBroken} alt="" />

            {isLounge &&
              LOUNGE_ORDER.map((id) =>
                loungeHas(state, id) ? (
                  <img
                    key={id}
                    className={`seat-fig ${id} ${state.teachers[id].notice > 0 ? "noticed" : ""}`}
                    src={asset(`assets/cameras/lounge-${id}.png`)}
                    style={LOUNGE_SEATS[id]}
                    onError={hideBroken} alt=""
                  />
                ) : (
                  <div key={id} className="seat-void" style={LOUNGE_SEATS[id]} />
                )
              )}

            {!isLounge &&
              present.map((id, i) => {
                if (id === "history" && sprinting) return null;
                if (id === "huff") return null;
                const spot = overlaySpot(state.currentCam, i);
                return (
                  <img
                    key={id}
                    className={`teacher-move ${id} ${state.teachers[id].notice > 0 ? "noticed" : ""}`}
                    src={state.teachers[id].body}
                    style={{ left: spot.left, bottom: spot.bottom, height: spot.height }}
                    onError={hideBroken} alt=""
                  />
                );
              })}

            {huffHere && (
              <div
                className={`huff-rig ${huff.paceDir !== 0 ? "stepping" : ""}`}
                style={{
                  left: `${15 + huff.paceX * 54}%`,
                  bottom: `${25 - huff.paceX * 6}%`,
                  height: `${42 + huff.paceX * 14}%`
                }}
              >
                <img
                  className={`huff-walk ${huff.notice > 0 ? "noticed" : ""}`}
                  src={huff.body}
                  style={{ transform: `scaleX(${huff.faceDir})` }}
                  onError={hideBroken} alt=""
                />
              </div>
            )}

            {isLounge && state.mathLook === "staring" && (
              <img className="look-slam" src={state.teachers.math.scare} onError={hideBroken} alt="" />
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

          <button className="cam-step prev" onClick={() => onStep(-1)} aria-label="Previous camera">
            ‹
          </button>
          <button className="cam-step next" onClick={() => onStep(1)} aria-label="Next camera">
            ›
          </button>

          <div className="cam-strip">
            <span className="strip-label">LEADS TO</span>
            {cam.links.map((id) => {
              const room = CAM_ROOMS.find((c) => c.id === id)!;
              return (
                <button key={id} className="strip-chip" onClick={() => onCam(id)}>
                  {room.short} · {room.label}
                </button>
              );
            })}
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

        {inBasement && (
          <div className="basement-tools">
            {target && (
              <button
                className={`go-away ${state.scareHold ? "armed" : ""} ${canScare ? "" : "cooling"}`}
                disabled={!canScare}
                onMouseDown={() => onScare(true)}
                onMouseUp={() => onScare(false)}
                onMouseLeave={() => onScare(false)}
                onTouchStart={() => onScare(true)}
                onTouchEnd={() => onScare(false)}
              >
                <span className="go-away-fill" style={{ width: `${scarePct}%` }} />
                <em>
                  {canScare
                    ? state.scareHold
                      ? "KEEP HOLDING…"
                      : "GO AWAY — HOLD IT"
                    : `RECHARGING ${Math.ceil(state.scareCooldown)}s`}
                </em>
              </button>
            )}
            {!state.hasGenerator ? (
              <p className="refill dead">GENERATOR OFFLINE — NOTHING TO REFUEL</p>
            ) : (
            <button
              className={`refill ${target ? "blocked" : ""}`}
              onMouseDown={() => onRefill(true)}
              onMouseUp={() => onRefill(false)}
              onMouseLeave={() => onRefill(false)}
              onTouchStart={() => onRefill(true)}
              onTouchEnd={() => onRefill(false)}
            >
              {sprinting
                ? "ROOM EMPTY — FEED UNSTABLE"
                : target
                  ? "SOMEONE IS IN THERE"
                  : state.refillHold
                    ? "REFUELLING…"
                    : "HOLD TO REFUEL GENERATOR"}
            </button>
            )}
          </div>
        )}

        <button className="close-cams" onClick={onClose}>
          ▼ LOWER MONITOR
        </button>
      </div>
    </div>
  );
}
