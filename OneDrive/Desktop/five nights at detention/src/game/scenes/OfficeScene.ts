import Phaser from "phaser";
import { getBridge } from "../bridge";
import { asset } from "../../paths";

export class OfficeScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;
  private desk!: Phaser.GameObjects.Image;
  private noise!: Phaser.GameObjects.TileSprite;
  private leftOpen!: Phaser.GameObjects.Image;
  private rightOpen!: Phaser.GameObjects.Image;
  private leftClosed!: Phaser.GameObjects.Image;
  private rightClosed!: Phaser.GameObjects.Image;
  private leftGlow!: Phaser.GameObjects.Rectangle;
  private rightGlow!: Phaser.GameObjects.Rectangle;
  private dim!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private shake = 0;
  private viewW = 1920;
  private viewH = 1080;

  constructor() {
    super({ key: "OfficeScene" });
  }

  preload(): void {
    this.load.image("detention", asset("/assets/office/detention.png"));
    this.load.image("doorClosed", asset("/assets/office/door-closed.png"));
    this.load.image("doorOpenL", asset("/assets/office/door-open-left.png"));
    this.load.image("doorOpenR", asset("/assets/office/door-open-right.png"));
    this.load.image("moon", asset("/assets/office/moonlight.png"));
    this.load.image("noise", asset("/assets/office/noise.png"));
    this.load.image("desk", asset("/assets/office/desk.png"));
  }

  create(): void {
    this.viewW = this.scale.width;
    this.viewH = this.scale.height;
    this.root = this.add.container(0, 0);
    this.bg = this.add.image(0, 0, "detention").setOrigin(0.5, 0.5);
    this.leftGlow = this.add.rectangle(0, 0, 10, 10, 0xdfe6ff, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.rightGlow = this.add.rectangle(0, 0, 10, 10, 0xdfe6ff, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.leftOpen = this.add.image(0, 0, "doorOpenL").setOrigin(0, 0.5);
    this.rightOpen = this.add.image(0, 0, "doorOpenR").setOrigin(1, 0.5);
    this.leftClosed = this.add.image(0, 0, "doorClosed").setOrigin(0, 0.5);
    this.rightClosed = this.add.image(0, 0, "doorClosed").setOrigin(1, 0.5);
    this.moon = this.add.image(0, 0, "moon").setBlendMode(Phaser.BlendModes.ADD);
    this.desk = this.add.image(0, 0, "desk").setOrigin(0.5, 1);
    this.root.add([
      this.bg,
      this.leftGlow,
      this.rightGlow,
      this.leftOpen,
      this.rightOpen,
      this.leftClosed,
      this.rightClosed,
      this.moon,
      this.desk
    ]);
    this.noise = this.add
      .tileSprite(0, 0, this.viewW, this.viewH, "noise")
      .setOrigin(0, 0)
      .setAlpha(0.055);
    this.dim = this.add.rectangle(0, 0, this.viewW, this.viewH, 0x000000, 0).setOrigin(0, 0);
    this.flash = this.add.rectangle(0, 0, this.viewW, this.viewH, 0xb7cfff, 0).setOrigin(0, 0);
    this.flash.setBlendMode(Phaser.BlendModes.ADD);
    this.layout();
    this.scale.on("resize", this.onResize, this);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.viewW = gameSize.width;
    this.viewH = gameSize.height;
    this.layout();
  }

  private layout(): void {
    const w = this.viewW;
    const h = this.viewH;
    this.bg.setPosition(w / 2, h / 2);
    const scale = Math.max((w * 1.14) / this.bg.width, (h * 1.06) / this.bg.height);
    this.bg.setScale(scale);
    const doorH = h * 1.02;
    this.leftOpen.setScale(doorH / this.leftOpen.height).setPosition(w * 0.5 - this.bg.displayWidth * 0.46, h * 0.52);
    this.rightOpen.setScale(doorH / this.rightOpen.height).setPosition(w * 0.5 + this.bg.displayWidth * 0.46, h * 0.52);
    this.leftClosed.setScale(doorH / this.leftClosed.height).setPosition(this.leftOpen.x, h * 0.52);
    this.rightClosed.setScale(doorH / this.rightClosed.height).setPosition(this.rightOpen.x, h * 0.52);
    this.leftGlow.setSize(w * 0.3, h * 1.1).setPosition(this.leftOpen.x + w * 0.08, h * 0.52);
    this.rightGlow.setSize(w * 0.3, h * 1.1).setPosition(this.rightOpen.x - w * 0.08, h * 0.52);
    this.moon.setPosition(w * 0.58, h * 0.26);
    this.moon.setDisplaySize(w * 0.48, h * 0.58);
    this.desk.setPosition(w / 2, h + 4);
    this.desk.setDisplaySize(w * 1.12, h * 0.22);
    this.noise.setSize(w, h);
    this.dim.setSize(w, h);
    this.flash.setSize(w, h);
  }

  update(time: number, delta: number): void {
    const s = getBridge();
    const w = this.viewW;
    const target = -s.pan * w * 0.09;

    if (s.bang > 0.01 || s.scare) this.shake = 1;
    this.shake = Math.max(0, this.shake - delta / 420);
    const jolt = this.shake * 26;

    this.root.x = Phaser.Math.Linear(this.root.x, target, 0.12) + (Math.random() - 0.5) * jolt;
    this.root.y = (Math.random() - 0.5) * jolt;

    this.leftClosed.setVisible(s.leftDoor);
    this.leftOpen.setVisible(!s.leftDoor);
    this.rightClosed.setVisible(s.rightDoor);
    this.rightOpen.setVisible(!s.rightDoor);

    const buzz = 0.72 + Math.random() * 0.28;
    this.leftGlow.setAlpha(s.leftLight && !s.powerOut ? 0.3 * buzz : 0);
    this.rightGlow.setAlpha(s.rightLight && !s.powerOut ? 0.3 * buzz : 0);
    this.leftOpen.setTint(s.leftLight ? 0xf2f4ff : 0xffffff);
    this.rightOpen.setTint(s.rightLight ? 0xf2f4ff : 0xffffff);
    this.leftClosed.setTint(s.leftLight ? 0x9aa0ae : 0x3b3f48);
    this.rightClosed.setTint(s.rightLight ? 0x9aa0ae : 0x3b3f48);

    if (s.blackout !== "none") {
      const stare = s.blackout === "stare";
      this.moon.setAlpha(stare ? 0.08 + Math.random() * 0.08 : 0.05);
      this.bg.setTint(0x2a3147);
      this.dim.setAlpha(stare ? 0.78 + Math.random() * 0.1 : 0.9);
      this.flash.setAlpha(stare && Math.random() > 0.86 ? 0.12 : 0);
      this.noise.setAlpha(0.16);
    } else if (s.generator < 24) {
      const pulse = 0.26 + Math.abs(Math.sin(time / 150)) * 0.6 + Math.random() * 0.18;
      this.moon.setAlpha(pulse);
      this.bg.setTint(0x6d7ea0);
      this.flash.setAlpha(pulse * 0.07);
      this.dim.setAlpha(0.2);
      this.noise.setAlpha(0.08);
    } else {
      this.moon.setAlpha(0.1 + Math.sin(time / 1100) * 0.03);
      this.bg.setTint(s.flicker && Math.random() < 0.018 ? 0xc4c4c4 : 0xffffff);
      this.flash.setAlpha(0);
      this.dim.setAlpha(s.camerasOpen ? 0.28 : 0);
      this.noise.setAlpha(0.05);
    }

    this.noise.tilePositionX += 1.3;
    this.noise.tilePositionY += 0.45;
  }
}
