import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { getAllBillingLog, getNewUsers, listUsers, adminGrant, lawyerMessages, lawyerSend, type AllBillingLogEntry, type AdminUserEntry, type LawyerMessage, type LawyerDialog } from "@/lib/auth";

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

// ─── Блок ручного начисления ──────────────────────────────────
function GrantBlock() {
  const [users, setUsers] = useState<{ id: number; email: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<typeof users>([]);
  const [selected, setSelected] = useState<{ id: number; email: string; name: string } | null>(null);
  const [questions, setQuestions] = useState("");
  const [docs, setDocs] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; msg?: string } | null>(null);

  useEffect(() => { listUsers().then(setUsers); }, []);

  const handleSearch = (v: string) => {
    setSearch(v);
    setSelected(null);
    setResult(null);
    if (v.length < 2) { setSuggestions([]); return; }
    setSuggestions(users.filter(u =>
      u.email.toLowerCase().includes(v.toLowerCase()) ||
      u.name.toLowerCase().includes(v.toLowerCase())
    ).slice(0, 8));
  };

  const handleSelect = (u: typeof users[0]) => {
    setSelected(u);
    setSearch(u.email);
    setSuggestions([]);
    setResult(null);
  };

  const handleGrant = async () => {
    if (!selected) return;
    const q = parseInt(questions) || 0;
    const d = parseInt(docs) || 0;
    if (q === 0 && d === 0) { setResult({ error: "Укажите количество вопросов или документов" }); return; }
    setLoading(true);
    setResult(null);
    const res = await adminGrant({
      target_user_id: selected.id,
      questions: q,
      docs: d,
      comment: comment.trim() || undefined,
    });
    setLoading(false);
    if (res.error) {
      setResult({ error: res.error });
    } else {
      const parts = [];
      if (res.questions_added) parts.push(`+${res.questions_added} вопр.`);
      if (res.docs_added) parts.push(`+${res.docs_added} докум.`);
      setResult({ ok: true, msg: `Начислено: ${parts.join(", ")} → ${selected.email}` });
      setQuestions("");
      setDocs("");
      setComment("");
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gold-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Gift" size={16} className="text-gold-600" />
        </div>
        <h3 className="font-semibold text-navy-800 text-sm">Ручное начисление</h3>
      </div>

      {/* Поиск пользователя */}
      <div className="relative mb-3">
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Найти пользователя по email или имени..."
          className="w-full text-sm border border-border rounded-xl px-3 py-2.5 outline-none focus:border-navy-400 transition-colors"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map(u => (
              <button key={u.id} onClick={() => handleSelect(u)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                <span className="font-medium text-navy-800">{u.email}</span>
                {u.name && <span className="text-muted-foreground ml-2">{u.name}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="mb-3 px-3 py-2 bg-navy-50 rounded-xl border border-navy-100 flex items-center gap-2">
          <Icon name="UserCheck" size={13} className="text-navy-500 shrink-0" />
          <span className="text-xs text-navy-700 font-medium truncate">{selected.name || selected.email}</span>
          <span className="text-[11px] text-muted-foreground truncate">{selected.name ? selected.email : ""}</span>
        </div>
      )}

      {/* Количество */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Вопросов</label>
          <div className="flex items-center border border-border rounded-xl overflow-hidden focus-within:border-navy-400 transition-colors">
            <div className="px-2.5 py-2 bg-blue-50">
              <Icon name="MessageCircle" size={13} className="text-blue-500" />
            </div>
            <input
              type="number" min="0" max="9999" value={questions}
              onChange={e => setQuestions(e.target.value)}
              placeholder="0"
              className="flex-1 text-sm px-2 py-2 outline-none w-full"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Документов</label>
          <div className="flex items-center border border-border rounded-xl overflow-hidden focus-within:border-navy-400 transition-colors">
            <div className="px-2.5 py-2 bg-amber-50">
              <Icon name="FileText" size={13} className="text-amber-500" />
            </div>
            <input
              type="number" min="0" max="9999" value={docs}
              onChange={e => setDocs(e.target.value)}
              placeholder="0"
              className="flex-1 text-sm px-2 py-2 outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Комментарий */}
      <input
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)"
        className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400 transition-colors mb-3"
      />

      {result && (
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium ${result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {result.ok ? <span>✓ {result.msg}</span> : <span>✗ {result.error}</span>}
        </div>
      )}

      <button
        onClick={handleGrant}
        disabled={loading || !selected || (parseInt(questions) === 0 && parseInt(docs) === 0 && !questions && !docs)}
        className="w-full btn-gold py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading
          ? <><div className="w-3.5 h-3.5 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin" />Начисляю...</>
          : <><Icon name="Plus" size={15} />Начислить</>
        }
      </button>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────
export default function AdminTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800 mb-4 sm:mb-6">Администратор</h2>
      <GrantBlock />
      <LawyerAdminBlock />
      <BillingBlock />
      <UsersBlock />
    </div>
  );
}

// ─── Блок «Юрист» для администратора ──────────────────────────────────────
function LawyerAdminBlock() {
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LawyerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [viewAtt, setViewAtt] = useState<{ title: string; content: string; type: string } | null>(null);

  const loadDialogs = useCallback(async () => {
    setLoading(true);
    const res = await lawyerMessages();
    if (res.dialogs) setDialogs(res.dialogs);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (userId: number) => {
    setMsgLoading(true);
    const res = await lawyerMessages({ target_user_id: userId });
    if (res.messages) setMessages(res.messages);
    setMsgLoading(false);
  }, []);

  useEffect(() => { loadDialogs(); }, [loadDialogs]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadMessages(selectedUserId);
    const iv = setInterval(() => loadMessages(selectedUserId), 8000);
    return () => clearInterval(iv);
  }, [selectedUserId, loadMessages]);

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedUserId) return;
    setSending(true);
    await lawyerSend({ body: reply.trim(), target_user_id: selectedUserId });
    setReply("");
    await loadMessages(selectedUserId);
    setSending(false);
  };

  const currentDialog = dialogs.find(d => d.user_id === selectedUserId);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm overflow-hidden">
      {/* Заголовок */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border">
        <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="UserCheck" size={16} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Раздел Юрист</h3>
          <p className="text-[11px] text-muted-foreground">Запросы от клиентов</p>
        </div>
        <button onClick={loadDialogs} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Обновить">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row" style={{ minHeight: 340 }}>
        {/* Список диалогов */}
        <div className={`${selectedUserId ? "hidden sm:flex" : "flex"} flex-col border-r border-border`} style={{ width: "100%", maxWidth: 280, flexShrink: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            </div>
          ) : dialogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 flex-1 px-4">
              <Icon name="MessageSquare" size={28} className="text-slate-200 mb-2" />
              <p className="text-xs text-muted-foreground text-center">Нет запросов от клиентов</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {dialogs.map(d => (
                <button
                  key={d.user_id}
                  onClick={() => setSelectedUserId(d.user_id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${selectedUserId === d.user_id ? "bg-navy-50 border-l-2 border-l-navy-600" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                      {d.name?.[0] || d.email[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-navy-800 truncate">{d.name || d.email}</p>
                        {d.unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{d.unread}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{d.email}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{d.last_message?.slice(0, 40)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Диалог */}
        {selectedUserId ? (
          <div className="flex flex-col flex-1 min-w-0">
            {/* Шапка диалога */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-slate-50/60">
              <button onClick={() => setSelectedUserId(null)} className="sm:hidden p-1 hover:bg-slate-100 rounded-lg mr-1">
                <Icon name="ChevronLeft" size={16} className="text-navy-600" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-navy-800 truncate">{currentDialog?.name || currentDialog?.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentDialog?.email}</p>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/30" style={{ maxHeight: 340 }}>
              {msgLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
                </div>
              ) : messages.map(msg => {
                const isAdmin = msg.sender === "admin";
                const hasAtt = !!(msg.attachment_name && msg.attachment_content && msg.attachment_content.length > 5);
                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${isAdmin ? "justify-end" : "justify-start"}`}>
                    {!isAdmin && (
                      <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center shrink-0 text-xs font-bold text-navy-700">
                        {currentDialog?.name?.[0] || "U"}
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                      isAdmin ? "bg-navy-700 text-white rounded-br-sm" : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm"
                    }`}>
                      {msg.attachment_name && (
                        <button
                          onClick={() => hasAtt && setViewAtt({ title: msg.attachment_name!, content: msg.attachment_content!, type: msg.attachment_type || "text" })}
                          className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs font-medium w-full text-left transition-colors ${
                            msg.attachment_type === "document"
                              ? isAdmin ? "bg-white/15 text-white/80" : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                              : isAdmin ? "bg-white/15 text-white/80" : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                          } ${hasAtt ? "cursor-pointer" : "cursor-default opacity-60"}`}
                        >
                          <Icon name={msg.attachment_type === "document" ? "FileText" : "Bot"} size={12} className="shrink-0" />
                          <span className="flex-1 truncate">
                            {msg.attachment_type === "document" ? "Документ" : "Ответ AI"}: {msg.attachment_name.slice(0, 45)}
                          </span>
                          {hasAtt && <Icon name="ExternalLink" size={10} className="shrink-0 opacity-50" />}
                        </button>
                      )}
                      {msg.body && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.body}</p>}
                      <p className={`text-[9px] mt-1 ${isAdmin ? "text-white/40" : "text-slate-400"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-xs font-bold text-purple-700">
                        Ю
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Поле ответа */}
            <div className="flex items-end gap-2 px-3 py-2.5 border-t border-border bg-white">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder="Ответ клиенту..."
                rows={1}
                className="flex-1 bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 resize-none transition-colors"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={handleSendReply}
                disabled={!reply.trim() || sending}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 shrink-0"
                style={{ background: reply.trim() ? "linear-gradient(135deg, #162d5a, #0a1628)" : "#f1f5f9" }}
              >
                {sending ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Send" size={14} color={reply.trim() ? "white" : "#94a3b8"} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex flex-col items-center justify-center flex-1 text-center p-8">
            <Icon name="UserCheck" size={32} className="text-slate-200 mb-3" />
            <p className="text-sm text-muted-foreground">Выберите клиента слева<br/>для просмотра переписки</p>
          </div>
        )}
      </div>

      {/* Предпросмотр вложения */}
      {viewAtt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewAtt(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: viewAtt.type === "document" ? "#ecfdf5" : "#eff6ff" }}>
                <Icon name={viewAtt.type === "document" ? "FileText" : "Bot"} size={14} color={viewAtt.type === "document" ? "#059669" : "#2563eb"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-800 truncate">{viewAtt.title}</p>
                <p className="text-[11px] text-muted-foreground">{viewAtt.type === "document" ? "Юридический документ" : "Ответ AI-юриста"}</p>
              </div>
              <button onClick={() => setViewAtt(null)} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <Icon name="X" size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap font-sans">{viewAtt.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}