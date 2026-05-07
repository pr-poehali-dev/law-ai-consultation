import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getToken, canAskQuestion, consumeQuestion } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

interface PartialEntry { date: string; amount: string; }

interface PenaltyCalcPanelProps {
  onClose: () => void;
  onPaymentRequired: () => void;
  embedded?: boolean;
}

type RateType = "percent" | "fixed" | "cbr";
type CbrMode = "multiplier" | "fraction";
type CbrApply = "periods" | "end" | "today" | "custom";
type PercentPeriod = "day" | "year";

export default function PenaltyCalcPanel({ onClose, onPaymentRequired, embedded = false }: PenaltyCalcPanelProps) {
  const [debt, setDebt] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rateType, setRateType] = useState<RateType>("percent");
  const [percentValue, setPercentValue] = useState("");
  const [percentPeriod, setPercentPeriod] = useState<PercentPeriod>("day");
  const [fixedDay, setFixedDay] = useState("");
  const [cbrMode, setCbrMode] = useState<CbrMode>("fraction");
  const [cbrValue, setCbrValue] = useState("300");
  const [cbrApply, setCbrApply] = useState<CbrApply>("today");
  const [cbrCustomDate, setCbrCustomDate] = useState("");
  const [capEnabled, setCapEnabled] = useState(false);
  const [capValue, setCapValue] = useState("");
  const [capType, setCapType] = useState<"percent" | "fixed">("percent");
  const [partials, setPartials] = useState<PartialEntry[]>([]);
  const [increases, setIncreases] = useState<PartialEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  const addPartial = () => setPartials(p => [...p, { date: "", amount: "" }]);
  const removePartial = (i: number) => setPartials(p => p.filter((_, idx) => idx !== i));
  const updatePartial = (i: number, field: keyof PartialEntry, val: string) =>
    setPartials(p => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const addIncrease = () => setIncreases(p => [...p, { date: "", amount: "" }]);
  const removeIncrease = (i: number) => setIncreases(p => p.filter((_, idx) => idx !== i));
  const updateIncrease = (i: number, field: keyof PartialEntry, val: string) =>
    setIncreases(p => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const buildCalcData = () => {
    const lines: string[] = [];
    lines.push(`Сумма долга: ${debt} руб.`);
    lines.push(`Период просрочки: с ${dateFrom} по ${dateTo || "дату расчёта"}`);

    if (rateType === "percent") {
      lines.push(`Тип расчёта: Вариант А (проценты от суммы долга)`);
      lines.push(`Ставка: ${percentValue}% в ${percentPeriod === "day" ? "день" : "год"}`);
    } else if (rateType === "fixed") {
      lines.push(`Тип расчёта: Вариант В (твёрдая сумма в день)`);
      lines.push(`Твёрдая сумма в день: ${fixedDay} руб.`);
    } else {
      lines.push(`Тип расчёта: Вариант Б (ключевая ставка ЦБ РФ)`);
      if (cbrMode === "fraction") {
        lines.push(`Доля ставки: 1/${cbrValue}`);
      } else {
        lines.push(`Кратность ставки: ${cbrValue}x`);
      }
      const applyMap: Record<CbrApply, string> = {
        periods: "по периодам действия ЦБ РФ",
        end: "на конец периода начисления",
        today: "на сегодня",
        custom: `на дату ${cbrCustomDate}`,
      };
      lines.push(`Применить ставку: ${applyMap[cbrApply]}`);
    }

    if (capEnabled && capValue) {
      lines.push(`Ограничение неустойки: ${capValue} ${capType === "percent" ? "% от суммы долга" : "руб. (фиксированно)"}`);
    }

    const validPartials = partials.filter(p => p.date && p.amount);
    if (validPartials.length > 0) {
      lines.push(`Частичные оплаты: ${validPartials.map(p => `${p.date} — ${p.amount} руб.`).join("; ")}`);
    }

    const validIncreases = increases.filter(p => p.date && p.amount);
    if (validIncreases.length > 0) {
      lines.push(`Увеличения долга: ${validIncreases.map(p => `${p.date} — ${p.amount} руб.`).join("; ")}`);
    }

    return lines.join("\n");
  };

  const handleCalc = async () => {
    if (!debt || !dateFrom) { setErr("Укажите сумму долга и дату начала просрочки"); return; }
    setErr("");
    setLoading(true);
    const canAsk = await canAskQuestion();
    if (!canAsk) { setLoading(false); onPaymentRequired(); return; }
    const { ok } = await consumeQuestion();
    if (!ok) { setLoading(false); onPaymentRequired(); return; }
    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "penalty_calc", calc_data: buildCalcData() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка расчёта");
      setResult(data.answer || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка расчёта. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadDoc("Расчёт неустойки", `[ЗАГОЛОВОК]\nРАСЧЁТ НЕУСТОЙКИ\n[ТЕЛО]\n${result}`);
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-100 transition-colors";
  const labelCls = "text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1 block";

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <Icon name="Calculator" size={14} className="text-amber-600" />
          </div>
          <span className="font-semibold text-navy-800 text-sm">Расчёт неустойки</span>
        </div>
        {!embedded && (
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-700 transition-colors">
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {/* Форма / Результат */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {result ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="CheckCircle" size={14} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">Расчёт готов</span>
              </div>
              <p className="text-xs text-navy-700 whitespace-pre-wrap leading-relaxed">{result}</p>
            </div>
            <button onClick={handleDownload} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5">
              <Icon name="Download" size={14} />Скачать расчёт .docx
            </button>
            <button onClick={() => setResult("")} className="w-full py-2 rounded-xl text-xs text-navy-500 hover:text-navy-700 border border-slate-200 hover:border-navy-300 transition-colors">
              Новый расчёт
            </button>
          </div>
        ) : (
          <>
            {/* Сумма долга */}
            <div>
              <label className={labelCls}>Сумма долга</label>
              <div className="relative">
                <input value={debt} onChange={e => setDebt(e.target.value)} placeholder="100 000" className={inputCls + " pr-8"} />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">₽</span>
              </div>
            </div>

            {/* Период */}
            <div>
              <label className={labelCls}>Период начисления неустойки</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 mb-0.5 block">С даты</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 mb-0.5 block">По дату (пусто = сегодня)</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Тип ставки */}
            <div>
              <label className={labelCls}>Ставка</label>
              <div className="flex flex-col gap-1.5">
                {[
                  { val: "percent" as RateType, label: "В процентах от суммы долга" },
                  { val: "fixed" as RateType, label: "Твёрдая денежная сумма в день" },
                  { val: "cbr" as RateType, label: "Зависит от ключевой ставки ЦБ РФ" },
                ].map(opt => (
                  <label key={opt.val} className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${rateType === opt.val ? "border-navy-600 bg-navy-600" : "border-slate-300"}`}>
                      {rateType === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs text-navy-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Поля в зависимости от типа ставки */}
            {rateType === "percent" && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <label className={labelCls}>Размер ставки</label>
                <div className="flex gap-2">
                  <input value={percentValue} onChange={e => setPercentValue(e.target.value)} placeholder="0.1" className={inputCls + " flex-1"} />
                  <span className="text-sm text-slate-400 self-center">%</span>
                </div>
                <div className="flex gap-3">
                  {(["day", "year"] as PercentPeriod[]).map(p => (
                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${percentPeriod === p ? "border-navy-600 bg-navy-600" : "border-slate-300"}`}>
                        {percentPeriod === p && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs text-navy-700">{p === "day" ? "% в день" : "% в год"}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {rateType === "fixed" && (
              <div className="bg-slate-50 rounded-xl p-3">
                <label className={labelCls}>Твёрдая сумма в день</label>
                <div className="relative">
                  <input value={fixedDay} onChange={e => setFixedDay(e.target.value)} placeholder="500" className={inputCls + " pr-8"} />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">₽</span>
                </div>
              </div>
            )}

            {rateType === "cbr" && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-3">
                <div>
                  <label className={labelCls}>Кратность / доля ставки</label>
                  <div className="flex gap-3 mb-2">
                    {(["fraction", "multiplier"] as CbrMode[]).map(m => (
                      <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${cbrMode === m ? "border-navy-600 bg-navy-600" : "border-slate-300"}`}>
                          {cbrMode === m && <div className="w-1 h-1 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs text-navy-700">{m === "fraction" ? "Доля ставки (1/N)" : "Кратность ставки"}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {cbrMode === "fraction" && <span className="text-sm text-slate-500 shrink-0">1 /</span>}
                    <input value={cbrValue} onChange={e => setCbrValue(e.target.value)} placeholder={cbrMode === "fraction" ? "300" : "1.5"} className={inputCls} />
                    {cbrMode === "multiplier" && <span className="text-sm text-slate-400 shrink-0">× ставки</span>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Применить ставку</label>
                  <select value={cbrApply} onChange={e => setCbrApply(e.target.value as CbrApply)} className={inputCls}>
                    <option value="periods">По периодам действия ЦБ РФ</option>
                    <option value="end">На конец периода начисления</option>
                    <option value="today">На сегодня</option>
                    <option value="custom">На выбранную дату</option>
                  </select>
                  {cbrApply === "custom" && (
                    <input type="date" value={cbrCustomDate} onChange={e => setCbrCustomDate(e.target.value)} className={inputCls + " mt-2"} />
                  )}
                </div>
              </div>
            )}

            {/* Ограничение неустойки */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setCapEnabled(v => !v)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${capEnabled ? "border-navy-600 bg-navy-600" : "border-slate-300"}`}
                >
                  {capEnabled && <Icon name="Check" size={10} className="text-white" />}
                </div>
                <span className="text-xs font-medium text-navy-700">Ограничение суммы неустойки</span>
              </label>
              {capEnabled && (
                <div className="flex gap-2 items-center mt-1">
                  <input value={capValue} onChange={e => setCapValue(e.target.value)} placeholder={capType === "percent" ? "10" : "50000"} className={inputCls + " flex-1"} />
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0">
                    <button onClick={() => setCapType("percent")} className={`px-3 py-2 text-xs font-medium transition-colors ${capType === "percent" ? "bg-navy-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>%</button>
                    <button onClick={() => setCapType("fixed")} className={`px-3 py-2 text-xs font-medium transition-colors ${capType === "fixed" ? "bg-navy-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>₽</button>
                  </div>
                </div>
              )}
            </div>

            {/* Частичные оплаты и увеличения долга */}
            <div className="grid grid-cols-2 gap-2">
              {/* Частичные оплаты */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-navy-600 uppercase tracking-wide">Частичные оплаты</span>
                  <button onClick={addPartial} className="w-5 h-5 rounded-lg bg-navy-100 hover:bg-navy-200 flex items-center justify-center transition-colors">
                    <Icon name="Plus" size={10} className="text-navy-700" />
                  </button>
                </div>
                {partials.length === 0 && <p className="text-[10px] text-slate-400">Нажмите + для добавления</p>}
                {partials.map((p, i) => (
                  <div key={i} className="mb-1.5 flex flex-col gap-1 relative">
                    <input type="date" value={p.date} onChange={e => updatePartial(i, "date", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none" />
                    <div className="flex gap-1">
                      <input value={p.amount} onChange={e => updatePartial(i, "amount", e.target.value)} placeholder="Сумма ₽" className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none" />
                      <button onClick={() => removePartial(i)} className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors">
                        <Icon name="Trash2" size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Увеличения долга */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-navy-600 uppercase tracking-wide">Увеличение долга</span>
                  <button onClick={addIncrease} className="w-5 h-5 rounded-lg bg-navy-100 hover:bg-navy-200 flex items-center justify-center transition-colors">
                    <Icon name="Plus" size={10} className="text-navy-700" />
                  </button>
                </div>
                {increases.length === 0 && <p className="text-[10px] text-slate-400">Нажмите + для добавления</p>}
                {increases.map((p, i) => (
                  <div key={i} className="mb-1.5 flex flex-col gap-1">
                    <input type="date" value={p.date} onChange={e => updateIncrease(i, "date", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none" />
                    <div className="flex gap-1">
                      <input value={p.amount} onChange={e => updateIncrease(i, "amount", e.target.value)} placeholder="Сумма ₽" className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none" />
                      <button onClick={() => removeIncrease(i)} className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors">
                        <Icon name="Trash2" size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 rounded-xl px-3 py-2">
                <Icon name="AlertCircle" size={13} />
                <span className="text-xs">{err}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Кнопка расчёта */}
      {!result && (
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <button
            onClick={handleCalc}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Icon name="Loader" size={14} className="animate-spin" />Считаем...</>
            ) : (
              <><Icon name="Calculator" size={14} />Рассчитать неустойку · 1 вопрос</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}