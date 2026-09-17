// Service worker exigido para o navegador oferecer a instalacao.
//
// De proposito ele NAO guarda nada em cache: um cache aqui faria o app abrir
// versao velha depois de cada deploy, que e exatamente o problema que ja
// custou caro neste projeto. O fetch passa direto para a rede.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
