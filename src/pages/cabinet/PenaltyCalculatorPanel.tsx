import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

interface DebtChange {
  id: number;
  date: string;
  amount: string;
  type: "payment" | "increase";
}

interface PeriodRow {
  from: string;
  to: string;
  debt: number;
  days: number;
  rate: number;
  penalty: number;
}

interface CalcResult {
  total: number;
  capped: number | null;
  capApplied: boolean;
  periods: PeriodRow[];
}

type CalcMode = "percent" | "cbr" | "fixed";
type CapMode = "amount" | "percent";

function numToWords(n: number): string {
  const r = Math.round(n * 100) / 100;
  const rub = Math.floor(r);
  const kop = Math.round((r - rub) * 100);
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  const say = (n: number, fem: boolean): string => {
    if (n === 0) return "";
    let s = "";
    if (n >= 100) { s += hundreds[Math.floor(n / 100)] + " "; n %= 100; }
    if (n >= 10 && n < 20) { s += teens[n - 10] + " "; return s; }
    if (n >= 20) { s += tens[Math.floor(n / 10)] + " "; n %= 10; }
    if (n > 0) {
      if (n === 1) s += (fem ? "одна" : "один") + " ";
      else if (n === 2) s += (fem ? "две" : "два") + " ";
      else s += ones[n] + " ";
    }
    return s;
  };

  const millions = Math.floor(rub / 1_000_000);
  const thousands = Math.floor((rub % 1_000_000) / 1_000);
  const rest = rub % 1_000;

  let result = "";
  if (millions > 0) {
    const w = say(millions, false);
    const m = millions % 10 === 1 && millions % 100 !== 11 ? "миллион" : millions % 10 >= 2 && millions % 10 <= 4 && (millions % 100 < 10 || millions % 100 >= 20) ? "миллиона" : "миллионов";
    result += w + m + " ";
  }
  if (thousands > 0) {
    const w = say(thousands, true);
    const t = thousands % 10 === 1 && thousands % 100 !== 11 ? "тысяча" : thousands % 10 >= 2 && thousands % 10 <= 4 && (thousands % 100 < 10 || thousands % 100 >= 20) ? "тысячи" : "тысяч";
    result += w + t + " ";
  }
  result += say(rest, false);

  const rubWord = rub % 10 === 1 && rub % 100 !== 11 ? "рубль" : rub % 10 >= 2 && rub % 10 <= 4 && (rub % 100 < 10 || rub % 100 >= 20) ? "рубля" : "рублей";
  result = (result.trim() || "ноль") + " " + rubWord;

  const kopWord = kop % 10 === 1 && kop % 100 !== 11 ? "копейка" : kop % 10 >= 2 && kop % 10 <= 4 && (kop % 100 < 10 || kop % 100 >= 20) ? "копейки" : "копеек";
  result += ` ${String(kop).padStart(2, "0")} ${kopWord}`;

  return result.trim();
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export default function PenaltyCalculatorPanel({ onClose, onSendToChat }: Props) {
  const [mode, setMode] = useState<CalcMode>("percent");
  const [debt, setDebt] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [ratePercent, setRatePercent] = useState("0.1");
  const [cbrRate, setCbrRate] = useState("16");
  const [cbrFraction, setCbrFraction] = useState("300");
  const [fixedDay, setFixedDay] = useState("");
  const [changes, setChanges] = useState<DebtChange[]>([]);
  const [capEnabled, setCapEnabled] = useState(false);
  const [capMode, setCapMode] = useState<CapMode>("amount");
  const [capAmount, setCapAmount] = useState("");
  const [capPercent, setCapPercent] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState("");
  const [nextId, setNextId] = useState(1);

  const addChange = () => {
    setChanges(p => [...p, { id: nextId, date: "", amount: "", type: "payment" }]);
    setNextId(n => n + 1);
  };

  const updateChange = (id: number, field: keyof DebtChange, value: string) => {
    setChanges(p => p.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeChange = (id: number) => setChanges(p => p.filter(c => c.id !== id));

  const calculate = useCallback(() => {
    setError("");
    setResult(null);

    const debtVal = parseFloat(debt.replace(/\s/g, "").replace(",", "."));
    if (!debtVal || debtVal <= 0) return setError("Укажите корректную сумму долга");
    if (!dateStart) return setError("Укажите дату начала просрочки");
    if (!dateEnd) return setError("Укажите дату окончания");
    if (dateEnd < dateStart) return setError("Дата окончания должна быть позже даты начала");

    // Собираем события изменения долга
    const events: { date: string; delta: number }[] = [];
    for (const ch of changes) {
      if (!ch.date || !ch.amount) continue;
      const amt = parseFloat(ch.amount.replace(/\s/g, "").replace(",", "."));
      if (!amt || amt <= 0) continue;
      if (ch.date < dateStart || ch.date > dateEnd) continue;
      events.push({ date: ch.date, delta: ch.type === "payment" ? -amt : amt });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

    // Разбиваем на интервалы
    const breakpoints = [dateStart, ...events.map(e => e.date), addDays(dateEnd, 1)];
    const unique = [...new Set(breakpoints)].sort();

    let currentDebt = debtVal;
    let evtIdx = 0;
    const periods: PeriodRow[] = [];
    let totalPenalty = 0;

    for (let i = 0; i < unique.length - 1; i++) {
      const from = unique[i];
      const to = unique[i + 1];

      // Применяем изменения долга на эту дату
      while (evtIdx < events.length && events[evtIdx].date === from) {
        currentDebt += events[evtIdx].delta;
        if (currentDebt < 0) currentDebt = 0;
        evtIdx++;
      }

      if (currentDebt <= 0) continue;
      const toInclusive = addDays(to, -1);
      if (toInclusive < dateStart) continue;

      const days = daysBetween(from, toInclusive);
      if (days <= 0) continue;

      let rate = 0;
      let penalty = 0;

      if (mode === "percent") {
        rate = parseFloat(ratePercent) || 0;
        penalty = (currentDebt * days * rate) / 100;
      } else if (mode === "cbr") {
        const cbr = parseFloat(cbrRate) || 0;
        const frac = parseFloat(cbrFraction) || 300;
        rate = cbr / frac;
        penalty = currentDebt * (cbr / 100) * (1 / frac) * days;
      } else {
        const fpd = parseFloat(fixedDay.replace(",", ".")) || 0;
        rate = fpd;
        penalty = fpd * days;
      }

      periods.push({ from, to: toInclusive, debt: currentDebt, days, rate, penalty });
      totalPenalty += penalty;
    }

    // Ограничение
    let capped: number | null = null;
    let capApplied = false;
    if (capEnabled) {
      let maxPenalty = Infinity;
      if (capMode === "amount") {
        maxPenalty = parseFloat(capAmount.replace(",", ".")) || Infinity;
      } else {
        const pct = parseFloat(capPercent.replace(",", ".")) || 0;
        maxPenalty = (debtVal * pct) / 100;
      }
      if (totalPenalty > maxPenalty) {
        capped = maxPenalty;
        capApplied = true;
      }
    }

    setResult({ total: totalPenalty, capped, capApplied, periods });
  }, [debt, dateStart, dateEnd, mode, ratePercent, cbrRate, cbrFraction, fixedDay, changes, capEnabled, capMode, capAmount, capPercent]);

  const sendToChat = () => {
    if (!result) return;
    const final = result.capApplied && result.capped !== null ? result.capped : result.total;
    let text = `📊 Расчёт неустойки:\n`;
    text += `• Период: ${dateStart} — ${dateEnd}\n`;
    text += `• Сумма долга: ${fmt(parseFloat(debt.replace(/\s/g, "").replace(",", ".") || "0"))} руб.\n`;
    if (mode === "percent") text += `• Ставка: ${ratePercent}% в день\n`;
    else if (mode === "cbr") text += `• Ставка: 1/${cbrFraction} от ключевой ставки ЦБ (${cbrRate}%)\n`;
    else text += `• Фикс. сумма: ${fixedDay} руб./день\n`;
    text += `• Итоговая неустойка: ${fmt(final)} руб. (${numToWords(final)})\n`;
    if (result.capApplied) text += `• Применено ограничение: расчётная сумма ${fmt(result.total)} руб.\n`;
    text += `\nПрокомментируй этот расчёт неустойки с точки зрения российского права и подскажи, правильно ли он сделан.`;
    onSendToChat(text);
    onClose();
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400";
  const labelCls = "text-xs font-semibold text-slate-600 mb-1 block";

  return (
    <div className="flex flex-col h-full bg-slate-50" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)" }}>
            <Icon name="Calculator" size={15} color="#fff" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Калькулятор неустойки</p>
            <p className="text-[10px] text-slate-400">по ГК РФ · справочный расчёт</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <Icon name="X" size={14} />
        </button>
      </div>

      {/* Тело — скролл */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Режим расчёта */}
        <div>
          <label className={labelCls}>Тип неустойки</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { v: "percent", label: "% в день" },
              { v: "cbr", label: "Доля ставки ЦБ" },
              { v: "fixed", label: "Фикс. сумма/день" },
            ] as { v: CalcMode; label: string }[]).map(({ v, label }) => (
              <button key={v} onClick={() => setMode(v)}
                className="py-2 px-1 rounded-xl text-xs font-semibold border transition-all"
                style={mode === v
                  ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff", border: "1.5px solid #0f4c81" }
                  : { background: "#fff", color: "#475569", border: "1.5px solid #e2e8f0" }
                }>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Сумма долга */}
        <div>
          <label className={labelCls}>Сумма долга (руб.)</label>
          <input className={inputCls} placeholder="100 000" value={debt}
            onChange={e => setDebt(e.target.value)} />
        </div>

        {/* Период */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Начало просрочки</label>
            <input type="date" className={inputCls} value={dateStart}
              onChange={e => setDateStart(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Окончание (включ.)</label>
            <input type="date" className={inputCls} value={dateEnd}
              onChange={e => setDateEnd(e.target.value)} />
          </div>
        </div>

        {/* Параметры ставки */}
        {mode === "percent" && (
          <div>
            <label className={labelCls}>Ставка неустойки (% в день)</label>
            <input className={inputCls} placeholder="0.1" value={ratePercent}
              onChange={e => setRatePercent(e.target.value)} />
          </div>
        )}
        {mode === "cbr" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ключевая ставка ЦБ (%)</label>
              <input className={inputCls} placeholder="16" value={cbrRate}
                onChange={e => setCbrRate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Знаменатель (1/N)</label>
              <select className={inputCls} value={cbrFraction}
                onChange={e => setCbrFraction(e.target.value)}>
                <option value="300">1/300</option>
                <option value="150">1/150</option>
                <option value="130">1/130</option>
                <option value="360">1/360</option>
                <option value="365">1/365</option>
              </select>
            </div>
          </div>
        )}
        {mode === "fixed" && (
          <div>
            <label className={labelCls}>Фиксированная сумма (руб./день)</label>
            <input className={inputCls} placeholder="100" value={fixedDay}
              onChange={e => setFixedDay(e.target.value)} />
          </div>
        )}

        {/* Изменения долга */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Изменения долга</label>
            <button onClick={addChange}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              <Icon name="Plus" size={12} />Добавить
            </button>
          </div>
          {changes.length === 0 && (
            <p className="text-xs text-slate-400 py-2 text-center border border-dashed border-slate-200 rounded-xl">
              Нет изменений — долг постоянный
            </p>
          )}
          <div className="space-y-2">
            {changes.map(ch => (
              <div key={ch.id} className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl">
                <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 w-32 shrink-0"
                  value={ch.date} onChange={e => updateChange(ch.id, "date", e.target.value)} />
                <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 shrink-0"
                  value={ch.type} onChange={e => updateChange(ch.id, "type", e.target.value as "payment" | "increase")}>
                  <option value="payment">Оплата</option>
                  <option value="increase">Увеличение</option>
                </select>
                <input className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 min-w-0"
                  placeholder="Сумма" value={ch.amount}
                  onChange={e => updateChange(ch.id, "amount", e.target.value)} />
                <button onClick={() => removeChange(ch.id)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                  <Icon name="X" size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ограничение */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={capEnabled} onChange={e => setCapEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-xs font-semibold text-slate-700">Ограничить неустойку</span>
          </label>
          {capEnabled && (
            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                {(["amount", "percent"] as CapMode[]).map(m => (
                  <button key={m} onClick={() => setCapMode(m)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    style={capMode === m
                      ? { background: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #93c5fd" }
                      : { background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0" }
                    }>
                    {m === "amount" ? "Макс. сумма (руб.)" : "Макс. % от долга"}
                  </button>
                ))}
              </div>
              {capMode === "amount"
                ? <input className={inputCls} placeholder="Например: 50000" value={capAmount} onChange={e => setCapAmount(e.target.value)} />
                : <input className={inputCls} placeholder="Например: 10" value={capPercent} onChange={e => setCapPercent(e.target.value)} />
              }
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <Icon name="AlertCircle" size={13} color="#ef4444" />{error}
          </div>
        )}

        {/* Кнопка рассчитать */}
        <button onClick={calculate}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] shadow-sm"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          Рассчитать
        </button>

        {/* Результат */}
        {result && (
          <div className="space-y-3">
            {/* Главная сумма */}
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <p className="text-xs text-blue-200 mb-1">Итоговая неустойка</p>
              <p className="text-2xl font-black text-white leading-tight">
                {fmt(result.capApplied && result.capped !== null ? result.capped : result.total)} ₽
              </p>
              <p className="text-[11px] text-blue-200 mt-1 leading-snug">
                {numToWords(result.capApplied && result.capped !== null ? result.capped : result.total)}
              </p>
              {result.capApplied && (
                <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-200 text-[11px] font-medium">
                  Ограничено · расчётная сумма: {fmt(result.total)} ₽
                </div>
              )}
            </div>

            {/* Таблица периодов */}
            {result.periods.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-700">Детализация по периодам</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Период</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500">Долг, ₽</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500">Дн.</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500">Пени, ₽</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.periods.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.from.slice(5)} — {p.to.slice(5)}</td>
                          <td className="px-3 py-2 text-right text-slate-700 font-medium">{fmt(p.debt)}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{p.days}</td>
                          <td className="px-3 py-2 text-right font-bold text-blue-700">{fmt(p.penalty)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={3} className="px-3 py-2 text-xs font-bold text-slate-700">Итого</td>
                        <td className="px-3 py-2 text-right text-sm font-black text-blue-800">{fmt(result.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Предупреждение */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <Icon name="Info" size={13} color="#d97706" className="shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-snug">
                Расчёт справочный, не является юридическим заключением. Для официального использования рекомендуется консультация юриста.
              </p>
            </div>

            {/* Кнопка отправить в чат */}
            <button onClick={sendToChat}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: "rgba(15,76,129,0.07)", color: "#0f4c81", border: "1.5px solid rgba(15,76,129,0.2)" }}>
              <Icon name="Send" size={14} color="#0f4c81" />
              Отправить результат в чат AI-юристу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
