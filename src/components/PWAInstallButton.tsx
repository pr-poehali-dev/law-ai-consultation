import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const HINT_KEY = "pwa_hint_seen";

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

  // Кнопка установки актуальна только на телефоне — на ПК не показываем

  // ── Android — кнопка установки ──
  if (status === "android") {
    return (
      <div className="relative shrink-0 sm:hidden">
        <button
          onClick={() => { dismissTooltip(); install(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
        >
          <Icon name="Smartphone" size={13} />
          <span className="text-[11px]">Приложение</span>
        </button>
        {showTooltip && (
          <MobileTooltip
            onClose={dismissTooltip}
            actionLabel="Установить приложение"
            onAction={() => { dismissTooltip(); install(); }}
          />
        )}
      </div>
    );
  }

  // ── iOS — инструкция ──
  return (
    <div className="relative shrink-0 sm:hidden">
      <button
        onClick={() => { dismissTooltip(); setShowIOSGuide(v => !v); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
      >
        <Icon name="Smartphone" size={13} />
        <span className="text-[11px]">Приложение</span>
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
  );
}