import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { getAllBillingLog, type AllBillingLogEntry } from "@/lib/auth";
import { loadSeenIds, saveSeenIds, fmtDt, SERVICE_ICONS, SERVICE_COLORS } from "@/pages/cabinet/adminTabUtils";

const BILLING_SEEN_KEY = "admin_billing_seen_ids";

export default function AdminBillingBlock() {
  const [logs, setLogs] = useState<AllBillingLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<number[]>(() => loadSeenIds(BILLING_SEEN_KEY));
  const [cleared, setCleared] = useState(false);

  const load = useCallback(async (currentSeenIds: number[]) => {
    setLoading(true);
    const res = await getAllBillingLog({ seen_ids: currentSeenIds });
    setLogs(res.logs);
    setTotal(res.total);
    setLoading(false);
    setCleared(false);
  }, []);

  useEffect(() => { load(seenIds); }, []);

  const handleClear = () => {
    const newSeen = [...seenIds, ...logs.map(l => l.id)];
    saveSeenIds(BILLING_SEEN_KEY, newSeen);
    setSeenIds(newSeen);
    setLogs([]);
    setCleared(true);
  };

  const handleRefresh = () => load(seenIds);
  const handleReset = () => {
    saveSeenIds(BILLING_SEEN_KEY, []);
    setSeenIds([]);
    load([]);
  };

  const totalAmount = logs.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="TrendingUp" size={16} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Начисления пользователей</h3>
          <p className="text-[11px] text-muted-foreground">Всего в базе: {total}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleRefresh} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Обновить">
            <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
          </button>
          {seenIds.length > 0 && (
            <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Показать все (сбросить очистку)">
              <Icon name="RotateCcw" size={14} className="text-slate-400" />
            </button>
          )}
          {logs.length > 0 && (
            <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
              <Icon name="EyeOff" size={12} />
              Скрыть просмотренные
            </button>
          )}
        </div>
      </div>

      {logs.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
          <Icon name="Banknote" size={14} className="text-emerald-600 shrink-0" />
          <span className="text-xs text-emerald-700 font-medium">
            Показано {logs.length} операций на сумму <strong>{totalAmount.toLocaleString("ru-RU")} ₽</strong>
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
      ) : cleared || logs.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="CheckCircle2" size={28} className="text-emerald-300 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Новых начислений нет</p>
          {seenIds.length > 0 && (
            <button onClick={handleReset} className="mt-2 text-xs text-navy-500 underline hover:no-underline">
              Показать все {total} записей
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {logs.map(l => {
            const icon = SERVICE_ICONS[l.service_type] || "CreditCard";
            const color = SERVICE_COLORS[l.service_type] || "bg-slate-50 text-slate-600";
            return (
              <div key={l.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                  <Icon name={icon} size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-navy-800 leading-tight">{l.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[140px]">
                      {l.user_name || l.user_email}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{l.user_email !== l.user_name ? l.user_email : ""}</span>
                    <span className="text-[10px] text-slate-400">{fmtDt(l.created_at)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-500">{l.source}</span>
                  </div>
                </div>
                {l.amount > 0 && (
                  <span className="text-xs font-bold text-emerald-700 shrink-0">{l.amount.toLocaleString("ru-RU")} ₽</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
