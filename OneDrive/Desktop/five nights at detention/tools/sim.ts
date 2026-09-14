import { createNight, tickNight, threatOn } from "../src/game/systems/ai";
import type { CamId, NightState, TeacherId } from "../src/types";

const NO_SFX = {
  camera: () => {}, glitch: () => {}, scare: () => {}, win: () => {}, knock: () => {},
  powerDown: () => {}, step: () => {}, bang: () => {}, dash: () => {}, clang: () => {},
  jingle: () => {}, stopJingle: () => {}, chime: () => {}, ahooga: () => { ahoogaCount += 1; }, job: () => {}
};

let ahoogaCount = 0;

const IDS: TeacherId[] = ["math", "gym", "principal", "history", "huff"];
const CAMS: CamId[] = ["lounge", "hallway", "cafeteria", "principal", "basementHall", "basement"];

type Policy = "blind" | "tunnel" | "balanced" | "pro" | "camper";

function eligible(st: NightState, id: TeacherId): boolean {
  const t = st.teachers[id];
  if (t.room === "office") return false;
  if (id === "history" && (t.room === "basement" || st.sprintRun > 0)) return false;
  if (id === "math" && !st.mathLookDone) return false;
  if (id === "huff") return false;
  if (st.minutes < t.wakeAt) return false;
  return t.room !== "leftDoor" && t.room !== "rightDoor";
}

function runNight(night: number, policy: Policy, seed: number) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const orig = Math.random;
  Math.random = rnd;

  ahoogaCount = 0;
  const st: NightState = createNight(night);
  const dt = 1 / 30;
  const dwell: Record<string, number> = {};
  const maxDwell: Record<string, number> = {};
  const movesPerHour = [0, 0, 0, 0, 0, 0];
  const lastRoom: Record<string, string> = {};
  IDS.forEach(id => { dwell[id] = 0; maxDwell[id] = 0; lastRoom[id] = st.teachers[id].room; });

  let camTimer = 0;
  let guard = 0;
  while (!st.won && !st.lost && guard < 80000) {
    guard += 1;
    camTimer += dt;
    if (policy === "blind") {
      st.camerasOpen = false;
    } else if (camTimer > 5) {
      camTimer = 0;
      st.camerasOpen = true;
      if (policy === "tunnel") st.currentCam = "lounge";
      else if (policy === "camper") st.currentCam = "hallway";
      else if (policy === "pro") st.currentCam = st.sprintCharge > 14 ? "basement" : CAMS[Math.floor(rnd() * CAMS.length)];
      else st.currentCam = CAMS[Math.floor(rnd() * CAMS.length)];
    } else if (camTimer > 1.2 && policy !== "camper") {
      st.camerasOpen = false;
    }
    if (policy === "camper") { st.camerasOpen = true; st.currentCam = "hallway"; }
    if (policy === "pro" && st.teachers.history.room === "basement" && st.sprintRun === 0 && st.scareCooldown <= 0) {
      st.camerasOpen = true;
      st.currentCam = "basement";
      st.scareHold = true;
      st.refillHold = false;
    } else if (policy === "pro" && st.generator < 60 && st.teachers.history.room !== "basement" && st.sprintRun === 0) {
      st.scareHold = false;
      st.camerasOpen = true;
      st.currentCam = "basement";
      st.refillHold = true;
    } else {
      st.refillHold = false;
      st.scareHold = false;
      if (st.generator < 35) st.camerasOpen = false;
    }

    st.leftDoor = Boolean(threatOn(st, "left"));
    st.rightDoor = Boolean(threatOn(st, "right")) || st.sprintRun > 0;
    st.leftLight = false;
    st.rightLight = false;

    tickNight(st, dt, NO_SFX);

    const hour = Math.min(5, Math.floor(st.minutes / 60));
    IDS.forEach(id => {
      const room = st.teachers[id].room;
      if (room !== lastRoom[id]) {
        lastRoom[id] = room;
        dwell[id] = 0;
        movesPerHour[hour] += 1;
        return;
      }
      if (!eligible(st, id)) { dwell[id] = 0; return; }
      dwell[id] += dt;
      if (dwell[id] > maxDwell[id]) maxDwell[id] = dwell[id];
    });
  }
  Math.random = orig;
  const scares = ahoogaCount;
  const cause = st.won ? "6am" : st.blackout !== "none" ? "blackout" : st.jumpscare || "?";
  return { won: st.won, minutes: st.minutes, maxDwell, movesPerHour, power: st.generator, cause, scares };
}

function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

for (const policy of ["blind", "tunnel", "balanced", "camper", "pro"] as Policy[]) {
  for (const night of [1, 3, 5]) {
    const runs = [1, 2, 3, 4, 5, 6, 7, 8].map(i => runNight(night, policy, i * 7919));
    const camp = Math.max(...runs.map(r => Math.max(...IDS.map(id => r.maxDwell[id]))));
    const perHour = [0, 1, 2, 3, 4, 5].map(h => avg(runs.map(r => r.movesPerHour[h])).toFixed(1));
    const causes = runs.map(r => r.cause).join(",");
    console.log(
      `${policy.padEnd(9)} n${night}  camp=${camp.toFixed(1)}s  moves/hr=[${perHour.join(", ")}]  6am=${runs.filter(r => r.won).length}/8  scares=${avg(runs.map(r => r.scares)).toFixed(1)}  ${causes}`
    );
  }
}
