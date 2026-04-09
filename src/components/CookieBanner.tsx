import { useState } from "react";
import Icon from "@/components/ui/icon";

export default function CookieBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-fade-in-up">
      <div className="glass-light rounded-2xl border border-border shadow-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Cookie" size={15} className="text-navy-600" />
          </div>
          <div>
            <div className="font-semibold text-navy-800 text-sm mb-1">Файлы cookie</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Мы используем cookies для улучшения работы сайта и персонализации контента. Продолжая использование, вы соглашаетесь с обработкой данных.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVisible(false)}
            className="btn-gold flex-1 py-2 rounded-xl text-xs font-semibold"
          >
            Принять все
          </button>
          <button
            onClick={() => setVisible(false)}
            className="flex-1 py-2 rounded-xl text-xs font-medium border border-border text-navy-600 hover:bg-slate-50 transition-colors"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </div>
  );
}
