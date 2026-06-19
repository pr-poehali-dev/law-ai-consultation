import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { subscribeToPush, isPushSupported, isPushGranted } from "@/lib/pushNotifications";

const DISMISSED_KEY = "push_banner_dismissed";

export default function PushPromptBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (isPushGranted()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    // Показываем через 8 сек — после WelcomeTutorials и других онбординг-модалок
    const t = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const handleEnable = async () => {
    setLoading(true);
    const ok = await subscribeToPush(true);
    setLoading(false);
    if (ok) {
      setDone(true);
      setTimeout(() => setShow(false), 2500);
    } else {
      // Пользователь отказал — не показываем снова
      localStorage.setItem(DISMISSED_KEY, "1");
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Полоска сверху */}
        <div style={{ height: 3, background: "linear-gradient(90deg, #162d5a, #e8a820)" }} />
        <div className="p-4">
          {done ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Icon name="CheckCircle" size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-800">Уведомления включены</p>
                <p className="text-xs text-muted-foreground">Вы получите уведомление при ответе юриста</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl gradient-navy flex items-center justify-center shrink-0">
                  <Icon name="Bell" size={16} className="text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-800 leading-tight">Включить уведомления?</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Мгновенно узнавайте об ответах юриста и новых возможностях
                  </p>
                </div>
                <button onClick={handleDismiss} className="shrink-0 p-1 text-slate-300 hover:text-slate-500 transition-colors">
                  <Icon name="X" size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2 rounded-xl text-xs text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors font-medium"
                >
                  Не сейчас
                </button>
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold btn-gold flex items-center justify-center gap-1.5 disabled:opacity-70"
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-navy-400/40 border-t-navy-700 rounded-full animate-spin" />
                  ) : (
                    <Icon name="Bell" size={13} />
                  )}
                  Включить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}