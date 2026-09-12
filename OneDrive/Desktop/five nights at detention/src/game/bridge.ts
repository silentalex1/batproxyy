import type { OfficeBridge } from "../types";

let data: OfficeBridge = {
  leftDoor: false,
  rightDoor: false,
  leftLight: false,
  rightLight: false,
  generator: 100,
  powerOut: false,
  camerasOpen: false,
  pan: 0,
  flicker: true,
  leftThreat: false,
  rightThreat: false,
  blackout: "none",
  bang: 0,
  scare: false
};

export function setBridge(partial: Partial<OfficeBridge>): void {
  data = { ...data, ...partial };
}

export function getBridge(): OfficeBridge {
  return data;
}
