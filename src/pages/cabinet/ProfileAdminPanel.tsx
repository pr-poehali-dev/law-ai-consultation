import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { getAdminReports, replyToReport, closeReport, getBillingLog, listUsers, type Report, type BillingLogEntry } from "@/lib/auth";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AdminBillingLog({ userId, userEmail }: { userId: number; userEmail: string }) {
  const [logs, setLogs] = useState<BillingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getBillingLog(userId);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const fmtAmount = (v: number) =>
    v > 0 ? `${v.toLocaleString("ru-RU")} ₽` : "—";

  const fmtDt = (s: string) => {
    const d = new Date(s);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Receipt" size={16} className="text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-navy-800 text-sm">История начислений</h3>
          <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
        </div>
        <button onClick={load} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Загрузка...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-6">
          <Icon name="ReceiptText" size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Начислений пока нет</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {logs.map(l => (
            <div key={l.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="TrendingUp" size={12} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-navy-800 leading-tight">{l.description}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">{fmtDt(l.created_at)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600">{l.source}</span>
                  {l.payment_id && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={l.payment_id}>
                      {l.payment_id.slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 shrink-0">{fmtAmount(l.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminUserBilling() {
  const [users, setUsers] = useState<{ id: number; email: string; name: string }[]>([]);
  const [search, setSearch] = useState("ilya.povarchuk@mail.ru");
  const [selected, setSelected] = useState<{ id: number; email: string } | null>(null);
  const [suggestions, setSuggestions] = useState<typeof users>([]);

  useEffect(() => {
    listUsers().then(list => {
      setUsers(list);
      const found = list.find(u => u.email === "ilya.povarchuk@mail.ru");
      if (found) setSelected({ id: found.id, email: found.email });
    });
  }, []);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (v.length < 2) { setSuggestions([]); return; }
    setSuggestions(users.filter(u =>
      u.email.toLowerCase().includes(v.toLowerCase()) ||
      u.name.toLowerCase().includes(v.toLowerCase())
    ).slice(0, 8));
  };

  const handleSelect = (u: typeof users[0]) => {
    setSelected({ id: u.id, email: u.email });
    setSearch(u.email);
    setSuggestions([]);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Search" size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-navy-800">Начисления пользователя</span>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Email или имя пользователя..."
            className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
              {suggestions.map(u => (
                <button key={u.id} onClick={() => handleSelect(u)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                  <span className="font-medium text-navy-800">{u.email}</span>
                  <span className="text-muted-foreground ml-2">{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {selected && <AdminBillingLog userId={selected.id} userEmail={selected.email} />}
    </div>
  );
}

function AdminReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "replied" | "closed">("all");
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async (f: string) => {
    setLoading(true);
    const r = await getAdminReports(f);
    setReports(r);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleReply = async (id: number) => {
    if (!replyText.trim()) return;
    setSending(true);
    await replyToReport(id, replyText.trim());
    setReplyingId(null);
    setReplyText("");
    setSending(false);
    load(filter);
  };

  const handleClose = async (id: number) => {
    await closeReport(id);
    load(filter);
  };

  const newCount = reports.filter(r => r.status === "new").length;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Inbox" size={16} className="text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-800 text-sm">Жалобы и обращения</h3>
          {newCount > 0 && <p className="text-xs text-orange-600">{newCount} новых</p>}
        </div>
        <button onClick={() => load(filter)} className="ml-auto p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {(["all", "new", "replied", "closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${filter === f ? "bg-navy-700 text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200"}`}>
            {f === "all" ? "Все" : f === "new" ? "Новые" : f === "replied" ? "Отвечены" : "Закрыты"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Загрузка...</p>
      ) : reports.length === 0 ? (
        <div className="text-center py-6">
          <Icon name="CheckCircle" size={28} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Нет обращений</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {reports.map(r => (
            <div key={r.id} className={`rounded-2xl border p-3 space-y-2 ${r.status === "new" ? "border-amber-200 bg-amber-50/40" : r.status === "replied" ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-navy-800 truncate">{r.user_name} · {r.user_email}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(r.created_at)}</p>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === "new" ? "bg-amber-100 text-amber-700" : r.status === "replied" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {r.status === "new" ? "Новое" : r.status === "replied" ? "Отвечено" : "Закрыто"}
                </span>
              </div>
              <p className="text-xs text-navy-700 leading-relaxed">{r.message}</p>
              {r.admin_reply && (
                <div className="pl-3 border-l-2 border-emerald-400">
                  <p className="text-[10px] text-emerald-700 font-semibold mb-0.5">Ваш ответ:</p>
                  <p className="text-xs text-navy-600">{r.admin_reply}</p>
                </div>
              )}

              {/* Форма ответа */}
              {replyingId === r.id ? (
                <div className="space-y-2 mt-1">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Напишите ответ пользователю..."
                    rows={3}
                    className="w-full text-xs bg-white border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleReply(r.id)} disabled={sending || !replyText.trim()}
                      className="flex-1 btn-gold text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <Icon name="Send" size={12} />{sending ? "..." : "Ответить"}
                    </button>
                    <button onClick={() => { setReplyingId(null); setReplyText(""); }}
                      className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-slate-50 transition-colors">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                r.status !== "closed" && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { setReplyingId(r.id); setReplyText(""); }}
                      className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors">
                      Ответить
                    </button>
                    <button onClick={() => handleClose(r.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-muted-foreground hover:bg-slate-50 transition-colors">
                      Закрыть
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileAdminPanel() {
  return (
    <>
      <AdminUserBilling />
      <AdminReportsPanel />
    </>
  );
}
