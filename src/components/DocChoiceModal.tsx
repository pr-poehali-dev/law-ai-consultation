/**
 * Модал выбора при нажатии «Создать документ»
 */
import Icon from "@/components/ui/icon";

interface DocChoiceModalProps {
  docLabel: string;
  onChooseDoc: () => void;
  onChoosePlan: (planId?: string) => void;
  onClose: () => void;
  onLoginClick?: () => void;
}

const GOLD = "#e8a820";
const GOLD_LIGHT = "#f0c060";
const BG = "#0a1628";

export default function DocChoiceModal({ docLabel, onChooseDoc, onChoosePlan, onClose, onLoginClick }: DocChoiceModalProps) {
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

        {/* Заголовок — фиксированный */}
        <div className="flex items-center gap-3 px-4 pt-2 pb-3 sm:px-6 shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: `1px solid rgba(232,168,32,0.3)` }}>
            <Icon name="FileText" size={15} color={GOLD} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm leading-tight">Создать «{docLabel}»</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Выберите удобный вариант</p>
          </div>
        </div>

        {/* Скролл — тарифы */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 space-y-2.5 pb-2">

          {/* ── Тариф СТАРТ ── */}
          <div
            className="rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, rgba(232,168,32,0.13), rgba(232,168,32,0.06))", border: "1.5px solid rgba(232,168,32,0.4)" }}
            onClick={() => onChoosePlan("plan_starter")}
          >
            {/* Шапка */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "rgba(232,168,32,0.2)", color: GOLD_LIGHT }}>
                  Старт
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}>
                  −40%
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-lg font-black leading-none" style={{ color: GOLD_LIGHT }}>990 ₽</span>
                <span className="text-[11px] line-through" style={{ color: "rgba(255,255,255,0.3)" }}>1 490 ₽</span>
              </div>
            </div>

            {/* Юрист */}
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 mb-2.5" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.3)" }}>
              <Icon name="User" size={12} color={GOLD} />
              <span className="text-[11px] font-semibold" style={{ color: GOLD_LIGHT }}>1 консультация живого юриста</span>
            </div>

            {/* Фичи — 2 колонки на мобиле */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2.5">
              {[
                "30 вопросов AI-юристу",
                "5 документов",
                "Анализ судебной практики",
                "Рекомендации AI-юриста",
                "Скачивание .doc",
                "Проверка документа юристом",
                "Поиск судебной практики",
                "Калькулятор неустойки",
                "Определение подсудности",
              ].map((text) => (
                <div key={text} className="flex items-start gap-1.5">
                  <Icon name="Check" size={10} color={GOLD} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.72)" }}>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 mb-2.5" style={{ borderTop: "1px solid rgba(232,168,32,0.2)" }}>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Тариф «Пробный» = 290 ₽</span>
              <span className="text-[10px] font-bold" style={{ color: "#4ade80" }}>Больше вопросов и функций</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onChoosePlan("plan_starter"); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }}
            >
              Выбрать «Старт» · 990 ₽
            </button>
          </div>

        </div>

        {/* ── Липкий футер: Тариф «Пробный» ── */}
        <div
          className="shrink-0 px-4 sm:px-6 pt-2.5 pb-3 sm:pb-4"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: `max(12px, env(safe-area-inset-bottom, 12px))`,
            background: BG,
          }}
        >
          <button
            onClick={onChooseDoc}
            className="w-full flex flex-col px-4 py-3 rounded-xl transition-all active:scale-[0.99] text-left"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>Тариф «Пробный»</span>
              <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>290 ₽</span>
            </div>
            <span className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>5 вопросов AI · 2 документа · AI-редактор · калькулятор</span>
          </button>
          <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
          <p className="text-center text-[11px] mt-2">
            <span style={{ color: "rgba(255,255,255,0.35)" }}>Уже есть подписка? </span>
            <button onClick={onLoginClick} className="underline underline-offset-2 transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.55)" }}>Войдите в личный кабинет</button>
          </p>
        </div>
      </div>
    </div>
  );
}