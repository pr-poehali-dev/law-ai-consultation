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

// Регистрируем Service Worker (обязательно для PWA на Android)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Если чанк не загрузился (старый SW отдал устаревший index.html) — перезагружаем
window.addEventListener("error", (e) => {
  const src = (e.target as HTMLScriptElement)?.src || "";
  if (src.includes("/assets/")) {
    const reloadKey = "chunk_reload_attempted";
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    }
  }
}, true);

createRoot(document.getElementById("root")!).render(<App />);