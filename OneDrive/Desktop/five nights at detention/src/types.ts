export type View =
  | "home"
  | "enroll"
  | "warning"
  | "night"
  | "credits"
  | "leaderboard"
  | "settings"
  | "feedback";

export type RoomId =
  | "lounge"
  | "hallway"
  | "cafeteria"
  | "principal"
  | "basementHall"
  | "basement"
  | "leftDoor"
  | "rightDoor"
  | "office";

export type CamId = "lounge" | "hallway" | "cafeteria" | "principal" | "basementHall" | "basement";

export type TeacherId = "math" | "gym" | "principal" | "history";

export type MathLook = "idle" | "staring" | "glitch";

export type Blackout = "none" | "dark" | "stare";

export interface Teacher {
  id: TeacherId;
  name: string;
  tag: string;
  room: RoomId;
  routeIndex: number;
  ai: number;
  moveEvery: number;
  moveAcc: number;
  atDoorSince: number | null;
  officeSince: number | null;
  portrait: string;
  body: string;
  scare: string;
  wakeAt: number;
}

export interface NightState {
  running: boolean;
  minutes: number;
  clockAcc: number;
  generator: number;
  leftDoor: boolean;
  rightDoor: boolean;
  leftLight: boolean;
  rightLight: boolean;
  camerasOpen: boolean;
  currentCam: CamId;
  powerOut: boolean;
  mathLook: MathLook;
  mathLookAcc: number;
  mathLookDone: boolean;
  teachers: Record<TeacherId, Teacher>;
  jumpscare: TeacherId | null;
  won: boolean;
  lost: boolean;
  night: number;
  staticBurst: number;
  signalLoss: number;
  refillHold: boolean;
  elapsed: number;
  dirty: boolean;
  paused: boolean;
  everOpened: boolean;
  blackout: Blackout;
  blackoutAcc: number;
  blackoutLimit: number;
  sprintCharge: number;
  sprintRun: number;
  sprintBang: number;
  ambientAt: number;
  breath: number;
  hint: string;
  hintAcc: number;
}

export interface ScoreRow {
  name: string;
  night: number;
  minutes: number;
  result: "survived" | "caught";
  at: number;
}

export interface SettingsData {
  volume: number;
  pan: number;
  flicker: boolean;
}

export interface SaveData {
  username: string;
  nightsCleared: number;
  settings: SettingsData;
  leaderboard: ScoreRow[];
  feedback: { text: string; at: number; name: string }[];
}

export interface OfficeBridge {
  leftDoor: boolean;
  rightDoor: boolean;
  leftLight: boolean;
  rightLight: boolean;
  generator: number;
  powerOut: boolean;
  camerasOpen: boolean;
  pan: number;
  flicker: boolean;
  leftThreat: boolean;
  rightThreat: boolean;
  blackout: Blackout;
  bang: number;
  scare: boolean;
}
