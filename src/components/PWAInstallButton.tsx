import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const HINT_KEY = "pwa_hint_seen";

function TooltipContent({
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

      {/* Мобильный — прибит к низу экрана */}
      <div className="fixed bottom-4 left-4 right-4 z-50 sm:hidden bg-navy-800 text-white rounded-2xl shadow-2xl p-4 animate-fade-in">
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

      {/* Десктоп — попап над кнопкой */}
      <div className="hidden sm:block absolute right-0 top-full mt-2.5 z-50 w-64 bg-navy-800 text-white rounded-2xl shadow-xl p-3.5 animate-fade-in">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 bg-navy-700 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Smartphone" size={15} className="text-gold-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-0.5">Добавьте на главный экран</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">Работайте с AI-юристом как с приложением — в один тап</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0 mt-0.5">
            <Icon name="X" size={14} />
          </button>
        </div>
        <button
          onClick={onAction}
          className="mt-3 w-full py-2 rounded-xl bg-gold-400 hover:bg-gold-500 text-navy-900 text-xs font-bold transition-colors"
        >
          {actionLabel}
        </button>
        <div className="absolute -top-1.5 right-6 w-3 h-3 bg-navy-800 rotate-45 rounded-sm" />
      </div>
    </>
  );
}

function IOSGuide({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Мобильный — снизу */}
      <div className="fixed bottom-4 left-4 right-4 z-50 sm:hidden bg-white rounded-2xl shadow-2xl p-4 animate-fade-in text-navy-800">
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

      {/* Десктоп — попап */}
      <div className="hidden sm:block absolute right-0 top-full mt-2.5 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 animate-fade-in text-navy-800">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Добавить на экран iPhone</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="X" size={16} />
          </button>
        </div>
        <ol className="space-y-2.5 text-xs text-slate-600">
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">1</span>
            <span>Нажмите <strong>«Поделиться»</strong> в Safari <Icon name="Share" size={13} className="inline align-middle text-blue-500" /></span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">2</span>
            <span>Выберите <strong>«На экран "Домой"»</strong></span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">3</span>
            <span>Нажмите <strong>«Добавить»</strong></span>
          </li>
        </ol>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
          <Icon name="Info" size={12} />
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

  if (status === "android") {
    return (
      <div className="relative shrink-0">
        <button
          onClick={() => { dismissTooltip(); install(); }}
          title="Установить как приложение"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
        >
          <Icon name="Download" size={13} />
          <span className="hidden sm:inline text-[11px]">Установить приложение</span>
        </button>

        {showTooltip && (
          <TooltipContent
            onClose={dismissTooltip}
            actionLabel="Установить приложение"
            onAction={() => { dismissTooltip(); install(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => { dismissTooltip(); setShowIOSGuide((v) => !v); }}
        title="Установить как приложение на iPhone"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
      >
        <Icon name="Download" size={13} />
        <span className="hidden sm:inline text-[11px]">Установить приложение</span>
      </button>

      {showTooltip && !showIOSGuide && (
        <TooltipContent
          onClose={dismissTooltip}
          actionLabel="Как установить?"
          onAction={() => { dismissTooltip(); setShowIOSGuide(true); }}
        />
      )}

      {showIOSGuide && <IOSGuide onClose={() => setShowIOSGuide(false)} />}
    </div>
  );
}