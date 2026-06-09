import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

interface Plan {
  id: string;
  name: string;
  price: string;
  oldPrice?: string;
  questions: number;
  docs: number;
  features: string[];
  lawyerFeature?: string;
  popular: boolean;
  badge: string | null;
  color: "light" | "dark" | "max";
}

export const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Старт",
    price: "990",
    oldPrice: "1 490",
    questions: 30,
    docs: 5,
    lawyerFeature: "1 консультация живого юриста",
    features: [
      "30 вопросов AI-юристу",
      "До 5 документов через систему",
      "Анализ судебной практики при подготовке документа",
      "Рекомендации по документу от AI-юриста",
      "Генерация и скачивание .doc",
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
    questions: 100,
    docs: 20,
    lawyerFeature: "5 вопросов живому юристу",
    features: [
      "Всё из тарифа «Старт»",
      "100 вопросов AI-юристу",
      "До 20 документов через систему",
      "Загрузка PDF, DOCX, фото для анализа",
      "Консультация юриста с анализом документов",
      "Редактор документов через AI-юриста",
      "Калькулятор расчёта неустойки",
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
    questions: 300,
    docs: 50,
    lawyerFeature: "30 вопросов живому юристу + 2 документа от юриста",
    features: [
      "Всё из тарифа «Профи»",
      "300 вопросов AI-юристу",
      "До 50 документов через систему",
      "Анализ нескольких документов одновременно",
      "Загрузка PDF, DOCX, фото для анализа",
      "Редактор документов через AI-юриста",
      "Калькулятор расчёта неустойки",
      "Приоритетная поддержка",
    ],
    popular: false,
    badge: "Рекомендуем",
    color: "max",
  },
];

export function getActivePlan(user: User): string | null {
  if ((user.paidQuestions ?? 0) >= 300 || (user.paidDocs ?? 0) >= 50) return "plan_max";
  if ((user.paidQuestions ?? 0) >= 100 || (user.paidDocs ?? 0) >= 20) return "plan_pro";
  if ((user.paidQuestions ?? 0) >= 30 || (user.paidDocs ?? 0) >= 5) return "plan_starter";
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

const BG = "#0a1628";
const GOLD = "#e8a820";
const GOLD_LIGHT = "#f0c060";

export default function PlanModal({ user, onClose, onSelectPlan, minPlanId }: PlanModalProps) {
  const [visible, setVisible] = useState(false);
  const activePlanId = getActivePlan(user);

  const planOrder = ["plan_starter", "plan_pro", "plan_max"];
  const minIdx = minPlanId ? planOrder.indexOf(minPlanId) : 0;
  const visiblePlans = minIdx > 0 ? PLANS.filter(p => planOrder.indexOf(p.id) >= minIdx) : PLANS;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 250); };
  const handleSelect = (plan: Plan) => {
    if (activePlanId === plan.id) return;
    onSelectPlan(plan.name, plan.price, plan.id);
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/65 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`w-full sm:max-w-xl flex flex-col shadow-2xl transition-all duration-250 ease-out rounded-t-3xl sm:rounded-3xl overflow-hidden
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          max-h-[94dvh] sm:max-h-[90vh]`}
        style={{ background: BG }}
        onClick={e => e.stopPropagation()}
      >
        {/* Золотая линия сверху */}
        <div className="shrink-0" style={{ height: 3, background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_LIGHT} 50%, ${GOLD} 70%, transparent)` }} />

        {/* Свайп-хэндл */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(232,168,32,0.15)`, border: `1px solid rgba(232,168,32,0.3)` }}>
              <Icon name="Zap" size={16} color={GOLD} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base leading-tight">Выберите тариф</h2>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Доступ сразу после оплаты · Нет автосписания</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10">
            <Icon name="X" size={16} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Тарифы */}
        <div className="overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 space-y-3 flex-1">
          {visiblePlans.map((plan) => {
            const isActive = activePlanId === plan.id;
            const isDark = plan.color === "dark";   // Профи
            const isMax = plan.color === "max";      // Максимум
            const isLight = plan.color === "light";  // Старт
            const savings = plan.oldPrice ? savingsLabel(plan.price, plan.oldPrice) : "";

            // Цвета текста
            const textPrimary = isActive ? "#059669" : (isLight ? "#1e3a5f" : "#fff");
            const textSecondary = isActive ? "#10b981" : (isLight ? "#475569" : "rgba(255,255,255,0.65)");
            const textMuted = isActive ? "#6ee7b7" : (isLight ? "#94a3b8" : "rgba(255,255,255,0.4)");

            // Фон карточки
            const cardBg = isActive
              ? "rgba(16,185,129,0.08)"
              : isLight
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.06)";

            // Рамка карточки
            const cardBorder = isActive
              ? "1.5px solid rgba(16,185,129,0.5)"
              : isMax
                ? `1.5px solid ${GOLD}` // золотой ободок для Максимума
                : isDark
                  ? "1.5px solid rgba(232,168,32,0.35)"
                  : "1.5px solid rgba(255,255,255,0.1)";

            return (
              <div
                key={plan.id}
                onClick={() => handleSelect(plan)}
                className="relative rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: cardBg,
                  border: cardBorder,
                  cursor: isActive ? "default" : "pointer",
                  ...(isMax && !isActive ? { boxShadow: `0 0 20px rgba(232,168,32,0.15)` } : {}),
                }}
              >
                {/* Золотая линия для Максимум и Профи */}
                {(isDark || isMax) && !isActive && (
                  <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_LIGHT} 50%, ${GOLD} 70%, transparent)` }} />
                )}

                <div className="p-4">
                  {/* Шапка карточки */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-base sm:text-lg leading-tight" style={{ color: textPrimary }}>
                        {plan.name}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1"
                          style={{ background: "rgba(16,185,129,0.2)", color: "#34d399" }}>
                          <Icon name="Check" size={8} color="#34d399" />Активен
                        </span>
                      )}
                      {!isActive && plan.badge && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: isMax ? `rgba(232,168,32,0.25)` : isDark ? `rgba(232,168,32,0.2)` : "rgba(255,255,255,0.1)", color: isMax || isDark ? GOLD_LIGHT : "rgba(255,255,255,0.7)" }}>
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    {/* Цена */}
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-xl leading-none" style={{ color: isActive ? "#34d399" : isLight ? "#1e3a5f" : GOLD_LIGHT }}>
                          {plan.price}
                        </span>
                        <span className="text-sm font-normal" style={{ color: textMuted }}>₽</span>
                      </div>
                      {plan.oldPrice && !isActive && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] line-through" style={{ color: textMuted }}>{plan.oldPrice} ₽</span>
                          {savings && (
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}>{savings}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Счётчики */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Icon name="MessageCircle" size={12} color={isActive ? "#34d399" : (isDark || isMax) ? GOLD : "#64748b"} />
                      <span className="text-[12px] font-semibold" style={{ color: isActive ? "#34d399" : (isDark || isMax) ? GOLD : "#64748b" }}>{plan.questions} вопросов AI</span>
                    </div>
                    <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.12)" }} />
                    <div className="flex items-center gap-1.5">
                      <Icon name="FileText" size={12} color={isActive ? "#34d399" : (isDark || isMax) ? GOLD : "#64748b"} />
                      <span className="text-[12px] font-semibold" style={{ color: isActive ? "#34d399" : (isDark || isMax) ? GOLD : "#64748b" }}>{plan.docs} документов</span>
                    </div>
                  </div>

                  {/* Блок юриста */}
                  {plan.lawyerFeature && !isActive && (
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
                      style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.3)" }}>
                      <Icon name="User" size={12} color={GOLD} />
                      <span className="text-[11px] font-semibold" style={{ color: GOLD_LIGHT }}>{plan.lawyerFeature}</span>
                    </div>
                  )}

                  {/* Список фич */}
                  <div className="space-y-1 mb-3.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2">
                        <Icon name="Check" size={10} color={isActive ? "#34d399" : (isDark || isMax) ? GOLD : "#64748b"} className="mt-0.5 shrink-0" />
                        <span className="text-[11.5px] leading-snug" style={{ color: textSecondary }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Кнопка */}
                  {isActive ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                      <Icon name="CheckCircle" size={13} color="#34d399" className="shrink-0" />
                      <span className="text-xs font-medium" style={{ color: "#34d399" }}>
                        Активен · {user.paidQuestions ?? 0} вопр. · {user.paidDocs ?? 0} доку.
                      </span>
                    </div>
                  ) : (
                    <button
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                      style={
                        isMax
                          ? { background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }
                          : isDark
                            ? { background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG }
                            : { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }
                      }
                    >
                      Выбрать «{plan.name}»
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 shrink-0 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты · Нет автосписания
          </p>
        </div>
      </div>
    </div>
  );
}