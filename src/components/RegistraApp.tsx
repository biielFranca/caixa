"use client";

import { useEffect } from "react";

/** Registra o service worker, que e o que habilita instalar o site como app. */
export default function RegistraApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o site funciona igual, so nao oferece instalacao.
    });
  }, []);
  return null;
}
