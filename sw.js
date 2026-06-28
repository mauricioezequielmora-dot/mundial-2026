const CACHE_NAME = "central-mundialista-v10-banderas-corregidas";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./studio.js",
  "./remote-control.js",
  "./firebase-config.js",
  "./knockout.js",
  "./pwa.js",
  "./titulares.js",
  "./preguntas.js",
  "./curiosidades.js",
  "./manifest.webmanifest",
  "./flags/za.png",
  "./flags/ca.png",
  "./flags/br.png",
  "./flags/jp.png",
  "./flags/de.png",
  "./flags/py.png",
  "./flags/nl.png",
  "./flags/ma.png",
  "./flags/ci.png",
  "./flags/no.png",
  "./flags/fr.png",
  "./flags/se.png",
  "./flags/mx.png",
  "./flags/ec.png",
  "./flags/eng.png",
  "./flags/cd.png",
  "./flags/be.png",
  "./flags/sn.png",
  "./flags/us.png",
  "./flags/ba.png",
  "./flags/es.png",
  "./flags/at.png",
  "./flags/pt.png",
  "./flags/hr.png",
  "./flags/ch.png",
  "./flags/dz.png",
  "./flags/au.png",
  "./flags/eg.png",
  "./flags/ar.png",
  "./flags/cv.png",
  "./flags/co.png",
  "./flags/gh.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./audio/fondo-central.mp3",
  "./control/index.html",
  "./control/style.css",
  "./control/control.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.destination === "audio" || url.pathname.endsWith(".mp3")) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(response => {
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        return new Response("Sin conexión", { status: 503, statusText: "Offline" });
      })
  );
});
