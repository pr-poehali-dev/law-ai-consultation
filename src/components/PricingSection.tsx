import { useState } from "react";
import Icon from "@/components/ui/icon";

interface PricingSectionProps {
  onSelectPlan: (plan: string, price: string) => void;
}

const PLANS = [
  {
    id: "basic",
    name: "Базовый",
    price: "499",
    period: "разово",
    desc: "Одна AI-консультация по любому правовому вопросу",
    features: [
      "1 консультация AI",
      "Ответ за 2–3 минуты",
      "История в кабинете",
      "Уточняющий вопрос",
    ],
    notIncluded: ["Документы", "Проверка юриста"],
    popular: false,
    icon: "MessageCircle",
    color: "bg-slate-50",
  },
  {
    id: "document",
    name: "Документ",
    price: "799",
    period: "за документ",
    desc: "Готовый юридический документ по вашим данным",
    features: [
      "1 документ любого типа",
      "Персонализация данных",
      "Скачать PDF / DOCX",
      "1 правка бесплатно",
    ],
    notIncluded: ["Консультации в наборе", "Проверка юриста"],
    popular: false,
    icon: "FileText",
    color: "bg-amber-50/60",
  },
  {
    id: "profi",
    name: "Профи",
    price: "1 990",
    period: "в месяц",
    desc: "Подписка для активных пользователей",
    features: [
      "5 консультаций AI / мес",
      "2 документа / мес",
      "Приоритетная обработка",
      "История и архив",
      "Уведомления об изменениях закона",
    ],
    notIncluded: ["Проверка живым юристом"],
    popular: true,
    icon: "Star",
    color: "",
  },
  {
    id: "expert",
    name: "Эксперт",
    price: "4 990",
    period: "в месяц",
    desc: "Максимальная защита: AI + живой юрист",
    features: [
      "Безлимит консультаций AI",
      "5 документов / мес",
      "Проверка живым юристом",
      "Юридическое заключение",
      "Персональный менеджер",
      "Приоритетная поддержка 24/7",
    ],
    notIncluded: [],
    popular: false,
    icon: "Shield",
    color: "bg-gradient-to-br from-navy-700/5 to-navy-800/10",
  },
];

export default function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-background to-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-4">
            Тарифы
          </span>
          <h2 className="font-cormorant font-bold text-4xl md:text-5xl text-navy-800 mb-4">
            Прозрачные цены без скрытых платежей
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Платите только за то, что нужно — разово или по подписке
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border transition-all duration-300 overflow-hidden cursor-pointer ${
                plan.popular
                  ? "pricing-popular text-white"
                  : `${plan.color} border-border bg-card card-hover hover:border-navy-200`
              } ${hoveredPlan === plan.id && !plan.popular ? "shadow-xl shadow-navy-900/10" : ""}`}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
              )}
              {plan.popular && (
                <div className="absolute top-4 right-4">
                  <span className="bg-gold-500 text-navy-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Популярный
                  </span>
                </div>
              )}

              <div className="p-7 flex-1">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-5 ${plan.popular ? "bg-white/15" : "bg-navy-100"}`}>
                  <Icon name={plan.icon as any} size={22} className={plan.popular ? "text-gold-300" : "text-navy-600"} />
                </div>

                <div className={`text-sm font-semibold mb-1 ${plan.popular ? "text-white/70" : "text-muted-foreground"}`}>
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`font-cormorant font-bold text-4xl ${plan.popular ? "text-white" : "text-navy-800"}`}>
                    {plan.price} ₽
                  </span>
                </div>
                <div className={`text-xs mb-3 ${plan.popular ? "text-white/55" : "text-muted-foreground"}`}>
                  {plan.period}
                </div>
                <p className={`text-sm leading-relaxed mb-6 ${plan.popular ? "text-white/70" : "text-muted-foreground"}`}>
                  {plan.desc}
                </p>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.popular ? "text-white/85" : "text-navy-700"}`}>
                      <Icon name="Check" size={15} className={`mt-0.5 shrink-0 ${plan.popular ? "text-gold-400" : "text-emerald-500"}`} />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.popular ? "text-white/35" : "text-muted-foreground/60"}`}>
                      <Icon name="X" size={15} className="mt-0.5 shrink-0 opacity-50" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-7 pt-0">
                <button
                  onClick={() => onSelectPlan(plan.name, plan.price)}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    plan.popular
                      ? "btn-gold"
                      : "bg-navy-800 text-white hover:bg-navy-700 hover:shadow-lg"
                  }`}
                >
                  Выбрать тариф
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          {[
            { icon: "Lock", text: "Безопасная оплата" },
            { icon: "RefreshCw", text: "Возврат в течение 3 дней" },
            { icon: "Award", text: "Данные защищены" },
            { icon: "HeadphonesIcon", text: "Поддержка 24/7" },
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2">
              <Icon name={badge.icon as any} size={16} className="text-navy-400" />
              <span>{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
