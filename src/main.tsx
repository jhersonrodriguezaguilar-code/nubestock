import "@fontsource-variable/plus-jakarta-sans";
import "./styles.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { applyTheme, readTheme } from "./lib/theme";

applyTheme(readTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// La app se puede instalar y abrir sin conexión (solo en la versión publicada).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
