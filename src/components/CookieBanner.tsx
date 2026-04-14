import { useState } from "react";
import Icon from "@/components/ui/icon";

const COOKIE_KEY = "cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(COOKIE_KEY));

  const accept = (value: "all" | "necessary") => {
    localStorage.setItem(COOKIE_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-fade-in-up">
      <div className="rounded-2xl border border-white/15 shadow-2xl shadow-black/40 p-5" style={{ background: '#0f1e38' }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Cookie" size={15} className="text-gold-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm mb-1">Файлы cookie</div>
            <p className="text-xs text-white/60 leading-relaxed">
              Мы используем cookies для улучшения работы сайта и персонализации контента.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => accept("all")}
            className="btn-gold flex-1 py-2 rounded-xl text-xs font-semibold"
          >
            Принять все
          </button>
          <button
            onClick={() => accept("necessary")}
            className="flex-1 py-2 rounded-xl text-xs font-medium border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            Только нужные
          </button>
        </div>
      </div>
    </div>
  );
}