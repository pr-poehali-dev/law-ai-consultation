/**
 * Баннер «Доступно обновление» — появляется когда Service Worker обнаружил новую
 * версию приложения (например, после нашего деплоя, пока у пользователя была открыта
 * старая вкладка). Работает одинаково в браузере и в установленном PWA.
 */
import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { onUpdateAvailable, applyAppUpdate } from "@/lib/appUpdate";

export default function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onUpdateAvailable(() => setVisible(true));
    return unsubscribe;
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    setUpdating(true);
    applyAppUpdate();
  };

  return (
    <div
      className="fixed left-1/2 z-[250] pointer-events-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, #0d1e38, #162d5a)",
          border: "1px solid rgba(232,168,32,0.35)",
          backdropFilter: "blur(16px)",
          minWidth: "260px",
          maxWidth: "360px",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(232,168,32,0.15)" }}
        >
          <Icon name="Sparkles" size={17} color="#f0c060" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight">Доступно обновление</p>
          <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
            Мы улучшили сервис — обновите страницу
          </p>
        </div>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
          style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}
        >
          {updating ? (
            <span className="w-3 h-3 border-2 border-navy-900/40 border-t-navy-900 rounded-full animate-spin" />
          ) : (
            <Icon name="RefreshCw" size={12} color="#0a1628" />
          )}
          Обновить
        </button>
      </div>
    </div>
  );
}
