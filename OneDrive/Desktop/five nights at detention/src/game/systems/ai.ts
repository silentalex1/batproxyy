import type { Blackout, CamId, NightState, RoomId, Teacher, TeacherId } from "../../types";
import { asset } from "../../paths";

export type CamRoom = {
  id: CamId;
  label: string;
  place: string;
  file: string;
  short: string;
  ratio: number;
  links: CamId[];
};

export const CAM_ROOMS: CamRoom[] = [
  {
    id: "lounge",
    label: "TEACHERS LOUNGE",
    place: "WEST WING",
    file: asset("/assets/cameras/lounge-empty.jpg"),
    short: "1A",
    links: ["hallway", "basementHall"],
    ratio: 1672 / 941
  },
  {
    id: "hallway",
    label: "MAIN HALLWAY",
    place: "OUTSIDE DETENTION",
    file: asset("/assets/cameras/cam-hallway.jpg"),
    short: "1B",
    links: ["lounge", "cafeteria", "principal", "basementHall"],
    ratio: 1168 / 784
  },
  {
    id: "cafeteria",
    label: "CAFETERIA",
    place: "EAST WING",
    file: asset("/assets/cameras/cam-cafeteria.jpg"),
    short: "2A",
    links: ["hallway"],
    ratio: 1168 / 784
  },
  {
    id: "principal",
    label: "PRINCIPAL OFFICE",
    place: "ADMIN",
    file: asset("/assets/cameras/cam-principal.jpg"),
    short: "3",
    links: ["hallway"],
    ratio: 1168 / 676
  },
  {
    id: "basementHall",
    label: "BASEMENT STAIR",
    place: "B1",
    file: asset("/assets/cameras/cam-basementHall.jpg"),
    short: "4",
    links: ["lounge", "hallway", "basement"],
    ratio: 1168 / 784
  },
  {
    id: "basement",
    label: "GENERATOR ROOM",
    place: "B1",
    file: asset("/assets/cameras/cam-basement.jpg"),
    short: "5",
    links: ["basementHall"],
    ratio: 1168 / 632
  }
];

export const ROUTES: Record<TeacherId, RoomId[]> = {
  math: ["lounge", "hallway", "leftDoor"],
  gym: ["lounge", "cafeteria", "hallway", "rightDoor"],
  principal: ["lounge", "principal", "hallway", "leftDoor"],
  history: ["lounge", "basementHall", "basement"],
  huff: ["hallway"]
};

export const LOUNGE_SEATS: Partial<
  Record<TeacherId, { left: string; top: string; width: string; height: string }>
> = {
  history: { left: "12.26%", top: "18.92%", width: "11.66%", height: "72.69%" },
  math: { left: "22.25%", top: "31.88%", width: "19.26%", height: "40.17%" },
  gym: { left: "52.63%", top: "32.73%", width: "19.74%", height: "34.64%" },
  principal: { left: "77.15%", top: "18.70%", width: "12.32%", height: "72.69%" }
};

export const HOUR_SECONDS = 66;

export const SCARE_SECONDS = 2.4;

export const BOTH_DOOR_DRAIN = 1.28;

export function bothDoorsShut(state: NightState): boolean {
  return state.leftDoor && state.rightDoor && !state.powerOut;
}

const AI_TABLE: Record<TeacherId, number[]> = {
  math: [2, 5, 7, 10, 13, 16],
  gym: [1, 4, 6, 9, 12, 15],
  principal: [0, 2, 4, 7, 11, 14],
  history: [1, 4, 6, 9, 13, 17],
  huff: [1, 1, 2, 3, 4, 6]
};

export const HUFF_PACE_SPEED = 0.16;

export const ELLIOT_CHANCE = 0.0006;

export const ELLIOT_MIN_POWER = 45;

export const ELLIOT_POWER = 25;

export const MAX_NIGHT = 6;

export const GENERATOR_NIGHTS = 3;

export const DOOR_HOLD = 15;

export const DOOR_REARM = 5;

export const DOOR_GRACE = 14;

export const DOOR_REPEL = 1.3;

export function hasGenerator(night: number): boolean {
  return night <= GENERATOR_NIGHTS;
}

export function doorLocked(state: NightState, side: "left" | "right"): boolean {
  return state.doorCool[side] > 0.05;
}

export function requestDoor(state: NightState, side: "left" | "right", shut: boolean): boolean {
  const key = side === "left" ? "leftDoor" : "rightDoor";
  if (state[key] === shut) return false;
  if (shut && doorLocked(state, side)) return false;
  state[key] = shut;
  if (state.hasGenerator) {
    state.dirty = true;
    return true;
  }
  if (shut) state.doorHold[side] = DOOR_HOLD;
  else {
    state.doorHold[side] = 0;
    state.doorCool[side] = DOOR_REARM;
  }
  state.dirty = true;
  return true;
}

const SPOTS: Record<string, { left: string; bottom: string; height: string }[]> = {
  hallway: [
    { left: "37%", bottom: "24%", height: "46%" },
    { left: "52%", bottom: "29%", height: "36%" }
  ],
  cafeteria: [
    { left: "26%", bottom: "16%", height: "54%" },
    { left: "58%", bottom: "24%", height: "42%" }
  ],
  principal: [{ left: "60%", bottom: "10%", height: "58%" }],
  basementHall: [
    { left: "6%", bottom: "22%", height: "48%" },
    { left: "58%", bottom: "26%", height: "42%" }
  ],
  basement: [
    { left: "16%", bottom: "14%", height: "60%" },
    { left: "68%", bottom: "22%", height: "48%" }
  ]
};

export type Sfx = {
  camera: () => void;
  glitch: () => void;
  scare: () => void;
  win: () => void;
  knock: () => void;
  powerDown: () => void;
  step: () => void;
  bang: () => void;
  dash: () => void;
  clang: () => void;
  jingle: () => void;
  stopJingle: () => void;
  chime: () => void;
  ahooga: () => void;
  job: () => void;
};

function aiFor(id: TeacherId, night: number): number {
  const row = AI_TABLE[id];
  const idx = Math.min(row.length - 1, Math.max(0, night - 1));
  return Math.min(20, row[idx] + Math.max(0, night - row.length) * 2);
}

export function createNight(night: number): NightState {
  const mk = (
    id: TeacherId,
    name: string,
    tag: string,
    portrait: string,
    body: string,
    moveEvery: number,
    wakeAt: number
  ): Teacher => ({
    id,
    name,
    tag,
    room: "lounge",
    routeIndex: 0,
    ai: aiFor(id, night),
    moveEvery,
    moveAcc: Math.random() * moveEvery,
    atDoorSince: null,
    doorShutAt: null,
    officeSince: null,
    portrait,
    body,
    scare: asset(`assets/teachers/scare-${id}.png`),
    wakeAt,
    stallAcc: 0,
    mood: 0,
    moodAcc: 6 + Math.random() * 14,
    notice: 0,
    paceX: Math.random(),
    paceDir: Math.random() < 0.5 ? -1 : 1,
    faceDir: 1,
    stepAcc: 0
  });

  return {
    running: true,
    minutes: 0,
    clockAcc: 0,
    generator: 100,
    leftDoor: false,
    rightDoor: false,
    leftLight: false,
    rightLight: false,
    camerasOpen: false,
    currentCam: "lounge",
    powerOut: false,
    mathLook: "idle",
    mathLookAcc: 0,
    mathLookDone: false,
    teachers: {
      math: mk(
        "math",
        "Mr. Keller",
        "MATHEMATICS",
        asset("/assets/teachers/math-portrait.png"),
        asset("/assets/teachers/math-cut.png"),
        5.5,
        0
      ),
      gym: mk(
        "gym",
        "Coach Brand",
        "ATHLETICS",
        asset("/assets/teachers/gym-portrait.png"),
        asset("/assets/teachers/gym-cut.png"),
        5.0,
        60
      ),
      principal: mk(
        "principal",
        "Principal Hollis",
        "ADMINISTRATION",
        asset("/assets/teachers/principal-portrait.png"),
        asset("/assets/teachers/principal-cut.png"),
        7.0,
        120
      ),
      history: mk(
        "history",
        "Mr. Ash",
        "HISTORY",
        asset("/assets/teachers/history-cut.png"),
        asset("/assets/teachers/history-cut.png"),
        5.0,
        0
      ),
      huff: {
        ...mk(
          "huff",
          "Mrs. Huff",
          "HALL MONITOR",
          asset("/assets/teachers/huff-portrait.png"),
          asset("/assets/teachers/huff-cut.png"),
          9.5,
          0
        ),
        room: "hallway",
        stepAcc: 1.5 + Math.random() * 2
      }
    },
    jumpscare: null,
    won: false,
    lost: false,
    night,
    staticBurst: 0,
    signalLoss: 0,
    refillHold: false,
    elapsed: 0,
    dirty: true,
    paused: false,
    everOpened: false,
    blackout: "none",
    blackoutAcc: 0,
    blackoutLimit: 0,
    sprintCharge: 0,
    sprintRun: 0,
    sprintBang: 0,
    ambientAt: 18 + Math.random() * 20,
    breath: 0,
    hint: "",
    hintAcc: 0,
    scareHold: false,
    scareCharge: 0,
    scareCooldown: 0,
    grudge: 0,
    camShake: 0,
    elliotOn: false,
    elliotCorner: 0,
    hasGenerator: hasGenerator(night),
    doorCool: { left: 0, right: 0 },
    doorHold: { left: 0, right: 0 },
    doorGrace: 0,
    elliotRoll: 0,
    elliotFound: 0,
    player: {
      camTime: {
        lounge: 0,
        hallway: 0,
        cafeteria: 0,
        principal: 0,
        basementHall: 0,
        basement: 0
      },
      doorShuts: { left: 0, right: 0 },
      lightChecks: { left: 0, right: 0 },
      monitorUp: 0,
      monitorDown: 0,
      sameCamTime: 0,
      lastCam: null,
      wasLeftDoor: false,
      wasRightDoor: false,
      wasLeftLight: false,
      wasRightLight: false
    }
  };
}

export function formatClock(minutes: number): string {
  if (minutes >= 360) return "6 AM";
  const h = Math.floor(minutes / 60);
  return `${h === 0 ? 12 : h} AM`;
}

export function formatStamp(state: NightState): string {
  const gameSeconds = (state.minutes + (state.clockAcc / HOUR_SECONDS) * 60) * 60;
  const h = Math.floor(gameSeconds / 3600);
  const m = Math.floor(gameSeconds / 60) % 60;
  const s = Math.floor(gameSeconds) % 60;
  const hh = h === 0 ? 12 : h;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} AM`;
}

export function teachersIn(state: NightState, room: RoomId): TeacherId[] {
  return (Object.keys(state.teachers) as TeacherId[]).filter((id) => state.teachers[id].room === room);
}

export function threatOn(state: NightState, side: "left" | "right"): Teacher | null {
  const id = teachersIn(state, side === "left" ? "leftDoor" : "rightDoor")[0];
  return id ? state.teachers[id] : null;
}

export function loungeHas(state: NightState, id: TeacherId): boolean {
  return state.teachers[id].room === "lounge";
}

export function sprintStage(state: NightState): number {
  if (state.sprintRun > 0) return 4;
  return Math.min(3, Math.floor(state.sprintCharge / 10));
}

export function overlaySpot(room: RoomId, index: number) {
  const list = SPOTS[room] || SPOTS.hallway;
  return list[index % list.length];
}

const ROOM_CAM: Partial<Record<RoomId, CamId>> = {
  lounge: "lounge",
  hallway: "hallway",
  cafeteria: "cafeteria",
  principal: "principal",
  basementHall: "basementHall",
  basement: "basement"
};

function currentHour(state: NightState): number {
  return Math.floor(state.minutes / 60);
}

function isWatched(state: NightState, room: RoomId): boolean {
  const cam = ROOM_CAM[room];
  return Boolean(cam) && state.camerasOpen && state.currentCam === cam;
}

function neglect(state: NightState, room: RoomId): number {
  const cam = ROOM_CAM[room];
  if (!cam) return 0;
  let total = 0;
  for (const c of CAM_ROOMS) total += state.player.camTime[c.id];
  const blindness = state.elapsed > 20 ? Math.max(0, 1 - total / (state.elapsed * 0.2)) : 0;
  let bias = 0;
  if (total >= 8) {
    const fair = 1 / CAM_ROOMS.length;
    bias = (fair - state.player.camTime[cam] / total) / fair;
  }
  return Math.max(-1, Math.min(1, bias + blindness));
}

function vigilance(state: NightState, side: "left" | "right"): number {
  const p = state.player;
  const looks = p.lightChecks[side] + p.doorShuts[side];
  return Math.min(1, looks / 9);
}

function hourPressure(state: NightState): number {
  return currentHour(state) * (0.58 + state.night * 0.04);
}

function starePin(state: NightState): number {
  return -3.2 + Math.min(2.9, state.player.sameCamTime * 0.17);
}

function pincer(state: NightState, t: Teacher): number {
  const route = ROUTES[t.id];
  const door = route[route.length - 1];
  if (door !== "leftDoor" && door !== "rightDoor") return 0;
  const other: RoomId = door === "leftDoor" ? "rightDoor" : "leftDoor";
  return teachersIn(state, other).length > 0 ? 1.3 : 0;
}

function effAi(state: NightState, t: Teacher): number {
  let a = t.ai + hourPressure(state);
  a += neglect(state, t.room) * 2.1;
  a += isWatched(state, t.room) ? starePin(state) : 0.85;
  a += Math.min(3.5, t.stallAcc / 9);
  a += pincer(state, t);
  a += t.mood * 1.55;
  if (state.camerasOpen) a += t.id === "principal" ? 1.3 : 0.7;
  if (state.generator < 30) a += 1.2;
  if (t.id === "principal" && state.minutes >= 240) a += 1.2;
  return Math.max(0.4, Math.min(18, a));
}

function stallLimit(state: NightState, t: Teacher): number {
  return Math.max(9, 33 - currentHour(state) * 3.1 - state.night * 1.5 - t.ai * 0.4);
}

function doorPatience(state: NightState, t: Teacher): number {
  const side = t.room === "leftDoor" ? "left" : "right";
  const base = Math.max(2.6, 7.0 - state.night * 0.5 - currentHour(state) * 0.36);
  return base * (0.66 + vigilance(state, side) * 0.55);
}

function runMoods(state: NightState, dt: number): void {
  (Object.keys(state.teachers) as TeacherId[]).forEach((id) => {
    const t = state.teachers[id];
    t.moodAcc -= dt;
    if (t.moodAcc > 0) return;
    const wasSurging = t.mood > 0;
    t.mood = wasSurging ? 0 : 1;
    t.moodAcc = wasSurging ? 15 + Math.random() * 20 : 7 + Math.random() * 9;
  });
}

function runNotice(state: NightState, dt: number, sfx: Sfx): void {
  (Object.keys(state.teachers) as TeacherId[]).forEach((id) => {
    const t = state.teachers[id];
    if (t.notice > 0) {
      t.notice = Math.max(0, t.notice - dt);
      if (t.notice === 0) state.dirty = true;
      return;
    }
    if (!isWatched(state, t.room)) return;
    if (state.player.sameCamTime < 1.4) return;
    if (Math.random() > dt * 0.13) return;
    t.notice = 1.7;
    state.staticBurst = Math.max(state.staticBurst, 0.28);
    sfx.camera();
    state.dirty = true;
  });
}

function retreatDelay(state: NightState, t: Teacher): number {
  const side = t.room === "leftDoor" ? "left" : "right";
  return 1.8 + vigilance(state, side) * 2.6;
}

function trackPlayer(state: NightState, dt: number): void {
  const p = state.player;
  if (state.grudge > 0) state.grudge = Math.max(0, state.grudge - dt / 45);
  if (state.camerasOpen) {
    p.camTime[state.currentCam] += dt;
    p.monitorUp += dt;
    if (p.lastCam === state.currentCam) {
      p.sameCamTime += dt;
    } else {
      p.lastCam = state.currentCam;
      p.sameCamTime = 0;
    }
  } else {
    p.monitorDown += dt;
    p.lastCam = null;
    p.sameCamTime = 0;
  }
  if (state.leftDoor && !p.wasLeftDoor) p.doorShuts.left += 1;
  if (state.rightDoor && !p.wasRightDoor) p.doorShuts.right += 1;
  if (state.leftLight && !p.wasLeftLight) p.lightChecks.left += 1;
  if (state.rightLight && !p.wasRightLight) p.lightChecks.right += 1;
  p.wasLeftDoor = state.leftDoor;
  p.wasRightDoor = state.rightDoor;
  p.wasLeftLight = state.leftLight;
  p.wasRightLight = state.rightLight;
}

export function huffWalking(state: NightState): boolean {
  const t = state.teachers.huff;
  return t.room === "hallway" && t.paceDir !== 0;
}

export function huffWatched(state: NightState): boolean {
  return huffWalking(state) && state.camerasOpen && state.currentCam === "hallway";
}

export function huffLoudness(state: NightState): number {
  if (!huffWalking(state) || state.paused || state.powerOut) return 0;
  return state.camerasOpen && state.currentCam === "hallway" ? 1 : 0.32;
}

function runPace(state: NightState, dt: number): void {
  const t = state.teachers.huff;
  if (state.camShake > 0) state.camShake = Math.max(0, state.camShake - dt * 2.2);
  if (t.room !== "hallway") {
    t.paceDir = 0;
    return;
  }

  t.stepAcc -= dt;
  if (t.stepAcc <= 0) {
    if (t.paceDir === 0) {
      t.paceDir = t.paceX > 0.5 ? -1 : 1;
      t.faceDir = t.paceDir;
      t.stepAcc = 2.4 + Math.random() * 3.4;
    } else {
      t.paceDir = 0;
      t.stepAcc = 1.6 + Math.random() * 2.8;
    }
    state.dirty = true;
  }
  if (t.paceDir === 0) return;

  t.paceX += t.paceDir * HUFF_PACE_SPEED * dt;
  if (t.paceX <= 0) {
    t.paceX = 0;
    t.paceDir = 1;
    t.faceDir = 1;
  } else if (t.paceX >= 1) {
    t.paceX = 1;
    t.paceDir = -1;
    t.faceDir = -1;
  }
  state.dirty = true;

  if (!isWatched(state, "hallway")) return;
  state.camShake = 1;
  t.stepAcc -= dt * 0.15;
}

function runElliot(state: NightState, dt: number): void {
  if (state.elliotOn || state.powerOut || state.blackout !== "none") return;
  if (state.generator > ELLIOT_MIN_POWER) return;
  state.elliotRoll += dt;
  if (state.elliotRoll < 1) return;
  state.elliotRoll = 0;
  if (Math.random() >= ELLIOT_CHANCE) return;
  state.elliotOn = true;
  state.elliotCorner = Math.floor(Math.random() * 4);
  state.dirty = true;
}

export function grabElliot(state: NightState): boolean {
  if (!state.elliotOn) return false;
  state.elliotOn = false;
  state.elliotRoll = 0;
  state.elliotFound += 1;
  state.generator = Math.min(100, state.generator + ELLIOT_POWER);
  state.dirty = true;
  return true;
}

function say(state: NightState, text: string): void {
  state.hint = text;
  state.hintAcc = 0;
  state.dirty = true;
}

export function tickNight(state: NightState, dt: number, sfx: Sfx): void {
  if (!state.running || state.paused || state.won || state.lost) return;
  state.elapsed += dt;
  if (state.staticBurst > 0) state.staticBurst = Math.max(0, state.staticBurst - dt);
  if (state.signalLoss > 0) state.signalLoss = Math.max(0, state.signalLoss - dt);
  if (state.sprintBang > 0) state.sprintBang = Math.max(0, state.sprintBang - dt);
  if (state.hint) {
    state.hintAcc += dt;
    if (state.hintAcc > 4.5) {
      state.hint = "";
      state.dirty = true;
    }
  }

  runDoorCooldown(state, dt);
  trackPlayer(state, dt);
  advanceClock(state, dt, sfx);
  if (state.won) return;

  runMathLook(state, dt, sfx);
  drainPower(state, dt, sfx);
  if (runBlackout(state, dt, sfx)) return;
  if (checkOffice(state, sfx)) return;
  runAmbient(state, sfx);
  runScare(state, dt, sfx);
  runMoods(state, dt);
  runNotice(state, dt, sfx);
  runPace(state, dt);
  runElliot(state, dt);

  if (state.mathLook !== "idle") return;
  runSprint(state, dt, sfx);
  stepTeachers(state, dt, sfx);
  updateBreath(state);
}

function runDoorCooldown(state: NightState, dt: number): void {
  if (state.hasGenerator) return;
  if (state.doorGrace > 0) state.doorGrace = Math.max(0, state.doorGrace - dt);
  (["left", "right"] as const).forEach((side) => {
    const key = side === "left" ? "leftDoor" : "rightDoor";
    if (state[key]) {
      state.doorHold[side] = Math.max(0, state.doorHold[side] - dt);
      if (state.doorHold[side] <= 0) {
        state[key] = false;
        state.doorCool[side] = DOOR_REARM;
        state.dirty = true;
      }
      return;
    }
    if (state.doorCool[side] <= 0) return;
    state.doorCool[side] = Math.max(0, state.doorCool[side] - dt);
    if (state.doorCool[side] <= 0) state.dirty = true;
  });
}

function advanceClock(state: NightState, dt: number, sfx: Sfx): void {
  state.clockAcc += dt;
  if (state.clockAcc < HOUR_SECONDS) return;
  state.clockAcc = 0;
  state.minutes = Math.min(360, state.minutes + 60);
  state.dirty = true;
  if (state.minutes >= 360) {
    state.won = true;
    state.running = false;
    sfx.stopJingle();
    sfx.win();
  } else {
    sfx.chime();
  }
}

function runMathLook(state: NightState, dt: number, sfx: Sfx): void {
  if (state.mathLook === "staring") {
    state.mathLookAcc += dt;
    if (state.mathLookAcc >= 1.6) {
      state.mathLook = "glitch";
      state.mathLookAcc = 0;
      state.staticBurst = 1.2;
      sfx.glitch();
      state.dirty = true;
    }
    return;
  }
  if (state.mathLook === "glitch") {
    state.mathLookAcc += dt;
    if (state.mathLookAcc >= 1.1) {
      state.mathLook = "idle";
      state.mathLookDone = true;
      const t = state.teachers.math;
      t.room = "hallway";
      t.routeIndex = 1;
      t.moveAcc = 0;
      state.signalLoss = 0.9;
      say(state, "HE IS NOT IN THE LOUNGE ANYMORE");
      state.dirty = true;
    }
    return;
  }
  if (
    !state.mathLookDone &&
    state.minutes >= 60 &&
    state.camerasOpen &&
    state.currentCam === "lounge" &&
    state.teachers.math.room === "lounge"
  ) {
    state.mathLook = "staring";
    state.mathLookAcc = 0;
    state.dirty = true;
  }
}

function drainPower(state: NightState, dt: number, sfx: Sfx): void {
  if (state.powerOut) return;
  if (!state.hasGenerator) {
    state.generator = 100;
    state.refillHold = false;
    return;
  }
  if (state.refillHold && state.camerasOpen && state.currentCam === "basement") {
    if (state.teachers.history.room === "basement" || state.sprintRun > 0) {
      state.staticBurst = Math.max(state.staticBurst, 0.5);
      return;
    }
    state.generator = Math.min(100, state.generator + 8 * dt);
    state.dirty = true;
    return;
  }
  const usage =
    1 +
    (state.camerasOpen ? 1 : 0) +
    (state.leftDoor ? 1 : 0) +
    (state.rightDoor ? 1 : 0) +
    (state.leftLight ? 1 : 0) +
    (state.rightLight ? 1 : 0);
  const rate = usage * (0.105 + state.night * 0.006) * (bothDoorsShut(state) ? BOTH_DOOR_DRAIN : 1);
  state.generator = Math.max(0, state.generator - rate * dt);
  if (state.generator > 0) return;

  state.powerOut = true;
  state.blackout = "dark";
  state.blackoutAcc = 0;
  state.leftDoor = false;
  state.rightDoor = false;
  state.leftLight = false;
  state.rightLight = false;
  state.camerasOpen = false;
  state.refillHold = false;
  sfx.powerDown();
  state.dirty = true;
}

function runBlackout(state: NightState, dt: number, sfx: Sfx): boolean {
  if (state.blackout === "none") return false;
  state.blackoutAcc += dt;
  if (state.blackout === "dark") {
    if (state.blackoutAcc >= 4.5) {
      state.blackout = "stare";
      state.blackoutAcc = 0;
      state.blackoutLimit = 8 + Math.random() * 13;
      sfx.jingle();
      state.dirty = true;
    }
    return true;
  }
  if (state.blackoutAcc >= state.blackoutLimit) {
    sfx.stopJingle();
    state.jumpscare = "principal";
    state.lost = true;
    state.running = false;
    sfx.scare();
    state.dirty = true;
  }
  return true;
}

function checkOffice(state: NightState, sfx: Sfx): boolean {
  const id = teachersIn(state, "office")[0];
  if (!id) return false;
  const t = state.teachers[id];
  if (t.officeSince === null) t.officeSince = state.elapsed;
  if (state.camerasOpen && state.elapsed - t.officeSince < 3.5) return false;
  sfx.stopJingle();
  state.jumpscare = id;
  state.lost = true;
  state.running = false;
  sfx.scare();
  state.dirty = true;
  return true;
}

function runAmbient(state: NightState, sfx: Sfx): void {
  if (state.elapsed < state.ambientAt) return;
  state.ambientAt = state.elapsed + 16 + Math.random() * 26;
  const roll = Math.random();
  if (roll < 0.45) sfx.step();
  else if (roll < 0.8) sfx.clang();
  else sfx.knock();
}

function updateBreath(state: NightState): void {
  const near = Boolean(threatOn(state, "left")) || Boolean(threatOn(state, "right"));
  state.breath = near && !state.camerasOpen ? 1 : 0;
}

export function scareTarget(state: NightState): TeacherId | null {
  if (state.currentCam !== "basement" || !state.camerasOpen) return null;
  if (state.sprintRun > 0) return null;
  const id = teachersIn(state, "basement")[0];
  return id || null;
}

export function scareReady(state: NightState): boolean {
  return state.scareCooldown <= 0 && scareTarget(state) !== null;
}

function runScare(state: NightState, dt: number, sfx: Sfx): void {
  if (state.scareCooldown > 0) state.scareCooldown = Math.max(0, state.scareCooldown - dt);

  const target = scareTarget(state);
  if (!target || !state.scareHold || state.scareCooldown > 0) {
    if (state.scareCharge > 0) {
      state.scareCharge = Math.max(0, state.scareCharge - dt * 1.6);
      state.dirty = true;
    }
    return;
  }

  state.scareCharge += dt;
  state.dirty = true;
  if (state.scareCharge < SCARE_SECONDS) return;

  const t = state.teachers[target];
  state.scareCharge = 0;
  state.scareCooldown = 26 + state.night * 4;
  state.grudge = 1;
  state.scareHold = false;
  state.sprintCharge = 0;
  t.room = "basementHall";
  t.routeIndex = Math.max(0, ROUTES[target].indexOf("basementHall"));
  t.moveAcc = 0;
  t.stallAcc = 0;
  state.staticBurst = 0.4;
  sfx.ahooga();
  say(state, "THAT GOT HIM OUT OF THE GENERATOR ROOM");
}

function runSprint(state: NightState, dt: number, sfx: Sfx): void {
  const t = state.teachers.history;

  if (state.sprintRun > 0) {
    state.sprintRun -= dt;
    if (state.sprintRun > 0) return;
    state.sprintRun = 0;
    if (state.rightDoor) {
      state.sprintBang = 1.1;
      state.generator = Math.max(0, state.generator - (4 + state.night * 1.6));
      state.sprintCharge = 0;
      t.room = "basementHall";
      t.routeIndex = 1;
      t.moveAcc = 0;
      sfx.bang();
      say(state, "SOMETHING HIT THE RIGHT DOOR");
    } else {
      t.room = "office";
      t.officeSince = state.elapsed;
    }
    state.dirty = true;
    return;
  }

  if (t.room !== "basement") return;

  const watched = state.camerasOpen && state.currentCam === "basement";
  if (watched) {
    state.sprintCharge = Math.max(0, state.sprintCharge - dt * 2.5);
    return;
  }
  state.sprintCharge += dt * (0.34 + state.night * 0.09 + effAi(state, t) * 0.02) * (1 + state.grudge * 0.7);
  if (state.sprintCharge < 30) return;

  state.sprintCharge = 0;
  state.sprintRun = 2.7;
  sfx.dash();
  say(state, "HEAVY FOOTSTEPS IN THE STAIRWELL");
  state.dirty = true;
}

function stepTeachers(state: NightState, dt: number, sfx: Sfx): void {
  (Object.keys(state.teachers) as TeacherId[]).forEach((id) => {
    const t = state.teachers[id];
    if (id === "huff") return;
    if (t.room === "office") return;
    if (id === "history" && (t.room === "basement" || state.sprintRun > 0)) return;
    if (id === "math" && !state.mathLookDone) {
      if (state.minutes >= 120) {
        state.mathLookDone = true;
        t.room = "hallway";
        t.routeIndex = 1;
        state.staticBurst = 0.4;
        state.dirty = true;
      }
      return;
    }
    if (state.minutes < t.wakeAt) return;

    const atDoor = t.room === "leftDoor" || t.room === "rightDoor";
    t.moveAcc += dt;
    if (!atDoor) t.stallAcc += dt;

    const forced = !atDoor && t.id !== "huff" && t.stallAcc >= stallLimit(state, t);
    if (!forced && t.moveAcc < t.moveEvery) return;
    t.moveAcc = 0;

    if (atDoor) {
      resolveDoor(state, t, sfx);
      return;
    }
    if (!forced && Math.random() * 20 >= effAi(state, t)) return;
    advance(state, t, sfx, forced);
  });
}

function resolveDoor(state: NightState, t: Teacher, sfx: Sfx): void {
  const closed = t.room === "leftDoor" ? state.leftDoor : state.rightDoor;
  if (t.atDoorSince === null) t.atDoorSince = state.elapsed;
  if (!closed) t.doorShutAt = null;
  if (closed) {
    if (t.doorShutAt === null) t.doorShutAt = state.elapsed;
    const held = Math.min(state.elapsed - t.atDoorSince, state.elapsed - t.doorShutAt);
    if (held < Math.min(DOOR_REPEL, retreatDelay(state, t))) return;
    t.doorShutAt = null;
    const route = ROUTES[t.id];
    t.routeIndex = Math.max(0, t.routeIndex - 1);
    t.room = route[t.routeIndex];
    t.atDoorSince = null;
    t.stallAcc = 0;
    if (Math.random() < 0.34 + state.night * 0.04) {
      t.mood = 1;
      t.moodAcc = 5 + Math.random() * 6;
    }
    state.staticBurst = 0.25;
    sfx.step();
    state.dirty = true;
    return;
  }
  if (state.elapsed - t.atDoorSince < doorPatience(state, t)) return;
  t.room = "office";
  t.officeSince = state.elapsed;
  state.dirty = true;
}

function advance(state: NightState, t: Teacher, sfx: Sfx, forced: boolean): void {
  const route = ROUTES[t.id];
  const backChance = t.id === "huff" ? 0.55 : 0.13;
  const back = !forced && Math.random() < backChance && t.routeIndex > 0;
  const next = back ? t.routeIndex - 1 : Math.min(route.length - 1, t.routeIndex + 1);
  if (next === t.routeIndex) {
    t.stallAcc = 0;
    return;
  }
  t.stallAcc = 0;

  let step = next;
  let nextRoom = route[step];
  const blocked = (r: RoomId) =>
    (r === "leftDoor" || r === "rightDoor") && !state.hasGenerator && state.doorGrace > 0;
  if (blocked(nextRoom)) {
    if (t.routeIndex <= 0) return;
    step = t.routeIndex - 1;
    nextRoom = route[step];
  }
  const toDoor = nextRoom === "leftDoor" || nextRoom === "rightDoor";

  const prev = t.room;
  t.routeIndex = step;
  t.room = nextRoom;
  if (toDoor && !state.hasGenerator) state.doorGrace = DOOR_GRACE;
  t.atDoorSince = t.room === "leftDoor" || t.room === "rightDoor" ? state.elapsed : null;
  t.doorShutAt = null;

  if (t.room === "leftDoor" || t.room === "rightDoor") sfx.knock();
  else sfx.step();

  if (state.camerasOpen && (state.currentCam === prev || state.currentCam === t.room)) {
    state.staticBurst = 0.45;
    sfx.camera();
  }
  if (prev === "lounge") state.signalLoss = 0.5;
  state.dirty = true;
}

export function blackoutTint(b: Blackout): number {
  return b === "stare" ? 1 : b === "dark" ? 0.5 : 0;
}
