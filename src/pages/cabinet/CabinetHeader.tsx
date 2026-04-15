import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { logout, type User } from "@/lib/auth";
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

export default function CabinetHeader({ user, tab, totalLeft, onTabChange, onSelectPlan }: CabinetHeaderProps) {
  const navigate = useNavigate();
  const activePlanId = getActivePlan(user);
  const activePlan = PLANS.find(p => p.id === activePlanId);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 border-b border-border shadow-sm md:bg-white/80 md:backdrop-blur-md">
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
                  activePlan
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    : "bg-gold-500 border-gold-400 text-navy-900 hover:bg-gold-400"
                }`}
              >
                <Icon name="Zap" size={11} className={activePlan ? "text-emerald-600" : "text-navy-800"} />
                <span className="hidden sm:inline">
                  {activePlan ? `${activePlan.name} · ${totalLeft} вопр.` : "Подключить тариф"}
                </span>
                <span className="sm:hidden">
                  {activePlan ? activePlan.name : "Тариф"}
                </span>
              </button>
            )}
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border safe-bottom">
        <div className="flex">
          {TABS_MOBILE.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id as Tab)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors ${
                tab === t.id ? "text-navy-700" : "text-muted-foreground"
              }`}
            >
              <div className={`w-8 h-5 flex items-center justify-center rounded-full transition-colors ${tab === t.id ? "bg-navy-100" : ""}`}>
                <Icon name={t.icon} size={16} />
              </div>
              <span className="leading-none">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}