import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { logout, type User } from "@/lib/auth";

type Tab = "chat" | "docs" | "expert" | "history" | "profile";

interface CabinetHeaderProps {
  user: User;
  tab: Tab;
  totalLeft: number;
  onTabChange: (tab: Tab) => void;
}

const TABS_DESKTOP = [
  { id: "chat", label: "Чат с AI", icon: "Bot" },
  { id: "docs", label: "Документы", icon: "FileText" },
  { id: "expert", label: "Юрист", icon: "UserCheck" },
  { id: "history", label: "История", icon: "Clock" },
  { id: "profile", label: "Профиль", icon: "User" },
];

const TABS_MOBILE = [
  { id: "chat", label: "Чат", icon: "Bot" },
  { id: "docs", label: "Docs", icon: "FileText" },
  { id: "expert", label: "Юрист", icon: "UserCheck" },
  { id: "history", label: "История", icon: "Clock" },
  { id: "profile", label: "Профиль", icon: "User" },
];

export default function CabinetHeader({ user, tab, totalLeft, onTabChange }: CabinetHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Верхний хедер — без backdrop-blur на мобиле */}
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
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
              totalLeft > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"
            }`}>
              <Icon name="MessageCircle" size={11} />
              {totalLeft > 0 ? `${totalLeft} вопр.` : "0"}
            </div>
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

      {/* Мобильный таб-бар — FIXED внизу экрана, не sticky */}
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