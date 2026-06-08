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
        style={{ background: "linear-gradient(150deg, #0a1628 0%, #0e2040 100%)", border: "1px solid rgba(232,168,32,0.3)" }}
      >
        {/* Золотая линия */}
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f0c060 50%, #e8a820 70%, transparent)" }} />

        <div className="p-4">
          {/* Шапка */}
          <div className="mb-3">
            <p className="text-sm font-bold text-white leading-snug mb-1">
              Хотите получить полный ответ?
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              AI разобрал вашу ситуацию. Продолжите диалог — уточните детали, получите стратегию и готовый документ.
            </p>
          </div>

          {/* Пакет Старт — главный CTA */}
          <button
            onClick={onBuyPlan}
            className="w-full rounded-xl mb-2 transition-all active:scale-[0.98] hover:brightness-105"
            style={{ padding: "12px 14px", background: "linear-gradient(135deg, #e8a820, #f0c060)", boxShadow: "0 4px 20px rgba(232,168,32,0.3)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(10,22,40,0.18)" }}>
                  <Icon name="Crown" size={13} color="#0a1628" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-navy-900 leading-tight">30 вопросов + 5 документов</p>
                  <p className="text-[10px] font-medium" style={{ color: "rgba(10,22,40,0.55)" }}>скачивание .docx · без ограничений</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-black text-navy-900">1 490</span>
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(10,22,40,0.65)" }}>₽</span>
                </div>
                <p className="text-[9px] font-semibold" style={{ color: "rgba(10,22,40,0.45)" }}>≈ 50 ₽ / вопрос</p>
              </div>
            </div>
          </button>

          {/* Разделитель */}
          <div className="flex items-center gap-2 my-2.5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>или</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* +3 вопроса — быстрый старт */}
          <button
            onClick={onBuyQuickQuestions}
            className="w-full rounded-xl mb-3 transition-all active:scale-[0.98] hover:brightness-110"
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.13)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.2)" }}>
                  <Icon name="MessageCircle" size={11} color="#e8a820" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.9)" }}>Ещё 3 вопроса прямо сейчас</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.38)" }}>диалог продолжится в кабинете</p>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-sm font-bold" style={{ color: "#f0c060" }}>35</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>₽</span>
              </div>
            </div>
          </button>

          {/* Войти + гарантия */}
          <div className="flex items-center justify-between">
            <button
              onClick={onLogin}
              className="text-xs font-semibold transition-all hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Есть аккаунт? Войти →
            </button>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              ЮКасса · сразу после оплаты
            </p>
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