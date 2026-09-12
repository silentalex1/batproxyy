import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { asset } from "./paths";
import "./index.css";

const root = document.documentElement;
root.style.setProperty("--noise-url", `url("${asset("assets/office/noise.png")}")`);
root.style.setProperty("--home-bg", `url("${asset("assets/ui/backgroundimagefnaf.png")}")`);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
