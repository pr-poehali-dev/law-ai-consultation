import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getToken, consumeQuestion, consumeDoc, getUser, hasActiveSubscription, getDailyFreeLeft } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

interface PartialEntry { id: number; date: string; amount: string; }

interface PenaltyCalcPanelProps {
  onClose: () => void;
  onPaymentRequired: () => void;
  embedded?: boolean;
  /** Контекст документа для AI — дополнительно передаётся в промт */
  docContext?: string;
  /** Вызывается после успешного расчёта */
  onSuccess?: () => void;
}

type RateType = "percent" | "fixed" | "cbr";
type CbrMode = "multiplier" | "fraction";
type CbrApply = "periods" | "end" | "today" | "custom";
type PercentPeriod = "day" | "year";

let _nextId = 1;
function nextId() { return _nextId++; }



export default function PenaltyCalcPanel({ onClose, onPaymentRequired, embedded = false, docContext, onSuccess }: PenaltyCalcPanelProps) {
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

  const addPartial = () => setPartials(p => [...p, { id: nextId(), date: "", amount: "" }]);
  const removePartial = (id: number) => setPartials(p => p.filter(e => e.id !== id));
  const updatePartial = (id: number, field: "date" | "amount", val: string) =>
    setPartials(p => p.map(e => e.id === id ? { ...e, [field]: val } : e));

  const addIncrease = () => setIncreases(p => [...p, { id: nextId(), date: "", amount: "" }]);
  const removeIncrease = (id: number) => setIncreases(p => p.filter(e => e.id !== id));
  const updateIncrease = (id: number, field: "date" | "amount", val: string) =>
    setIncreases(p => p.map(e => e.id === id ? { ...e, [field]: val } : e));

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
      lines.push(cbrMode === "fraction" ? `Доля ставки: 1/${cbrValue}` : `Кратность ставки: ${cbrValue}x`);
      const applyMap: Record<CbrApply, string> = {
        periods: "по периодам действия ЦБ РФ", end: "на конец периода начисления",
        today: "на сегодня", custom: `на дату ${cbrCustomDate}`,
      };
      lines.push(`Применить ставку: ${applyMap[cbrApply]}`);
    }
    if (capEnabled && capValue) {
      lines.push(`Ограничение неустойки: ${capValue} ${capType === "percent" ? "% от суммы долга" : "руб. (фиксированно)"}`);
    }
    const vp = partials.filter(p => p.date && p.amount);
    if (vp.length) lines.push(`Частичные оплаты: ${vp.map(p => `${p.date} — ${p.amount} руб.`).join("; ")}`);
    const vi = increases.filter(p => p.date && p.amount);
    if (vi.length) lines.push(`Увеличения долга: ${vi.map(p => `${p.date} — ${p.amount} руб.`).join("; ")}`);
    if (docContext) lines.push(`\nКонтекст документа (для справки):\n${docContext.slice(0, 800)}`);
    return lines.join("\n");
  };

  const handleCalc = async () => {
    if (!debt.trim() || !dateFrom) { setErr("Укажите сумму долга и дату начала просрочки"); return; }
    setErr("");
    setLoading(true);

    // Один запрос getUser — проверяем и доступ и баланс
    const user = await getUser();
    if (!user) { setLoading(false); onPaymentRequired(); return; }
    const isPro = user.isAdmin
      || hasActiveSubscription(user, "consult")
      || hasActiveSubscription(user, "docs")
      || user.paidQuestions >= 30
      || user.paidDocs >= 10;
    if (!isPro) { setLoading(false); onPaymentRequired(); return; }
    const hasQ = user.isAdmin
      || hasActiveSubscription(user, "consult")
      || getDailyFreeLeft() > 0
      || user.paidQuestions > 0;
    if (!hasQ) { setLoading(false); onPaymentRequired(); return; }
    // Списываем 1 документ + 1 вопрос за расчёт
    const hasDoc = user.isAdmin || hasActiveSubscription(user, "docs") || user.paidDocs > 0;
    if (!hasDoc) { setLoading(false); onPaymentRequired(); return; }
    const docOk = await consumeDoc();
    if (!docOk) { setLoading(false); onPaymentRequired(); return; }
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
      if (onSuccess) onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка расчёта. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  // Парсим блоки [ШАПКА][ЗАГОЛОВОК][ИСХОДНЫЕ_ДАННЫЕ][РАСЧЁТ][ИТОГ][СНОСКА] из ответа AI
  function buildDocxContent(raw: string): string {
    // Если AI уже вернул блоки — используем как есть
    if (raw.includes("[ШАПКА]") || raw.includes("[ЗАГОЛОВОК]") || raw.includes("[ИСХОДНЫЕ_ДАННЫЕ]")) {
      return raw;
    }
    // Иначе оборачиваем в структуру
    return `[ЗАГОЛОВОК]\nРАСЧЁТ НЕУСТОЙКИ\n[ТЕЛО]\n${raw}`;
  }

  // Разбиваем результат на именованные секции для красивого рендера
  function parseSections(raw: string): { key: string; label: string; content: string }[] {
    const LABELS: Record<string, string> = {
      "ШАПКА": "Шапка",
      "ЗАГОЛОВОК": "Заголовок",
      "ИСХОДНЫЕ_ДАННЫЕ": "Исходные данные",
      "РАСЧЁТ": "Расчёт",
      "ИТОГ": "Итог",
      "СНОСКА": "Примечание",
      "ТЕЛО": "",
    };
    const blockRe = /\[([А-ЯA-Z_]+)\]\n?([\s\S]*?)(?=\n?\[[А-ЯA-Z_]+\]|$)/g;
    const found: { key: string; label: string; content: string }[] = [];
    let m;
    while ((m = blockRe.exec(raw)) !== null) {
      const key = m[1];
      const content = m[2].trim();
      if (content) found.push({ key, label: LABELS[key] ?? key, content });
    }
    return found.length > 0 ? found : [{ key: "ТЕЛО", label: "", content: raw }];
  }

  const handleDownload = () => {
    if (!result) return;
    downloadDoc("Расчёт неустойки", buildDocxContent(result));
  };

  const inp = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-100 transition-colors placeholder:text-slate-300";
  const lbl = "text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1 block";

  const Radio = ({ value, current, onChange, label }: { value: string; current: string; onChange: (v: string) => void; label: string }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none group" onClick={() => onChange(value)}>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${current === value ? "border-navy-600 bg-navy-600" : "border-slate-300 group-hover:border-navy-400"}`}>
        {current === value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <span className={`text-xs transition-colors ${current === value ? "text-navy-800 font-medium" : "text-slate-500 group-hover:text-navy-700"}`}>{label}</span>
    </label>
  );

  return (
    <div className="flex flex-col h-full bg-white">
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

      {/* Тариф-подсказка */}
      {!embedded && (
        <div className="px-4 pt-2.5 pb-0 shrink-0">
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5">
            <Icon name="Lock" size={11} className="text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-700">Доступно с тарифа <b>Профи</b> и выше · 1 вопрос</span>
          </div>
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {result ? (
          /* ── Результат ── */
          (() => {
            const sections = parseSections(result);
            const SECTION_ICONS: Record<string, string> = {
              ШАПКА: "AlignRight", ЗАГОЛОВОК: "FileText", ИСХОДНЫЕ_ДАННЫЕ: "List",
              РАСЧЁТ: "Calculator", ИТОГ: "TrendingUp", СНОСКА: "Info", ТЕЛО: "",
            };
            const SECTION_COLORS: Record<string, string> = {
              ИСХОДНЫЕ_ДАННЫЕ: "bg-blue-50 border-blue-100",
              РАСЧЁТ: "bg-amber-50 border-amber-100",
              ИТОГ: "bg-emerald-50 border-emerald-200",
              СНОСКА: "bg-slate-50 border-slate-200",
              ШАПКА: "bg-white border-slate-100",
              ЗАГОЛОВОК: "",
              ТЕЛО: "bg-white border-slate-100",
            };
            return (
              <div className="space-y-3">
                {/* Шапка карточки результата */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
                  <div className="p-4 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Icon name="CheckCircle" size={14} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Расчёт готов</p>
                        <p className="text-[10px] text-slate-400">Юридический калькулятор неустойки</p>
                      </div>
                    </div>

                    {/* Секции документа */}
                    <div className="space-y-2">
                      {sections.map((sec, idx) => {
                        if (sec.key === "ЗАГОЛОВОК") {
                          return (
                            <div key={idx} className="text-center py-1">
                              <p className="text-sm font-bold text-navy-800 uppercase tracking-widest">{sec.content}</p>
                            </div>
                          );
                        }
                        if (sec.key === "ШАПКА") {
                          return (
                            <div key={idx} className="text-right text-[11px] text-navy-600 leading-relaxed bg-white border border-slate-100 rounded-xl px-3 py-2">
                              {sec.content.split("\n").map((l, j) => <p key={j}>{l}</p>)}
                            </div>
                          );
                        }
                        if (sec.key === "ИТОГ") {
                          return (
                            <div key={idx} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <Icon name="TrendingUp" size={11} />ИТОГОВАЯ СУММА
                              </p>
                              <p className="text-sm font-bold text-navy-800 whitespace-pre-wrap leading-relaxed">{sec.content}</p>
                            </div>
                          );
                        }
                        if (sec.key === "СНОСКА") {
                          return (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] text-slate-500 leading-relaxed italic">{sec.content}</p>
                            </div>
                          );
                        }
                        const colorCls = SECTION_COLORS[sec.key] || "bg-white border-slate-100";
                        const iconName = SECTION_ICONS[sec.key] || "FileText";
                        const sectionLabel = sec.label;
                        return (
                          <div key={idx} className={`rounded-xl border px-3 py-2.5 ${colorCls}`}>
                            {sectionLabel && (
                              <p className="text-[10px] font-bold text-navy-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <Icon name={iconName} size={11} />{sectionLabel}
                              </p>
                            )}
                            <p className="text-xs text-navy-700 whitespace-pre-wrap leading-relaxed">{sec.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button onClick={handleDownload} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95">
                  <Icon name="Download" size={14} />Скачать расчёт .docx
                </button>
                <button onClick={() => setResult("")} className="w-full py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-navy-600 border border-slate-200 hover:border-navy-200 transition-colors">
                  ← Новый расчёт
                </button>
              </div>
            );
          })()
        ) : (
          /* ── Форма ── */
          <>
            {/* Сумма долга */}
            <div>
              <label className={lbl}>Сумма долга</label>
              <div className="relative">
                <input value={debt} onChange={e => setDebt(e.target.value)} placeholder="100 000" className={inp + " pr-8"} />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">₽</span>
              </div>
            </div>

            {/* Период */}
            <div>
              <label className={lbl}>Период просрочки</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 mb-0.5 block">С даты (начало)</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 mb-0.5 block">По дату (пусто = сегодня)</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} />
                </div>
              </div>
            </div>

            {/* Тип ставки */}
            <div>
              <label className={lbl}>Тип ставки</label>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2.5">
                <Radio value="percent" current={rateType} onChange={v => setRateType(v as RateType)} label="В процентах от суммы долга" />
                <Radio value="fixed" current={rateType} onChange={v => setRateType(v as RateType)} label="Твёрдая сумма в день" />
                <Radio value="cbr" current={rateType} onChange={v => setRateType(v as RateType)} label="Ключевая ставка ЦБ РФ" />
              </div>
            </div>

            {/* Поля по типу ставки */}
            {rateType === "percent" && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2.5">
                <label className={lbl}>Размер ставки</label>
                <div className="flex gap-2 items-center">
                  <input value={percentValue} onChange={e => setPercentValue(e.target.value)} placeholder="0.1" className={inp + " flex-1"} />
                  <span className="text-sm text-slate-400 shrink-0 font-medium">%</span>
                </div>
                <div className="flex gap-4">
                  <Radio value="day" current={percentPeriod} onChange={v => setPercentPeriod(v as PercentPeriod)} label="% в день" />
                  <Radio value="year" current={percentPeriod} onChange={v => setPercentPeriod(v as PercentPeriod)} label="% в год" />
                </div>
              </div>
            )}

            {rateType === "fixed" && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <label className={lbl}>Твёрдая сумма в день</label>
                <div className="relative">
                  <input value={fixedDay} onChange={e => setFixedDay(e.target.value)} placeholder="500" className={inp + " pr-8"} />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">₽</span>
                </div>
              </div>
            )}

            {rateType === "cbr" && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-3">
                <div>
                  <label className={lbl}>Кратность / доля ставки</label>
                  <div className="flex gap-4 mb-2">
                    <Radio value="fraction" current={cbrMode} onChange={v => setCbrMode(v as CbrMode)} label="Доля (1/N)" />
                    <Radio value="multiplier" current={cbrMode} onChange={v => setCbrMode(v as CbrMode)} label="Кратность" />
                  </div>
                  <div className="flex items-center gap-2">
                    {cbrMode === "fraction" && <span className="text-sm text-slate-500 shrink-0">1 /</span>}
                    <input value={cbrValue} onChange={e => setCbrValue(e.target.value)} placeholder={cbrMode === "fraction" ? "300" : "1.5"} className={inp} />
                    {cbrMode === "multiplier" && <span className="text-sm text-slate-400 shrink-0">× ставки</span>}
                  </div>
                </div>
                <div>
                  <label className={lbl}>Применить ставку</label>
                  <select value={cbrApply} onChange={e => setCbrApply(e.target.value as CbrApply)} className={inp + " cursor-pointer"}>
                    <option value="periods">По периодам действия ЦБ РФ</option>
                    <option value="end">На конец периода начисления</option>
                    <option value="today">На сегодня</option>
                    <option value="custom">На выбранную дату</option>
                  </select>
                  {cbrApply === "custom" && (
                    <input type="date" value={cbrCustomDate} onChange={e => setCbrCustomDate(e.target.value)} className={inp + " mt-2"} />
                  )}
                </div>
              </div>
            )}

            {/* Ограничение */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setCapEnabled(v => !v)}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${capEnabled ? "border-navy-600 bg-navy-600" : "border-slate-300"}`}>
                  {capEnabled && <Icon name="Check" size={10} className="text-white" />}
                </div>
                <span className="text-xs font-medium text-navy-700">Ограничение суммы неустойки</span>
              </label>
              {capEnabled && (
                <div className="flex gap-2 items-center">
                  <input value={capValue} onChange={e => setCapValue(e.target.value)} placeholder={capType === "percent" ? "10" : "50000"} className={inp + " flex-1"} />
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0">
                    <button onClick={() => setCapType("percent")} className={`px-3 py-2 text-xs font-semibold transition-colors ${capType === "percent" ? "bg-navy-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>%</button>
                    <button onClick={() => setCapType("fixed")} className={`px-3 py-2 text-xs font-semibold transition-colors ${capType === "fixed" ? "bg-navy-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>₽</button>
                  </div>
                </div>
              )}
            </div>

            {/* Частичные оплаты и увеличения долга */}
            <div className="grid grid-cols-2 gap-2">
              {/* Частичные оплаты */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-navy-600 uppercase tracking-wide">Частичные оплаты</span>
                  <button onClick={addPartial} className="w-5 h-5 rounded-lg bg-navy-100 hover:bg-navy-200 flex items-center justify-center transition-colors">
                    <Icon name="Plus" size={10} className="text-navy-700" />
                  </button>
                </div>
                {partials.length === 0
                  ? <p className="text-[10px] text-slate-400 italic">Нажмите +</p>
                  : partials.map(p => (
                    <div key={p.id} className="mb-2 space-y-1">
                      <input type="date" value={p.date} onChange={e => updatePartial(p.id, "date", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none focus:border-navy-300" />
                      <div className="flex gap-1">
                        <input value={p.amount} onChange={e => updatePartial(p.id, "amount", e.target.value)} placeholder="Сумма ₽" className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none focus:border-navy-300" />
                        <button onClick={() => removePartial(p.id)} className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors">
                          <Icon name="X" size={10} />
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>
              {/* Увеличения долга */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-navy-600 uppercase tracking-wide">Увеличение долга</span>
                  <button onClick={addIncrease} className="w-5 h-5 rounded-lg bg-navy-100 hover:bg-navy-200 flex items-center justify-center transition-colors">
                    <Icon name="Plus" size={10} className="text-navy-700" />
                  </button>
                </div>
                {increases.length === 0
                  ? <p className="text-[10px] text-slate-400 italic">Нажмите +</p>
                  : increases.map(p => (
                    <div key={p.id} className="mb-2 space-y-1">
                      <input type="date" value={p.date} onChange={e => updateIncrease(p.id, "date", e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none focus:border-navy-300" />
                      <div className="flex gap-1">
                        <input value={p.amount} onChange={e => updateIncrease(p.id, "amount", e.target.value)} placeholder="Сумма ₽" className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] bg-white outline-none focus:border-navy-300" />
                        <button onClick={() => removeIncrease(p.id)} className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors">
                          <Icon name="X" size={10} />
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                <Icon name="AlertCircle" size={13} className="shrink-0" />
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
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all shadow-md active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Icon name="Loader" size={14} className="animate-spin" />Считаем...</>
              : <><Icon name="Calculator" size={14} />Рассчитать · 1 вопрос</>
            }
          </button>
        </div>
      )}
    </div>
  );
}