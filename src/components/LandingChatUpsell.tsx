import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ── UpsellBlock ────────────────────────────────────────────────────────────────
export function UpsellBlock({
  onBuyPlan,
  onBuyQuickQuestions,
  onLogin,
}: {
  onBuyPlan: () => void;
  onBuyQuickQuestions: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="flex gap-2.5 items-start mt-1">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)", boxShadow: "0 2px 8px rgba(10,22,40,0.2)" }}
      >
        <Icon name="Scale" size={11} color="#e8a820" />
      </div>

      <div className="flex-1 rounded-2xl rounded-tl-sm overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0c1e3d 0%, #0f2550 100%)", boxShadow: "0 4px 24px rgba(10,22,40,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" }}>

        {/* Золотая линия */}
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #e8a820 25%, #f0c060 50%, #e8a820 75%, transparent)" }} />

        <div className="p-4 space-y-3">
          {/* Заголовок */}
          <div>
            <p className="text-sm font-bold text-white leading-snug">Хотите получить полный ответ?</p>
            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Продолжите диалог — уточните детали, получите стратегию и готовый документ.
            </p>
          </div>

          {/* Пакет Старт */}
          <button
            onClick={onBuyPlan}
            className="w-full rounded-2xl transition-all active:scale-[0.98]"
            style={{ padding: "11px 14px", background: "linear-gradient(135deg, #e8a820, #f0c060)", boxShadow: "0 4px 16px rgba(232,168,32,0.35)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(10,22,40,0.15)" }}>
                  <Icon name="Crown" size={13} color="#0a1628" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black leading-tight" style={{ color: "#0a1628" }}>Пакет «Старт»</p>
                  <p className="text-[10px] font-medium" style={{ color: "rgba(10,22,40,0.55)" }}>30 вопросов · 5 документов · .docx</p>
                  <p className="text-[10px] font-semibold" style={{ color: "rgba(10,22,40,0.7)" }}>+ проверка документов юристом</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-black" style={{ color: "#0a1628" }}>1 490 ₽</p>
              </div>
            </div>
          </button>

          {/* Разделитель */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>или быстрее</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* +3 вопроса */}
          <button
            onClick={onBuyQuickQuestions}
            className="w-full rounded-2xl transition-all active:scale-[0.98]"
            style={{ padding: "10px 14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.25)" }}>
                  <Icon name="MessageCircle" size={11} color="#f0c060" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-white leading-tight">Ещё 3 вопроса сейчас</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>диалог продолжится в кабинете</p>
                </div>
              </div>
              <p className="text-sm font-bold shrink-0" style={{ color: "#f0c060" }}>35 ₽</p>
            </div>
          </button>

          {/* Футер */}
          <div className="flex items-center justify-between pt-0.5">
            <button onClick={onLogin} className="text-[11px] font-medium transition-all hover:opacity-80" style={{ color: "rgba(255,255,255,0.35)" }}>
              Есть аккаунт? Войти →
            </button>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>ЮКасса · сразу</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PWAInstallButton ───────────────────────────────────────────────────────────
export function PWAInstallButton() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hasPrompt = !!(window as unknown as Record<string, unknown>).__pwaPrompt;
    if (ios || hasPrompt) { setIsIOS(ios); setShow(true); }
  }, []);

  if (!show) return null;

  const handleClick = async () => {
    if (isIOS) { setShowGuide(true); return; }
    const prompt = (window as unknown as Record<string, unknown>).__pwaPrompt as { prompt: () => void } | undefined;
    prompt?.prompt();
  };

  return (
    <>
      <button onClick={handleClick}
        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm transition-all active:scale-[0.98] shrink-0"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
        <Icon name="Smartphone" size={15} />
        <span className="hidden sm:inline">Приложение</span>
      </button>
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowGuide(false)}>
          <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()}>
            <p className="font-bold text-white mb-3">Добавить на экран (iOS)</p>
            {["Нажмите «Поделиться» (□↑) внизу Safari", "Прокрутите и выберите «На экран Домой»", "Нажмите «Добавить»"].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(232,168,32,0.2)" }}>
                  <span className="text-[10px] font-bold" style={{ color: "#e8a820" }}>{i + 1}</span>
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{step}</p>
              </div>
            ))}
            <button onClick={() => setShowGuide(false)} className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>Понятно</button>
          </div>
        </div>
      )}
    </>
  );
}