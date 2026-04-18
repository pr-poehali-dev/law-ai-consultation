import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface UpsellCardProps {
  onPayClick: () => void;
  onSelectPlan: () => void;
}

export default function UpsellCard({ onPayClick, onSelectPlan }: UpsellCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="flex gap-2 items-start">
        {/* Иконка AI */}
        <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Icon name="Scale" size={13} className="text-gold-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative overflow-hidden rounded-2xl rounded-tl-sm border border-gold-300/60 bg-gradient-to-br from-[#0a1628] to-[#0f2040] shadow-lg">

            {/* Декоративная полоска сверху */}
            <div className="h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />

            {/* Декоративные круги */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold-400/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/3 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative px-4 py-4">
              {/* Иконка + заголовок */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gold-400/15 rounded-lg flex items-center justify-center shrink-0">
                  <Icon name="MessageSquare" size={13} className="text-gold-400" />
                </div>
                <p className="text-[13px] font-semibold text-white leading-tight">
                  Ваша консультация продолжается
                </p>
              </div>

              {/* Основной текст */}
              <p className="text-[12.5px] text-white/75 leading-relaxed mb-4">
                Я ответил на ваш первый вопрос бесплатно. Ваша ситуация требует
                более детального разбора — дальнейшая консультация AI-юриста
                платная, но <span className="text-white/95 font-medium">доступная</span>.
              </p>

              {/* Разделитель */}
              <div className="h-px bg-white/8 mb-4" />

              {/* Два варианта */}
              <div className="space-y-2.5">

                {/* Вариант 1 — 3 вопроса */}
                <button
                  onClick={onPayClick}
                  className="group w-full relative overflow-hidden rounded-xl bg-gold-500 hover:bg-gold-400 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-gold-500/30 hover:shadow-lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-full group-hover:translate-x-full" style={{ transition: "opacity 0.3s, transform 0.6s" }} />
                  <div className="relative flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-navy-900/20 rounded-lg flex items-center justify-center shrink-0">
                        <Icon name="Zap" size={13} className="text-navy-900" />
                      </div>
                      <div className="text-left">
                        <p className="text-[12px] font-bold text-navy-900 leading-tight">3 вопроса к AI-юристу</p>
                        <p className="text-[10.5px] text-navy-800/70 leading-tight">Продолжите прямо сейчас</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[18px] font-bold text-navy-900 leading-none">350</span>
                      <span className="text-[11px] font-semibold text-navy-800/80">₽</span>
                    </div>
                  </div>
                </button>

                {/* Вариант 2 — тарифы */}
                <button
                  onClick={onSelectPlan}
                  className="group w-full relative overflow-hidden rounded-xl border border-white/15 bg-white/6 hover:bg-white/10 hover:border-white/25 active:scale-[0.98] transition-all duration-200"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                        <Icon name="Star" size={13} className="text-gold-300" />
                      </div>
                      <div className="text-left">
                        <p className="text-[12px] font-semibold text-white leading-tight">Тарифы с максимальной выгодой</p>
                        <p className="text-[10.5px] text-white/50 leading-tight">30–300 вопросов + документы</p>
                      </div>
                    </div>
                    <Icon name="ChevronRight" size={14} className="text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
                  </div>
                </button>

              </div>

              {/* Подпись */}
              <p className="mt-3 text-center text-[10.5px] text-white/30">
                Оплата через защищённый шлюз · Доступ сразу после оплаты
              </p>
            </div>

            {/* Декоративная полоска снизу */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
