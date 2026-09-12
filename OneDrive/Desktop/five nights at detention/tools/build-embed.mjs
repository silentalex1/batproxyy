import { build } from "vite";
import { cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = resolve(root, "..", "BatProx proxy", "public", "my-games", "five-nights-at-detention");

process.env.FNAD_EMBED = "1";
await build({ root, logLevel: "warn" });

if (!existsSync(dirname(target))) await mkdir(dirname(target), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(join(root, "dist"), target, { recursive: true });

console.log("deployed to " + target);
