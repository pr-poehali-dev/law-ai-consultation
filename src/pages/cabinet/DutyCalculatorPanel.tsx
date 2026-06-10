import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../../backend/func2url.json";

const DUTY_URL = (func2url as Record<string, string>)["court-duty"];

type CourtType = "civil" | "arbitration";
type PayerType = "individual" | "org";
type PaymentForm = "cash" | "non-cash";

interface Rate {
  id: number;
  court_type: CourtType;
  sub_key: string;
  label: string;
  sub_ref: string;
  amount_individual: number;
  amount_org: number;
  note: string;
  sort_order: number;
}

function fmtRub(n: number): string {
  if (n === 0) return "0 руб. 00 коп.";
  return `${n.toLocaleString("ru-RU")} руб. 00 коп.`;
}

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export default function DutyCalculatorPanel({ onClose, onSendToChat }: Props) {
  const [courtType, setCourtType] = useState<CourtType>("civil");
  const [payerType, setPayerType] = useState<PayerType>("individual");
  const [paymentForm, setPaymentForm] = useState<PaymentForm>("cash");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState<CourtType | null>(null);

  useEffect(() => {
    fetch(DUTY_URL)
      .then(r => r.json())
      .then(d => { setRates(d.rates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // При смене типа суда сбрасываем выбор
  useEffect(() => { setSelectedKey(""); }, [courtType, payerType]);

  const filtered = rates.filter(r => r.court_type === courtType);
  const selected = filtered.find(r => r.sub_key === selectedKey);
  const amount = selected
    ? (payerType === "individual" ? selected.amount_individual : selected.amount_org)
    : 0;

  const selectTitle = {
    civil_individual: "Выберите заявление, подаваемое физическим лицом по делам, рассматриваемым судами общей юрисдикции (ГПК РФ, КАС РФ)",
    civil_org: "Выберите заявление, подаваемое юридическим лицом по делам, рассматриваемым судами общей юрисдикции (ГПК РФ, КАС РФ)",
    arbitration_individual: "Выберите заявление, подаваемое физическим лицом по делам, рассматриваемым арбитражными судами (АПК РФ)",
    arbitration_org: "Выберите заявление, подаваемое юридическим лицом по делам, рассматриваемым арбитражными судами (АПК РФ)",
  }[`${courtType}_${payerType}`] ?? "";

  const sendToChat = () => {
    if (!selected) return;
    let text = `⚖️ Расчёт государственной пошлины:\n`;
    text += `• Тип суда: ${courtType === "civil" ? "Суд общей юрисдикции (ГПК/КАС РФ)" : "Арбитражный суд (АПК РФ)"}\n`;
    text += `• Тип плательщика: ${payerType === "individual" ? "Физическое лицо" : "Организация"}\n`;
    text += `• Заявление: ${selected.label}\n`;
    text += `• Основание: ${selected.sub_ref}\n`;
    text += `• Размер госпошлины: ${fmtRub(amount)}\n`;
    if (selected.note) text += `• Примечание: ${selected.note}\n`;
    text += `\nУчти этот расчёт госпошлины. Подскажи, правильно ли определена категория заявления, и как правильно оплатить госпошлину при подаче данного заявления.`;
    onSendToChat(text);
    onClose();
  };

  const inp = "w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 transition-all";

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="Landmark" size={12} color="#fff" />
          </div>
          <p className="text-xs font-bold text-slate-800">Калькулятор госпошлины</p>
          <span className="text-[10px] text-slate-400">· НК РФ</span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>тестовый режим</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Тело */}
      <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "calc(68dvh - 44px)" }}>
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
            <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            Загрузка ставок...
          </div>
        )}

        {!loading && (
          <>
            {/* Шаг 1: Тип плательщика */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">1. Тип плательщика</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([["individual", "Физическое лицо"], ["org", "Организация"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setPayerType(v)}
                    className="py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                    style={payerType === v
                      ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff", border: "1.5px solid #0f4c81" }
                      : { background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Шаг 2: Вид судопроизводства */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">2. Вид судопроизводства</p>
              <div className="space-y-1.5">
                {([
                  { v: "civil" as CourtType, label: "Суд общей юрисдикции", sub: "ГПК РФ, КАС РФ" },
                  { v: "arbitration" as CourtType, label: "Арбитражный суд", sub: "АПК РФ" },
                ]).map(({ v, label, sub }) => (
                  <div key={v} className="flex items-center gap-2">
                    <button
                      onClick={() => setCourtType(v)}
                      className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left"
                      style={courtType === v
                        ? { background: "rgba(15,76,129,0.06)", border: "1.5px solid rgba(15,76,129,0.3)", color: "#0f4c81" }
                        : { background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#64748b" }}>
                      <div>
                        <p className="text-[11px] font-semibold leading-tight">{label}</p>
                        <p className="text-[10px] opacity-70">{sub}</p>
                      </div>
                      {courtType === v && <Icon name="CheckCircle" size={13} color="#0f4c81" />}
                    </button>
                    <button
                      onClick={() => setInfoModal(v)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      title="Справка">
                      <Icon name="Info" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Шаг 3: Выбор заявления */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">3. Вид заявления</p>
              <p className="text-[10px] text-slate-400 mb-1.5 leading-snug">{selectTitle}</p>
              <select
                className={inp + " cursor-pointer"}
                value={selectedKey}
                onChange={e => setSelectedKey(e.target.value)}
                style={{ height: "auto", paddingTop: "6px", paddingBottom: "6px" }}
              >
                <option value="">— Выберите заявление —</option>
                {filtered.map(r => (
                  <option key={r.sub_key} value={r.sub_key}>{r.label}</option>
                ))}
              </select>
              {selected?.note && (
                <p className="text-[10px] text-amber-700 mt-1 px-0.5">⚠ {selected.note}</p>
              )}
            </div>

            {/* Шаг 4: Результат */}
            <div className="rounded-xl px-4 py-3"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <p className="text-[10px] text-blue-200 mb-0.5">Размер госпошлины составит</p>
              <p className="text-xl font-black text-white leading-tight">
                {amount > 0 ? `${amount.toLocaleString("ru-RU")} ₽` : "0 ₽"}
              </p>
              <p className="text-[10px] text-blue-200 mt-0.5">{fmtRub(amount)}</p>
              {selected && (
                <p className="text-[10px] text-blue-300 mt-1">{selected.sub_ref}</p>
              )}
            </div>

            {/* Шаг 5: Форма оплаты */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">4. Форма оплаты</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([["cash", "Наличный расчёт"], ["non-cash", "Безналичный расчёт"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setPaymentForm(v)}
                    className="py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                    style={paymentForm === v
                      ? { background: "rgba(15,76,129,0.08)", color: "#0f4c81", border: "1.5px solid rgba(15,76,129,0.3)" }
                      : { background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0" }}>
                    {label}
                  </button>
                ))}
              </div>
              {paymentForm === "non-cash" && (
                <a href="https://service.nalog.ru/static/personal-data.html?id=gosposhlina" target="_blank" rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600 hover:underline">
                  <Icon name="ExternalLink" size={11} />Оплатить на сайте ФНС России
                </a>
              )}
            </div>

            <p className="text-[10px] text-slate-400 text-center">Справочный расчёт · Актуальность ставок уточняйте в НК РФ</p>

            {selected && amount > 0 && (
              <button onClick={sendToChat}
                className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{ background: "rgba(15,76,129,0.07)", color: "#0f4c81", border: "1.5px solid rgba(15,76,129,0.2)" }}>
                <Icon name="Send" size={12} color="#0f4c81" />
                Отправить в чат AI-юристу
              </button>
            )}
          </>
        )}
      </div>

      {/* Справочное модальное окно */}
      {infoModal && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-3xl p-4"
          onClick={() => setInfoModal(null)}>
          <div className="bg-white rounded-2xl p-4 shadow-xl max-w-xs" onClick={e => e.stopPropagation()}>
            <p className="text-xs font-bold text-slate-800 mb-2">
              {infoModal === "civil" ? "Суд общей юрисдикции" : "Арбитражный суд"}
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {infoModal === "civil"
                ? "Дела, рассматриваемые Верховным Судом РФ в соответствии с гражданским процессуальным законодательством РФ и законодательством об административном судопроизводстве, судами общей юрисдикции, мировыми судьями."
                : "Дела, рассматриваемые Верховным Судом РФ в соответствии с арбитражным процессуальным законодательством РФ, арбитражными судами."}
            </p>
            <button onClick={() => setInfoModal(null)}
              className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}