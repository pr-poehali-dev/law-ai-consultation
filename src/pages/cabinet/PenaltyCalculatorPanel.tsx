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
  const [detailMode, setDetailMode] = useState<"periods" | "days">("periods");
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

  const getRateDisplay = () => {
    if (mode === "percent") return `${ratePercent}% в день`;
    if (mode === "cbr") return `1/${cbrFraction} × ${cbrRate}% (ЦБ РФ) = ${(parseFloat(cbrRate) / parseFloat(cbrFraction)).toFixed(4)}% в день`;
    return `${fixedDay} ₽/день (фиксированная)`;
  };

  const getFormula = () => {
    if (mode === "percent") return `сумма долга × ${ratePercent}% × количество дней / 100`;
    if (mode === "cbr") return `сумма долга × (${cbrRate}% / 100) × (1 / ${cbrFraction}) × количество дней`;
    return `${fixedDay} ₽ × количество дней`;
  };

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}`;
  };

  const getDayName = (d: string) => {
    const days = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
    return days[new Date(d).getDay()];
  };

  const buildBody = (kind: "periods" | "days") => {
    if (!result) return "";
    const final = result.capApplied && result.capped !== null ? result.capped : result.total;
    const debtVal = parseFloat(debt.replace(/\s/g, "").replace(",", ".") || "0");
    const totalDays = result.periods.reduce((s, p) => s + p.days, 0);
    const rateD = mode === "percent" ? `${ratePercent}%` : mode === "cbr"
      ? `${(parseFloat(cbrRate)/parseFloat(cbrFraction)).toFixed(4)}%`
      : `${fixedDay} ₽`;

    let t = `РАСЧЁТ НЕУСТОЙКИ\n`;
    t += `${"─".repeat(50)}\n`;
    t += `Сумма неустойки: ${fmt(final)} руб.\n`;
    t += `Сумма долга и неустойки: ${fmt(debtVal + final)} руб.\n`;
    t += `(по состоянию на ${fmtDate(dateEnd)})\n`;
    t += `${"─".repeat(50)}\n`;
    t += `Ставка по договору: ${getRateDisplay()}\n`;
    t += `Долг на дату начала начисления (${fmtDate(dateStart)}): ${fmt(debtVal)} руб.\n`;
    t += `Период начисления: ${fmtDate(dateStart)} – ${fmtDate(dateEnd)} (${totalDays} дней)\n`;
    if (result.capApplied) t += `Ограничение: расчётная сумма ${fmt(result.total)} руб., применено ограничение до ${fmt(final)} руб.\n`;
    t += `\n`;

    if (kind === "periods") {
      t += `период | дней | формула | неустойка\n`;
      for (const p of result.periods) {
        const formulaStr = mode === "percent"
          ? `${fmt(p.debt)} × ${ratePercent}% × ${p.days}`
          : mode === "cbr"
            ? `${fmt(p.debt)} × ${(parseFloat(cbrRate)/parseFloat(cbrFraction)).toFixed(4)}% × ${p.days}`
            : `${fixedDay} ₽ × ${p.days}`;
        t += `${fmtDate(p.from)} – ${fmtDate(p.to)} | ${p.days} | ${formulaStr} | ${fmt(p.penalty)}\n`;
      }
    } else {
      t += `дата | долг (₽) | ставка | за день (₽) | накоплено (₽)\n`;
      let acc = 0;
      for (const p of result.periods) {
        const dayPenalty = p.penalty / p.days;
        for (let d = 0; d < p.days; d++) {
          const date = addDays(p.from, d);
          acc += dayPenalty;
          t += `${fmtDate(date)} | ${fmt(p.debt)} | ${rateD} | ${fmt(dayPenalty)} | ${fmt(acc)}\n`;
        }
      }
    }

    t += `\nСумма неустойки: ${fmt(final)} руб.\n`;
    t += `Сумма основного долга: ${fmt(debtVal)} руб.\n`;
    t += `\nПорядок расчёта\n${getFormula()}\n`;

    // Примечание по ст. 193 ГК РФ для расчёта по дням
    if (kind === "days") {
      const startDate = new Date(dateStart);
      const dayName = getDayName(dateStart);
      const isWeekend = startDate.getDay() === 0 || startDate.getDay() === 6;
      if (isWeekend) {
        const prevDay = new Date(startDate);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevStr = prevDay.toISOString().slice(0, 10);
        // следующий рабочий после prevDay
        const nextWork = new Date(startDate);
        while (nextWork.getDay() === 0 || nextWork.getDay() === 6) nextWork.setDate(nextWork.getDate() + 1);
        const nextWorkStr = nextWork.toISOString().slice(0, 10);
        const firstProsr = new Date(nextWork);
        firstProsr.setDate(firstProsr.getDate() + 1);
        t += `\n⚠ Примечание: ${fmtDate(dateStart)} (${dayName}) указано как первый день начисления неустойки. `;
        t += `Если неустойка рассчитывается с первого дня просрочки, то последним днём оплаты определено ${fmtDate(prevStr)} (${getDayName(prevStr)}). `;
        t += `По правилам ст. 193 ГК РФ днём оплаты считается ближайший рабочий день — ${fmtDate(nextWorkStr)}, `;
        t += `а первым днём просрочки — ${fmtDate(firstProsr.toISOString().slice(0, 10))}.\n`;
      }
    }

    return t;
  };

  const [copied, setCopied] = useState<"periods" | "days" | null>(null);

  const copyText = async (kind: "periods" | "days") => {
    const text = buildBody(kind);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(kind);
      setTimeout(() => setCopied(null), 2500);
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  const sendToChat = (_kind: "periods" | "days") => {
    if (!result) return;
    const debtVal = parseFloat(debt.replace(/\s/g, "").replace(",", ".") || "0");
    const startDow = new Date(dateStart).getDay();
    const data = {
      mode, debt: debtVal, dateStart, dateEnd,
      ratePercent, cbrRate, cbrFraction, fixedDay,
      total: result.total, capped: result.capped, capApplied: result.capApplied,
      periods: result.periods,
      art193: startDow === 0 || startDow === 6,
    };
    onSendToChat(`__PENALTY_DATA__:${JSON.stringify(data)}`);
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

        {/* Примечание ст. 193 ГК РФ — если начало на выходном */}
        {dateStart && (() => {
          const d = new Date(dateStart);
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) return null;
          const dayName = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][dow];
          const prev = new Date(d); prev.setDate(prev.getDate() - 1);
          const prevStr = `${String(prev.getDate()).padStart(2,"0")}.${String(prev.getMonth()+1).padStart(2,"0")}.${prev.getFullYear()}`;
          const prevDay = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][prev.getDay()];
          const nw = new Date(d);
          while (nw.getDay() === 0 || nw.getDay() === 6) nw.setDate(nw.getDate() + 1);
          const nwStr = `${String(nw.getDate()).padStart(2,"0")}.${String(nw.getMonth()+1).padStart(2,"0")}.${nw.getFullYear()}`;
          const fp = new Date(nw); fp.setDate(fp.getDate() + 1);
          const fpStr = `${String(fp.getDate()).padStart(2,"0")}.${String(fp.getMonth()+1).padStart(2,"0")}.${fp.getFullYear()}`;
          const startStr = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
          return (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <Icon name="AlertTriangle" size={12} color="#d97706" className="shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-snug">
                <strong>{startStr} ({dayName})</strong> — выходной день. По ст. 193 ГК РФ последним
                днём оплаты считается <strong>{prevStr} ({prevDay})</strong>, ближайший рабочий
                день — <strong>{nwStr}</strong>, первый день просрочки — <strong>{fpStr}</strong>.
              </p>
            </div>
          );
        })()}

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

            {result.periods.length > 0 && (() => {
              // Генерируем строки по дням из периодов
              const dayRows: { date: string; debt: number; penalty: number; accumulated: number }[] = [];
              let acc = 0;
              for (const p of result.periods) {
                for (let d = 0; d < p.days; d++) {
                  const date = addDays(p.from, d);
                  const dayPenalty = p.penalty / p.days;
                  acc += dayPenalty;
                  dayRows.push({ date, debt: p.debt, penalty: dayPenalty, accumulated: acc });
                }
              }

              // Формула и ставка для отображения
              const rateLabel = mode === "percent"
                ? `${ratePercent}% в день`
                : mode === "cbr"
                  ? `1/${cbrFraction} × ${cbrRate}% ЦБ = ${(parseFloat(cbrRate) / parseFloat(cbrFraction)).toFixed(4)}% в день`
                  : `${fixedDay} ₽/день (фиксировано)`;

              const formulaLabel = mode === "percent"
                ? `Долг × ${ratePercent}% × Дней ÷ 100`
                : mode === "cbr"
                  ? `Долг × (${cbrRate}% ÷ 100) × (1 ÷ ${cbrFraction}) × Дней`
                  : `${fixedDay} ₽ × Дней`;

              return (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Параметры расчёта */}
                  <div className="px-3 py-2.5 border-b border-slate-100 space-y-1.5"
                    style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.04),rgba(26,107,181,0.02))" }}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Формула</p>
                        <p className="text-[11px] font-semibold text-navy-700">{formulaLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ставка</p>
                        <p className="text-[11px] font-semibold text-blue-700">{rateLabel}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Начало</p>
                        <p className="text-[11px] font-medium text-slate-700">{dateStart}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Конец (включ.)</p>
                        <p className="text-[11px] font-medium text-slate-700">{dateEnd}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Всего дней</p>
                        <p className="text-[11px] font-bold text-blue-700">{dayRows.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Шапка с переключателем */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-600">Детализация</p>
                    <div className="flex gap-1">
                      {([["periods", "По периодам"], ["days", "По дням"]] as const).map(([v, label]) => (
                        <button key={v} onClick={() => setDetailMode(v)}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all"
                          style={detailMode === v
                            ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff" }
                            : { background: "transparent", color: "#94a3b8" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Таблица */}
                  <div className="overflow-auto" style={{ maxHeight: "220px" }}>
                    {detailMode === "periods" ? (
                      <table className="w-full" style={{ fontSize: "11px" }}>
                        <thead className="sticky top-0 bg-white z-10">
                          <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Период</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Долг, ₽</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Ставка</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Дн.</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Пени, ₽</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.periods.map((p, i) => {
                            const rateDisplay = mode === "percent"
                              ? `${ratePercent}%`
                              : mode === "cbr"
                                ? `${(parseFloat(cbrRate) / parseFloat(cbrFraction)).toFixed(4)}%`
                                : `${fixedDay}₽`;
                            return (
                              <tr key={i} style={{ borderTop: "1px solid #f8fafc" }}>
                                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.from.slice(5)} – {p.to.slice(5)}</td>
                                <td className="px-2 py-1.5 text-right text-slate-700">{fmt(p.debt)}</td>
                                <td className="px-2 py-1.5 text-right text-amber-600 font-semibold">{rateDisplay}</td>
                                <td className="px-2 py-1.5 text-right text-slate-500">{p.days}</td>
                                <td className="px-2 py-1.5 text-right font-bold text-blue-700">{fmt(p.penalty)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50" style={{ borderTop: "1px solid #e2e8f0" }}>
                            <td colSpan={4} className="px-2 py-1.5 font-bold text-slate-700">Итого</td>
                            <td className="px-2 py-1.5 text-right font-black text-blue-800">{fmt(result.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <table className="w-full" style={{ fontSize: "11px" }}>
                        <thead className="sticky top-0 bg-white z-10">
                          <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Дата</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Долг, ₽</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Ставка</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">За день, ₽</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Итого, ₽</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayRows.map((row, i) => {
                            const rateDisplay = mode === "percent"
                              ? `${ratePercent}%`
                              : mode === "cbr"
                                ? `${(parseFloat(cbrRate) / parseFloat(cbrFraction)).toFixed(4)}%`
                                : `${fixedDay}₽`;
                            return (
                              <tr key={i} style={{ borderTop: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                                <td className="px-2 py-1 text-slate-600 whitespace-nowrap font-medium">{row.date.slice(5)}</td>
                                <td className="px-2 py-1 text-right text-slate-600">{fmt(row.debt)}</td>
                                <td className="px-2 py-1 text-right text-amber-600 font-semibold">{rateDisplay}</td>
                                <td className="px-2 py-1 text-right text-blue-600 font-semibold">{fmt(row.penalty)}</td>
                                <td className="px-2 py-1 text-right text-slate-700 font-bold">{fmt(row.accumulated)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50" style={{ borderTop: "1px solid #e2e8f0" }}>
                            <td colSpan={4} className="px-2 py-1.5 font-bold text-slate-700">Итого ({dayRows.length} дней)</td>
                            <td className="px-2 py-1.5 text-right font-black text-blue-800">{fmt(result.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}

            <p className="text-[10px] text-slate-400 text-center">Справочный расчёт · не юридическое заключение</p>

            {/* Действия */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center">Использовать расчёт</p>

              {/* Карточка — По периодам */}
              <div className="rounded-2xl overflow-hidden border border-slate-100">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                    <Icon name="BarChart2" size={11} color="#3b82f6" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-700">По периодам</p>
                  <span className="text-[10px] text-slate-400 ml-auto">{result.periods.length} периодов</span>
                </div>
                <div className="flex divide-x divide-slate-100">
                  <button onClick={() => sendToChat("periods")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all active:scale-[0.97] hover:bg-blue-50"
                    style={{ color: "#0f4c81" }}>
                    <Icon name="Send" size={12} color="#0f4c81" />
                    Отправить в чат
                  </button>
                  <button onClick={() => copyText("periods")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all active:scale-[0.97] hover:bg-emerald-50"
                    style={{ color: copied === "periods" ? "#059669" : "#64748b" }}>
                    <Icon name={copied === "periods" ? "CheckCheck" : "Copy"} size={12} color={copied === "periods" ? "#059669" : "#64748b"} />
                    {copied === "periods" ? "Скопировано!" : "Скопировать"}
                  </button>
                </div>
              </div>

              {/* Карточка — По дням */}
              <div className="rounded-2xl overflow-hidden border border-slate-100">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                    <Icon name="Calendar" size={11} color="#7c3aed" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-700">По дням</p>
                  <span className="text-[10px] text-slate-400 ml-auto">
                    {result.periods.reduce((s, p) => s + p.days, 0)} дней
                  </span>
                </div>
                <div className="flex divide-x divide-slate-100">
                  <button onClick={() => sendToChat("days")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all active:scale-[0.97] hover:bg-blue-50"
                    style={{ color: "#0f4c81" }}>
                    <Icon name="Send" size={12} color="#0f4c81" />
                    Отправить в чат
                  </button>
                  <button onClick={() => copyText("days")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all active:scale-[0.97] hover:bg-emerald-50"
                    style={{ color: copied === "days" ? "#059669" : "#64748b" }}>
                    <Icon name={copied === "days" ? "CheckCheck" : "Copy"} size={12} color={copied === "days" ? "#059669" : "#64748b"} />
                    {copied === "days" ? "Скопировано!" : "Скопировать"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}