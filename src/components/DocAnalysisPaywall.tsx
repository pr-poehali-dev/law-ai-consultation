import Icon from "@/components/ui/icon";

interface DocAnalysisPaywallProps {
  fileName: string;
  onChoosePro: () => void;
  onChooseMax: () => void;
  onClose: () => void;
}

const GOLD = "#e8a820";
const GOLD_LIGHT = "#f0c060";
const BG = "#0a1628";

export default function DocAnalysisPaywall({ fileName, onChoosePro, onChooseMax, onClose }: DocAnalysisPaywallProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
        style={{ background: BG, maxHeight: "92dvh" }}
      >
        {/* Золотая линия */}
        <div className="shrink-0 rounded-t-3xl overflow-hidden" style={{ height: 3, background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_LIGHT} 50%, ${GOLD} 70%, transparent)` }} />

        {/* Свайп-индикатор */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <Icon name="X" size={15} color="rgba(255,255,255,0.6)" />
        </button>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 pt-1 pb-5 space-y-4">

          {/* Уведомление */}
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(232,168,32,0.12), rgba(232,168,32,0.05))", border: "1px solid rgba(232,168,32,0.25)" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: `1px solid rgba(232,168,32,0.3)` }}>
                <Icon name="FileSearch" size={17} color={GOLD} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm leading-tight mb-1">Анализ документов</p>
                <p className="text-[11px] truncate mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>📎 {fileName}</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Загрузка и AI-анализ документов доступны с тарифа <span style={{ color: GOLD_LIGHT }} className="font-semibold">«Профи»</span> и выше.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            Выберите тариф
          </p>

          {/* ── Тариф ПРОФИ ── */}
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99] hover:brightness-105"
            style={{ background: "linear-gradient(135deg, #0f2650, #162d5a)", border: "1.5px solid rgba(255,255,255,0.14)" }}
            onClick={onChoosePro}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}>Хит</span>
                </div>
                <p className="text-base font-black text-white leading-tight">Профи</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">3 990</span>
                  <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>₽</span>
                </div>
                <span className="text-[11px] line-through" style={{ color: "rgba(255,255,255,0.28)" }}>5 990 ₽</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
              {[
                "100 вопросов AI-юристу",
                "20 документов",
                "Загрузка PDF / DOCX / фото",
                "Анализ документов AI",
                "5 вопросов живому юристу",
                "Редактор документов",
              ].map((text) => (
                <div key={text} className="flex items-start gap-1.5">
                  <Icon name="Check" size={11} color={GOLD} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.72)" }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onChoosePro(); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }}
            >
              Выбрать «Профи» · 3 990 ₽
            </button>
          </div>

          {/* ── Тариф МАКСИМУМ ── */}
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99] hover:brightness-105"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))", border: "1.5px solid rgba(255,255,255,0.1)" }}
            onClick={onChooseMax}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>Рекомендуем</span>
                </div>
                <p className="text-base font-black text-white leading-tight">Максимум</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">5 990</span>
                  <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>₽</span>
                </div>
                <span className="text-[11px] line-through" style={{ color: "rgba(255,255,255,0.28)" }}>8 990 ₽</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
              {[
                "300 вопросов AI-юристу",
                "50 документов",
                "Загрузка PDF / DOCX / фото",
                "Анализ нескольких документов",
                "30 вопросов живому юристу",
                "2 документа от юриста",
              ].map((text) => (
                <div key={text} className="flex items-start gap-1.5">
                  <Icon name="Check" size={11} color="rgba(255,255,255,0.5)" className="mt-0.5 shrink-0" />
                  <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onChooseMax(); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.16)" }}
            >
              Выбрать «Максимум» · 5 990 ₽
            </button>
          </div>

          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
        </div>
      </div>
    </div>
  );
}
