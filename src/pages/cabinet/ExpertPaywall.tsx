import Icon from "@/components/ui/icon";

interface ExpertPaywallProps {
  onPayClick?: () => void;
}

export default function ExpertPaywall({ onPayClick }: ExpertPaywallProps) {
  return (
    <div className="max-w-2xl mx-auto px-1">
      <div className="relative overflow-hidden bg-white rounded-3xl border border-border shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-navy-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <Icon name="UserCheck" size={26} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-cormorant font-bold text-xl sm:text-2xl text-navy-800">Проверка живым юристом</h2>
              <p className="text-sm text-muted-foreground mt-1">Эксперт-юрист проанализирует ответ AI или ваш документ</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
            {[
              { icon: "MessageCircle", title: "Личная переписка", desc: "Чат с экспертом-юристом" },
              { icon: "FileSearch", title: "Анализ документов и ответов AI", desc: "Юрист просматривает прикреплённые материалы" },
              { icon: "FileCheck", title: "Письменное заключение", desc: "Правовая оценка вашей ситуации" },
              { icon: "Clock", title: "Ответ за 24 часа", desc: "В рабочие дни" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-border/50">
                <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name={f.icon} size={14} className="text-navy-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-navy-800">{f.title}</p>
                  <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onPayClick}
            className="btn-gold w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
          >
            <Icon name="UserCheck" size={16} />
            Подключить — 1 500 ₽
          </button>
          <p className="text-xs text-muted-foreground mt-3 text-center">Защищённая оплата · доступ сразу после оплаты</p>
        </div>
      </div>
    </div>
  );
}
