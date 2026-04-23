import Icon from "@/components/ui/icon";

interface UpsellCardProps {
  onPayClick: () => void;
  onSelectPlan: () => void;
}

export default function UpsellCard({ onPayClick, onSelectPlan }: UpsellCardProps) {
  return (
    <div className="upsell-animate">
      <div className="flex gap-2 items-start">
        {/* Иконка AI — как у обычного сообщения */}
        <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Icon name="Scale" size={13} className="text-gold-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="relative overflow-hidden rounded-2xl rounded-tl-sm shadow-lg"
            style={{
              background: "linear-gradient(135deg, #0a1628 0%, #0f2040 100%)",
              border: "1px solid rgba(232, 168, 32, 0.35)",
            }}
          >
            {/* Золотая полоска сверху */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(232,168,32,0.7), transparent)" }} />

            {/* Декоративные круги */}
            <div className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(232,168,32,0.07) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)", transform: "translate(-30%, 30%)" }} />

            <div className="relative px-4 py-4">

              {/* Заголовок */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(232,168,32,0.15)" }}>
                  <Icon name="MessageSquare" size={12} className="text-gold-400" />
                </div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.95)" }}>
                  Ваша консультация продолжается
                </p>
              </div>

              {/* Текст */}
              <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.68)" }}>
                Я ответил на ваш первый вопрос бесплатно. Ваша ситуация требует
                более детального разбора — дальнейшая консультация AI-юриста
                платная, но{" "}
                <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>доступная</span>.
              </p>

              {/* Разделитель */}
              <div className="mb-4" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

              {/* Кнопка 1 — пакет Старт */}
              <button
                onClick={onPayClick}
                className="w-full rounded-xl mb-2.5 btn-gold active:scale-95"
                style={{ padding: "11px 16px" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(10,22,40,0.2)" }}>
                      <Icon name="Zap" size={13} className="text-navy-900" />
                    </div>
                    <div className="text-left">
                      <p className="text-[12px] font-bold text-navy-900 leading-tight">Пакет «Старт» · 30 вопросов</p>
                      <p className="text-[10.5px] leading-tight" style={{ color: "rgba(10,22,40,0.6)" }}>+ 5 документов · анализ PDF</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[20px] font-bold text-navy-900 leading-none">990</span>
                    <span className="text-[11px] font-semibold" style={{ color: "rgba(10,22,40,0.7)" }}>₽</span>
                  </div>
                </div>
              </button>

              {/* Кнопка 2 — тарифы */}
              <button
                onClick={onSelectPlan}
                className="w-full rounded-xl active:scale-95 transition-all duration-150"
                style={{
                  padding: "11px 16px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      <Icon name="Star" size={13} style={{ color: "#f0c060" }} />
                    </div>
                    <div className="text-left">
                      <p className="text-[12px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.92)" }}>
                        Тарифы с максимальной выгодой
                      </p>
                      <p className="text-[10.5px] leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
                        30–300 вопросов + документы
                      </p>
                    </div>
                  </div>
                  <Icon name="ChevronRight" size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
                </div>
              </button>

              {/* Подпись */}
              <p className="mt-3 text-center text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Оплата через защищённый шлюз · Доступ сразу после оплаты
              </p>

            </div>

            {/* Полоска снизу */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}