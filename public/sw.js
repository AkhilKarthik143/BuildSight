// Only public app assets and pre-read manuals. Never API responses, pairing rooms or camera frames.
const CACHE = "buildsight-shell-v2";
const SHELL = ["/", "/practice/parrot", "/practice/pc", "/ar/markers"];
const DEMO = ["/steps/6455750.json", "/steps/6455750/5.jpg"];
function cacheable(request) {
  const url = new URL(request.url);
  return request.method === "GET" && url.origin === self.location.origin && !request.headers.get("RSC") &&
    (SHELL.includes(url.pathname) || url.pathname.startsWith("/steps/") || url.pathname.startsWith("/_next/static/"));
}
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...SHELL, ...DEMO]);
    // Offline HTML also needs its initial JS/CSS; subsequent dynamic chunks are cached on first use.
    const assets = new Set();
    for (const path of SHELL) {
      const html = await (await cache.match(path)).text();
      for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"<>]+)"/g)) assets.add(match[1].replace(/&amp;/g, "&"));
    }
    await cache.addAll([...assets]);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("buildsight-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (!cacheable(event.request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), hit = await cache.match(event.request);
    try {
      const res = await fetch(event.request);
      if (res.ok) await cache.put(event.request, res.clone());
      return res;
    } catch {
      return hit || new Response("This asset is not saved offline yet.", {status:503});
    }
  })());
});
