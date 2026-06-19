import Icon from "@/components/ui/icon";
import type { LawyerDialog } from "@/lib/auth";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function planLabel(plan?: string | null) {
  if (plan === "starter") return { text: "Старт", color: "bg-blue-50 text-blue-600 border-blue-200" };
  if (plan === "pro") return { text: "Профи", color: "bg-violet-50 text-violet-600 border-violet-200" };
  if (plan === "max") return { text: "Макс", color: "bg-amber-50 text-amber-600 border-amber-200" };
  return { text: "Бесплатно", color: "bg-slate-50 text-slate-500 border-slate-200" };
}

interface ExpertDialogListProps {
  dialogs: LawyerDialog[];
  loading: boolean;
  showArchive: boolean;
  onToggleArchive: () => void;
  onSelect: (userId: number) => void;
  onRefresh: () => void;
}

export default function ExpertDialogList({ dialogs, loading, showArchive, onToggleArchive, onSelect, onRefresh }: ExpertDialogListProps) {
  const totalUnread = dialogs.reduce((s, d) => s + (d.unread || 0), 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">

        {/* Шапка */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #0f2044 0%, #1a3260 100%)" }}>
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="MessageSquare" size={16} className="text-gold-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">Обращения клиентов</h2>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  {totalUnread}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">{showArchive ? "Архив диалогов" : "Активные диалоги"}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Переключатель архива */}
            <button
              onClick={onToggleArchive}
              title={showArchive ? "Показать активные" : "Показать архив"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                showArchive
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white"
              }`}
            >
              <Icon name="Archive" size={12} />
              <span className="hidden sm:inline">{showArchive ? "Архив" : "Архив"}</span>
            </button>
            <button onClick={onRefresh} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <Icon name="RefreshCw" size={15} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Контент */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : dialogs.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name={showArchive ? "Archive" : "Inbox"} size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">
              {showArchive ? "Архив пуст" : "Новых обращений нет"}
            </p>
            <p className="text-xs text-slate-300 mt-1">
              {showArchive ? "Завершённые консультации будут здесь" : "Ожидайте сообщений от клиентов"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dialogs.map((d) => {
              const pl = planLabel(d.purchased_plan);
              const initial = (d.name?.[0] ?? d.email?.[0] ?? "U").toUpperCase();
              return (
                <button
                  key={d.user_id}
                  onClick={() => onSelect(d.user_id)}
                  className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left group ${d.is_closed ? "opacity-60" : ""}`}
                >
                  {/* Аватар */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shadow-sm text-white font-bold text-sm">
                      {initial}
                    </div>
                    {d.unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {d.unread}
                      </span>
                    )}
                    {d.is_closed && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                        <Icon name="Check" size={8} color="white" />
                      </span>
                    )}
                  </div>

                  {/* Инфо */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-sm font-semibold truncate ${d.unread > 0 ? "text-navy-900" : "text-navy-700"}`}>
                        {d.name || d.email}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(d.last_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs truncate ${d.unread > 0 ? "text-slate-600 font-medium" : "text-slate-400"}`}>
                        {d.last_sender === "admin" ? "Вы: " : ""}{d.last_message?.slice(0, 50)}
                      </span>
                      <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${pl.color}`}>
                        {pl.text}
                      </span>
                    </div>
                  </div>

                  <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-navy-400 transition-colors shrink-0 ml-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
