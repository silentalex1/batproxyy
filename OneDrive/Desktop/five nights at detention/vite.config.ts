import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export const EMBED_BASE = "/my-games/five-nights-at-detention/";

export default defineConfig({
  base: process.env.FNAD_EMBED ? EMBED_BASE : "/",
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
});
