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
    <div className="flex gap-2.5 items-start">
      {/* Аватар AI */}
      <div className="shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(145deg, #0d2040, #162d5a)",
            boxShadow: "0 2px 8px rgba(10,22,40,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
          <Icon name="Scale" size={12} color="#e8a820" />
        </div>
      </div>

      {/* Карточка upsell */}
      <div className="flex-1 rounded-2xl rounded-tl-md overflow-hidden"
        style={{
          background: "linear-gradient(150deg, #091b38 0%, #0d2448 60%, #0f2a55 100%)",
          boxShadow: "0 8px 32px rgba(10,22,40,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>

        {/* Акцентная линия */}
        <div style={{ height: 2, background: "linear-gradient(90deg, #c97d10 0%, #e8a820 30%, #f5d060 50%, #e8a820 70%, #c97d10 100%)" }} />

        <div className="px-4 py-4 space-y-3.5">

          {/* Заголовок */}
          <div>
            <p className="text-[13px] font-semibold text-white leading-snug">Хотите получить полный ответ?</p>
            <p className="text-[11px] mt-1 leading-relaxed font-normal" style={{ color: "rgba(255,255,255,0.38)" }}>
              Продолжите диалог — детали, стратегия и готовый документ.
            </p>
          </div>

          {/* Пакет Старт — главный CTA */}
          <button onClick={onBuyPlan}
            className="w-full rounded-2xl transition-all active:scale-[0.98]"
            style={{
              padding: "11px 14px",
              background: "linear-gradient(135deg, #d4920f, #e8a820, #f5d060)",
              boxShadow: "0 4px 16px rgba(232,168,32,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(10,22,40,0.15)" }}>
                  <Icon name="Crown" size={12} color="#0a1628" />
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-semibold leading-tight" style={{ color: "#0a1628" }}>Пакет «Старт»</p>
                  <p className="text-[10px] font-normal leading-tight mt-0.5" style={{ color: "rgba(10,22,40,0.55)" }}>30 вопросов · 5 документов · .doc</p>
                  <p className="text-[10px] font-normal leading-tight" style={{ color: "rgba(10,22,40,0.6)" }}>+ проверка документов юристом</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] font-semibold leading-tight" style={{ color: "#0a1628" }}>990 ₽</p>
              </div>
            </div>
          </button>

          {/* Разделитель */}
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[10px] font-normal" style={{ color: "rgba(255,255,255,0.2)" }}>или быстрее</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* +3 вопроса */}
          <button onClick={onBuyQuickQuestions}
            className="w-full rounded-xl transition-all active:scale-[0.98]"
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(232,168,32,0.1)", border: "1px solid rgba(232,168,32,0.18)" }}>
                  <Icon name="MessageCircle" size={11} color="#f0c060" />
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-medium text-white leading-tight">Ещё 3 вопроса сейчас</p>
                  <p className="text-[10px] font-normal mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>диалог продолжится в кабинете</p>
                </div>
              </div>
              <p className="text-[13px] font-medium shrink-0" style={{ color: "#f0c060" }}>35 ₽</p>
            </div>
          </button>

          {/* Футер */}
          <div className="flex items-center justify-between">
            <button onClick={onLogin}
              className="text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.3)" }}>
              Есть аккаунт? Войти →
            </button>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>🔒 ЮКасса</p>
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