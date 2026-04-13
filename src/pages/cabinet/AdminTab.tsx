import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { getAllBillingLog, getNewUsers, type AllBillingLogEntry, type AdminUserEntry } from "@/lib/auth";

const BILLING_SEEN_KEY = "admin_billing_seen_ids";
const USERS_SEEN_KEY = "admin_users_seen_ids";

function loadSeenIds(key: string): number[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function saveSeenIds(key: string, ids: number[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

function fmtDt(s: string) {
  return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const SERVICE_ICONS: Record<string, string> = {
  consultation: "MessageCircle",
  document: "FileText",
  expert: "Shield",
  business: "Briefcase",
  subscription_consult: "Repeat",
  subscription_docs: "Repeat",
  plan_starter: "Zap",
  plan_pro: "Star",
  plan_max: "Crown",
  business_subscription: "Building2",
  business_actions_10: "Plus",
  business_actions_30: "Plus",
  business_actions_50: "Plus",
  business_actions_60: "Plus",
  business_actions_150: "Plus",
};

const SERVICE_COLORS: Record<string, string> = {
  consultation: "bg-blue-50 text-blue-600",
  document: "bg-amber-50 text-amber-600",
  expert: "bg-purple-50 text-purple-600",
  business: "bg-navy-50 text-navy-600",
  subscription_consult: "bg-emerald-50 text-emerald-600",
  subscription_docs: "bg-emerald-50 text-emerald-600",
  plan_starter: "bg-gold-50 text-gold-600",
  plan_pro: "bg-gold-50 text-gold-600",
  plan_max: "bg-gold-50 text-gold-700",
  business_subscription: "bg-navy-50 text-navy-700",
};

// ─── Блок начислений ─────────────────────────────────────────
function BillingBlock() {
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

// ─── Блок регистраций ─────────────────────────────────────────
function UsersBlock() {
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<number[]>(() => loadSeenIds(USERS_SEEN_KEY));
  const [cleared, setCleared] = useState(false);

  const load = useCallback(async (currentSeenIds: number[]) => {
    setLoading(true);
    const res = await getNewUsers({ seen_ids: currentSeenIds });
    setUsers(res.users);
    setTotal(res.total);
    setLoading(false);
    setCleared(false);
  }, []);

  useEffect(() => { load(seenIds); }, []);

  const handleClear = () => {
    const newSeen = [...seenIds, ...users.map(u => u.id)];
    saveSeenIds(USERS_SEEN_KEY, newSeen);
    setSeenIds(newSeen);
    setUsers([]);
    setCleared(true);
  };

  const handleRefresh = () => load(seenIds);
  const handleReset = () => {
    saveSeenIds(USERS_SEEN_KEY, []);
    setSeenIds([]);
    load([]);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Users" size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Регистрации пользователей</h3>
          <p className="text-[11px] text-muted-foreground">Всего в базе: {total}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleRefresh} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Обновить">
            <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
          </button>
          {seenIds.length > 0 && (
            <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Показать всех">
              <Icon name="RotateCcw" size={14} className="text-slate-400" />
            </button>
          )}
          {users.length > 0 && (
            <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
              <Icon name="EyeOff" size={12} />
              Скрыть просмотренных
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
      ) : cleared || users.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="CheckCircle2" size={28} className="text-blue-200 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Новых регистраций нет</p>
          {seenIds.length > 0 && (
            <button onClick={handleReset} className="mt-2 text-xs text-navy-500 underline hover:no-underline">
              Показать всех {total} пользователей
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {users.map(u => (
            <div key={u.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 text-blue-700 font-bold text-xs uppercase">
                {(u.name || u.email)[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-navy-800 truncate">{u.name || "—"}</p>
                  {u.is_admin && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-full font-medium">Админ</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                {u.phone && <p className="text-[11px] text-slate-400">{u.phone}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400">{fmtDt(u.created_at)}</span>
                  {u.paid_questions > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md">{u.paid_questions} вопр.</span>
                  )}
                  {u.paid_docs > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md">{u.paid_docs} докум.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────
export default function AdminTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800 mb-4 sm:mb-6">Администратор</h2>
      <BillingBlock />
      <UsersBlock />
    </div>
  );
}
