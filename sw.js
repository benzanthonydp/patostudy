/* PatoStudy web copy (iPhone and iPad home screen app, also any browser). Template: tools/11-16-2026-build-web.py fills in
   @@SHELL@@ (patostudy-<version>-<fingerprint of index.html>, so every new page is a new cache) and @@SLIDES@@
   (patostudy-slides-<fingerprint of the slide picture files>, so the pictures are kept across app updates unless they changed).
   This file only touches Cache Storage. It never reads or writes localStorage or IndexedDB, so saved progress is never affected.

   Contract (the Profile "App update" card, pZy_61c_update.py, relies on it):
   - install: precache the app shell (index.html, manifest, icons). NO skipWaiting here: the new worker waits.
   - message {type:"SKIP_WAITING"}: self.skipWaiting(). The page sends it only when the student taps "Update now".
   - activate: delete every other patostudy-* cache, then clients.claim() (the page then gets "controllerchange" and reloads).
   - version.json is never cached or intercepted (the fetch handler returns before respondWith), and is not in the shell list.
   - slide pictures (slides/<deck>/<n>.webp, t<n>.webp): cache first; a picture not seen yet is fetched, and kept only when the
     answer is 200. The set is finite (about 70 MB for all decks), so the cache cannot grow past that. */
const PREFIX = "patostudy-";
const SHELL = "patostudy-6.3-92c1639d0f";
const SLIDES = "patostudy-slides-88bb1daa6c";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];
const SLIDE_PATH = new URL("slides/", self.registration.scope).pathname;

self.addEventListener("install", e => {
  /* no skipWaiting here: the page tells the worker when (Update now) */
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== SHELL && k !== SLIDES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return; /* fonts and other sites go straight to the network */
  if (u.pathname.endsWith("/version.json")) return; /* "Check for update" must always ask the server, never the cache */
  if (u.pathname.endsWith(".apk")) return; /* the Android app file always comes from the server */
  if (u.pathname.startsWith(SLIDE_PATH)) {
    e.respondWith(
      caches.open(SLIDES).then(c =>
        c.match(r).then(hit => {
          if (hit) return hit;
          return fetch(r).then(res => {
            if (res && res.status === 200) c.put(r, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }
  e.respondWith(
    caches.open(SHELL).then(c =>
      c.match(r, { ignoreSearch: true }).then(hit => {
        if (hit) return hit;
        return fetch(r).catch(() => (r.mode === "navigate" ? c.match("./index.html") : Response.error()));
      })
    )
  );
});
