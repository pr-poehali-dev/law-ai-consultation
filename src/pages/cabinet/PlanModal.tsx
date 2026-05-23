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
    price: "1 490",
    oldPrice: "2 490",
    questions: 30,
    docs: 5,
    lawyerFeature: "3 вопроса живому юристу",
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
}

export default function PlanModal({ user, onClose, onSelectPlan }: PlanModalProps) {
  const [visible, setVisible] = useState(false);
  const activePlanId = getActivePlan(user);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSelect = (plan: Plan) => {
    if (activePlanId === plan.id) return;
    onSelectPlan(plan.name, plan.price, plan.id);
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full sm:rounded-3xl sm:max-w-2xl flex flex-col shadow-2xl transition-all duration-250 ease-out rounded-t-3xl
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          max-h-[92dvh] sm:max-h-[90vh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Драг-хэндл мобайл */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 sm:pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Zap" size={16} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-bold text-navy-800 text-base leading-tight">Выберите тариф</h2>
              <p className="text-[11px] text-muted-foreground">Вопросы и документы начисляются сразу</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Тарифы */}
        <div className="overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3 flex-1">
          {PLANS.map((plan) => {
            const isActive = activePlanId === plan.id;
            const isDark = plan.color === "dark";
            const isMax = plan.color === "max";
            const savings = plan.oldPrice ? savingsLabel(plan.price, plan.oldPrice) : "";

            return (
              <div
                key={plan.id}
                onClick={() => handleSelect(plan)}
                className={`relative rounded-2xl border transition-all duration-200 overflow-hidden
                  ${isActive
                    ? "border-emerald-300 bg-emerald-50 cursor-default"
                    : isDark
                      ? "border-gold-400/30 bg-gradient-to-br from-navy-800 to-navy-900 hover:border-gold-400 hover:shadow-xl cursor-pointer active:scale-[0.99]"
                      : isMax
                        ? "border-slate-300 bg-gradient-to-br from-slate-800 to-navy-900 hover:border-slate-400 hover:shadow-xl cursor-pointer active:scale-[0.99]"
                        : "border-slate-200 bg-white hover:border-navy-300 hover:shadow-md cursor-pointer active:scale-[0.99]"
                  }`}
              >
                {/* Топ-полоска */}
                {isDark && !isActive && (
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                )}
                {isMax && !isActive && (
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-400 to-transparent" />
                )}

                <div className="p-4 sm:p-5">
                  {/* Строка: название + бейдж + цена + экономия */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-base sm:text-lg leading-tight ${(isDark || isMax) && !isActive ? "text-white" : "text-navy-800"}`}>
                        {plan.name}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide flex items-center gap-0.5">
                          <Icon name="Check" size={8} />Активен
                        </span>
                      )}
                      {!isActive && plan.badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${isDark ? "bg-gold-500 text-navy-900" : "bg-slate-500 text-white"}`}>
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    {/* Цена + старая цена + экономия */}
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-bold text-xl leading-none ${(isDark || isMax) && !isActive ? "text-white" : "text-navy-800"}`}>
                          {plan.price}
                        </span>
                        <span className={`text-sm font-normal ${(isDark || isMax) && !isActive ? "text-white/50" : "text-muted-foreground"}`}>₽</span>
                      </div>
                      {plan.oldPrice && !isActive && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[11px] line-through ${(isDark || isMax) ? "text-white/40" : "text-slate-400"}`}>
                            {plan.oldPrice} ₽
                          </span>
                          {savings && (
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-emerald-500 text-white leading-none">
                              {savings}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ключевые цифры */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${isActive ? "text-emerald-700" : (isDark || isMax) ? "text-gold-300" : "text-navy-600"}`}>
                      <Icon name="MessageCircle" size={13} />
                      <span>{plan.questions} вопросов AI</span>
                    </div>
                    <div className={`w-px h-3 ${isActive ? "bg-emerald-300" : (isDark || isMax) ? "bg-white/20" : "bg-slate-200"}`} />
                    <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${isActive ? "text-emerald-700" : (isDark || isMax) ? "text-gold-300" : "text-navy-600"}`}>
                      <Icon name="FileText" size={13} />
                      <span>{plan.docs} документов</span>
                    </div>
                  </div>

                  {/* Консультация юриста — выделенный блок */}
                  {plan.lawyerFeature && !isActive && (
                    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3 ${(isDark || isMax) ? "bg-gold-400/20 border border-gold-400/40" : "bg-navy-50 border border-navy-100"}`}>
                      <Icon name="User" size={13} className={(isDark || isMax) ? "text-gold-400 shrink-0" : "text-navy-500 shrink-0"} />
                      <span className={`text-[11px] font-semibold ${(isDark || isMax) ? "text-gold-200" : "text-navy-700"}`}>
                        {plan.lawyerFeature}
                      </span>
                    </div>
                  )}

                  {/* Список возможностей */}
                  <div className="grid grid-cols-1 gap-y-1.5 mb-3.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2">
                        <Icon
                          name="Check"
                          size={11}
                          className={`mt-0.5 shrink-0 ${isActive ? "text-emerald-500" : (isDark || isMax) ? "text-gold-400" : "text-navy-400"}`}
                        />
                        <span className={`text-[11.5px] leading-snug ${isActive ? "text-emerald-700" : (isDark || isMax) ? "text-white/75" : "text-slate-600"}`}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Кнопка / статус */}
                  {isActive ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-xl">
                      <Icon name="CheckCircle" size={13} className="text-emerald-600 shrink-0" />
                      <span className="text-xs text-emerald-700 font-medium">
                        Тариф активен · {user.paidQuestions ?? 0} вопр. · {user.paidDocs ?? 0} доку.
                      </span>
                    </div>
                  ) : (
                    <div className={`w-full py-2.5 rounded-xl text-sm font-bold text-center transition-colors
                      ${isDark
                        ? "bg-gold-500 text-navy-900 hover:bg-gold-400"
                        : isMax
                          ? "bg-slate-100 text-navy-800 hover:bg-white"
                          : "bg-navy-800 text-white hover:bg-navy-700"
                      }`}
                    >
                      Выбрать «{plan.name}»
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 shrink-0 text-center">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Безопасная оплата · Доступ сразу после оплаты · Нет автосписания
          </p>
        </div>
      </div>
    </div>
  );
}