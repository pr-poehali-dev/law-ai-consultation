import Icon from "@/components/ui/icon";
import type { LawyerDialog } from "@/lib/auth";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface ExpertDialogListProps {
  dialogs: LawyerDialog[];
  loading: boolean;
  onSelect: (userId: number) => void;
  onRefresh: () => void;
}

export default function ExpertDialogList({ dialogs, loading, onSelect, onRefresh }: ExpertDialogListProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-navy-800 to-navy-700">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
            <Icon name="MessageSquare" size={16} className="text-gold-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Диалоги с клиентами</h2>
            <p className="text-xs text-white/60">Входящие обращения</p>
          </div>
          <button onClick={onRefresh} className="ml-auto p-2 hover:bg-white/10 rounded-xl transition-colors">
            <Icon name="RefreshCw" size={15} className="text-white/60" />
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : dialogs.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name="Inbox" size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Обращений пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dialogs.map((d) => (
              <button
                key={d.user_id}
                onClick={() => onSelect(d.user_id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white font-bold text-sm uppercase">
                  {(d.name?.[0] ?? d.email?.[0] ?? "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-navy-800 truncate">{d.name || d.email}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{fmtTime(d.last_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">{d.last_message?.slice(0, 55)}</span>
                    {d.unread > 0 && (
                      <span className="shrink-0 min-w-5 h-5 px-1.5 bg-gold-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {d.unread}
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-navy-400 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
