import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { logout, sendReport, isPlanExhausted, type User } from "@/lib/auth";
import { getActivePlan, PLANS } from "@/pages/cabinet/PlanModal";

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";

interface CabinetHeaderProps {
  user: User;
  tab: Tab;
  totalLeft: number;
  onTabChange: (tab: Tab) => void;
  onSelectPlan: () => void;
}

const TABS_DESKTOP = [
  { id: "chat", label: "Чат с AI", icon: "Bot" },
  { id: "docs", label: "Документы", icon: "FileText" },
  { id: "expert", label: "Юрист", icon: "UserCheck" },
  { id: "business", label: "Бизнес", icon: "Briefcase" },
  { id: "history", label: "История", icon: "Clock" },
  { id: "profile", label: "Профиль", icon: "User" },
];

const TABS_MOBILE = [
  { id: "chat", label: "Чат", icon: "Bot" },
  { id: "docs", label: "Доки", icon: "FileText" },
  { id: "expert", label: "Юрист", icon: "UserCheck" },
  { id: "business", label: "Бизнес", icon: "Briefcase" },
  { id: "profile", label: "Профиль", icon: "User" },
];

function ReportPopover({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    setErr("");
    const result = await sendReport(text.trim());
    setSending(false);
    if (result.ok) {
      setSent(true);
      setTimeout(onClose, 2000);
    } else {
      setErr(result.error || "Ошибка отправки");
    }
  };

  return (
    <div
      className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-border shadow-2xl z-50 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-50 rounded-lg flex items-center justify-center">
            <Icon name="AlertTriangle" size={12} className="text-orange-500" />
          </div>
          <span className="text-sm font-semibold text-navy-800">Сообщить о проблеме</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-navy-700">
          <Icon name="X" size={12} />
        </button>
      </div>

      {sent ? (
        <div className="flex items-center gap-2 py-3 text-emerald-600">
          <Icon name="CheckCircle" size={16} />
          <span className="text-sm font-medium">Обращение отправлено!</span>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите проблему — что произошло, при каких действиях..."
            rows={3}
            className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-2.5"
            autoFocus
          />
          {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="w-full btn-gold py-2 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending
              ? <><Icon name="Loader" size={13} className="animate-spin" />Отправка...</>
              : <><Icon name="Send" size={13} />Отправить</>
            }
          </button>
        </>
      )}
    </div>
  );
}

export default function CabinetHeader({ user, tab, totalLeft, onTabChange, onSelectPlan }: CabinetHeaderProps) {
  const navigate = useNavigate();
  const activePlanId = getActivePlan(user);
  const activePlan = PLANS.find(p => p.id === activePlanId);
  const exhausted = isPlanExhausted(user);
  const [showReport, setShowReport] = useState(false);

  return (
    <>
      {/* Overlay для закрытия поповера */}
      {showReport && (
        <div className="fixed inset-0 z-40" onClick={() => setShowReport(false)} />
      )}

      <header className="sticky top-0 z-40 shrink-0 bg-white/95 border-b border-border shadow-sm md:bg-white/80 md:backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 md:w-8 md:h-8 gradient-navy rounded-xl flex items-center justify-center">
              <Icon name="Scale" size={14} className="text-gold-400" />
            </div>
            <span className="font-cormorant font-bold text-base md:text-lg text-navy-800">
              ИИ-Право<span className="text-gradient-gold">.рф</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
            {TABS_DESKTOP.map((t) => (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id ? "bg-white shadow-sm text-navy-800" : "text-muted-foreground hover:text-navy-700"
                }`}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
              </button>
            ))}
            {user.isAdmin && (
              <button
                onClick={() => onTabChange("admin")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === "admin" ? "bg-purple-600 shadow-sm text-white" : "text-purple-600 hover:bg-purple-50"
                }`}
              >
                <Icon name="ShieldCheck" size={14} />
                Админ
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {tab === "business" ? (
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
                (user.businessActionsLeft ?? 0) > 0 || user.isAdmin ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"
              }`}>
                <Icon name="Zap" size={11} />
                {user.isAdmin ? "∞" : (user.businessActionsLeft ?? 0)} действий
              </div>
            ) : !user.isAdmin && (
              <button
                onClick={onSelectPlan}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  exhausted
                    ? "bg-red-50 border-red-300 text-red-600 hover:bg-red-100 animate-pulse"
                    : activePlan
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      : "bg-gold-500 border-gold-400 text-navy-900 hover:bg-gold-400"
                }`}
              >
                <Icon name={exhausted ? "AlertCircle" : "Zap"} size={11}
                  className={exhausted ? "text-red-500" : activePlan ? "text-emerald-600" : "text-navy-800"} />
                <span className="hidden sm:inline">
                  {exhausted
                    ? `${activePlan?.name ?? "Тариф"} · продлить`
                    : activePlan
                      ? `${activePlan.name} · ${totalLeft} вопр.`
                      : "Подключить тариф"}
                </span>
                <span className="sm:hidden">
                  {exhausted ? "Продлить" : activePlan ? activePlan.name : "Тариф"}
                </span>
              </button>
            )}

            {/* Кнопка «Сообщить о проблеме» — доступна всегда */}
            <div className="relative">
              <button
                onClick={() => setShowReport(v => !v)}
                title="Сообщить о проблеме"
                className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-xl transition-colors ${
                  showReport
                    ? "bg-orange-100 text-orange-600"
                    : "bg-slate-100 text-muted-foreground hover:bg-orange-50 hover:text-orange-500"
                }`}
              >
                <Icon name="LifeBuoy" size={15} />
              </button>
              {showReport && <ReportPopover onClose={() => setShowReport(false)} />}
            </div>

            {/* Кнопка Админ на мобиле */}
            {user.isAdmin && (
              <button
                onClick={() => onTabChange("admin")}
                className={`md:hidden flex items-center justify-center w-7 h-7 rounded-xl transition-colors ${
                  tab === "admin" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600"
                }`}
              >
                <Icon name="ShieldCheck" size={14} />
              </button>
            )}
            <div className="w-7 h-7 md:w-8 md:h-8 gradient-navy rounded-xl flex items-center justify-center text-white text-xs font-bold uppercase">
              {user.name?.[0] ?? "U"}
            </div>
            <button
              onClick={async () => { await logout(); navigate("/"); }}
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-navy-700 transition-colors"
            >
              <Icon name="LogOut" size={14} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex pt-1">
          {TABS_MOBILE.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id as Tab)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors ${
                tab === t.id ? "text-navy-700" : "text-muted-foreground"
              }`}
            >
              <div className={`w-10 h-6 flex items-center justify-center rounded-full transition-all ${tab === t.id ? "bg-navy-100" : ""}`}>
                <Icon name={t.icon} size={17} className={tab === t.id ? "text-navy-700" : "text-slate-400"} />
              </div>
              <span className="leading-none">{t.label}</span>
              <div className={`w-1 h-1 rounded-full mt-0.5 transition-all ${tab === t.id ? "bg-navy-600 scale-100" : "bg-transparent scale-0"}`} />
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}