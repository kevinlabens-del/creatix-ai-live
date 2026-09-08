const CACHE_NAME = "creatix-ai-live-v3.2.2-pages";
const APP_BASE = new URL("./", self.location.href).pathname;
const appPath = (path = "") => new URL(path, self.registration.scope).pathname;
const APP_SHELL = [
  APP_BASE,
  appPath("manifest.webmanifest"),
  appPath("icons/icon.svg"),
  appPath("icons/icon-192.png"),
  appPath("icons/icon-512.png"),
  appPath("data/seed-catalog.json"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      const indexResponse = await cache.match(APP_BASE);
      if (!indexResponse) return;
      const html = await indexResponse.text();
      const builtAssets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(
        (match) => new URL(match[1], self.location.origin).pathname,
      );
      if (builtAssets.length) await cache.addAll([...new Set(builtAssets)]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Les lecteurs et flux vidéo distants restent entièrement hors du cache PWA.
  if (
    url.origin !== self.location.origin ||
    request.destination === "video" ||
    /\.(?:mp4|webm|m3u8|ts)(?:$|\?)/i.test(url.pathname)
  ) {
    return;
  }

  if (url.pathname.startsWith(appPath("api/"))) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_BASE, copy));
          return response;
        })
        .catch(() => caches.match(APP_BASE)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }),
  );
});
