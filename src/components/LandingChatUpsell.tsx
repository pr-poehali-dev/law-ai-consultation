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
    <div className="flex gap-2 items-start mt-1">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}
      >
        <Icon name="Scale" size={11} color="#e8a820" />
      </div>

      <div
        className="flex-1 rounded-2xl rounded-tl-sm overflow-hidden"
        style={{ background: "linear-gradient(150deg, #0a1628 0%, #0e2040 100%)", border: "1px solid rgba(232,168,32,0.25)" }}
      >
        {/* Золотая линия */}
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f0c060 50%, #e8a820 70%, transparent)" }} />

        <div className="p-4">
          {/* Шапка */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)" }}>
              <Icon name="Zap" size={13} color="#e8a820" />
            </div>
            <p className="text-sm font-bold text-white">Бесплатные вопросы использованы</p>
          </div>

          <p className="text-xs mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            Продолжите работу с AI-юристом — выберите удобный вариант:
          </p>

          {/* Пакет Старт */}
          <button
            onClick={onBuyPlan}
            className="w-full rounded-xl mb-2 transition-all active:scale-[0.98]"
            style={{ padding: "11px 14px", background: "linear-gradient(135deg, #e8a820, #f0c060)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(10,22,40,0.2)" }}>
                  <Icon name="Crown" size={12} color="#0a1628" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-navy-900 leading-tight">Пакет «Старт» · 30 вопросов</p>
                  <p className="text-[10px]" style={{ color: "rgba(10,22,40,0.6)" }}>+ 5 документов · скачивание .doc</p>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-black text-navy-900">1 490</span>
                <span className="text-[11px] font-semibold" style={{ color: "rgba(10,22,40,0.7)" }}>₽</span>
              </div>
            </div>
          </button>

          {/* +3 вопроса к AI */}
          <button
            onClick={onBuyQuickQuestions}
            className="w-full rounded-xl mb-2 transition-all active:scale-[0.98]"
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Icon name="MessageCircle" size={12} color="#a0b4cc" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.9)" }}>Докупить 3 вопроса AI-юристу</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Диалог продолжится в личном кабинете</p>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-bold" style={{ color: "#f0c060" }}>199</span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>₽</span>
              </div>
            </div>
          </button>

          {/* Войти */}
          <button
            onClick={onLogin}
            className="w-full rounded-xl text-xs font-semibold py-2 transition-all"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Уже есть аккаунт? Войти →
          </button>

          <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
          <p className="text-center text-[11px] mt-2">
            <span style={{ color: "rgba(255,255,255,0.35)" }}>Уже есть подписка? </span>
            <a href="/cabinet" className="underline underline-offset-2" style={{ color: "rgba(255,255,255,0.55)" }}>Войдите в личный кабинет</a>
          </p>
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