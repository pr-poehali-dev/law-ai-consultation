/**
 * Модал выбора при нажатии «Создать документ»:
 * - Показывает что Пакет «Старт» (1490р) выгоднее 5 документов по отдельности (990р каждый)
 * - Даёт выбор: 1 документ за 990р или пакет за 1490р
 */
import Icon from "@/components/ui/icon";


interface DocChoiceModalProps {
  docLabel: string;
  onChooseDoc: () => void;
  onChoosePlan: () => void;
  onClose: () => void;
}

export default function DocChoiceModal({ docLabel, onChooseDoc, onChoosePlan, onClose }: DocChoiceModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md sm:mx-4 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-scale-in"
        style={{ background: "#0a1628", maxHeight: "90dvh" }}
      >
        {/* Золотая линия сверху */}
        <div className="shrink-0" style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f0c060 50%, #e8a820 70%, transparent)" }} />

        {/* Свайп-индикатор на мобиле */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: "rgba(255,255,255,0.08)" }}>
          <Icon name="X" size={15} color="rgba(255,255,255,0.6)" />
        </button>

        <div className="overflow-y-auto flex-1 px-4 py-3 sm:p-7" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}>
          {/* Заголовок */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.3)" }}>
              <Icon name="FileText" size={16} color="#e8a820" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base leading-tight">Создать «{docLabel}»</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Выберите удобный вариант</p>
            </div>
          </div>

          {/* Рекомендуемый — пакет Старт */}
          <div
            className="rounded-2xl p-3 sm:p-4 mb-3 cursor-pointer transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, rgba(232,168,32,0.15), rgba(232,168,32,0.07))",
              border: "1.5px solid rgba(232,168,32,0.4)",
            }}
            onClick={onChoosePlan}
          >
            {/* Бейдж выгоды */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                style={{ background: "rgba(232,168,32,0.2)", color: "#f0c060" }}>
                Рекомендуем · 5 документов по цене 1.5
              </span>
              <span className="text-lg font-black" style={{ color: "#f0c060" }}>1 490 ₽</span>
            </div>

            <p className="font-bold text-white text-sm mb-2">Пакет «Старт»</p>

            <div className="space-y-1.5">
              {[
                { icon: "MessageCircle", text: "30 вопросов AI-юристу" },
                { icon: "FileText", text: "5 документов (включая этот)" },
                { icon: "Download", text: "Скачивание в .doc формате" },
                { icon: "Clock", text: "Доступ на 90 дней" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,32,0.2)" }}>
                    <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={10} color="#e8a820" />
                  </div>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(232,168,32,0.2)" }}>
              <span className="text-xs line-through" style={{ color: "rgba(255,255,255,0.3)" }}>
                1 документ = 990 ₽ · 5 документов = 4 950 ₽
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold" style={{ color: "#4ade80" }}>Экономия 3 460 ₽</span>
              </div>
            </div>

            <button
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)", color: "#0a1628" }}
            >
              Выбрать пакет «Старт» · 1 490 ₽
            </button>
          </div>

          {/* Один документ */}
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onClick={onChooseDoc}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>Только этот документ</p>
              <span className="text-base font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>990 ₽</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
              Один документ без дополнительных возможностей
            </p>
            <button
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}
            >
              Создать 1 документ · 990 ₽
            </button>
          </div>

          <p className="text-center text-[10px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
          <p className="text-center text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.18)" }}>
            * Подгрузка документов в чат доступна начиная с тарифа «Профи» и выше
          </p>
        </div>
      </div>
    </div>
  );
}