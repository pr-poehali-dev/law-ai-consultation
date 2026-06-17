import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { listUsers, adminGrant } from "@/lib/auth";

export default function AdminGrantBlock() {
  const [users, setUsers] = useState<{ id: number; email: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<typeof users>([]);
  const [selected, setSelected] = useState<{ id: number; email: string; name: string } | null>(null);
  const [questions, setQuestions] = useState("");
  const [docs, setDocs] = useState("");
  const [consultations, setConsultations] = useState("");
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
    const c = parseInt(consultations) || 0;
    if (q === 0 && d === 0 && c === 0) {
      setResult({ error: "Укажите количество вопросов, документов или консультаций" });
      return;
    }
    setLoading(true);
    setResult(null);
    const res = await adminGrant({
      target_user_id: selected.id,
      questions: q || undefined,
      docs: d || undefined,
      lawyer_questions: c || undefined,
      comment: comment.trim() || undefined,
    });
    setLoading(false);
    if (res.error) {
      setResult({ error: res.error });
    } else {
      const parts = res.changes || [];
      setResult({ ok: true, msg: `Начислено → ${selected.email}: ${parts.join(", ")}` });
      setQuestions("");
      setDocs("");
      setConsultations("");
      setComment("");
    }
  };

  const hasValue = !!(parseInt(questions) || parseInt(docs) || parseInt(consultations));

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
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Вопросов</label>
          <div className="flex items-center border border-border rounded-xl overflow-hidden focus-within:border-navy-400 transition-colors">
            <div className="px-2 py-2 bg-blue-50">
              <Icon name="MessageCircle" size={12} className="text-blue-500" />
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
            <div className="px-2 py-2 bg-amber-50">
              <Icon name="FileText" size={12} className="text-amber-500" />
            </div>
            <input
              type="number" min="0" max="9999" value={docs}
              onChange={e => setDocs(e.target.value)}
              placeholder="0"
              className="flex-1 text-sm px-2 py-2 outline-none w-full"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Консультаций</label>
          <div className="flex items-center border border-border rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors">
            <div className="px-2 py-2 bg-emerald-50">
              <Icon name="UserCheck" size={12} className="text-emerald-600" />
            </div>
            <input
              type="number" min="0" max="999" value={consultations}
              onChange={e => setConsultations(e.target.value)}
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
        disabled={loading || !selected || !hasValue}
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