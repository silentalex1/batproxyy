import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { asset } from "./paths";
import { audio } from "./audio/engine";
import "./index.css";

const root = document.documentElement;
root.style.setProperty("--noise-url", `url("${asset("assets/office/noise.png")}")`);
root.style.setProperty("--home-bg", `url("${asset("assets/ui/backgroundimagefnaf.png")}")`);
audio.setAhoogaSrc(asset("assets/sounds/Cartoon Ahooga - Sound Effect.mp3"));
audio.setJobSrc(asset("assets/sounds/I have a job sound effect.mov"));
audio.setStepsSrc(asset("assets/sounds/Heavy monster footsteps sound (Sound effect).mp3"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
