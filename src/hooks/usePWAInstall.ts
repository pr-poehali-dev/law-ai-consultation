import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PWAStatus = "android" | "ios" | "installed" | "unsupported";

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<PWAStatus>("unsupported");

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode =
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isInStandaloneMode) {
      setStatus("installed");
      return;
    }

    if (isIOS) {
      setStatus("ios");
      return;
    }

    // Событие перехватывается глобально в main.tsx и сохраняется в window.__pwaPrompt
    const check = () => {
      if (window.__pwaPrompt) {
        setDeferredPrompt(window.__pwaPrompt as BeforeInstallPromptEvent);
        setStatus("android");
      }
    };

    // Проверяем сразу (если событие уже пришло до монтирования)
    check();

    // И подписываемся на кастомный event который main.tsx диспатчит после сохранения
    const onReady = () => check();
    window.addEventListener("pwaPromptReady", onReady);
    return () => window.removeEventListener("pwaPromptReady", onReady);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setStatus("installed");
      setDeferredPrompt(null);
      window.__pwaPrompt = undefined;
    }
  };

  return { status, install };
}