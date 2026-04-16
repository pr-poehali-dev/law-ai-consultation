import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const HINT_KEY = "pwa_hint_seen";

function DesktopInfoPopup({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2.5 z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 animate-fade-in text-navy-800">
        <div className="absolute -top-1.5 right-5 w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45 rounded-sm" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-navy rounded-lg flex items-center justify-center shrink-0">
              <Icon name="Smartphone" size={14} className="text-gold-400" />
            </div>
            <p className="text-sm font-semibold text-navy-800">Установить как приложение</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Icon name="X" size={15} />
          </button>
        </div>

        <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
          Откройте сайт на телефоне и добавьте на главный экран — работает как полноценное приложение без браузера.
        </p>

        <div className="space-y-3">
          {/* iOS */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <p className="text-[11px] font-semibold text-navy-700">iPhone / iPad (Safari)</p>
            </div>
            <ol className="space-y-1.5">
              {[
                <>Нажмите <strong>«Поделиться»</strong> <Icon name="Share" size={11} className="inline align-middle text-blue-500" /> в Safari</>,
                <>Выберите <strong>«На экран "Домой"»</strong></>,
                <>Нажмите <strong>«Добавить»</strong></>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                  <span className="w-4 h-4 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[9px] mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Android */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.341A8.003 8.003 0 0 0 20 9.2C20 4.682 16.418 1 12 1S4 4.682 4 9.2c0 2.38.962 4.528 2.477 6.14l-1.351 2.34a.75.75 0 0 0 1.299.75L7.77 16.27A7.963 7.963 0 0 0 12 17.4a7.963 7.963 0 0 0 4.23-1.13l1.345 2.161a.75.75 0 1 0 1.299-.75l-1.351-2.34ZM8.5 8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>
              <p className="text-[11px] font-semibold text-navy-700">Android (Chrome)</p>
            </div>
            <ol className="space-y-1.5">
              {[
                <>Нажмите <strong>⋮</strong> в Chrome (меню)</>,
                <>Выберите <strong>«Добавить на главный экран»</strong></>,
                <>Нажмите <strong>«Добавить»</strong></>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                  <span className="w-4 h-4 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[9px] mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function MobileTooltip({
  onClose,
  actionLabel,
  onAction,
}: {
  onClose: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-navy-800 text-white rounded-2xl shadow-2xl p-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-navy-700 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Smartphone" size={18} className="text-gold-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1">Добавьте на главный экран</p>
            <p className="text-xs text-slate-300 leading-relaxed">Работайте с AI-юристом как с приложением — без браузера, в один тап</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
            <Icon name="X" size={16} />
          </button>
        </div>
        <button
          onClick={onAction}
          className="mt-3 w-full py-2.5 rounded-xl bg-gold-400 hover:bg-gold-500 text-navy-900 text-sm font-bold transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </>
  );
}

function IOSGuide({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 animate-fade-in text-navy-800">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Добавить на экран iPhone</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="X" size={18} />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">1</span>
            <span>Нажмите <strong>«Поделиться»</strong> в Safari <Icon name="Share" size={14} className="inline align-middle text-blue-500" /></span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">2</span>
            <span>Выберите <strong>«На экран "Домой"»</strong></span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">3</span>
            <span>Нажмите <strong>«Добавить»</strong></span>
          </li>
        </ol>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
          <Icon name="Info" size={13} />
          Только в браузере Safari
        </div>
      </div>
    </>
  );
}

export default function PWAInstallButton() {
  const { status, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDesktopInfo, setShowDesktopInfo] = useState(false);

  useEffect(() => {
    if (status === "installed" || status === "unsupported") return;
    if (!sessionStorage.getItem(HINT_KEY)) {
      const t = setTimeout(() => {
        setShowTooltip(true);
        sessionStorage.setItem(HINT_KEY, "1");
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (status === "installed" || status === "unsupported") return null;

  const dismissTooltip = () => setShowTooltip(false);

  // ── ПК — информационная кнопка со всплывающей инструкцией ──
  const desktopButton = (
    <div className="relative shrink-0 hidden sm:block">
      <button
        onClick={() => { dismissTooltip(); setShowDesktopInfo(v => !v); }}
        title="Можно установить как приложение на телефон"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-medium transition-colors"
      >
        <Icon name="Smartphone" size={13} />
        <span className="text-[11px]">Приложение</span>
      </button>
      {showDesktopInfo && <DesktopInfoPopup onClose={() => setShowDesktopInfo(false)} />}
    </div>
  );

  // ── Android — кнопка установки ──
  if (status === "android") {
    return (
      <>
        {desktopButton}
        <div className="relative shrink-0 sm:hidden">
          <button
            onClick={() => { dismissTooltip(); install(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
          >
            <Icon name="Smartphone" size={13} />
          </button>
          {showTooltip && (
            <MobileTooltip
              onClose={dismissTooltip}
              actionLabel="Установить приложение"
              onAction={() => { dismissTooltip(); install(); }}
            />
          )}
        </div>
      </>
    );
  }

  // ── iOS — инструкция ──
  return (
    <>
      {desktopButton}
      <div className="relative shrink-0 sm:hidden">
        <button
          onClick={() => { dismissTooltip(); setShowIOSGuide(v => !v); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
        >
          <Icon name="Smartphone" size={13} />
        </button>
        {showTooltip && !showIOSGuide && (
          <MobileTooltip
            onClose={dismissTooltip}
            actionLabel="Как установить?"
            onAction={() => { dismissTooltip(); setShowIOSGuide(true); }}
          />
        )}
        {showIOSGuide && <IOSGuide onClose={() => setShowIOSGuide(false)} />}
      </div>
    </>
  );
}
