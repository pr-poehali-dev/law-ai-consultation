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
      className={`fixed inset-0 z-[9999] flex items-end sm:items-center justify-center transition-all duration-300 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      style={{ background: "rgba(6, 13, 24, 0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Контейнер — снизу на мобиле, по центру на десктопе */}
      <div
        className={`relative w-full sm:max-w-md transition-all duration-300 ${
          visible ? "translate-y-0 scale-100" : "translate-y-full sm:translate-y-8 sm:scale-95"
        }`}
      >
        {/* Glow — только на десктопе */}
        <div className="absolute -inset-1 rounded-3xl opacity-50 blur-xl hidden sm:block"
          style={{ background: "linear-gradient(135deg, #e8a820 0%, #162d5a 60%)" }} />

        {/* Card */}
        <div
          className="relative overflow-hidden sm:rounded-3xl rounded-t-3xl"
          style={{
            background: "linear-gradient(160deg, #0f1f3d 0%, #0a1628 60%, #060e1c 100%)",
            border: "1px solid rgba(232,168,32,0.22)",
            borderBottom: "none",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Верхняя золотая линия */}
          <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, transparent, #e8a820 30%, #f0c060 50%, #e8a820 70%, transparent)" }} />

          {/* Индикатор свайпа (мобиле) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
          </div>

          {/* Кнопка закрыть */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}
          >
            <Icon name="X" size={14} />
          </button>

          <div className="px-5 pt-3 pb-5 sm:px-6 sm:pt-5 sm:pb-7">

            {/* Бейдж */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
              style={{ background: "rgba(232,168,32,0.13)", border: "1px solid rgba(232,168,32,0.28)" }}>
              <span className="text-[11px] font-bold tracking-wide" style={{ color: "#f0c060" }}>⚡ СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ</span>
            </div>

            {/* Заголовок */}
            <h2 className="font-bold text-white leading-snug mb-1.5"
              style={{ fontSize: "clamp(18px, 5vw, 22px)", fontFamily: "Georgia, serif" }}>
              Подождите! Получите{" "}
              <span style={{ color: "#f0c060" }}>полный доступ</span> всего за 745 ₽
            </h2>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "rgba(160,180,204,0.82)" }}>
              30 вопросов AI-юристу + 5 документов — начните решать юридические вопросы прямо сейчас.
            </p>

            {/* Пакет */}
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>

              {/* Шапка пакета */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,32,0.15)" }}>
                    <Icon name="Scale" size={14} color="#e8a820" />
                  </div>
                  <span className="font-bold text-white text-[15px]">Пакет «Старт»</span>
                </div>
                <div className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
                  −50%
                </div>
              </div>

              {/* Состав */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Icon name="MessageCircle" size={12} color="#a0b4cc" />
                  <span className="text-xs" style={{ color: "#a0b4cc" }}>30 вопросов</span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>·</span>
                <div className="flex items-center gap-1">
                  <Icon name="FileText" size={12} color="#a0b4cc" />
                  <span className="text-xs" style={{ color: "#a0b4cc" }}>5 документов</span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>·</span>
                <span className="text-xs" style={{ color: "#a0b4cc" }}>Скачивание .doc</span>
              </div>

              {/* Цена */}
              <div className="flex items-baseline gap-2">
                <span className="font-black" style={{ color: "#f0c060", fontSize: "clamp(26px, 8vw, 32px)" }}>745 ₽</span>
                <span className="text-[11px] font-semibold" style={{ color: "#4ade80" }}>Полный доступ!</span>
              </div>
            </div>

            {/* Фичи — горизонтально на мобиле */}
            <div className="flex flex-col gap-1.5 mb-5">
              {[
                "Ответы со ссылками на статьи закона РФ",
                "Иски, претензии, договоры за 3 минуты",
                "Генерация документов по вашей ситуации",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,32,0.18)" }}>
                    <Icon name="Check" size={9} color="#e8a820" />
                  </div>
                  <span style={{ fontSize: "12px", color: "rgba(160,180,204,0.78)" }}>{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleAccept}
              className="w-full rounded-2xl font-bold transition-all duration-150 active:scale-[0.97]"
              style={{
                padding: "14px 16px",
                background: "linear-gradient(135deg, #e8a820, #f0c060)",
                color: "#0a1628",
                fontSize: "15px",
                boxShadow: "0 4px 20px rgba(232,168,32,0.3)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Icon name="Zap" size={17} />
                Забрать пакет «Старт» за 745 ₽
              </span>
            </button>

            <button
              onClick={handleClose}
              className="w-full py-3 text-sm mt-2"
              style={{ color: "rgba(160,180,204,0.45)" }}
            >
              Нет, спасибо
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}