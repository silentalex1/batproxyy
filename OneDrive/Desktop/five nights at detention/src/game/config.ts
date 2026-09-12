import Phaser from "phaser";
import { OfficeScene } from "./scenes/OfficeScene";

export function makeGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 1920,
    height: 1080,
    backgroundColor: "#050505",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      powerPreference: "high-performance"
    },
    scene: [OfficeScene],
    audio: { noAudio: true }
  };
}
