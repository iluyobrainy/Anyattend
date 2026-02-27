import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles/app.css";

function registerPwaUpdates(): void {
  let hasReloaded = false;

  const forceActivate = (registration: ServiceWorkerRegistration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  const wireUpdateHandling = (registration: ServiceWorkerRegistration) => {
    forceActivate(registration);

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) {
        return;
      }

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          forceActivate(registration);
        }
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloaded) {
        return;
      }
      hasReloaded = true;
      window.location.reload();
    });

    const periodicUpdate = () => registration.update().catch(() => undefined);
    setInterval(periodicUpdate, 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        periodicUpdate();
      }
    });
  };

  navigator.serviceWorker
    .register("/sw.js", {
      updateViaCache: "none"
    })
    .then(wireUpdateHandling)
    .catch(() => undefined);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    registerPwaUpdates();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
