import { useState } from "react";
import Icon from "@/components/ui/icon";

interface PricingSectionProps {
  onSelectPlan: (plan: string, price: string, serviceType: string) => void;
}

const PLANS = [
  {
    id: "consultation",
    name: "Консультация",
    price: "100",
    period: "3 вопроса",
    desc: "Задайте 3 вопроса AI-юристу по любой правовой теме",
    features: [
      "3 вопроса AI-юристу",
      "Ответ с ссылками на законы",
      "История в кабинете",
      "Уточняющие вопросы",
    ],
    notIncluded: ["Документы", "Проверка юриста"],
    popular: false,
    icon: "MessageCircle",
    color: "bg-slate-50",
  },
  {
    id: "document",
    name: "Документ",
    price: "500",
    period: "за документ",
    desc: "Готовый юридический документ: иск, претензия или жалоба",
    features: [
      "Исковое заявление",
      "Претензия / жалоба",
      "Скачать готовый файл",
      "Составлен по нормам РФ",
    ],
    notIncluded: ["Консультации", "Проверка юриста"],
    popular: false,
    icon: "FileText",
    color: "bg-amber-50/60",
  },
  {
    id: "business",
    name: "Для бизнеса",
    price: "1 000",
    period: "за договор",
    desc: "Договоры и юридические документы для бизнеса",
    features: [
      "Договор ГПХ / услуг",
      "Корпоративные соглашения",
      "Трудовые договоры",
      "Скачать готовый файл",
    ],
    notIncluded: ["Проверка живым юристом"],
    popular: true,
    icon: "Briefcase",
    color: "",
  },
  {
    id: "expert",
    name: "Проверка юристом",
    price: "1 500",
    period: "разово",
    desc: "Юрист анализирует ответ AI или документ и даёт заключение. Включает 3 вопроса к AI при отсутствии тарифа консультации",
    features: [
      "3 вопроса к AI (если нет тарифа)",
      "Личный чат с экспертом-юристом",
      "Анализ ответа AI или документа",
      "Ответ в течение 24 часов",
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
    <section id="pricing" className="py-16 sm:py-24 bg-gradient-to-b from-background to-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 sm:mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-3 sm:mb-4">
            Тарифы
          </span>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 mb-3 sm:mb-4">
            Прозрачные цены без скрытых платежей
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto px-4 sm:px-0">
            Платите только за то, что нужно — разово или по подписке
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch">
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
                  <Icon name={plan.icon} size={22} className={plan.popular ? "text-gold-300" : "text-navy-600"} />
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
                  onClick={() => onSelectPlan(plan.name, plan.price, plan.id)}
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

        {/* Subscription plans */}
        <div className="mt-6 sm:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {[
            {
              id: "subscription_consult",
              name: "Безлимитные консультации",
              price: "1 990",
              features: ["Неограниченные вопросы AI-юристу", "Все отрасли права", "История консультаций", "Приоритетная поддержка"],
              icon: "MessageCircle",
              badge: "🔥 Безлимит",
            },
            {
              id: "subscription_docs",
              name: "Безлимитные документы",
              price: "4 990",
              features: ["Неограниченная генерация документов", "Все типы документов", "Автозаполнение реквизитов", "Скачивание .docx"],
              icon: "FileText",
              badge: "🔥 Безлимит",
            },
          ].map((sub) => (
            <div key={sub.id} className="relative rounded-3xl border border-navy-200 bg-gradient-to-br from-navy-50 to-slate-50 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 card-hover cursor-pointer group"
              onClick={() => onSelectPlan(sub.name, sub.price, sub.id)}>
              <div className="w-11 h-11 sm:w-12 sm:h-12 gradient-navy rounded-2xl flex items-center justify-center shrink-0">
                <Icon name={sub.icon} size={20} className="text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className="font-semibold text-navy-800 text-sm">{sub.name}</span>
                  <span className="text-[10px] font-bold bg-gold-400/20 text-gold-700 px-2 py-0.5 rounded-full">{sub.badge}</span>
                </div>
                <ul className="space-y-0.5 mb-2">
                  {sub.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="Check" size={11} className="text-emerald-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-left sm:text-right shrink-0 w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-start">
                <div>
                  <div className="font-cormorant font-bold text-xl sm:text-2xl text-navy-800">{sub.price} ₽</div>
                  <div className="text-xs text-muted-foreground">в месяц</div>
                </div>
                <button className="btn-gold text-xs px-3 py-1.5 rounded-xl group-hover:shadow-md transition-shadow sm:mt-2">
                  Подключить
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
              <Icon name={badge.icon} size={16} className="text-navy-400" />
              <span>{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}