import { useState } from "react";
import Icon from "@/components/ui/icon";

interface PricingSectionProps {
  onSelectPlan: (plan: string, price: string, serviceType: string) => void;
  onSelectMax?: () => void;
}

const USER_PLANS = [
  {
    id: "document",
    name: "Пробный",
    price: "290",
    oldPrice: "",
    period: "",
    desc: "Познакомьтесь с сервисом — минимальный старт",
    badge: null,
    lawyerFeature: "",
    features: [
      "5 вопросов AI-юристу",
      "2 документа через систему",
      "Доступ к тарифу «Старт»",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Расчёт госпошлины",
      "Определение подсудности",
    ],
    popular: false,
    gradient: "",
    border: "border-border hover:border-navy-200",
  },
  {
    id: "plan_starter",
    name: "Старт",
    price: "990",
    oldPrice: "1 490",
    period: "",
    desc: "Консультации AI + живой юрист + документы",
    badge: null,
    lawyerFeature: "1 консультация живого юриста",
    features: [
      "30 вопросов AI-юристу",
      "До 5 документов через систему",
      "Анализ судебной практики при подготовке документа",
      "Рекомендации по документу от AI-юриста",
      "Генерация и скачивание .doc",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
    ],
    popular: false,
    gradient: "",
    border: "border-border hover:border-navy-200",
  },
  {
    id: "plan_pro",
    name: "Профи",
    price: "3 990",
    oldPrice: "5 990",
    period: "",
    desc: "Оптимальный выбор для активного использования",
    badge: "Хит",
    lawyerFeature: "3 консультации живого юриста с анализом документов",
    features: [
      "Всё из тарифа «Старт»",
      "70 вопросов AI-юристу",
      "До 20 документов через систему",
      "Загрузка PDF, DOCX, фото для анализа",
      "Определение перспективы дела",
      "Редактор документов через AI-юриста",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
    ],
    popular: true,
    gradient: "from-navy-600/60 to-navy-800/80",
    border: "border-gold-400/30",
  },
  {
    id: "plan_max",
    name: "Максимум",
    price: "5 990",
    oldPrice: "8 990",
    period: "",
    desc: "Для частых юридических задач",
    badge: "Рекомендуем",
    lawyerFeature: "10 консультаций живого юриста + 2 документа от юриста",
    features: [
      "Всё из тарифа «Профи»",
      "150 вопросов AI-юристу",
      "До 50 документов через систему",
      "Анализ нескольких документов сразу",
      "Приоритетный доступ к AI",
      "Загрузка PDF, DOCX, фото для анализа",
      "Редактор документов через AI-юриста",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
    ],
    popular: false,
    gradient: "from-navy-800 to-navy-900",
    border: "border-gold-400/50 hover:border-gold-400",
  },
];

const CORP_FEATURES = [
  { icon: "MessageCircle", text: "300 вопросов AI-юристу" },
  { icon: "FileText", text: "100 юридических документов" },
  { icon: "UserCheck", text: "20 консультаций живого юриста" },
  { icon: "BookOpen", text: "Поиск судебной практики" },
  { icon: "Calculator", text: "Калькулятор неустойки" },
  { icon: "MapPin", text: "Определение подсудности" },
  { icon: "Upload", text: "Загрузка PDF, DOCX, фото для анализа" },
  { icon: "Shield", text: "Приоритетная поддержка" },
  { icon: "PenLine", text: "2 документа от живого юриста" },
  { icon: "Download", text: "Скачивание документов в .doc" },
];

export default function PricingSection({ onSelectPlan, onSelectMax }: PricingSectionProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const handlePlanClick = (plan: typeof USER_PLANS[0]) => {
    if (plan.id === "plan_max" && onSelectMax) {
      onSelectMax();
    } else {
      onSelectPlan(plan.name, plan.price, plan.id);
    }
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-6 items-stretch">
          {USER_PLANS.map((plan, idx) => (
            <div
              key={plan.id}
              onMouseEnter={() => setHovered(plan.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handlePlanClick(plan)}
              className={`plan-card-animate relative flex flex-col rounded-3xl cursor-pointer transition-all duration-300 overflow-hidden ${
                plan.popular
                  ? "pricing-popular lg:scale-105"
                  : plan.id === "plan_max"
                    ? `border-2 ${plan.border} bg-gradient-to-br ${plan.gradient} hover:scale-[1.01] shadow-lg ${hovered === plan.id ? "shadow-gold-400/20 shadow-xl" : "shadow-black/20"}`
                    : `border ${plan.border} bg-gradient-to-br ${plan.gradient} backdrop-blur-sm hover:scale-[1.01] ${hovered === plan.id ? "shadow-xl shadow-black/30" : ""}`
              }`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {plan.popular && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                  <div className="absolute inset-0 rounded-3xl ring-1 ring-gold-400/25 pointer-events-none" />
                </>
              )}
              {plan.id === "plan_max" && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                  <div className="absolute inset-0 rounded-3xl ring-1 ring-gold-400/40 pointer-events-none" />
                </>
              )}
              {plan.badge && (
                <div className="absolute top-4 right-4">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    plan.popular ? "bg-gold-500 text-navy-900"
                    : plan.id === "plan_max" ? "bg-gold-400/25 text-gold-300 border border-gold-400/40"
                    : "bg-navy-100 text-navy-700"
                  }`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-6 sm:p-7 flex-1">
                {(() => {
                  const isDark = plan.popular || plan.id === "plan_max";
                  const isMax = plan.id === "plan_max";
                  return (
                    <>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-white/15" : "bg-navy-100"}`}>
                        <Icon name="Scale" size={18} className={isDark ? (isMax ? "text-gold-400" : "text-gold-300") : "text-navy-600"} />
                      </div>
                      <p className={`text-sm font-semibold mb-1 ${isDark ? "text-white/70" : "text-muted-foreground"}`}>{plan.name}</p>
                      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                        <span className={`font-cormorant font-bold text-4xl leading-none ${isDark ? "text-white" : "text-navy-800"}`}>{plan.price} ₽</span>
                        {plan.oldPrice && (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm line-through ${isDark ? "text-white/35" : "text-slate-400"}`}>{plan.oldPrice} ₽</span>
                            {(() => {
                              const p = parseInt(plan.price.replace(/\s/g, ""), 10);
                              const o = parseInt(plan.oldPrice.replace(/\s/g, ""), 10);
                              const pct = o > p ? Math.round(((o - p) / o) * 100) : 0;
                              return pct > 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500 text-white leading-none">−{pct}%</span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                      <p className={`text-xs mb-3 ${isDark ? "text-white/55" : "text-muted-foreground"}`}>{plan.period}</p>
                      <p className={`text-sm leading-relaxed mb-4 ${isDark ? "text-white/75" : "text-muted-foreground"}`}>{plan.desc}</p>
                      {plan.lawyerFeature && (
                        <div className="relative flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4 overflow-hidden"
                          style={isDark ? {
                            background: "linear-gradient(135deg, rgba(232,168,32,0.18) 0%, rgba(180,110,10,0.10) 100%)",
                            border: "1px solid rgba(232,168,32,0.35)",
                            boxShadow: "0 0 18px rgba(232,168,32,0.10) inset",
                          } : {
                            background: "linear-gradient(135deg, #f0f4ff 0%, #e8edf8 100%)",
                            border: "1px solid rgba(22,45,90,0.12)",
                          }}>
                          {isDark && (
                            <div className="absolute top-0 left-0 right-0 h-px"
                              style={{ background: "linear-gradient(90deg, transparent, rgba(232,168,32,0.5), transparent)" }} />
                          )}
                          <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                            style={isDark
                              ? { background: "rgba(232,168,32,0.25)", border: "1px solid rgba(232,168,32,0.4)" }
                              : { background: "rgba(22,45,90,0.08)" }}>
                            <Icon name="UserCheck" size={11} className={isDark ? "text-gold-400" : "text-navy-500"} />
                          </div>
                          <span className={`text-xs font-semibold leading-snug ${isDark ? "text-white" : "text-navy-700"}`}>{plan.lawyerFeature}</span>
                        </div>
                      )}
                      <ul className="space-y-2.5">
                        {plan.features.map((f) => (
                          <li key={f} className={`flex items-start gap-2.5 text-sm ${isDark ? "text-white/85" : "text-navy-700"}`}>
                            <Icon name="Check" size={14} className={`mt-0.5 shrink-0 ${isDark ? "text-gold-400" : "text-emerald-500"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </div>

              <div className="p-6 sm:p-7 pt-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePlanClick(plan); }}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                    plan.popular
                      ? "btn-gold hover:scale-[1.02] active:scale-[0.98]"
                      : plan.id === "plan_max"
                        ? "bg-gold-500 hover:bg-gold-400 text-navy-900 font-bold hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-navy-800 text-white hover:bg-navy-700 hover:shadow-lg"
                  }`}
                >
                  Выбрать тариф
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Корпоративный тариф */}
        <div
          className="biz-card-animate relative rounded-3xl overflow-hidden border border-gold-500/20 cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:shadow-black/40"
          onClick={() => onSelectPlan("Корпоративный тариф", "9 990", "plan_corporate")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-gold-400/8 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/3 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

          <div className="relative p-6 sm:p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">
              <div className="flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gold-400/20 rounded-2xl flex items-center justify-center">
                    <Icon name="Building2" size={22} className="text-gold-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold bg-gold-400/20 text-gold-300 px-2.5 py-1 rounded-full uppercase tracking-wider">Для компаний</span>
                    <h3 className="font-cormorant font-bold text-2xl sm:text-3xl text-white mt-1">Корпоративный</h3>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-cormorant font-bold text-5xl shimmer-gold">9 990 ₽</span>
                </div>
                <p className="text-white/75 text-sm mb-5 max-w-xs">
                  Максимальный пакет — всё включено для юридических нужд компании
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectPlan("Корпоративный тариф", "9 990", "plan_corporate"); }}
                  className="btn-gold px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 text-sm group-hover:scale-[1.02] transition-transform"
                >
                  <Icon name="Zap" size={15} />
                  Подключить
                </button>
              </div>

              <div className="hidden md:block w-px bg-white/10 self-stretch" />

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CORP_FEATURES.map((f) => (
                  <div key={f.text} className="flex items-center gap-2.5 group/item">
                    <div className="w-7 h-7 bg-white/8 border border-white/10 rounded-xl flex items-center justify-center shrink-0 group-hover/item:bg-gold-400/20 group-hover/item:border-gold-400/20 transition-all">
                      <Icon name={f.icon as Parameters<typeof Icon>[0]["name"]} size={13} className="text-gold-400" />
                    </div>
                    <span className="text-sm text-white/70 group-hover/item:text-white transition-colors">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4 opacity-70">
          * Подгрузка документов в чат доступна начиная с тарифа «Профи» и выше
        </p>
      </div>
    </section>
  );
}