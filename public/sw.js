// 해피케어 서비스워커: 앱(플레이스토어 TWA)·홈 화면 설치용 최소 기능
// - 페이지는 항상 인터넷에서 새로 받습니다 (상품·가격·기관 정보가 오래된 채로 남지 않게)
// - 인터넷이 끊겼을 때만 미리 받아 둔 안내 화면(/offline.html)을 보여 줍니다
// - API 요청과 다른 사이트로 가는 요청은 건드리지 않습니다
const CACHE = "happycare-offline-v1";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/logo.png", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("happycare-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
