import { useState } from "react";
import Icon from "@/components/ui/icon";
import { adminSearchUser, adminGrant, type AdminUserFull } from "@/lib/auth";

const SERVICE_LABELS: Record<string, string> = {
  plan_starter:          "Пакет Старт (+30 вопр / +5 докум)",
  plan_starter_discount: "Пакет Старт скидка (+30 вопр / +5 докум)",
  plan_pro:              "Тариф Профи (+100 вопр / +20 докум)",
  plan_max:              "Тариф Максимум (+300 вопр / +50 докум + юрист)",
  document:              "+1 документ",
  consultation:          "+3 вопроса",
  expert:                "Доступ к юристу",
};

// Режим редактирования — только один активен, чтобы не было конфликтов
type EditMode = "tariff" | "delta" | "set";

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
  if (u.paid_questions >= 100 || u.paid_docs >= 20) return { label: "Профи 🔒📎", color: "bg-blue-100 text-blue-700" };
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

  const [showEdit, setShowEdit]     = useState(false);
  const [editMode, setEditMode]     = useState<EditMode>("tariff");
  const [grantSvc, setGrantSvc]     = useState("");
  const [qDelta, setQDelta]         = useState("");
  const [dDelta, setDDelta]         = useState("");
  const [setQ, setSetQ]             = useState("");
  const [setD, setSetD]             = useState("");
  const [comment, setComment]       = useState("");
  const [saving, setSaving]         = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok?: boolean; msg?: string; error?: string } | null>(null);

  const resetEdit = () => {
    setGrantSvc(""); setQDelta(""); setDDelta(""); setSetQ(""); setSetD(""); setComment("");
    setSaveResult(null);
  };

  const handleSearch = async () => {
    if (!email.trim() || email.length < 2) return;
    setLoading(true); setError(""); setUsers([]); setSelected(null); setShowEdit(false); resetEdit();
    const res = await adminSearchUser(email.trim());
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setUsers(res.users);
    if (res.users.length === 1) setSelected(res.users[0]);
  };

  const handleSave = async () => {
    if (!selected) return;
    const params: Parameters<typeof adminGrant>[0] = {
      target_user_id: selected.id,
      comment: comment.trim() || undefined,
    };

    // Только один режим применяется за раз
    if (editMode === "tariff") {
      if (!grantSvc) { setSaveResult({ error: "Выберите тариф" }); return; }
      params.grant_service = grantSvc;
    } else if (editMode === "delta") {
      const q = qDelta !== "" ? parseInt(qDelta) : 0;
      const d = dDelta !== "" ? parseInt(dDelta) : 0;
      if (q === 0 && d === 0) { setSaveResult({ error: "Укажите значение" }); return; }
      if (q !== 0) params.questions = q;
      if (d !== 0) params.docs = d;
    } else if (editMode === "set") {
      if (setQ === "" && setD === "") { setSaveResult({ error: "Укажите значение" }); return; }
      if (setQ !== "") params.set_questions = Math.max(0, parseInt(setQ));
      if (setD !== "") params.set_docs = Math.max(0, parseInt(setD));
    }

    setSaving(true); setSaveResult(null);
    const res = await adminGrant(params);
    setSaving(false);

    if (res.error) {
      setSaveResult({ error: res.error });
    } else {
      setSaveResult({ ok: true, msg: res.changes?.join(" · ") || "Сохранено" });
      setSelected(prev => prev ? {
        ...prev,
        paid_questions: res.paid_questions ?? prev.paid_questions,
        paid_docs:      res.paid_docs      ?? prev.paid_docs,
        paid_expert:    res.paid_expert    ?? prev.paid_expert,
      } : prev);
      resetEdit();
      setShowEdit(false);
    }
  };

  const tabCls = (active: boolean) =>
    `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
      active ? "bg-navy-800 text-white" : "text-navy-500 hover:bg-slate-100"
    }`;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Search" size={16} className="text-blue-600" />
        </div>
        <h3 className="font-semibold text-navy-800 text-sm">Поиск пользователя</h3>
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
          {loading ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Search" size={14} />}
          Найти
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{error}</div>
      )}

      {/* Список совпадений */}
      {users.length > 1 && !selected && (
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
      {selected && (() => {
        const pl = planLabel(selected);
        const canFiles = selected.paid_questions >= 100 || selected.paid_expert;
        return (
          <div className="space-y-3">
            {/* Шапка */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy-800 text-sm">{selected.name || "Без имени"}</p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
                {selected.phone && <p className="text-xs text-muted-foreground">{selected.phone}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Рег: {fmtDate(selected.created_at)} · Вход: {fmtDate(selected.last_login_at)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge label={pl.label} color={pl.color} />
                {canFiles
                  ? <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5"><Icon name="Paperclip" size={10} />Файлы: ✓</span>
                  : <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Icon name="Paperclip" size={10} />Файлы: нет (нужно 100+ вопр)</span>
                }
              </div>
            </div>

            {/* Баланс */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                <p className="text-xl font-bold text-blue-700">{selected.paid_questions}</p>
                <p className="text-[10px] text-blue-500 font-medium">Вопросов</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                <p className="text-xl font-bold text-amber-700">{selected.paid_docs}</p>
                <p className="text-[10px] text-amber-500 font-medium">Документов</p>
              </div>
              <div className={`rounded-xl p-2.5 text-center ${selected.paid_expert ? "bg-purple-50" : "bg-slate-50"}`}>
                <p className={`text-xl font-bold ${selected.paid_expert ? "text-purple-700" : "text-slate-400"}`}>
                  {selected.paid_expert ? "✓" : "—"}
                </p>
                <p className={`text-[10px] font-medium ${selected.paid_expert ? "text-purple-500" : "text-slate-400"}`}>Юрист</p>
              </div>
            </div>

            {/* Оплаты */}
            {selected.orders.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-navy-600 mb-1.5 uppercase tracking-wide">Оплаты</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {selected.orders.map(o => (
                    <div key={o.inv_id} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs">
                      <div className="truncate">
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

            {/* Начисления */}
            {selected.billing.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-navy-600 mb-1.5 uppercase tracking-wide">История начислений</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {selected.billing.map((b, i) => (
                    <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs gap-2">
                      <span className="text-navy-600 truncate">{b.description || b.service_type}</span>
                      <span className="text-muted-foreground shrink-0">{fmtDate(b.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Кнопка редактирования */}
            {!showEdit ? (
              <button
                onClick={() => { setShowEdit(true); setSaveResult(null); setEditMode("tariff"); }}
                className="w-full py-2.5 rounded-xl border border-navy-200 text-sm font-semibold text-navy-700 hover:bg-navy-50 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Edit" size={14} />
                Редактировать пакет
              </button>
            ) : (
              <div className="border border-navy-100 rounded-xl p-3 space-y-3">
                <p className="text-[11px] font-bold text-navy-700 uppercase tracking-wide">Изменить пакет</p>

                {/* Вкладки — только один режим */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  <button className={tabCls(editMode === "tariff")} onClick={() => { setEditMode("tariff"); resetEdit(); }}>
                    Тариф
                  </button>
                  <button className={tabCls(editMode === "delta")} onClick={() => { setEditMode("delta"); resetEdit(); }}>
                    ± Добавить/убрать
                  </button>
                  <button className={tabCls(editMode === "set")} onClick={() => { setEditMode("set"); resetEdit(); }}>
                    = Установить
                  </button>
                </div>

                {/* Тариф */}
                {editMode === "tariff" && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Выберите тариф для начисления</label>
                    <select
                      value={grantSvc}
                      onChange={e => setGrantSvc(e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-2.5 py-2.5 outline-none focus:border-navy-400 bg-white"
                    >
                      <option value="">— выберите тариф —</option>
                      {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">Начисляется поверх текущего баланса</p>
                  </div>
                )}

                {/* Дельта */}
                {editMode === "delta" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Используйте отрицательные числа для уменьшения (напр. -10)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Вопросов ±</label>
                        <input
                          type="number" value={qDelta} onChange={e => setQDelta(e.target.value)}
                          placeholder="напр. -5 или 10"
                          className="w-full text-sm border border-border rounded-lg px-2.5 py-2 outline-none focus:border-navy-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Документов ±</label>
                        <input
                          type="number" value={dDelta} onChange={e => setDDelta(e.target.value)}
                          placeholder="напр. -2 или 5"
                          className="w-full text-sm border border-border rounded-lg px-2.5 py-2 outline-none focus:border-navy-400"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Текущий баланс: {selected.paid_questions} вопр. / {selected.paid_docs} докум.
                    </p>
                  </div>
                )}

                {/* Установить точно */}
                {editMode === "set" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Установить точное значение (перезаписывает текущее)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Вопросов =</label>
                        <input
                          type="number" min="0" value={setQ} onChange={e => setSetQ(e.target.value)}
                          placeholder={`сейчас: ${selected.paid_questions}`}
                          className="w-full text-sm border border-border rounded-lg px-2.5 py-2 outline-none focus:border-navy-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Документов =</label>
                        <input
                          type="number" min="0" value={setD} onChange={e => setSetD(e.target.value)}
                          placeholder={`сейчас: ${selected.paid_docs}`}
                          className="w-full text-sm border border-border rounded-lg px-2.5 py-2 outline-none focus:border-navy-400"
                        />
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[10px] text-amber-700">
                      ⚠️ Это заменит текущий баланс. Для добавления используйте вкладку «± Добавить/убрать».
                    </div>
                  </div>
                )}

                {/* Комментарий */}
                <input
                  value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Комментарий (необязательно)"
                  className="w-full text-xs border border-border rounded-lg px-2.5 py-2 outline-none focus:border-navy-400"
                />

                {saveResult && (
                  <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
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
                    {saving ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />}
                    Применить
                  </button>
                  <button
                    onClick={() => { setShowEdit(false); resetEdit(); }}
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
