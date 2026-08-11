// Service Worker: network-first для HTML, cache-first для статики
const CACHE_VERSION = "ii-pravo-v7";
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

// ── Web Push ──────────────────────────────────────────────────────────────────

// Иконки: используем абсолютные URL чтобы работало и в PWA и в браузере
const PUSH_ICON = "/icon-192.svg";
const PUSH_BADGE = "/icon-192.svg"; // badge — SVG (Chrome Android использует для строки статуса)

// Действия по умолчанию для уведомлений с кнопками
const ACTION_OPEN = { action: "open", title: "Открыть" };
const ACTION_DISMISS = { action: "dismiss", title: "Закрыть" };

self.addEventListener("push", (event) => {
  let data = {
    title: "ИИ-Право.рф",
    body: "У вас новое сообщение",
    url: "/cabinet",
    tag: "default",
    actions: [],
    image: null,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {}

  // Определяем действия по типу уведомления
  const actions = [{ action: "open", title: "Ответить" }];


  const options = {
    body: data.body,
    icon: PUSH_ICON,
    badge: PUSH_BADGE,
    data: { url: data.url || "/cabinet" },
    // Вибрация: короткий паттерн — неназойливо
    vibrate: [100, 50, 100],
    // Группировка одинаковых уведомлений
    tag: data.tag || "ii-pravo",
    renotify: true,
    // Не требуем взаимодействия — исчезнет само
    requireInteraction: false,
    // Показываем уведомление даже если приложение открыто
    silent: false,
    // Кнопки действий (работает в Chrome Android и desktop)
    actions: actions,
    // Временная метка
    timestamp: Date.now(),
  };

  // image — большая картинка под телом (только Chrome desktop/Android)
  if (data.image) options.image = data.image;

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Если нажали "Закрыть" — просто закрываем
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/cabinet";
  const fullUrl = self.location.origin + url;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Если уже открыт кабинет — фокусируем и навигируем
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      // Иначе открываем новую вкладку
      if (clients.openWindow) return clients.openWindow(fullUrl);
    })
  );
});

// Закрытие уведомления без клика — можно логировать аналитику
self.addEventListener("notificationclose", () => {
  // можно отправить событие аналитики
});