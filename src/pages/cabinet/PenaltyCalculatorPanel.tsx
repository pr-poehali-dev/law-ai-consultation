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
    text += `\nУчти этот расчёт неустойки в своих ответах. Помоги мне: проверь корректность применённой ставки и формулы по нормам ГК РФ, и подскажи — как использовать эту сумму при составлении претензии или искового заявления.`;
    onSendToChat(text);
    onClose();
  };

  const inp = "w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 transition-all placeholder:text-slate-400";

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)" }}>
            <Icon name="Calculator" size={12} color="#fff" />
          </div>
          <p className="text-xs font-bold text-slate-800">Калькулятор неустойки</p>
          <span className="text-[10px] text-slate-400">· по ГК РФ</span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>тестовый режим</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Скроллируемое тело */}
      <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "calc(68dvh - 44px)" }}>

        {/* Тип + основные поля в одной строке */}
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { v: "percent", label: "% в день" },
            { v: "cbr", label: "Ставка ЦБ" },
            { v: "fixed", label: "Фикс./день" },
          ] as { v: CalcMode; label: string }[]).map(({ v, label }) => (
            <button key={v} onClick={() => setMode(v)}
              className="py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={mode === v
                ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff", border: "1.5px solid #0f4c81" }
                : { background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0" }
              }>
              {label}
            </button>
          ))}
        </div>

        {/* Сумма + период в строку */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Долг, ₽</p>
            <input className={inp} placeholder="100 000" value={debt} onChange={e => setDebt(e.target.value)} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Начало</p>
            <input type="date" className={inp} value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Конец</p>
            <input type="date" className={inp} value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
        </div>

        {/* Параметры ставки — компактно */}
        {mode === "percent" && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Ставка (% в день)</p>
            <input className={inp} placeholder="0.1" value={ratePercent} onChange={e => setRatePercent(e.target.value)} />
          </div>
        )}
        {mode === "cbr" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 mb-1">Ключевая ставка (%)</p>
              <input className={inp} placeholder="16" value={cbrRate} onChange={e => setCbrRate(e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 mb-1">Доля</p>
              <select className={inp} value={cbrFraction} onChange={e => setCbrFraction(e.target.value)}>
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
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Сумма в день (₽)</p>
            <input className={inp} placeholder="100" value={fixedDay} onChange={e => setFixedDay(e.target.value)} />
          </div>
        )}

        {/* Частичные оплаты */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-slate-500">Изменения долга</p>
            <button onClick={addChange} className="flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
              <Icon name="Plus" size={11} />Добавить
            </button>
          </div>
          {changes.length === 0 && (
            <p className="text-[10px] text-slate-400 text-center py-1.5 border border-dashed border-slate-200 rounded-lg">
              Долг постоянный
            </p>
          )}
          <div className="space-y-1.5">
            {changes.map(ch => (
              <div key={ch.id} className="flex items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <input type="date" className="text-[11px] border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-blue-400 w-28 shrink-0 bg-white"
                  value={ch.date} onChange={e => updateChange(ch.id, "date", e.target.value)} />
                <select className="text-[11px] border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-blue-400 shrink-0 bg-white"
                  value={ch.type} onChange={e => updateChange(ch.id, "type", e.target.value as "payment" | "increase")}>
                  <option value="payment">Оплата</option>
                  <option value="increase">Увеличение</option>
                </select>
                <input className="flex-1 text-[11px] border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-blue-400 min-w-0 bg-white"
                  placeholder="Сумма" value={ch.amount} onChange={e => updateChange(ch.id, "amount", e.target.value)} />
                <button onClick={() => removeChange(ch.id)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                  <Icon name="X" size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ограничение — коллапсируемое */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-slate-50">
            <input type="checkbox" checked={capEnabled} onChange={e => setCapEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
            <span className="text-[11px] font-semibold text-slate-600">Ограничить неустойку</span>
          </label>
          {capEnabled && (
            <div className="px-3 py-2 space-y-2 bg-white">
              <div className="flex gap-1.5">
                {(["amount", "percent"] as CapMode[]).map(m => (
                  <button key={m} onClick={() => setCapMode(m)}
                    className="flex-1 py-1 rounded-md text-[11px] font-semibold border transition-all"
                    style={capMode === m ? { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd" } : { background: "#fff", color: "#64748b", border: "1px solid #e2e8f0" }}>
                    {m === "amount" ? "Макс. руб." : "Макс. %"}
                  </button>
                ))}
              </div>
              <input className={inp} placeholder={capMode === "amount" ? "50 000" : "10"} value={capMode === "amount" ? capAmount : capPercent} onChange={e => capMode === "amount" ? setCapAmount(e.target.value) : setCapPercent(e.target.value)} />
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
            <Icon name="AlertCircle" size={12} color="#ef4444" />{error}
          </div>
        )}

        {/* Кнопка */}
        <button onClick={calculate}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          Рассчитать
        </button>

        {/* Результат */}
        {result && (
          <div className="space-y-2">
            <div className="rounded-xl px-4 py-3 text-center"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <p className="text-[10px] text-blue-200 mb-0.5">Итоговая неустойка</p>
              <p className="text-xl font-black text-white leading-tight">
                {fmt(result.capApplied && result.capped !== null ? result.capped : result.total)} ₽
              </p>
              <p className="text-[10px] text-blue-200 mt-0.5 leading-tight">
                {numToWords(result.capApplied && result.capped !== null ? result.capped : result.total)}
              </p>
              {result.capApplied && (
                <p className="mt-1.5 text-[10px] text-amber-300">
                  Ограничено · расчётная: {fmt(result.total)} ₽
                </p>
              )}
            </div>

            {result.periods.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <p className="text-[10px] font-bold text-slate-600 px-3 py-1.5 border-b border-slate-100">Детализация</p>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontSize: "11px" }}>
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-2.5 py-1.5 text-left font-semibold">Период</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Долг</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Дн.</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Пени</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.periods.map((p, i) => (
                        <tr key={i} className="border-t border-slate-50">
                          <td className="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">{p.from.slice(5)} – {p.to.slice(5)}</td>
                          <td className="px-2.5 py-1.5 text-right text-slate-700">{fmt(p.debt)}</td>
                          <td className="px-2.5 py-1.5 text-right text-slate-500">{p.days}</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-blue-700">{fmt(p.penalty)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-100">
                        <td colSpan={3} className="px-2.5 py-1.5 font-bold text-slate-700">Итого</td>
                        <td className="px-2.5 py-1.5 text-right font-black text-blue-800">{fmt(result.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-400 text-center">Справочный расчёт · не юридическое заключение</p>

            <button onClick={sendToChat}
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
              style={{ background: "rgba(15,76,129,0.07)", color: "#0f4c81", border: "1.5px solid rgba(15,76,129,0.2)" }}>
              <Icon name="Send" size={12} color="#0f4c81" />
              Отправить в чат AI-юристу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}