import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const DUTY_URL = (func2url as Record<string, string>)["court-duty"];

interface Rate {
  id: number;
  court_type: string;
  sub_key: string;
  label: string;
  sub_ref: string;
  amount_individual: number;
  amount_org: number;
  note: string;
  updated_at: string;
  updated_by: string;
}

interface HistoryItem {
  id: number;
  rate_id: number;
  label: string;
  sub_ref: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  amount_individual: "Физ. лицо (₽)",
  amount_org: "Организация (₽)",
  note: "Примечание",
  label: "Название",
};

export default function AdminDutyRates() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"civil" | "arbitration">("civil");
  const [editing, setEditing] = useState<{ id: number; field: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const [ratesRes, histRes] = await Promise.all([
      fetch(DUTY_URL).then(r => r.json()),
      fetch(`${DUTY_URL}?history=1`).then(r => r.json()),
    ]);
    setRates(ratesRes.rates || []);
    setHistory(histRes.history || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (id: number, field: string, current: string | number) => {
    setEditing({ id, field, value: String(current) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const token = getToken();
    const res = await fetch(DUTY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Token": token },
      body: JSON.stringify({ id: editing.id, [editing.field]: editing.field.startsWith("amount") ? parseInt(editing.value) : editing.value }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(editing.id);
      setTimeout(() => setSaved(null), 2000);
      setEditing(null);
      await load();
    }
  };

  const filtered = rates.filter(r => r.court_type === tab);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="Landmark" size={13} color="#fff" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Ставки госпошлины</p>
            <p className="text-[10px] text-slate-400">ст. 333.19 и ст. 333.21 НК РФ</p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border"
          style={showHistory
            ? { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd" }
            : { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
          <Icon name="Clock" size={12} />История
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
          <span className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          Загрузка...
        </div>
      )}

      {!loading && !showHistory && (
        <>
          {/* Табы */}
          <div className="flex border-b border-slate-100">
            {([["civil", "ГПК / КАС (ст. 333.19)"], ["arbitration", "АПК (ст. 333.21)"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)}
                className="flex-1 py-2.5 text-xs font-semibold transition-all border-b-2"
                style={tab === v
                  ? { color: "#0f4c81", borderColor: "#0f4c81", background: "#fff" }
                  : { color: "#94a3b8", borderColor: "transparent", background: "#f8fafc" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Таблица */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "12px" }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500 w-1/2">Заявление</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Физ. лицо, ₽</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Организация, ₽</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rate => (
                  <tr key={rate.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2">
                      <p className="text-slate-700 leading-snug">{rate.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{rate.sub_ref}</p>
                      {saved === rate.id && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
                          <Icon name="Check" size={10} color="#059669" />Сохранено
                        </span>
                      )}
                    </td>
                    {(["amount_individual", "amount_org"] as const).map(field => (
                      <td key={field} className="px-3 py-2 text-center">
                        {editing?.id === rate.id && editing.field === field ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              className="w-24 border border-blue-300 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-500"
                              value={editing.value}
                              onChange={e => setEditing({ ...editing, value: e.target.value })}
                              autoFocus
                              onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                            />
                            <button onClick={saveEdit} disabled={saving}
                              className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center transition-colors">
                              {saving ? <span className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={11} />}
                            </button>
                            <button onClick={() => setEditing(null)}
                              className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                              <Icon name="X" size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(rate.id, field, rate[field])}
                            className="group flex items-center gap-1 mx-auto px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                            <span className="font-semibold text-slate-700">
                              {rate[field] === 0 ? <span className="text-slate-400">0</span> : rate[field].toLocaleString("ru-RU")}
                            </span>
                            <Icon name="Pencil" size={10} color="#94a3b8" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-slate-500 text-[11px] max-w-[120px]">
                      {editing?.id === rate.id && editing.field === "note" ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-blue-500"
                            value={editing.value}
                            onChange={e => setEditing({ ...editing, value: e.target.value })}
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                          />
                          <button onClick={saveEdit} disabled={saving}
                            className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Icon name="Check" size={10} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(rate.id, "note", rate.note)}
                          className="group text-left hover:text-slate-700 transition-colors flex items-start gap-1">
                          <span className="leading-snug">{rate.note || <span className="text-slate-300">—</span>}</span>
                          <Icon name="Pencil" size={9} color="#94a3b8" className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 px-4 py-2">Нажмите на значение для редактирования · Enter — сохранить · Esc — отменить</p>
        </>
      )}

      {!loading && showHistory && (
        <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">История изменений пуста</p>
          ) : (
            <table className="w-full" style={{ fontSize: "11px" }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Дата</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Статья</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Поле</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Было → Стало</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Кто</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-slate-50">
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                      {new Date(h.changed_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{h.sub_ref}</td>
                    <td className="px-3 py-1.5 text-slate-600 font-medium">{FIELD_LABELS[h.field_changed] ?? h.field_changed}</td>
                    <td className="px-3 py-1.5">
                      <span className="text-red-500 line-through mr-1">{h.old_value}</span>
                      <span className="text-emerald-600 font-semibold">{h.new_value}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 truncate max-w-[100px]">{h.changed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
