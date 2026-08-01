const ASSET_CACHE = "cafe1-assets-v2";
const PROTECTED_PREFIXES = [
  "/api/",
  "/~oauth",
  "/admin",
  "/staff",
  "/till",
  "/kds",
  "/driver",
  "/display",
  "/pay",
  "/order",
  "/account",
  "/tab",
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => key !== ASSET_CACHE).map((key) => caches.delete(key))),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return;
  if (PROTECTED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;
  if (!/\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) return;

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const fresh = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") void cache.put(request, response.clone());
        return response;
      });
      return cached ?? fresh;
    }),
  );
});
