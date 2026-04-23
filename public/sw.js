// Service Worker: network-first для HTML, cache-first для статики
const CACHE_VERSION = "ii-pravo-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Статика которую кэшируем (JS/CSS/иконки)
const STATIC_EXTENSIONS = [".js", ".css", ".svg", ".png", ".ico", ".woff2", ".woff"];

function isStatic(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

function isHTML(request) {
  return request.headers.get("accept")?.includes("text/html");
}

// Install — просто активируемся
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Обработка SKIP_WAITING от страницы (при ошибке чанка)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate — удаляем старые кэши
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Не трогаем запросы к бэкенду и внешним ресурсам
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;

  // HTML — всегда network-first, кэш только как fallback
  if (isHTML(e.request) || url.pathname === "/" || url.pathname === "/cabinet") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Сохраняем свежую копию
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Статика (JS/CSS/иконки) — cache-first, но обновляем в фоне
  if (isStatic(url)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then((res) => {
          cache.put(e.request, res.clone());
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Всё остальное — network-first без кэша
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});