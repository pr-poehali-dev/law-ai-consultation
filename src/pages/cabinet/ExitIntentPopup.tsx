import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

interface ExitIntentPopupProps {
  onAccept: () => void;
  onClose: () => void;
}

const STORAGE_KEY = "exit_intent_shown";

export function useExitIntent({
  enabled,
  onShow,
}: {
  enabled: boolean;
  onShow: () => void;
}) {
  const shown = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !shown.current) {
        shown.current = true;
        sessionStorage.setItem(STORAGE_KEY, "1");
        onShow();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && !shown.current) {
        shown.current = true;
        sessionStorage.setItem(STORAGE_KEY, "1");
        onShow();
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, onShow]);
}

export default function ExitIntentPopup({ onAccept, onClose }: ExitIntentPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleAccept = () => {
    setVisible(false);
    setTimeout(onAccept, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 transition-all duration-300 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      style={{ background: "rgba(6, 13, 24, 0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`relative w-full max-w-md transition-all duration-300 ${visible ? "translate-y-0 scale-100" : "translate-y-8 scale-95"}`}
      >
        {/* Glow */}
        <div className="absolute -inset-1 rounded-3xl opacity-60 blur-xl"
          style={{ background: "linear-gradient(135deg, #e8a820 0%, #162d5a 60%)" }} />

        {/* Card */}
        <div className="relative rounded-3xl overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0f1f3d 0%, #0a1628 60%, #060e1c 100%)", border: "1px solid rgba(232,168,32,0.25)" }}>

          {/* Top accent line */}
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #e8a820, #f0c060, #e8a820)" }} />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <Icon name="X" size={14} />
          </button>

          <div className="px-6 pt-6 pb-7">
            {/* Бейдж */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.3)" }}>
              <span className="text-xs font-bold tracking-wide" style={{ color: "#f0c060" }}>⚡ СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ</span>
            </div>

            {/* Заголовок */}
            <h2 className="font-bold text-white leading-tight mb-2" style={{ fontSize: "22px", fontFamily: "Georgia, serif" }}>
              Подождите! Только сейчас<br />
              <span style={{ color: "#f0c060" }}>скидка 50%</span> на пакет «Старт»
            </h2>
            <p className="text-sm mb-5" style={{ color: "rgba(160,180,204,0.85)" }}>
              Получите полный доступ к AI-юристу по минимальной цене — это предложение исчезнет, когда вы уйдёте.
            </p>

            {/* Пакет */}
            <div className="rounded-2xl p-4 mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(232,168,32,0.15)" }}>
                    <Icon name="Scale" size={16} color="#e8a820" />
                  </div>
                  <span className="font-bold text-white text-base">Пакет «Старт»</span>
                </div>
                <div className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
                  −50%
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <Icon name="MessageCircle" size={14} color="#a0b4cc" />
                  <span className="text-sm" style={{ color: "#a0b4cc" }}>30 вопросов юристу</span>
                </div>
                <div className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <div className="flex items-center gap-1.5">
                  <Icon name="FileText" size={14} color="#a0b4cc" />
                  <span className="text-sm" style={{ color: "#a0b4cc" }}>5 документов</span>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ color: "#f0c060" }}>745 ₽</span>
                <span className="text-base line-through" style={{ color: "rgba(160,180,204,0.45)" }}>1 490 ₽</span>
                <span className="text-xs font-semibold ml-1" style={{ color: "#4ade80" }}>Максимальная выгода!</span>
              </div>
            </div>

            {/* Фичи */}
            <div className="flex flex-col gap-2 mb-6">
              {[
                "Ответы со ссылками на статьи закона РФ",
                "Иски, претензии, договоры за 3 минуты",
                "Анализ PDF-документов",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,32,0.2)" }}>
                    <Icon name="Check" size={10} color="#e8a820" />
                  </div>
                  <span className="text-xs" style={{ color: "rgba(160,180,204,0.8)" }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Кнопки */}
            <button
              onClick={handleAccept}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 mb-3 relative overflow-hidden group"
              style={{ background: "linear-gradient(135deg, #e8a820 0%, #f0c060 50%, #e8a820 100%)", color: "#0a1628", backgroundSize: "200% 100%" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundPosition = "right center")}
              onMouseLeave={e => (e.currentTarget.style.backgroundPosition = "left center")}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Icon name="Zap" size={18} />
                Забрать за 745 ₽ со скидкой 50%
              </span>
            </button>

            <button
              onClick={handleClose}
              className="w-full py-2.5 text-sm transition-colors"
              style={{ color: "rgba(160,180,204,0.5)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(160,180,204,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(160,180,204,0.5)")}
            >
              Нет, спасибо
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
