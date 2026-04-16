import { useState } from "react";
import Icon from "@/components/ui/icon";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function PWAInstallButton() {
  const { status, install } = usePWAInstall();
  const [showIOSHint, setShowIOSHint] = useState(false);

  if (status === "installed" || status === "unsupported") return null;

  if (status === "android") {
    return (
      <button
        onClick={install}
        title="Добавить на главный экран"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors shrink-0"
      >
        <Icon name="Smartphone" size={13} />
        <span className="hidden sm:inline">На телефон</span>
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setShowIOSHint((v) => !v)}
        title="Добавить на главный экран"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-navy-50 hover:bg-navy-100 border border-navy-200 text-navy-700 text-xs font-semibold transition-colors"
      >
        <Icon name="Smartphone" size={13} />
        <span className="hidden sm:inline">На телефон</span>
      </button>

      {showIOSHint && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowIOSHint(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-navy-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Добавить на экран iPhone</p>
              <button onClick={() => setShowIOSHint(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="X" size={16} />
              </button>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">1</span>
                <span>Нажмите кнопку <strong>«Поделиться»</strong> в браузере Safari <Icon name="Share" size={13} className="inline align-middle text-blue-500" /></span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">2</span>
                <span>Прокрутите вниз и выберите <strong>«На экран "Домой"»</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">3</span>
                <span>Нажмите <strong>«Добавить»</strong> — ярлык появится на рабочем столе</span>
              </li>
            </ol>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
              <Icon name="Info" size={12} />
              Работает в браузере Safari
            </div>
          </div>
        </>
      )}
    </div>
  );
}
