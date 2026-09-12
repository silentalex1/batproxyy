import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { makeGameConfig } from "./config";

export function PhaserRoot() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game(makeGameConfig(host.current));
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div className="phaser-host" ref={host} />;
}
