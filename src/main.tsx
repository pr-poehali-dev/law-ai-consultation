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
});

// Регистрируем Service Worker (обязательно для PWA на Android)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);