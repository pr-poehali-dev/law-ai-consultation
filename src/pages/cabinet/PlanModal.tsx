import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { hasActiveSubscription, type User } from "@/lib/auth";

interface Plan {
  id: string;
  name: string;
  price: string;
  oldPrice?: string;
  /** Единое количество запросов к AI (объединяет прежние "вопросы" и "документы") */
  requests: number;
  features: string[];
  lawyerFeature?: string;
  popular: boolean;
  badge: string | null;
  color: "light" | "dark" | "max";
}

export const PLANS: Plan[] = [
  {
    id: "document",
    name: "Пробный",
    price: "290",
    requests: 7,
    features: [
      "7 запросов к AI",
      "AI-редактор документов",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Расчёт госпошлины",
      "Определение подсудности",
    ],
    popular: false,
    badge: null,
    color: "light",
  },
  {
    id: "plan_starter",
    name: "Старт",
    price: "990",
    oldPrice: "1 490",
    requests: 35,
    lawyerFeature: "1 полная консультация юриста-эксперта",
    features: [
      "35 запросов к AI",
      "1 полная консультация юриста-эксперта",
      "Загрузка PDF, DOCX, фото для анализа",
      "AI-редактор и уточнение у AI-юриста",
      "Анализ судебной практики при подготовке документа",
      "Рекомендации по документу от AI-юриста",
      "Генерация и скачивание .doc",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
    ],
    popular: false,
    badge: null,
    color: "light",
  },
  {
    id: "plan_pro",
    name: "Профи",
    price: "3 990",
    oldPrice: "5 990",
    requests: 90,
    lawyerFeature: "3 полные консультации юриста-эксперта",
    features: [
      "Всё из тарифа «Старт»",
      "90 запросов к AI",
      "3 полные консультации юриста-эксперта",
      "Консультация юриста с анализом документов",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
    ],
    popular: true,
    badge: "Хит",
    color: "dark",
  },
  {
    id: "plan_max",
    name: "Максимум",
    price: "5 990",
    oldPrice: "8 990",
    requests: 200,
    lawyerFeature: "10 полных консультаций юриста-эксперта",
    features: [
      "Всё из тарифа «Профи»",
      "200 запросов к AI",
      "10 полных консультаций юриста-эксперта",
      "Анализ нескольких документов одновременно",
      "Загрузка PDF, DOCX, фото для анализа",
      "Редактор документов через AI-юриста",
      "Приоритетная поддержка",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
    ],
    popular: false,
    badge: "Рекомендуем",
    color: "max",
  },
  {
    id: "plan_corporate",
    name: "Корпоративный",
    price: "9 990",
    oldPrice: "",
    requests: 400,
    lawyerFeature: "20 полных консультаций юриста-эксперта",
    features: [
      "Всё из тарифа «Максимум»",
      "400 запросов к AI",
      "20 полных консультаций юриста-эксперта",
      "Анализ нескольких документов одновременно",
      "Загрузка PDF, DOCX, фото для анализа",
      "Поиск судебной практики",
      "Калькулятор неустойки",
      "Определение подсудности",
      "Приоритетная поддержка",
    ],
    popular: false,
    badge: "Для компаний",
    color: "max",
  },
];

/** Тариф определяется ТОЛЬКО по факту покупки (purchasedPlan) — не по остатку запросов.
 * Так пользователь, истративший весь баланс, по-прежнему видит купленный тариф
 * (просто с пометкой "лимит исчерпан"), а не "тариф не подключён". */
export function getActivePlan(user: User): string | null {
  if (user.purchasedPlan === "max") return "plan_max";
  if (user.purchasedPlan === "pro") return "plan_pro";
  if (user.purchasedPlan === "starter") return "plan_starter";
  if (user.purchasedPlan === "trial") return "document";
  return null;
}

function savingsLabel(price: string, oldPrice: string): string {
  const p = parseInt(price.replace(/\s/g, ""), 10);
  const o = parseInt(oldPrice.replace(/\s/g, ""), 10);
  if (!p || !o || o <= p) return "";
  const pct = Math.round(((o - p) / o) * 100);
  return `−${pct}%`;
}

interface PlanModalProps {
  user: User;
  onClose: () => void;
  onSelectPlan: (name: string, price: string, id: string) => void;
  minPlanId?: string;
}

// Иконки для каждого тарифа
const PLAN_ICONS: Record<string, string> = {
  document: "Sparkles",
  plan_starter: "Rocket",
  plan_pro: "Zap",
  plan_max: "Crown",
  plan_corporate: "Building2",
};

// Ключевые метрики по тарифу (для визуальных пилюль)
const PLAN_PILLS: Record<string, { icon: string; label: string }[]> = {
  document: [
    { icon: "MessageCircle", label: "7 запросов к AI" },
    { icon: "Rocket", label: "Доступ к «Старт»" },
  ],
  plan_starter: [
    { icon: "MessageCircle", label: "35 запросов к AI" },
    { icon: "UserCheck", label: "1 консультация" },
  ],
  plan_pro: [
    { icon: "MessageCircle", label: "90 запросов к AI" },
    { icon: "UserCheck", label: "3 консультации" },
  ],
  plan_max: [
    { icon: "MessageCircle", label: "200 запросов к AI" },
    { icon: "UserCheck", label: "10 консультаций" },
  ],
  plan_corporate: [
    { icon: "MessageCircle", label: "400 запросов к AI" },
    { icon: "UserCheck", label: "20 консультаций" },
  ],
};

export default function PlanModal({ user, onClose, onSelectPlan, minPlanId }: PlanModalProps) {
  const [visible, setVisible] = useState(false);
  const activePlanId = getActivePlan(user);
  // Тариф куплен, но лимит запросов исчерпан и нет безлимитной подписки —
  // в этом случае карточка активного тарифа не блокирует клик, а предлагает продлить.
  const isExhausted = !!activePlanId
    && (user.paidRequests ?? 0) <= 0
    && !hasActiveSubscription(user, "consult")
    && !hasActiveSubscription(user, "docs");

  const planOrder = ["document", "plan_starter", "plan_pro", "plan_max", "plan_corporate"];
  const minIdx = minPlanId ? planOrder.indexOf(minPlanId) : 0;
  // Тариф «Пробный» — только для знакомства с сервисом, доступен один раз.
  // Если пользователь уже что-то покупал — скрываем его из списка.
  const basePlans = user.purchasedPlan ? PLANS.filter(p => p.id !== "document") : PLANS;
  const visiblePlans = minIdx > 0 ? basePlans.filter(p => planOrder.indexOf(p.id) >= minIdx) : basePlans;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 250); };
  const handleSelect = (plan: Plan) => {
    // Активный тариф с остатком — клик по нему ничего не делает (уже подключён).
    // Но если лимит исчерпан — разрешаем нажать и купить/продлить тот же тариф.
    if (activePlanId === plan.id && !isExhausted) return;
    onSelectPlan(plan.name, plan.price, plan.id);
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/70 backdrop-blur-md" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`w-full sm:max-w-lg flex flex-col shadow-2xl transition-all duration-250 ease-out rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[94dvh] sm:max-h-[90vh]`}
        style={{ background: "linear-gradient(170deg, #0d1f3c 0%, #091528 100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Радужная полоска сверху */}
        <div className="shrink-0 h-[3px]" style={{ background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 30%, #e8a820 60%, #f0c060 80%, #e8a820 100%)" }} />

        {/* Свайп-хэндл */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden shrink-0">
          <div className="w-10 h-[5px] rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-4 sm:pt-5 pb-4 shrink-0">
          <div>
            <h2 className="font-bold text-white text-lg leading-tight tracking-tight">Тарифные планы</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Доступ сразу · Без автосписания</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <Icon name="X" size={15} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Карточки тарифов */}
        <div className="overflow-y-auto px-4 sm:px-5 pb-4 space-y-3 flex-1">
          {visiblePlans.map((plan, idx) => {
            const isActiveWithBalance = activePlanId === plan.id && !isExhausted;
            const isActiveExhausted = activePlanId === plan.id && isExhausted;
            const isActive = isActiveWithBalance; // используется ниже только для "зелёного" вида
            const isPro = plan.color === "dark";
            const isMax = plan.color === "max";
            const isLight = plan.color === "light";
            const savings = plan.oldPrice ? savingsLabel(plan.price, plan.oldPrice) : "";
            const pills = PLAN_PILLS[plan.id] ?? [];
            const planIcon = PLAN_ICONS[plan.id] ?? "Zap";

            // Градиенты и акценты по типу
            const accentColor = isActive
              ? "#10b981"
              : isActiveExhausted
                ? "#f87171"
                : isMax
                  ? "#f0c060"
                  : isPro
                    ? "#a78bfa"
                    : "#60a5fa";

            const cardGradient = isActive
              ? "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)"
              : isActiveExhausted
                ? "linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(248,113,113,0.04) 100%)"
                : isMax
                  ? "linear-gradient(135deg, rgba(240,192,96,0.1) 0%, rgba(232,168,32,0.04) 100%)"
                  : isPro
                    ? "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(109,40,217,0.04) 100%)"
                    : "linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(59,130,246,0.02) 100%)";

            const cardBorder = isActive
              ? "1.5px solid rgba(16,185,129,0.45)"
              : isActiveExhausted
                ? "1.5px solid rgba(248,113,113,0.45)"
                : isMax
                  ? "1.5px solid rgba(240,192,96,0.45)"
                  : isPro
                    ? "1.5px solid rgba(139,92,246,0.35)"
                    : "1.5px solid rgba(96,165,250,0.2)";

            const btnStyle = isActive
              ? { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", cursor: "default" }
              : isActiveExhausted
                ? { background: "linear-gradient(135deg, #dc2626, #f87171)", color: "#fff" }
                : isMax
                  ? { background: "linear-gradient(135deg, #e8a820, #f0c060)", color: "#0a1628" }
                  : isPro
                    ? { background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff" }
                    : { background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", color: "#fff" };

            return (
              <div
                key={plan.id}
                onClick={() => handleSelect(plan)}
                className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${!isActive ? "hover:scale-[1.01] active:scale-[0.99]" : ""}`}
                style={{
                  background: cardGradient,
                  border: cardBorder,
                  cursor: isActive ? "default" : "pointer",
                  ...(isMax && !isActive && !isActiveExhausted ? { boxShadow: "0 4px 24px rgba(240,192,96,0.12)" } : {}),
                  ...(isPro && !isActive && !isActiveExhausted ? { boxShadow: "0 4px 24px rgba(139,92,246,0.12)" } : {}),
                }}
              >
                {/* Популярный — тонкая линия акцента сверху */}
                {(isPro || isMax) && !isActive && !isActiveExhausted && (
                  <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
                )}

                <div className="p-4">
                  {/* Верхняя строка: иконка + название + бейдж + цена */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      {/* Иконка тарифа */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
                      >
                        <Icon name={planIcon as Parameters<typeof Icon>[0]["name"]} size={16} color={accentColor} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-base leading-tight">{plan.name}</span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                              style={{ background: "rgba(16,185,129,0.2)", color: "#34d399" }}>
                              <Icon name="CheckCircle" size={8} color="#34d399" />Активен
                            </span>
                          )}
                          {isActiveExhausted && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                              style={{ background: "rgba(248,113,113,0.2)", color: "#f87171" }}>
                              <Icon name="AlertCircle" size={8} color="#f87171" />Лимит исчерпан
                            </span>
                          )}
                          {!isActive && !isActiveExhausted && plan.badge && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                              style={{ background: `${accentColor}25`, color: accentColor }}
                            >
                              {isMax && <Icon name="Star" size={7} color={accentColor} />}
                              {isPro && <Icon name="Flame" size={7} color={accentColor} />}
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        {/* Счётчик запросов — маленький */}
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {plan.requests} запр. к AI
                        </p>
                      </div>
                    </div>

                    {/* Цена */}
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-baseline gap-0.5">
                        <span className="font-black text-2xl leading-none" style={{ color: isActive ? "#34d399" : accentColor }}>
                          {plan.price}
                        </span>
                        <span className="text-xs font-medium ml-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>₽</span>
                      </div>
                      {plan.oldPrice && !isActive && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] line-through" style={{ color: "rgba(255,255,255,0.25)" }}>{plan.oldPrice} ₽</span>
                          {savings && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
                              {savings}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Пилюли — ключевые параметры */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {pills.map((pill) => (
                      <div
                        key={pill.label}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}25` }}
                      >
                        <Icon name={pill.icon as Parameters<typeof Icon>[0]["name"]} size={10} color={accentColor} />
                        {pill.label}
                      </div>
                    ))}
                  </div>

                  {/* Разделитель */}
                  <div className="mb-3" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

                  {/* Фичи */}
                  <div className="space-y-1.5 mb-3.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${accentColor}18` }}>
                          <Icon name="Check" size={9} color={accentColor} />
                        </div>
                        <span className="text-[11.5px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Юрист-фича */}
                  {plan.lawyerFeature && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
                      style={{ background: "rgba(232,168,32,0.08)", border: "1px solid rgba(232,168,32,0.2)" }}
                    >
                      <Icon name="Scale" size={12} color="#e8a820" />
                      <span className="text-[11px] font-medium" style={{ color: "#f0c060" }}>{plan.lawyerFeature}</span>
                    </div>
                  )}

                  {/* Кнопка */}
                  {isActive ? (
                    <div
                      className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2"
                      style={btnStyle}
                    >
                      <Icon name="CheckCircle" size={13} color="#34d399" />
                      <span className="text-xs font-semibold">
                        Активен · {user.paidRequests ?? 0} запр.
                      </span>
                    </div>
                  ) : isActiveExhausted ? (
                    <button
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] hover:opacity-90 flex items-center justify-center gap-2"
                      style={btnStyle}
                    >
                      <Icon name="RotateCw" size={13} color="#fff" />
                      Продлить «{plan.name}»
                    </button>
                  ) : (
                    <button
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] hover:opacity-90"
                      style={btnStyle}
                    >
                      {idx === 0 ? `Начать с тарифа «${plan.name}»` : `Выбрать «${plan.name}»`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-center gap-4">
            {[
              { icon: "Lock", text: "Безопасная оплата" },
              { icon: "Zap", text: "Доступ сразу" },
              { icon: "ShieldCheck", text: "Без подписки" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-1">
                <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={10} color="rgba(255,255,255,0.25)" />
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}