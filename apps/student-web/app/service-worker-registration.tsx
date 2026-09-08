"use client";

import { useEffect } from "react";

/** Registers /sw.js on mount — required (alongside the manifest) for
 * Chrome/Android to consider the app installable as a PWA. No-ops
 * gracefully in browsers without Service Worker support (e.g. very old
 * Safari) or in non-browser contexts. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a progressive enhancement — silently skip.
      });
    }
  }, []);

  return null;
}
