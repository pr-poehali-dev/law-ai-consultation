import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

interface Plan {
  id: string;
  name: string;
  price: string;
  questions: number;
  docs: number;
  features: string[];
  popular: boolean;
  badge: string | null;
}

const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Старт",
    price: "990",
    questions: 30,
    docs: 5,
    features: ["30 вопросов AI-юристу", "5 готовых документов", "Анализ PDF и фото"],
    popular: false,
    badge: null,
  },
  {
    id: "plan_pro",
    name: "Профи",
    price: "3 990",
    questions: 100,
    docs: 20,
    features: ["100 вопросов AI-юристу", "20 готовых документов", "Анализ документов и фото", "Перспектива дела"],
    popular: true,
    badge: "Хит",
  },
  {
    id: "plan_max",
    name: "Максимум",
    price: "5 990",
    questions: 300,
    docs: 50,
    features: ["до 300 вопросов AI-юристу", "50 готовых документов", "Всё из «Профи» + приоритет"],
    popular: false,
    badge: null,
  },
];

function getActivePlan(user: User): string | null {
  if ((user.paidQuestions ?? 0) >= 300 || (user.paidDocs ?? 0) >= 50) return "plan_max";
  if ((user.paidQuestions ?? 0) >= 100 || (user.paidDocs ?? 0) >= 20) return "plan_pro";
  if ((user.paidQuestions ?? 0) >= 30 || (user.paidDocs ?? 0) >= 5) return "plan_starter";
  return null;
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
        className={`bg-white w-full sm:rounded-3xl sm:max-w-xl flex flex-col shadow-2xl transition-all duration-250 ease-out rounded-t-3xl
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          max-h-[88dvh] sm:max-h-[90vh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Драг-хэндл мобайл */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Zap" size={15} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-semibold text-navy-800 text-sm sm:text-base leading-tight">Выгодный тариф</h2>
              <p className="text-[11px] text-muted-foreground">Вопросы и документы начисляются сразу</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Тарифы — скролл на мобиле */}
        <div className="overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 space-y-2.5 flex-1">
          {PLANS.map((plan) => {
            const isActive = activePlanId === plan.id;
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                onClick={() => handleSelect(plan)}
                className={`relative rounded-2xl border transition-all duration-200 overflow-hidden
                  ${isActive
                    ? "border-emerald-300 bg-emerald-50 cursor-default"
                    : isPopular
                      ? "border-gold-400/40 bg-gradient-to-br from-navy-800 to-navy-900 hover:border-gold-400 hover:shadow-lg cursor-pointer active:scale-[0.99]"
                      : "border-border bg-white hover:border-navy-300 hover:shadow-md cursor-pointer active:scale-[0.99]"
                  }`}
              >
                {/* Топ-полоска популярного */}
                {isPopular && !isActive && (
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                )}

                <div className="p-3.5 sm:p-4">
                  {/* Строка: название + бейдж + цена */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-base ${isPopular && !isActive ? "text-white" : "text-navy-800"}`}>
                        {plan.name}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide flex items-center gap-0.5">
                          <Icon name="Check" size={8} />Активен
                        </span>
                      )}
                      {!isActive && plan.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gold-500 text-navy-900 uppercase tracking-wide">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <span className={`font-bold text-lg ${isPopular && !isActive ? "text-white" : "text-navy-800"}`}>
                      {plan.price} <span className={`text-xs font-normal ${isPopular && !isActive ? "text-white/60" : "text-muted-foreground"}`}>₽</span>
                    </span>
                  </div>

                  {/* Ключевые цифры */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className={`flex items-center gap-1 text-xs font-semibold ${isActive ? "text-emerald-700" : isPopular ? "text-gold-300" : "text-navy-600"}`}>
                      <Icon name="MessageCircle" size={12} />
                      {plan.questions} вопр.
                    </div>
                    <div className={`w-px h-3 ${isActive ? "bg-emerald-300" : isPopular ? "bg-white/20" : "bg-slate-200"}`} />
                    <div className={`flex items-center gap-1 text-xs font-semibold ${isActive ? "text-emerald-700" : isPopular ? "text-gold-300" : "text-navy-600"}`}>
                      <Icon name="FileText" size={12} />
                      {plan.docs} доку.
                    </div>
                  </div>

                  {/* Фичи — компактно */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                    {plan.features.map((f) => (
                      <span key={f} className={`text-[11px] flex items-center gap-1 ${isActive ? "text-emerald-600" : isPopular ? "text-white/70" : "text-muted-foreground"}`}>
                        <Icon name="Check" size={10} className={isActive ? "text-emerald-500" : isPopular ? "text-gold-400" : "text-navy-400"} />
                        {f}
                      </span>
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
                    <div className={`w-full py-2 rounded-xl text-sm font-semibold text-center
                      ${isPopular ? "bg-gold-500 text-navy-900" : "bg-navy-800 text-white"}`}>
                      Подключить · {plan.price} ₽
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 shrink-0 border-t border-slate-50">
          <p className="text-[10px] sm:text-[11px] text-center text-muted-foreground">
            Без подписки · Начисляется сразу после оплаты · Без автосписаний
          </p>
        </div>
      </div>
    </div>
  );
}

export { PLANS, getActivePlan };