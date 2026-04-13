import { useState } from "react";
import Icon from "@/components/ui/icon";

interface PricingSectionProps {
  onSelectPlan: (plan: string, price: string, serviceType: string) => void;
}

const USER_PLANS = [
  {
    id: "plan_starter",
    name: "Старт",
    price: "1 490",
    period: "/ месяц",
    desc: "Для тех, кто решает разовые вопросы",
    badge: null,
    features: [
      "30 вопросов AI-юристу",
      "5 готовых документов",
      "Анализ PDF-файлов и фото",
      "Подготовка документов AI",
      "Генерация .doc из диалога",
    ],
    color: "bg-white",
    popular: false,
  },
  {
    id: "plan_pro",
    name: "Профи",
    price: "3 990",
    period: "/ месяц",
    desc: "Оптимальный выбор для активного использования",
    badge: "Хит",
    features: [
      "100 вопросов AI-юристу",
      "20 готовых документов",
      "Анализ документов и фото",
      "Определение перспективы дела",
      "Генерация .doc из диалога",
      "История консультаций",
    ],
    color: "",
    popular: true,
  },
  {
    id: "plan_max",
    name: "Максимум",
    price: "5 990",
    period: "/ месяц",
    desc: "Для бизнеса и частых юридических задач",
    badge: "Максимум",
    features: [
      "до 300 вопросов AI-юристу",
      "50 готовых документов",
      "Всё из тарифа «Профи»",
      "Приоритетный доступ к AI",
      "Расширенный анализ документов",
    ],
    color: "bg-gradient-to-br from-navy-800/5 to-navy-900/10",
    popular: false,
  },
];

const BIZ_FEATURES = [
  { icon: "Zap", text: "150 юридических действий/мес" },
  { icon: "FileSearch", text: "Анализ договоров PDF и DOC" },
  { icon: "GitCompare", text: "Сравнение документов" },
  { icon: "Search", text: "Проверка контрагентов (due diligence)" },
  { icon: "Stamp", text: "Приказы и корпоративные документы" },
  { icon: "Download", text: "Скачивание договоров в .doc" },
  { icon: "Clock", text: "История запросов 24 часа" },
  { icon: "Plus", text: "Возможность докупить действия" },
];

export default function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-16 sm:py-24 bg-gradient-to-b from-background to-slate-50 overflow-hidden">
      <div className="container mx-auto px-4">

        {/* Заголовок */}
        <div className="text-center mb-10 sm:mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-3 sm:mb-4">
            Тарифы
          </span>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 mb-3">
            Прозрачные цены
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Платите только за то, что нужно — без скрытых платежей
          </p>
        </div>

        {/* Пользовательские тарифы */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6 items-stretch">
          {USER_PLANS.map((plan, idx) => (
            <div
              key={plan.id}
              onMouseEnter={() => setHovered(plan.id)}
              onMouseLeave={() => setHovered(null)}
              className={`plan-card-animate relative flex flex-col rounded-3xl border overflow-hidden cursor-pointer transition-all duration-300 ${
                plan.popular
                  ? "pricing-popular text-white shadow-2xl shadow-navy-900/20 scale-[1.02] sm:scale-105"
                  : `${plan.color} border-border hover:border-navy-200 hover:shadow-xl`
              } ${hovered === plan.id && !plan.popular ? "shadow-xl -translate-y-1" : ""}`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {plan.popular && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                  <div className="absolute -top-px -left-px -right-px h-full rounded-3xl pointer-events-none ring-2 ring-gold-400/30" />
                </>
              )}
              {plan.badge && (
                <div className="absolute top-4 right-4">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${plan.popular ? "bg-gold-500 text-navy-900" : "bg-navy-100 text-navy-700"}`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-6 sm:p-7 flex-1">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${plan.popular ? "bg-white/15" : "bg-navy-100"}`}>
                  <Icon name="Scale" size={18} className={plan.popular ? "text-gold-300" : "text-navy-600"} />
                </div>
                <p className={`text-sm font-semibold mb-1 ${plan.popular ? "text-white/70" : "text-muted-foreground"}`}>{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`font-cormorant font-bold text-4xl ${plan.popular ? "text-white" : "text-navy-800"}`}>{plan.price} ₽</span>
                </div>
                <p className={`text-xs mb-3 ${plan.popular ? "text-white/55" : "text-muted-foreground"}`}>{plan.period}</p>
                <p className={`text-sm leading-relaxed mb-5 ${plan.popular ? "text-white/70" : "text-muted-foreground"}`}>{plan.desc}</p>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.popular ? "text-white/85" : "text-navy-700"}`}>
                      <Icon name="Check" size={14} className={`mt-0.5 shrink-0 ${plan.popular ? "text-gold-400" : "text-emerald-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 sm:p-7 pt-0">
                <button
                  onClick={() => onSelectPlan(plan.name, plan.price, plan.id)}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                    plan.popular
                      ? "btn-gold hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-navy-800 text-white hover:bg-navy-700 hover:shadow-lg"
                  }`}
                >
                  Выбрать тариф
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Бизнес-тариф */}
        <div
          className="biz-card-animate relative rounded-3xl overflow-hidden border border-navy-700/20 cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:shadow-navy-900/15"
          onClick={() => onSelectPlan("Бизнес-тариф", "4 990", "business_subscription")}
        >
          {/* Фон */}
          <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-gold-400/8 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/3 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          {/* Анимированные линии */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

          <div className="relative p-6 sm:p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">

              {/* Левая часть */}
              <div className="flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gold-400/20 rounded-2xl flex items-center justify-center">
                    <Icon name="Briefcase" size={22} className="text-gold-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold bg-gold-400/20 text-gold-300 px-2.5 py-1 rounded-full uppercase tracking-wider">Для бизнеса</span>
                    <h3 className="font-cormorant font-bold text-2xl sm:text-3xl text-white mt-1">Бизнес-тариф</h3>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-cormorant font-bold text-5xl shimmer-gold">4 990 ₽</span>
                  <span className="text-white/50 text-sm">/ месяц</span>
                </div>
                <p className="text-white/60 text-sm mb-5 max-w-xs">
                  Полный юридический инструментарий для вашего бизнеса
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectPlan("Бизнес-тариф", "4 990", "business_subscription"); }}
                  className="btn-gold px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 text-sm group-hover:scale-[1.02] transition-transform"
                >
                  <Icon name="Zap" size={15} />
                  Подключить
                </button>
              </div>

              {/* Разделитель */}
              <div className="hidden md:block w-px bg-white/10 self-stretch" />

              {/* Правая часть — фичи */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BIZ_FEATURES.map((f) => (
                  <div key={f.text} className="flex items-center gap-2.5 group/item">
                    <div className="w-7 h-7 bg-white/10 rounded-xl flex items-center justify-center shrink-0 group-hover/item:bg-gold-400/20 transition-colors">
                      <Icon name={f.icon} size={13} className="text-gold-400" />
                    </div>
                    <span className="text-sm text-white/80 group-hover/item:text-white transition-colors">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Докупка действий */}
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-white/40 font-medium">Докупить действия:</span>
              {[
                { label: "+10", price: "1 000 ₽", id: "business_actions_10" },
                { label: "+30", price: "3 000 ₽", id: "business_actions_30" },
                { label: "+50", price: "3 500 ₽", id: "business_actions_50" },
                { label: "+150", price: "9 000 ₽", id: "business_actions_150" },
              ].map((a) => (
                <button
                  key={a.id}
                  onClick={(e) => { e.stopPropagation(); onSelectPlan(`${a.label} действий`, a.price, a.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white/70 hover:text-white rounded-xl text-xs font-medium transition-all"
                >
                  <Icon name="Plus" size={11} />
                  {a.label} — {a.price}
                </button>
              ))}
            </div>
          </div>
        </div>



      </div>
    </section>
  );
}