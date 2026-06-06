import Icon from "@/components/ui/icon";

interface DocAnalysisPaywallProps {
  fileName: string;
  onChoosePro: () => void;
  onChooseSingle: () => void;
  onClose: () => void;
}

const GOLD = "#e8a820";
const GOLD_LIGHT = "#f0c060";
const BG = "#0a1628";

export default function DocAnalysisPaywall({ fileName, onChoosePro, onChooseSingle, onClose }: DocAnalysisPaywallProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
        style={{ background: BG, maxHeight: "90dvh" }}
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

        {/* Заголовок */}
        <div className="flex items-center gap-3 px-4 pt-2 pb-3 sm:px-6 shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: `1px solid rgba(232,168,32,0.3)` }}>
            <Icon name="FileSearch" size={15} color={GOLD} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm leading-tight">Анализ документа</h3>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
              📎 {fileName}
            </p>
          </div>
        </div>

        {/* Тарифы */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 space-y-2.5 pb-3">

          {/* ── Разовый анализ 99 ₽ ── */}
          <div
            className="rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, rgba(232,168,32,0.13), rgba(232,168,32,0.06))", border: "1.5px solid rgba(232,168,32,0.4)" }}
            onClick={onChooseSingle}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "rgba(232,168,32,0.2)", color: GOLD_LIGHT }}>
                  Разовый
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}>
                  Быстро
                </span>
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span className="text-xl font-black leading-none" style={{ color: GOLD_LIGHT }}>99 ₽</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
              {[
                "Анализ 1 документа",
                "Ответ на ваш вопрос",
                "Правовые риски",
                "Рекомендации AI",
              ].map((text) => (
                <div key={text} className="flex items-start gap-1.5">
                  <Icon name="Check" size={10} color={GOLD} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.72)" }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onChooseSingle(); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }}
            >
              Разовый анализ · 99 ₽
            </button>
          </div>

          {/* ── Тариф ПРОФИ ── */}
          <div
            className="rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.99]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.14)" }}
            onClick={onChoosePro}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                  Профи
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}>
                  Выгоднее
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-lg font-black text-white leading-none">3 990 ₽</span>
                <span className="text-[11px] line-through" style={{ color: "rgba(255,255,255,0.3)" }}>5 990 ₽</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 mb-2.5" style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.16)" }}>
              <Icon name="Infinity" size={12} color="rgba(255,255,255,0.85)" />
              <span className="text-[11px] font-semibold text-white">Безлимитный анализ документов</span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2.5">
              {[
                "100 вопросов AI-юристу",
                "20 документов",
                "Загрузка PDF / фото",
                "5 вопросов юристу",
                "Редактор документов",
                "Калькулятор неустойки",
              ].map((text) => (
                <div key={text} className="flex items-start gap-1.5">
                  <Icon name="Check" size={10} color="rgba(255,255,255,0.5)" className="mt-0.5 shrink-0" />
                  <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.58)" }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onChoosePro(); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              Тариф «Профи» · 3 990 ₽
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-4 pt-1 shrink-0">
          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
          <p className="text-center text-[11px] mt-2">
            <span style={{ color: "rgba(255,255,255,0.35)" }}>Уже есть подписка? </span>
            <a href="/cabinet" className="underline underline-offset-2" style={{ color: "rgba(255,255,255,0.55)" }}>Войдите в личный кабинет</a>
          </p>
        </div>
      </div>
    </div>
  );
}