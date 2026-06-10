import { useState } from "react";
import Icon from "@/components/ui/icon";

export interface PenaltyData {
  mode: "percent" | "cbr" | "fixed";
  debt: number;
  dateStart: string;
  dateEnd: string;
  ratePercent?: string;
  cbrRate?: string;
  cbrFraction?: string;
  fixedDay?: string;
  total: number;
  capped: number | null;
  capApplied: boolean;
  periods: { from: string; to: string; debt: number; days: number; penalty: number }[];
  art193: boolean; // применяется ли примечание по ст. 193 ГК
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDayName(iso: string) {
  return ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][new Date(iso).getDay()];
}

interface Props {
  data: PenaltyData;
  onSendToChat: (text: string) => void;
}

export default function PenaltyResultMessage({ data, onSendToChat }: Props) {
  const [view, setView] = useState<"periods" | "days">("periods");
  const [art193, setArt193] = useState(data.art193);
  const [copied, setCopied] = useState(false);

  const final = data.capApplied && data.capped !== null ? data.capped : data.total;
  const totalDays = data.periods.reduce((s, p) => s + p.days, 0);

  // Ставка в читаемом виде
  const rateLabel = data.mode === "percent"
    ? `${data.ratePercent}% в день`
    : data.mode === "cbr"
      ? `1/${data.cbrFraction} × ${data.cbrRate}% ЦБ РФ = ${(parseFloat(data.cbrRate!)/parseFloat(data.cbrFraction!)).toFixed(4)}% в день`
      : `${data.fixedDay} ₽/день (фиксированная)`;

  const formulaLabel = data.mode === "percent"
    ? `сумма долга × ${data.ratePercent}% × количество дней / 100`
    : data.mode === "cbr"
      ? `сумма долга × (${data.cbrRate}% / 100) × (1 / ${data.cbrFraction}) × количество дней`
      : `${data.fixedDay} ₽ × количество дней`;

  // Примечание ст. 193
  const startDow = new Date(data.dateStart).getDay();
  const isWeekendStart = startDow === 0 || startDow === 6;
  const art193Note = (() => {
    if (!isWeekendStart) return null;
    const prev = new Date(data.dateStart); prev.setDate(prev.getDate() - 1);
    const prevIso = prev.toISOString().slice(0, 10);
    const nw = new Date(data.dateStart);
    while (nw.getDay() === 0 || nw.getDay() === 6) nw.setDate(nw.getDate() + 1);
    const nwIso = nw.toISOString().slice(0, 10);
    const fp = new Date(nw); fp.setDate(fp.getDate() + 1);
    const fpIso = fp.toISOString().slice(0, 10);
    return { prevIso, nwIso, fpIso };
  })();

  // Строки для таблицы по дням
  const dayRows = (() => {
    const rows: { date: string; debt: number; penalty: number; acc: number }[] = [];
    let acc = 0;
    for (const p of data.periods) {
      const dayP = p.penalty / p.days;
      for (let d = 0; d < p.days; d++) {
        acc += dayP;
        rows.push({ date: addDays(p.from, d), debt: p.debt, penalty: dayP, acc });
      }
    }
    return rows;
  })();

  const rateD = data.mode === "percent" ? `${data.ratePercent}%`
    : data.mode === "cbr" ? `${(parseFloat(data.cbrRate!)/parseFloat(data.cbrFraction!)).toFixed(4)}%`
    : `${data.fixedDay}₽`;

  const handleCopy = async () => {
    let text = `РАСЧЁТ НЕУСТОЙКИ\n${"─".repeat(46)}\n`;
    text += `Сумма неустойки: ${fmt(final)} руб.\n`;
    text += `Долг + неустойка: ${fmt(data.debt + final)} руб. (на ${fmtDate(data.dateEnd)})\n`;
    text += `Период: ${fmtDate(data.dateStart)} – ${fmtDate(data.dateEnd)} (${totalDays} дней)\n`;
    text += `Ставка: ${rateLabel}\n`;
    text += `Долг: ${fmt(data.debt)} руб.\n\n`;
    if (view === "periods") {
      text += `период | дней | формула | неустойка\n`;
      for (const p of data.periods) {
        const f = data.mode === "percent" ? `${fmt(p.debt)} × ${data.ratePercent}% × ${p.days}`
          : data.mode === "cbr" ? `${fmt(p.debt)} × ${rateD} × ${p.days}`
          : `${data.fixedDay} × ${p.days}`;
        text += `${fmtDate(p.from)} – ${fmtDate(p.to)} | ${p.days} | ${f} | ${fmt(p.penalty)}\n`;
      }
    } else {
      text += `дата | долг | ставка | за день | накоплено\n`;
      for (const r of dayRows) {
        text += `${fmtDate(r.date)} | ${fmt(r.debt)} | ${rateD} | ${fmt(r.penalty)} | ${fmt(r.acc)}\n`;
      }
    }
    text += `\nПорядок расчёта: ${formulaLabel}\n`;
    if (art193 && art193Note) {
      text += `\n⚠ Ст. 193 ГК РФ: последний день оплаты ${fmtDate(art193Note.prevIso)} (${getDayName(art193Note.prevIso)}), рабочий день — ${fmtDate(art193Note.nwIso)}, первый день просрочки — ${fmtDate(art193Note.fpIso)}\n`;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else { const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.error("copy", e); }
  };

  const handleDownloadDoc = () => {
    const tableRowsPeriods = data.periods.map((p, i) => {
      const formulaStr = data.mode === "percent"
        ? `${fmt(p.debt)} × ${data.ratePercent}% × ${p.days}`
        : data.mode === "cbr"
          ? `${fmt(p.debt)} × ${rateD} × ${p.days}`
          : `${data.fixedDay} × ${p.days}`;
      const bg = i === 0 ? "#fff3cd" : i % 2 === 0 ? "#f9f9f9" : "#ffffff";
      return `<tr style="background:${bg}">
        <td style="padding:8px;border:1px solid #dee2e6">${fmtDate(p.from)} – ${fmtDate(p.to)}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right">${fmt(p.debt)}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:center">${rateD}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right">${p.days}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right">${formulaStr}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-weight:bold;color:#1565c0">${fmt(p.penalty)}</td>
      </tr>`;
    }).join("");

    const tableRowsDays = dayRows.map((row, i) => {
      const bg = i === 0 ? "#fff3cd" : i % 2 === 0 ? "#f9f9f9" : "#ffffff";
      return `<tr style="background:${bg};font-weight:${i === 0 ? "bold" : "normal"}">
        <td style="padding:8px;border:1px solid #dee2e6">${fmtDate(row.date)}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right">${fmt(row.debt)}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:center">${rateD}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right;color:#1565c0;font-weight:bold">${fmt(row.penalty)}</td>
        <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-weight:bold">${fmt(row.acc)}</td>
      </tr>`;
    }).join("");

    const art193Block = (art193 && art193Note) ? `
      <div style="margin-top:16px;padding:12px 16px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px">
        <b>⚠ Ст. 193 ГК РФ</b><br/>
        ${fmtDate(data.dateStart)} (${getDayName(data.dateStart)}) — выходной.
        Последний день оплаты: <b>${fmtDate(art193Note.prevIso)}</b> (${getDayName(art193Note.prevIso)}).
        Рабочий день оплаты: <b>${fmtDate(art193Note.nwIso)}</b>.
        Первый день просрочки: <b>${fmtDate(art193Note.fpIso)}</b>.
      </div>` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:"Times New Roman",serif;font-size:12pt;color:#000;margin:2cm}
  h1{font-size:14pt;text-align:center;margin-bottom:20px}
  h2{font-size:12pt;margin-top:22px;margin-bottom:8px}
  .cards{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
  .card{border:1px solid #dee2e6;border-radius:4px;padding:10px 14px;min-width:160px}
  .cl{font-size:9pt;color:#6c757d;text-transform:uppercase;margin-bottom:3px}
  .cv{font-size:13pt;font-weight:bold;color:#0d2e5a}
  .row{margin:4px 0;font-size:11pt}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:10.5pt}
  thead tr{background:#2c3e50;color:#fff}
  thead th{padding:9px 8px;border:1px solid #2c3e50}
  tfoot td{padding:8px;border:1px solid #c3e6cb;font-weight:bold;color:#155724;background:#d4edda;border-top:2px solid #c3e6cb}
  .formula{margin-top:14px;font-size:10pt;color:#555}
  .disc{margin-top:22px;font-size:9pt;color:#999;font-style:italic}
</style></head><body>
<h1>РАСЧЁТ НЕУСТОЙКИ</h1>
<div class="cards">
  <div class="card"><div class="cl">Сумма неустойки</div><div class="cv">${fmt(final)} ₽</div></div>
  <div class="card"><div class="cl">Долг + неустойка</div><div class="cv">${fmt(data.debt + final)} ₽</div><div style="font-size:9pt;color:#888">на ${fmtDate(data.dateEnd)}</div></div>
  <div class="card"><div class="cl">Ставка</div><div class="cv" style="font-size:11pt;color:#b45309">${rateLabel}</div></div>
  <div class="card"><div class="cl">Сумма долга</div><div class="cv">${fmt(data.debt)} ₽</div></div>
</div>
<div class="row"><b>Период:</b> ${fmtDate(data.dateStart)} – ${fmtDate(data.dateEnd)} (${totalDays} дней)</div>
<div class="row"><b>Долг на начало:</b> ${fmt(data.debt)} руб.</div>
${data.capApplied ? `<div class="row" style="color:#b45309"><b>Ограничение:</b> расчётная ${fmt(data.total)} руб., итого ${fmt(final)} руб.</div>` : ""}
<h2>Детализация по периодам</h2>
<table><thead><tr>
  <th>Период</th><th style="text-align:right">Долг, ₽</th><th style="text-align:center">Ставка</th>
  <th style="text-align:right">Дней</th><th style="text-align:right">Формула</th><th style="text-align:right">Пени, ₽</th>
</tr></thead><tbody>${tableRowsPeriods}</tbody>
<tfoot><tr><td colspan="5"><b>Итого</b></td><td style="text-align:right">${fmt(data.total)}</td></tr></tfoot></table>
<h2>Детализация по дням</h2>
<table><thead><tr>
  <th>Дата</th><th style="text-align:right">Долг, ₽</th><th style="text-align:center">Ставка</th>
  <th style="text-align:right">За день, ₽</th><th style="text-align:right">Накоплено, ₽</th>
</tr></thead><tbody>${tableRowsDays}</tbody>
<tfoot><tr><td colspan="4"><b>Итого (${dayRows.length} дней)</b></td><td style="text-align:right">${fmt(data.total)}</td></tr></tfoot></table>
<div class="formula"><b>Порядок расчёта:</b> ${formulaLabel}</div>
${art193Block}
<div class="disc">Расчёт носит справочный характер и не является официальным юридическим документом.</div>
</body></html>`;

    const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `расчет_неустойки_${data.dateStart}_${data.dateEnd}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white" style={{ fontFamily: "system-ui,sans-serif" }}>

      {/* Шапка */}
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
        <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Icon name="Calculator" size={14} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight">Расчёт неустойки</p>
          <p className="text-[10px] text-blue-200">{fmtDate(data.dateStart)} — {fmtDate(data.dateEnd)} · {totalDays} дней</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-semibold">справочно</span>
      </div>

      {/* Итоги — карточки */}
      <div className="grid grid-cols-2 gap-px bg-slate-100">
        <div className="bg-white px-3 py-2.5">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Сумма неустойки</p>
          <p className="text-base font-black text-blue-800 leading-tight">{fmt(final)} ₽</p>
          {data.capApplied && <p className="text-[9px] text-amber-600 mt-0.5">расчётная: {fmt(data.total)} ₽</p>}
        </div>
        <div className="bg-white px-3 py-2.5">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Долг + неустойка</p>
          <p className="text-base font-black text-slate-800 leading-tight">{fmt(data.debt + final)} ₽</p>
          <p className="text-[9px] text-slate-400 mt-0.5">на {fmtDate(data.dateEnd)}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Ставка</p>
          <p className="text-[11px] font-semibold text-amber-700 leading-tight">{rateLabel}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Сумма долга</p>
          <p className="text-[11px] font-semibold text-slate-700 leading-tight">{fmt(data.debt)} ₽</p>
        </div>
      </div>

      {/* Формула */}
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
        <p className="text-[10px] text-slate-500 leading-snug">
          <span className="font-bold text-slate-600">Формула: </span>{formulaLabel}
        </p>
      </div>

      {/* Примечание ст. 193 — если применимо */}
      {isWeekendStart && art193Note && (
        <div className="border-t border-amber-100">
          <label className="flex items-start gap-2 px-3 py-2.5 cursor-pointer"
            style={{ background: art193 ? "rgba(254,243,199,0.6)" : "transparent" }}>
            <input type="checkbox" checked={art193} onChange={e => setArt193(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-amber-800">Учесть ст. 193 ГК РФ</p>
              {art193 && (
                <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
                  {fmtDate(data.dateStart)} ({getDayName(data.dateStart)}) — выходной.
                  Последний день оплаты: <strong>{fmtDate(art193Note.prevIso)}</strong> ({getDayName(art193Note.prevIso)}).
                  По ст. 193 ГК РФ рабочий день оплаты: <strong>{fmtDate(art193Note.nwIso)}</strong>.
                  Первый день просрочки: <strong>{fmtDate(art193Note.fpIso)}</strong>.
                </p>
              )}
            </div>
          </label>
        </div>
      )}

      {/* Детализация */}
      <div className="border-t border-slate-100">
        {/* Переключатель */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-600">Детализация</p>
          <div className="flex gap-1">
            {([["periods","По периодам"],["days","По дням"]] as const).map(([v,label]) => (
              <button key={v} onClick={() => setView(v)}
                className="px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all"
                style={view === v
                  ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff" }
                  : { color: "#94a3b8" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Таблица */}
        <div className="overflow-auto" style={{ maxHeight: 280 }}>
          {view === "periods" ? (
            <table className="w-full" style={{ fontSize: "11px", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#2c3e50", color: "#fff", zIndex: 1 }}>
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Период</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Долг, ₽</th>
                  <th className="px-2.5 py-2 text-center font-semibold">Ставка</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Дней</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Формула</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Пени, ₽</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((p, i) => {
                  const formulaStr = data.mode === "percent"
                    ? `${fmt(p.debt)} × ${data.ratePercent}% × ${p.days}`
                    : data.mode === "cbr"
                      ? `${fmt(p.debt)} × ${rateD} × ${p.days}`
                      : `${data.fixedDay} × ${p.days}`;
                  return (
                    <tr key={i} style={{ background: i === 0 ? "#fff3cd" : i % 2 === 0 ? "#f9f9f9" : "#fff", borderBottom: "1px solid #ecf0f1" }}>
                      <td className="px-2.5 py-2 whitespace-nowrap font-medium" style={{ color: "#2c3e50" }}>{fmtDate(p.from)} – {fmtDate(p.to)}</td>
                      <td className="px-2.5 py-2 text-right" style={{ color: "#2c3e50" }}>{fmt(p.debt)}</td>
                      <td className="px-2.5 py-2 text-center font-semibold" style={{ color: "#e67e22" }}>{rateD}</td>
                      <td className="px-2.5 py-2 text-right" style={{ color: "#7f8c8d" }}>{p.days}</td>
                      <td className="px-2.5 py-2 text-right text-[10px]" style={{ color: "#7f8c8d" }}>{formulaStr}</td>
                      <td className="px-2.5 py-2 text-right font-bold" style={{ color: "#1565c0" }}>{fmt(p.penalty)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#d4edda", borderTop: "2px solid #c3e6cb" }}>
                  <td colSpan={5} className="px-2.5 py-2 font-bold" style={{ color: "#155724" }}>Итого</td>
                  <td className="px-2.5 py-2 text-right font-black" style={{ color: "#155724" }}>{fmt(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full" style={{ fontSize: "11px", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#2c3e50", color: "#fff", zIndex: 1 }}>
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold" style={{ minWidth: 90 }}>Дата</th>
                  <th className="px-2.5 py-2 text-right font-semibold" style={{ minWidth: 120 }}>Долг, ₽</th>
                  <th className="px-2.5 py-2 text-center font-semibold" style={{ minWidth: 60 }}>Ставка</th>
                  <th className="px-2.5 py-2 text-right font-semibold" style={{ minWidth: 110 }}>За день, ₽</th>
                  <th className="px-2.5 py-2 text-right font-semibold" style={{ minWidth: 130 }}>Накоплено, ₽</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row, i) => (
                  <tr key={i} style={{ background: i === 0 ? "#fff3cd" : i % 2 === 0 ? "#f9f9f9" : "#fff", borderBottom: "1px solid #ecf0f1", fontWeight: i === 0 ? 700 : 400 }}>
                    <td className="px-2.5 py-1.5 whitespace-nowrap" style={{ color: "#2c3e50" }}>{fmtDate(row.date)}</td>
                    <td className="px-2.5 py-1.5 text-right" style={{ color: "#2c3e50" }}>{fmt(row.debt)}</td>
                    <td className="px-2.5 py-1.5 text-center font-semibold" style={{ color: "#e67e22" }}>{rateD}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold" style={{ color: "#1565c0" }}>{fmt(row.penalty)}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold" style={{ color: "#2c3e50" }}>{fmt(row.acc)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#d4edda", borderTop: "2px solid #c3e6cb" }}>
                  <td colSpan={4} className="px-2.5 py-2 font-bold" style={{ color: "#155724" }}>Итого ({dayRows.length} дней)</td>
                  <td className="px-2.5 py-2 text-right font-black" style={{ color: "#155724" }}>{fmt(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Действия */}
      <div className="px-3 py-2.5 border-t border-slate-100 flex gap-1.5 flex-wrap">

        <button onClick={handleDownloadDoc}
          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97]"
          style={{ background: "rgba(99,102,241,0.07)", color: "#4338ca", border: "1.5px solid rgba(99,102,241,0.25)" }}>
          <Icon name="FileDown" size={12} color="#4338ca" />
          Скачать .doc
        </button>
        <button
          onClick={() => onSendToChat(`Учти этот расчёт неустойки: сумма ${fmt(final)} руб. за период ${fmtDate(data.dateStart)}–${fmtDate(data.dateEnd)} (${totalDays} дней), ставка ${rateLabel}. Проверь корректность ставки по нормам ГК РФ.${art193 && art193Note ? ` Учти ст. 193 ГК РФ: первый день просрочки — ${fmtDate(art193Note.fpIso)}.` : ""}`)}
          className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97] text-white"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          <Icon name="Send" size={12} color="#fff" />
          Спросить AI-юриста
        </button>
      </div>
    </div>
  );
}