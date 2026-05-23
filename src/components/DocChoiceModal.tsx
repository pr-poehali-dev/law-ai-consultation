/**
 * Модал выбора при нажатии «Создать документ»:
 * Показывает тарифы «Старт», «Профи» и разовый документ
 */
import Icon from "@/components/ui/icon";

interface DocChoiceModalProps {
  docLabel: string;
  onChooseDoc: () => void;
  onChoosePlan: (planId?: string) => void;
  onClose: () => void;
}

const GOLD = "#e8a820";
const GOLD_LIGHT = "#f0c060";
const BG = "#0a1628";

export default function DocChoiceModal({ docLabel, onChooseDoc, onChoosePlan, onClose }: DocChoiceModalProps) {
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
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <Icon name="X" size={15} color="rgba(255,255,255,0.6)" />
        </button>

        <div className="overflow-y-auto flex-1 px-4 py-3 sm:px-6 sm:py-5 space-y-3" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>

          {/* Заголовок */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: `1px solid rgba(232,168,32,0.3)` }}>
              <Icon name="FileText" size={16} color={GOLD} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base leading-tight">Создать «{docLabel}»</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Выберите удобный вариант</p>
            </div>
          </div>

          {/* ── Тариф СТАРТ ─────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, rgba(232,168,32,0.13), rgba(232,168,32,0.06))", border: "1.5px solid rgba(232,168,32,0.4)" }}
            onClick={onChoosePlan}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide" style={{ background: "rgba(232,168,32,0.2)", color: GOLD_LIGHT }}>
                  Тариф «Старт»
                </span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
                  −40%
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl font-black leading-none" style={{ color: GOLD_LIGHT }}>1 490 ₽</span>
                <div className="text-[10px] line-through mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>2 490 ₽</div>
              </div>
            </div>

            {/* Юрист — выделенный блок */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.3)" }}>
              <Icon name="User" size={13} color={GOLD} />
              <span className="text-xs font-semibold" style={{ color: GOLD_LIGHT }}>3 вопроса живому юристу</span>
            </div>

            <div className="grid grid-cols-1 gap-y-1.5 mb-3">
              {[
                { icon: "MessageCircle", text: "30 вопросов AI-юристу" },
                { icon: "FileText", text: "До 5 документов через систему" },
                { icon: "BarChart2", text: "Анализ судебной практики при подготовке" },
                { icon: "Star", text: "Рекомендации по документу от AI-юриста" },
                { icon: "Download", text: "Генерация и скачивание .doc" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(232,168,32,0.15)" }}>
                    <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={9} color={GOLD} />
                  </div>
                  <span className="text-[12px] leading-snug" style={{ color: "rgba(255,255,255,0.78)" }}>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 mb-3" style={{ borderTop: "1px solid rgba(232,168,32,0.2)" }}>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>1 документ разово = 990 ₽</span>
              <span className="text-[11px] font-bold" style={{ color: "#4ade80" }}>Экономия 3 460 ₽</span>
            </div>

            <button
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }}
            >
              Выбрать тариф «Старт» · 1 490 ₽
            </button>
          </div>

          {/* ── Тариф ПРОФИ ─────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))", border: "1.5px solid rgba(255,255,255,0.15)" }}
            onClick={() => onChoosePlan("plan_pro")}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                  Тариф «Профи»
                </span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
                  Хит
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl font-black leading-none text-white">3 990 ₽</span>
                <div className="text-[10px] line-through mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>5 990 ₽</div>
              </div>
            </div>

            {/* Юрист — выделенный блок */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Icon name="User" size={13} color="rgba(255,255,255,0.8)" />
              <span className="text-xs font-semibold text-white">5 вопросов живому юристу · анализ документов</span>
            </div>

            <div className="grid grid-cols-1 gap-y-1.5">
              {[
                { icon: "MessageCircle", text: "100 вопросов AI-юристу" },
                { icon: "FileText", text: "До 20 документов через систему" },
                { icon: "Upload", text: "Загрузка PDF, DOCX, фото для анализа" },
                { icon: "PenLine", text: "Редактор документов через AI-юриста" },
                { icon: "Calculator", text: "Калькулятор расчёта неустойки" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={9} color="rgba(255,255,255,0.6)" />
                  </div>
                  <span className="text-[12px] leading-snug" style={{ color: "rgba(255,255,255,0.65)" }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Выбрать тариф «Профи» · 3 990 ₽
            </button>
          </div>

          {/* ── Один документ ───────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={onChooseDoc}
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>Только этот документ</p>
              <span className="text-base font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>990 ₽</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Без доступа к вопросам AI, редактору и калькулятору
            </p>
            <button
              className="w-full py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}
            >
              Создать 1 документ · 990 ₽
            </button>
          </div>

          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
        </div>
      </div>
    </div>
  );
}