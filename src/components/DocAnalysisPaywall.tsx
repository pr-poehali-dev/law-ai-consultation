import { useState } from "react";
import Icon from "@/components/ui/icon";

interface DocAnalysisPaywallProps {
  fileName?: string;
  onChoosePro: () => void;
  onChooseMax: () => void;
  onClose: () => void;
}

const GOLD = "#e8a820";
const GOLD_LIGHT = "#f0c060";
const BG = "#0a1628";

export default function DocAnalysisPaywall({ onChoosePro, onChooseMax, onClose }: DocAnalysisPaywallProps) {
  const [showPlans, setShowPlans] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-md sm:mx-4 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: BG, maxHeight: "92dvh" }}
      >
        {/* Золотая линия */}
        <div className="shrink-0" style={{ height: 3, background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_LIGHT} 50%, ${GOLD} 70%, transparent)` }} />

        {/* Свайп-индикатор мобайл */}
        <div className="flex justify-center pt-2 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <Icon name="X" size={15} color="rgba(255,255,255,0.6)" />
        </button>

        {!showPlans ? (
          /* ── Шаг 1: Уведомление ── */
          <div className="px-6 pt-5 pb-7 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mt-2"
              style={{ background: "linear-gradient(135deg, rgba(232,168,32,0.18), rgba(232,168,32,0.07))", border: "1px solid rgba(232,168,32,0.3)" }}>
              <Icon name="FileSearch" size={30} color={GOLD} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white leading-tight">Анализ документов</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                Загрузка PDF, DOCX и фото для AI‑анализа доступна с тарифа{" "}
                <span style={{ color: GOLD_LIGHT }} className="font-semibold">«Профи»</span> и выше.
              </p>
            </div>

            <div className="w-full rounded-2xl p-4 space-y-3 text-left"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                { icon: "ScanSearch", text: "AI анализирует содержание и выявляет риски" },
                { icon: "Scale",      text: "Правовая оценка на основе законов РФ" },
                { icon: "Bot",        text: "Задавайте вопросы по документу в чате" },
                { icon: "Download",   text: "Скачивание готового документа .docx" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,32,0.12)" }}>
                    <Icon name={icon as "Scale"} size={13} color={GOLD} />
                  </div>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPlans(true)}
              className="w-full py-3.5 rounded-2xl text-sm font-black transition-all active:scale-[0.98] hover:brightness-105"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG, boxShadow: "0 4px 20px rgba(232,168,32,0.35)" }}
            >
              Посмотреть тарифы
            </button>

            <button onClick={onClose} className="text-xs -mt-2" style={{ color: "rgba(255,255,255,0.28)" }}>
              Закрыть
            </button>
          </div>
        ) : (
          /* ── Шаг 2: Тарифы ── */
          <div className="overflow-y-auto flex-1 px-4 sm:px-5 pt-4 pb-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setShowPlans(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.07)" }}>
                <Icon name="ChevronLeft" size={14} color="rgba(255,255,255,0.6)" />
              </button>
              <p className="text-sm font-bold text-white">Выберите тариф</p>
            </div>

            {/* Профи */}
            <div className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99] hover:brightness-105"
              style={{ background: "linear-gradient(135deg, #0f2650, #162d5a)", border: "1.5px solid rgba(232,168,32,0.25)" }}
              onClick={onChoosePro}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide inline-block mb-1.5"
                    style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}>Хит</span>
                  <p className="text-base font-black text-white">Профи</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white">3 990</span>
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>₽</span>
                  </div>
                  <span className="text-[11px] line-through" style={{ color: "rgba(255,255,255,0.25)" }}>5 990 ₽</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
                {["100 вопросов AI", "20 документов", "Загрузка PDF / фото", "Анализ документов AI", "5 вопросов юристу", "Редактор документов"].map(t => (
                  <div key={t} className="flex items-start gap-1.5">
                    <Icon name="Check" size={11} color={GOLD} className="mt-0.5 shrink-0" />
                    <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.72)" }}>{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onChoosePro(); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }}>
                Выбрать «Профи» · 3 990 ₽
              </button>
            </div>

            {/* Максимум */}
            <div className="rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99] hover:brightness-105"
              style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)" }}
              onClick={onChooseMax}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide inline-block mb-1.5"
                    style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>Рекомендуем</span>
                  <p className="text-base font-black text-white">Максимум</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white">5 990</span>
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>₽</span>
                  </div>
                  <span className="text-[11px] line-through" style={{ color: "rgba(255,255,255,0.25)" }}>8 990 ₽</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
                {["300 вопросов AI", "50 документов", "Загрузка PDF / фото", "Анализ нескольких документов", "30 вопросов юристу", "2 документа от юриста"].map(t => (
                  <div key={t} className="flex items-start gap-1.5">
                    <Icon name="Check" size={11} color="rgba(255,255,255,0.5)" className="mt-0.5 shrink-0" />
                    <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onChooseMax(); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.16)" }}>
                Выбрать «Максимум» · 5 990 ₽
              </button>
            </div>

            <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              Защищённая оплата · ЮКасса · Доступ сразу после оплаты
            </p>
          </div>
        )}
      </div>
    </div>
  );
}