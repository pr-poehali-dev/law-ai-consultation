import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Перехватываем beforeinstallprompt ГЛОБАЛЬНО до монтирования React
// Chrome может выстрелить его очень рано — сохраняем в window
declare global {
  interface Window {
    __pwaPrompt?: Event;
  }
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaPrompt = e;
  // Уведомляем хук что промпт готов
  window.dispatchEvent(new Event("pwaPromptReady"));
});

// После успешной установки PWA — запрашиваем разрешение на push
window.addEventListener("appinstalled", () => {
  setTimeout(async () => {
    try {
      const { subscribeToPush } = await import("@/lib/pushNotifications");
      await subscribeToPush(true);
    } catch (_e) {
      // не критично
    }
  }, 2000);
});

// Регистрируем Service Worker (обязательно для PWA на Android)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Если чанк не загрузился (старый SW отдал устаревший index.html) — перезагружаем
// Работает во всех браузерах: Chrome, Яндекс, Safari, Opera, Firefox
window.addEventListener("error", (e) => {
  const target = e.target as HTMLScriptElement | HTMLLinkElement;
  const src = (target as HTMLScriptElement)?.src || (target as HTMLLinkElement)?.href || "";
  if (src.includes("/assets/")) {
    const reloadKey = "chunk_reload_attempted";
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      // Принудительно инвалидируем SW-кэш перед перезагрузкой
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      }
      window.location.reload();
    }
  }
}, true);

// Сбрасываем фон после монтирования React — убираем инлайн-стиль из body
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    document.documentElement.style.removeProperty("background");
    document.body.style.removeProperty("background");
  }, 50);
});

createRoot(document.getElementById("root")!).render(<App />);