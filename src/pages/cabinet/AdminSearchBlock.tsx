import { useState } from "react";
import Icon from "@/components/ui/icon";
import { adminSearchUser, adminGrant, type AdminUserFull } from "@/lib/auth";

const SERVICE_LABELS: Record<string, string> = {
  plan_starter:          "Тариф Старт (+30 вопр AI / +5 докум / +1 конс юриста)",
  plan_starter_discount: "Тариф Старт скидка (+30 вопр AI / +5 докум / +1 конс юриста)",
  plan_pro:              "Тариф Профи (+100 вопр AI / +20 докум / +5 вопр юристу)",
  plan_max:              "Тариф Максимум (+300 вопр AI / +50 докум / +30 вопр юристу)",
  document:              "Тариф Пробный (+5 вопр AI / +2 докум)",
  consultation:          "+5 вопросов юристу",
  expert:                "Доступ к юристу",
  lawyer_questions:      "+5 вопросов юристу (докупить)",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

function planLabel(u: AdminUserFull) {
  if (u.paid_questions >= 300 || u.paid_docs >= 50) return { label: "Максимум", color: "bg-purple-100 text-purple-700" };
  if (u.paid_questions >= 100 || u.paid_docs >= 20) return { label: "Профи", color: "bg-blue-100 text-blue-700" };
  if (u.paid_questions >= 30  || u.paid_docs >= 5)  return { label: "Старт", color: "bg-emerald-100 text-emerald-700" };
  if (u.paid_questions > 0    || u.paid_docs > 0)   return { label: "Частичный", color: "bg-amber-100 text-amber-700" };
  return { label: "Бесплатный", color: "bg-slate-100 text-slate-500" };
}

export default function AdminSearchBlock() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [users, setUsers]       = useState<AdminUserFull[]>([]);
  const [error, setError]       = useState("");
  const [selected, setSelected] = useState<AdminUserFull | null>(null);

  const [showEdit, setShowEdit] = useState(false);

  // Форма — все поля независимые, можно заполнять любые комбинации
  const [grantSvc, setGrantSvc]   = useState("");
  const [setQ, setSetQ]           = useState("");   // установить вопросы точно
  const [setD, setSetD]           = useState("");   // установить документы точно
  const [setLQ, setSetLQ]         = useState("");   // установить вопросы к юристу точно
  const [comment, setComment]     = useState("");

  const [saving, setSaving]         = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok?: boolean; msg?: string; error?: string } | null>(null);

  const resetForm = () => {
    setGrantSvc(""); setSetQ(""); setSetD(""); setSetLQ(""); setComment(""); setSaveResult(null);
  };

  const handleSearch = async () => {
    if (!email.trim() || email.length < 2) return;
    setLoading(true); setError(""); setUsers([]); setSelected(null); setShowEdit(false); resetForm();
    const res = await adminSearchUser(email.trim());
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setUsers(res.users);
    if (res.users.length === 1) setSelected(res.users[0]);
  };

  const handleSave = async () => {
    if (!selected) return;

    const hasService  = !!grantSvc;
    const hasSetQ     = setQ !== "" && setQ !== null;
    const hasSetD     = setD !== "" && setD !== null;
    const hasSetLQ    = setLQ !== "" && setLQ !== null;

    if (!hasService && !hasSetQ && !hasSetD && !hasSetLQ) {
      setSaveResult({ error: "Заполните хотя бы одно поле: тариф или количество" });
      return;
    }

    const params: Parameters<typeof adminGrant>[0] = {
      target_user_id: selected.id,
      comment: comment.trim() || undefined,
    };
    if (hasService)  params.grant_service = grantSvc;
    if (hasSetQ)     params.set_questions = Math.max(0, parseInt(setQ));
    if (hasSetD)     params.set_docs      = Math.max(0, parseInt(setD));
    if (hasSetLQ)    params.set_lawyer_questions = Math.max(0, parseInt(setLQ));

    setSaving(true); setSaveResult(null);
    const res = await adminGrant(params);
    setSaving(false);

    if (res.error) {
      setSaveResult({ error: res.error });
    } else {
      setSaveResult({ ok: true, msg: res.changes?.join(" · ") || "Применено" });
      setSelected(prev => prev ? {
        ...prev,
        paid_questions: res.paid_questions ?? prev.paid_questions,
        paid_docs:      res.paid_docs      ?? prev.paid_docs,
        paid_expert:    res.paid_expert    ?? prev.paid_expert,
        lawyer_questions_left: res.lawyer_questions_left ?? prev.lawyer_questions_left,
      } : prev);
      resetForm();
      setShowEdit(false);
    }
  };

  const sel = selected;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Search" size={16} className="text-blue-600" />
        </div>
        <h3 className="font-semibold text-navy-800 text-sm">Поиск и управление пользователем</h3>
      </div>

      {/* Строка поиска */}
      <div className="flex gap-2 mb-4">
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="Email пользователя..."
          className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 outline-none focus:border-navy-400 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={loading || email.length < 2}
          className="btn-gold px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40 shrink-0"
        >
          {loading
            ? <Icon name="Loader" size={14} className="animate-spin" />
            : <Icon name="Search" size={14} />}
          Найти
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{error}</div>
      )}

      {/* Несколько результатов */}
      {users.length > 1 && !sel && (
        <div className="mb-3 space-y-1.5">
          {users.map(u => {
            const pl = planLabel(u);
            return (
              <button key={u.id} onClick={() => setSelected(u)}
                className="w-full text-left px-3 py-2 border border-border rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-navy-800">{u.email}</span>
                  {u.name && <span className="text-xs text-muted-foreground ml-2">{u.name}</span>}
                </div>
                <Badge label={pl.label} color={pl.color} />
              </button>
            );
          })}
        </div>
      )}

      {!loading && users.length === 0 && email.length > 1 && !error && (
        <p className="text-xs text-muted-foreground text-center py-4">Пользователи не найдены</p>
      )}

      {/* Карточка пользователя */}
      {sel && (() => {
        const pl = planLabel(sel);
        const canFiles = sel.paid_questions >= 100 || sel.paid_expert;
        return (
          <div className="space-y-3">
            {/* Шапка */}
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold text-navy-800 text-sm">{sel.name || "Без имени"}</p>
                <p className="text-xs text-muted-foreground">{sel.email}</p>
                {sel.phone && <p className="text-xs text-muted-foreground">{sel.phone}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Рег: {fmtDate(sel.created_at)} · Вход: {fmtDate(sel.last_login_at)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge label={pl.label} color={pl.color} />
                <span className={`text-[10px] flex items-center gap-0.5 font-medium ${canFiles ? "text-emerald-600" : "text-slate-400"}`}>
                  <Icon name="Paperclip" size={10} />
                  {canFiles ? "Файлы в чат: ✓" : "Файлы: нет (нужно 100+ вопр)"}
                </span>
              </div>
            </div>

            {/* Баланс */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                <p className="text-xl font-bold text-blue-700">{sel.paid_questions}</p>
                <p className="text-[10px] text-blue-500 font-medium">Вопр AI</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                <p className="text-xl font-bold text-amber-700">{sel.paid_docs}</p>
                <p className="text-[10px] text-amber-500 font-medium">Докум</p>
              </div>
              <div className={`rounded-xl p-2.5 text-center ${sel.lawyer_questions_left ? "bg-emerald-50" : "bg-slate-50"}`}>
                <p className={`text-xl font-bold ${sel.lawyer_questions_left ? "text-emerald-700" : "text-slate-400"}`}>
                  {sel.lawyer_questions_left ?? 0}
                </p>
                <p className={`text-[10px] font-medium ${sel.lawyer_questions_left ? "text-emerald-500" : "text-slate-400"}`}>Вопр юрист</p>
              </div>
              <div className={`rounded-xl p-2.5 text-center ${sel.paid_expert ? "bg-purple-50" : "bg-slate-50"}`}>
                <p className={`text-xl font-bold ${sel.paid_expert ? "text-purple-700" : "text-slate-400"}`}>
                  {sel.paid_expert ? "✓" : "—"}
                </p>
                <p className={`text-[10px] font-medium ${sel.paid_expert ? "text-purple-500" : "text-slate-400"}`}>Юрист</p>
              </div>
            </div>

            {/* Оплаты */}
            {sel.orders.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-navy-600 mb-1.5 uppercase tracking-wide">Оплаты</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {sel.orders.map(o => (
                    <div key={o.inv_id} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs gap-2">
                      <div className="min-w-0">
                        <span className="font-medium text-navy-700">{o.service_type}</span>
                        <span className="text-muted-foreground ml-1.5">{fmtDate(o.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-semibold text-navy-800">{o.amount} ₽</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          o.status === "paid"
                            ? o.credited ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {o.status === "paid" ? (o.credited ? "✓ зачислено" : "⏳ ждёт рег.") : o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* История начислений */}
            {sel.billing.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-navy-600 mb-1.5 uppercase tracking-wide">История начислений</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {sel.billing.map((b, i) => (
                    <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs gap-2">
                      <span className="text-navy-600 truncate">{b.description || b.service_type}</span>
                      <span className="text-muted-foreground shrink-0">{fmtDate(b.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Форма управления */}
            {!showEdit ? (
              <button
                onClick={() => { setShowEdit(true); resetForm(); }}
                className="w-full py-2.5 rounded-xl border border-navy-200 text-sm font-semibold text-navy-700 hover:bg-navy-50 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Settings" size={14} />
                Управление пакетом
              </button>
            ) : (
              <div className="border border-navy-100 rounded-xl p-3 sm:p-4 space-y-4">
                <p className="text-[11px] font-bold text-navy-700 uppercase tracking-wide">
                  Управление пакетом · можно комбинировать
                </p>

                {/* Тариф */}
                <div>
                  <label className="text-xs font-semibold text-navy-700 mb-1.5 block flex items-center gap-1.5">
                    <Icon name="Zap" size={12} className="text-gold-500" />
                    Начислить тариф (необязательно)
                  </label>
                  <select
                    value={grantSvc}
                    onChange={e => setGrantSvc(e.target.value)}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2.5 outline-none focus:border-navy-400 bg-white"
                  >
                    <option value="">— не начислять тариф —</option>
                    {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Прибавляется к текущему балансу
                  </p>
                </div>

                {/* Установить итоговый баланс */}
                <div>
                  <label className="text-xs font-semibold text-navy-700 mb-1.5 block flex items-center gap-1.5">
                    <Icon name="SlidersHorizontal" size={12} className="text-navy-500" />
                    Итоговое количество после начисления (необязательно)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Вопросов AI (итого =)</label>
                      <input
                        type="number" min="0"
                        value={setQ}
                        onChange={e => setSetQ(e.target.value)}
                        placeholder={`сейчас: ${sel.paid_questions}`}
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Документов (итого =)</label>
                      <input
                        type="number" min="0"
                        value={setD}
                        onChange={e => setSetD(e.target.value)}
                        placeholder={`сейчас: ${sel.paid_docs}`}
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Вопросов юристу (итого =)</label>
                      <input
                        type="number" min="0"
                        value={setLQ}
                        onChange={e => setSetLQ(e.target.value)}
                        placeholder={`сейчас: ${sel.lawyer_questions_left ?? 0}`}
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Устанавливает точное значение после начисления тарифа. Например: дать Профи (+100 вопр), но ограничить итог до 30.
                  </p>
                </div>

                {/* Пример для ситуации как с Екатериной */}
                {grantSvc && (setQ !== "" || setD !== "") && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[10px] text-blue-700">
                    💡 Будет начислен тариф <strong>{SERVICE_LABELS[grantSvc]}</strong>, затем баланс будет установлен в итоговое значение, которое вы указали.
                  </div>
                )}

                {/* Комментарий */}
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Комментарий (необязательно)</label>
                  <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Причина изменений..."
                    className="w-full text-xs border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
                  />
                </div>

                {saveResult && (
                  <div className={`px-3 py-2 rounded-xl text-xs font-medium ${
                    saveResult.ok
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                    {saveResult.ok ? `✓ ${saveResult.msg}` : `✗ ${saveResult.error}`}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 btn-gold py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {saving
                      ? <Icon name="Loader" size={14} className="animate-spin" />
                      : <Icon name="Check" size={14} />}
                    Применить
                  </button>
                  <button
                    onClick={() => { setShowEdit(false); resetForm(); }}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm text-navy-600 hover:bg-slate-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {users.length > 1 && (
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-navy-600 flex items-center gap-1"
              >
                <Icon name="ChevronLeft" size={12} />Назад к результатам
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}