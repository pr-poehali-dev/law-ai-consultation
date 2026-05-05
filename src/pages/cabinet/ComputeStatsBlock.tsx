import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { getComputeStats, type ComputeStats } from "@/lib/auth";

const TOTAL_COMPUTE = 3_000_000;
const USED_BEFORE_TRACKING = 1_180_000;
const RESET_DATE = new Date("2026-06-16");
const DAILY_TARGET = 70_000;

const MODE_LABELS: Record<string, string> = {
  chat: "Чат",
  doc_generate: "Документы",
  file_analyze: "Анализ файлов",
  business_chat: "Бизнес-чат",
};

function getDaysLeft(): number {
  const diff = RESET_DATE.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function fmtSec(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)} сек`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} мин`;
  return `${(sec / 3600).toFixed(1)} ч`;
}

function shortEmail(email: string): string {
  if (email === "Аноним") return "Аноним";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 3)}***@${domain}`;
}

export default function ComputeStatsBlock() {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<ComputeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getComputeStats();
    setStats(data);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const trackedSec = stats?.week_sec ?? 0;
  const totalUsed = USED_BEFORE_TRACKING + trackedSec;
  const remaining = TOTAL_COMPUTE - totalUsed;
  const daysLeft = getDaysLeft();
  const availablePerDay = daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0;
  const usedPct = Math.min(100, Math.round((totalUsed / TOTAL_COMPUTE) * 100));

  const statusColor =
    availablePerDay >= DAILY_TARGET ? "text-emerald-600"
    : availablePerDay >= DAILY_TARGET * 0.7 ? "text-amber-600"
    : "text-red-600";

  const barColor =
    usedPct < 50 ? "bg-emerald-500"
    : usedPct < 75 ? "bg-amber-500"
    : "bg-red-500";

  const todaySec = stats?.today_sec ?? 0;
  const lastHourSec = stats?.last_hour_sec ?? 0;
  const onlineCount = stats?.online_users?.length ?? 0;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Cpu" size={16} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Вычислительный ресурс</h3>
          <p className="text-[11px] text-muted-foreground">
            Сегодня: <span className="font-semibold text-navy-700">{fmtSec(todaySec)}</span>
            {" · "}за час: <span className="font-semibold text-navy-700">{fmtSec(lastHourSec)}</span>
            {onlineCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <span className="text-emerald-600 font-semibold">{onlineCount} онлайн</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); load(); }}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors"
            title="Обновить"
          >
            <Icon name="RefreshCw" size={13} className={`text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className={`text-xs font-semibold ${statusColor}`}>
            {availablePerDay.toLocaleString("ru-RU")} сек/день
          </span>
          <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground" />
        </div>
      </div>

      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usedPct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{usedPct}% использовано</span>
        <span className="text-[10px] text-muted-foreground">До 16 июня: {daysLeft} дн.</span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">

          {/* Онлайн сейчас */}
          {stats?.online_users && stats.online_users.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] font-semibold text-emerald-800">
                  Онлайн сейчас — {stats.online_users.length} польз.
                </p>
              </div>
              <div className="space-y-1.5">
                {stats.online_users.map((u, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon name="User" size={11} className="text-emerald-600 shrink-0" />
                      <span className="text-[11px] text-emerald-900 truncate">{shortEmail(u.email)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-emerald-600">{u.online_requests} зап. за 15 мин</span>
                      <span className="text-[11px] font-semibold text-emerald-800">{fmtSec(u.today_sec)} сег.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ключевые цифры */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">За последний час</p>
              <p className="text-sm font-bold text-navy-800">{fmtSec(lastHourSec)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Сегодня</p>
              <p className="text-sm font-bold text-navy-800">{fmtSec(todaySec)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {stats?.today_chats ?? 0} чатов · {stats?.today_docs ?? 0} документов
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Остаток</p>
              <p className="text-sm font-bold text-navy-800">
                {Math.round(remaining / 1000).toLocaleString("ru-RU")} тыс. сек
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Доступно в день</p>
              <p className={`text-sm font-bold ${statusColor}`}>{availablePerDay.toLocaleString("ru-RU")} сек</p>
            </div>
          </div>

          {/* Топ пользователей за сутки */}
          {stats?.top_users && stats.top_users.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-navy-700 mb-2">Топ пользователей за сутки</p>
              <div className="space-y-1.5">
                {stats.top_users.map((u, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-400 w-4 shrink-0">{i + 1}.</span>
                      <span className="text-[11px] text-slate-700 truncate">{shortEmail(u.email)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {u.chats > 0 && `${u.chats}ч`}{u.docs > 0 && ` ${u.docs}д`}{u.files > 0 && ` ${u.files}ф`}
                      </span>
                      <span className="text-[11px] font-semibold text-navy-700">{fmtSec(u.today_sec)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* По типам за 7 дней */}
          {stats?.by_mode && stats.by_mode.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-navy-700 mb-2">За 7 дней по типам</p>
              <div className="space-y-1.5">
                {stats.by_mode.map(m => (
                  <div key={m.mode} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">{MODE_LABELS[m.mode] || m.mode}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{m.count} зап.</span>
                      <span className="text-[11px] font-semibold text-navy-700">~{fmtSec(m.avg_sec)} avg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* График по дням */}
          {stats?.days && stats.days.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-navy-700 mb-2">По дням</p>
              <div className="space-y-1">
                {stats.days.slice(0, 7).map(d => {
                  const maxSec = Math.max(...stats.days.slice(0, 7).map(x => x.total_sec), 1);
                  const pct = Math.round((d.total_sec / maxSec) * 100);
                  const dateStr = new Date(d.day).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
                  return (
                    <div key={d.day} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-10 shrink-0">{dateStr}</span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 w-16 text-right shrink-0">
                        {fmtSec(d.total_sec)} · {d.requests}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {availablePerDay >= DAILY_TARGET ? (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
              <Icon name="CheckCircle2" size={14} className="text-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-700">До 16 июня ресурса хватает с запасом</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
              <Icon name="AlertTriangle" size={14} className="text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700">Ресурс ограничен — рекомендуется снизить таймаут функции</p>
            </div>
          )}

          {lastUpdated && (
            <p className="text-[10px] text-slate-400 text-center">
              Обновлено: {lastUpdated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
