import { useEffect, useReducer, useRef, useState } from "react";
import { audio } from "../audio/engine";
import type { CamId, SettingsData } from "../types";
import { PhaserRoot } from "./PhaserRoot";
import { setBridge } from "./bridge";
import { CameraTablet } from "./CameraTablet";
import { NightBreak } from "./NightBreak";
import { Hud } from "./Hud";
import {
  CAM_ROOMS,
  MAX_NIGHT,
  createNight,
  grabElliot,
  huffLoudness,
  huffWalking,
  huffWatched,
  approachOn,
  requestDoor,
  threatOn,
  tickNight
} from "./systems/ai";
import { asset } from "../paths";

type Props = {
  username: string;
  night: number;
  settings: SettingsData;
  paused: boolean;
  onExit: (result: "win" | "lose" | "quit", minutes: number) => void;
  onFeedback: () => void;
};

const BRIEF: Record<number, string> = {
  1: "Doors and lights run off the same generator. Use them only when you have to.",
  2: "Mr. Ash gets restless in the basement if nobody is watching him.",
  3: "Keep the monitor down. Every second it is up costs you power.",
  4: "Principal Hollis does not knock.",
  5: "Nobody has made it to six without refuelling at least once.",
  6: "You were never supposed to be here this long."
};

export function NightView({ username, night, settings, paused, onExit, onFeedback }: Props) {
  const stateRef = useRef(createNight(night));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const panRef = useRef(0);
  const panScale = useRef(settings.pan);
  panScale.current = settings.pan;
  const [intro, setIntro] = useState(true);
  const [halted, setHalted] = useState(false);
  const state = stateRef.current;
  state.paused = paused || intro || halted;
  const left = threatOn(state, "left");
  const right = threatOn(state, "right");
  const litLeft = state.leftLight && !state.powerOut;
  const litRight = state.rightLight && !state.powerOut;
  const showLeft = Boolean(left) && litLeft;
  const showRight = Boolean(right) && litRight;
  const farLeft = !left && litLeft ? approachOn(state, "left") : null;
  const farRight = !right && litRight ? approachOn(state, "right") : null;
  const hidden = state.camerasOpen || Boolean(state.jumpscare) || state.won;

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), 3400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    audio.setVolume(settings.volume);
    audio.ensure();
    audio.startHum();
    let last = performance.now();
    let ui = 0;
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tickNight(stateRef.current, dt, {
        camera: () => audio.camera(),
        glitch: () => audio.glitch(),
        scare: () => audio.scare(),
        win: () => audio.win(),
        knock: () => audio.knock(),
        powerDown: () => audio.powerDown(),
        step: () => audio.step(),
        bang: () => audio.bang(),
        dash: () => audio.dash(),
        clang: () => audio.clang(),
        jingle: () => audio.jingle(),
        stopJingle: () => audio.stopJingle(),
        chime: () => audio.chime(),
        ahooga: () => audio.ahooga(),
        job: () => audio.job()
      });
      const snap = stateRef.current;
      setBridge({
        leftDoor: snap.leftDoor,
        rightDoor: snap.rightDoor,
        leftLight: snap.leftLight,
        rightLight: snap.rightLight,
        generator: snap.generator,
        powerOut: snap.powerOut,
        camerasOpen: snap.camerasOpen,
        pan: panRef.current,
        flicker: settings.flicker,
        leftThreat: Boolean(threatOn(snap, "left")),
        rightThreat: Boolean(threatOn(snap, "right")),
        blackout: snap.blackout,
        bang: snap.sprintBang,
        scare: Boolean(snap.jumpscare)
      });
      if (snap.breath > 0) audio.startBreath();
      else audio.stopBreath();
      const steps = huffLoudness(snap);
      if (steps > 0) audio.startSteps(steps);
      else audio.stopSteps();
      ui += dt;
      if (ui > 0.07 || snap.dirty) {
        ui = 0;
        snap.dirty = false;
        bump();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      audio.stopHum();
      audio.stopBuzz();
      audio.stopBreath();
      audio.stopSteps();
      audio.stopJingle();
    };
  }, [settings.flicker, settings.volume]);

  const locked = () => {
    const s = stateRef.current;
    return s.powerOut || s.won || s.lost || s.paused;
  };

  const toggleDoor = (side: "left" | "right") => {
    const s = stateRef.current;
    if (locked() || s.camerasOpen) return;
    const shutting = !(side === "left" ? s.leftDoor : s.rightDoor);
    if (!requestDoor(s, side, shutting)) return;
    audio.door();
    bump();
  };

  const setLight = (side: "left" | "right", on: boolean) => {
    const s = stateRef.current;
    if (locked() || s.camerasOpen) return;
    const key = side === "left" ? "leftLight" : "rightLight";
    if (s[key] === on) return;
    s[key] = on;
    if (on) {
      s[side === "left" ? "rightLight" : "leftLight"] = false;
      audio.startBuzz();
    } else if (!s.leftLight && !s.rightLight) {
      audio.stopBuzz();
    }
    s.dirty = true;
    bump();
  };

  const openCams = () => {
    const s = stateRef.current;
    if (locked() || s.camerasOpen) return;
    s.camerasOpen = true;
    s.everOpened = true;
    s.leftLight = false;
    s.rightLight = false;
    s.staticBurst = 0.5;
    audio.stopBuzz();
    audio.camera();
    s.dirty = true;
    bump();
  };

  const closeCams = () => {
    const s = stateRef.current;
    s.camerasOpen = false;
    s.refillHold = false;
    s.scareHold = false;
    s.scareCharge = 0;
    audio.camera();
    s.dirty = true;
    bump();
  };

  const switchCam = (id: CamId) => {
    const s = stateRef.current;
    if (s.currentCam === id) return;
    s.currentCam = id;
    s.refillHold = false;
    s.scareHold = false;
    s.scareCharge = 0;
    s.staticBurst = 0.4;
    audio.camera();
    s.dirty = true;
    bump();
  };

  const stepCam = (dir: -1 | 1) => {
    const s = stateRef.current;
    if (!s.camerasOpen || s.powerOut) return;
    const i = CAM_ROOMS.findIndex((c) => c.id === s.currentCam);
    const next = (i + dir + CAM_ROOMS.length) % CAM_ROOMS.length;
    switchCam(CAM_ROOMS[next].id);
  };

  const catchElliot = () => {
    const s = stateRef.current;
    if (!grabElliot(s)) return;
    audio.job();
    bump();
  };

  const holdScare = (held: boolean) => {
    const s = stateRef.current;
    if (held && (s.powerOut || s.won || s.lost)) return;
    s.scareHold = held;
    s.dirty = true;
    bump();
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (intro || s.won || s.lost) return;
    setHalted((was) => {
      const next = !was;
      if (next) {
        s.leftLight = false;
        s.rightLight = false;
        s.scareHold = false;
        s.refillHold = false;
        audio.stopBuzz();
        audio.stopBreath();
        audio.stopSteps();
      }
      return next;
    });
    audio.click();
    s.dirty = true;
  };

  const actions = useRef({ toggleDoor, setLight, openCams, closeCams, switchCam, stepCam, togglePause });
  actions.current = { toggleDoor, setLight, openCams, closeCams, switchCam, stepCam, togglePause };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      panRef.current = (e.clientX / window.innerWidth - 0.5) * 2 * (panScale.current / 0.16);
    };
    const down = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const a = actions.current;
      const k = e.key.toLowerCase();
      if (k === "p") {
        if (e.repeat) return;
        e.preventDefault();
        return a.togglePause();
      }
      if (s.paused) return;
      if (k === "a") return a.setLight("left", true);
      if (k === "d") return a.setLight("right", true);
      if (e.repeat) return;
      const space = e.code === "Space" || e.key === " ";
      if (space || k === "escape") {
        e.preventDefault();
        if (s.camerasOpen) a.closeCams();
        else if (space) a.openCams();
        return;
      }
      if (k === "q") return a.toggleDoor("left");
      if (k === "e") return a.toggleDoor("right");
      if (s.camerasOpen && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        return a.stepCam(e.key === "ArrowLeft" ? -1 : 1);
      }
      const idx = ["1", "2", "3", "4", "5", "6"].indexOf(e.key);
      if (idx >= 0 && s.camerasOpen && !s.powerOut) a.switchCam(CAM_ROOMS[idx].id);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "a") actions.current.setLight("left", false);
      if (k === "d") actions.current.setLight("right", false);
    };
    const blur = () => {
      actions.current.setLight("left", false);
      actions.current.setLight("right", false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const starving = state.powerOut || state.generator < 24;
  const lastNight = night >= MAX_NIGHT;
  const huffOnFoot = huffWalking(state);
  const huffSeen = huffWatched(state);

  return (
    <div className={`night ${state.blackout !== "none" ? "blackout" : ""} ${huffSeen ? "quake" : ""}`}>
      <PhaserRoot />
      <div className="chair-back" />
      <div className={`moon-window ${starving ? "starve" : ""}`} />

      {!hidden && state.leftLight && !state.powerOut && <div className="door-beam left" />}
      {!hidden && state.rightLight && !state.powerOut && <div className="door-beam right" />}
      {!hidden && showLeft && (
        <img className={`door-fig left ${state.leftDoor ? "peek" : ""}`} src={left!.body} alt="" />
      )}
      {!hidden && showRight && (
        <img className={`door-fig right ${state.rightDoor ? "peek" : ""}`} src={right!.body} alt="" />
      )}
      {!hidden && farLeft && <img className="door-fig left far" src={farLeft.body} alt="" />}
      {!hidden && farRight && <img className="door-fig right far" src={farRight.body} alt="" />}

      {!hidden && state.blackout === "stare" && (
        <div className="stare">
          <img src={state.teachers.principal.scare} alt="" />
        </div>
      )}

      {!hidden && (
        <Hud
          state={state}
          username={username}
          onToggleDoor={toggleDoor}
          onLight={setLight}
          onOpenCams={openCams}
          onFeedback={onFeedback}
          onQuit={() => onExit("quit", state.minutes)}
        />
      )}

      {state.camerasOpen && !state.jumpscare && !state.won && (
        <CameraTablet
          state={state}
          onCam={switchCam}
          onStep={stepCam}
          onClose={closeCams}
          onScare={holdScare}
          onRefill={(held) => {
            state.refillHold = held;
            state.dirty = true;
          }}
        />
      )}

      {!state.jumpscare && !state.won && (
        <div className={`huff-alert ${huffOnFoot ? "on" : ""}`}>
          <img src={state.teachers.huff.portrait} alt="" />
          <span>Mrs Huff is walking!</span>
        </div>
      )}

      {state.elliotOn && !state.jumpscare && !state.won && !halted && (
        <button
          type="button"
          className={`elliot c${state.elliotCorner}`}
          onClick={catchElliot}
          aria-label="Elliot"
        >
          <img src={asset("assets/easter egg-hut assets/elliot face.jpg")} alt="" />
        </button>
      )}

      {halted && !state.jumpscare && !state.won && (
        <div className="halt">
          <p className="halt-title">Game has been paused.</p>
          <p className="halt-sub">Press P to resume.</p>
        </div>
      )}

      {intro && (
        <div className="intro">
          <p>NIGHT {night}</p>
          <h2>12 AM</h2>
          <span>{BRIEF[Math.min(6, night)] || BRIEF[6]}</span>
          <small>Q / E doors · A / D lights · SPACE monitor · 1-6 cams</small>
        </div>
      )}

      {state.jumpscare && (
        <div className="scare">
          <img src={state.teachers[state.jumpscare].scare} alt="" />
          <div className="scare-static" />
          <div className="end-card">
            <h2>YOU WERE CAUGHT</h2>
            <p>
              {state.teachers[state.jumpscare].name} found you out of your seat at{" "}
              {state.minutes >= 60 ? `${state.minutes / 60} AM` : "12 AM"}.
            </p>
            <button type="button" className="paper-btn" onClick={() => onExit("lose", state.minutes)}>
              Return
            </button>
          </div>
        </div>
      )}

      {state.won && !lastNight && (
        <NightBreak night={night} onDone={() => onExit("win", state.minutes)} />
      )}

      {state.won && lastNight && (
        <div className="six">
          <p>6 AM</p>
          <h2>NIGHT {night} SURVIVED</h2>
          <button type="button" className="paper-btn" onClick={() => onExit("win", state.minutes)}>
            Return
          </button>
        </div>
      )}
    </div>
  );
}
