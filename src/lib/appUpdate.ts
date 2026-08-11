/**
 * Обнаружение новой версии приложения через Service Worker и уведомление пользователя.
 * Работает одинаково в обычном браузере и в установленном PWA (мобильный/десктоп).
 */

const UPDATE_EVENT = "app-update-available";
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // проверяем раз в 10 минут, пока вкладка открыта

let waitingWorker: ServiceWorker | null = null;
let reloadTriggered = false;

function notifyUpdateAvailable(worker: ServiceWorker) {
  waitingWorker = worker;
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

/** Регистрирует Service Worker и слушает появление новой версии. */
export function registerServiceWorkerWithUpdates(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Если новый воркер уже ждёт активации (например, обновление пришло пока вкладка была закрыта)
      if (registration.waiting) {
        notifyUpdateAvailable(registration.waiting);
      }

      // Новый воркер появился — следим за его состоянием
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && registration.waiting) {
            notifyUpdateAvailable(newWorker);
          }
        });
      });

      // Периодически проверяем обновления, пока вкладка активна
      setInterval(() => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      }, CHECK_INTERVAL_MS);

      // Проверяем сразу при возврате на вкладку
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      });
    } catch {
      // регистрация SW не критична для работы приложения
    }
  });

  // Когда новый SW реально возьмёт контроль — перезагружаем страницу ОДИН раз
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadTriggered) return;
    reloadTriggered = true;
    window.location.reload();
  });
}

/** Подписка на событие "доступно обновление". Возвращает функцию отписки. */
export function onUpdateAvailable(cb: () => void): () => void {
  window.addEventListener(UPDATE_EVENT, cb);
  return () => window.removeEventListener(UPDATE_EVENT, cb);
}

/** Применяет обновление: просит ожидающий SW активироваться — это вызовет controllerchange и перезагрузку. */
export function applyAppUpdate(): void {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else {
    // На случай если ссылку на воркер потеряли — просто перезагружаем принудительно
    window.location.reload();
  }
}
