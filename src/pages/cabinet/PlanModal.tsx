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
    price: "1 490",
    questions: 30,
    docs: 5,
    features: ["30 вопросов AI-юристу", "5 готовых документов", "Анализ PDF и фото", "История консультаций"],
    popular: false,
    badge: null,
  },
  {
    id: "plan_pro",
    name: "Профи",
    price: "3 990",
    questions: 100,
    docs: 20,
    features: ["100 вопросов AI-юристу", "20 готовых документов", "Анализ документов и фото", "Перспектива дела", "Генерация .doc из диалога"],
    popular: true,
    badge: "Хит",
  },
  {
    id: "plan_max",
    name: "Максимум",
    price: "5 990",
    questions: 300,
    docs: 50,
    features: ["до 300 вопросов AI-юристу", "50 готовых документов", "Всё из тарифа «Профи»", "Приоритетный доступ к AI"],
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
  const activePlan = getActivePlan(user);

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
    if (activePlan === plan.id) return;
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
          max-h-[92dvh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Zap" size={16} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-semibold text-navy-800 text-base">Выгодный тариф</h2>
              <p className="text-xs text-muted-foreground">Выберите подходящий план</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground hover:text-navy-700 transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Тарифы */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
          {PLANS.map((plan) => {
            const isActive = activePlan === plan.id;
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                onClick={() => handleSelect(plan)}
                className={`relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer
                  ${isActive
                    ? "border-emerald-300 bg-emerald-50 cursor-default"
                    : isPopular
                      ? "border-gold-400/50 bg-gradient-to-br from-navy-800 to-navy-900 hover:border-gold-400 hover:shadow-xl hover:shadow-navy-900/20"
                      : "border-border bg-white hover:border-navy-300 hover:shadow-lg hover:shadow-navy-900/8"
                  }`}
              >
                {/* Бейдж */}
                {isActive && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <Icon name="CheckCircle" size={10} />Активен
                  </span>
                )}
                {!isActive && plan.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gold-500 text-navy-900 uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}

                <div className="flex items-start gap-4">
                  {/* Цена */}
                  <div className="shrink-0">
                    <div className={`text-2xl font-bold ${isPopular && !isActive ? "text-white" : "text-navy-800"}`}>
                      {plan.price} ₽
                    </div>
                    <div className={`text-xs ${isPopular && !isActive ? "text-white/60" : "text-muted-foreground"}`}>/ месяц</div>
                  </div>

                  {/* Инфо */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-base mb-0.5 ${isPopular && !isActive ? "text-white" : "text-navy-800"}`}>
                      {plan.name}
                    </div>

                    {/* Ключевые цифры */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex items-center gap-1 text-xs font-medium ${isActive ? "text-emerald-700" : isPopular ? "text-gold-300" : "text-navy-600"}`}>
                        <Icon name="MessageCircle" size={12} />
                        {plan.questions} вопросов
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${isActive ? "text-emerald-700" : isPopular ? "text-gold-300" : "text-navy-600"}`}>
                        <Icon name="FileText" size={12} />
                        {plan.docs} документов
                      </div>
                    </div>

                    {/* Фичи */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {plan.features.map((f) => (
                        <div key={f} className={`flex items-center gap-1.5 text-xs ${isActive ? "text-emerald-600" : isPopular ? "text-white/75" : "text-muted-foreground"}`}>
                          <Icon name="Check" size={11} className={isActive ? "text-emerald-500" : isPopular ? "text-gold-400" : "text-navy-400"} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Кнопка */}
                {!isActive && (
                  <div className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all
                    ${isPopular
                      ? "bg-gold-500 hover:bg-gold-400 text-navy-900"
                      : "bg-navy-800 hover:bg-navy-900 text-white"
                    }`}>
                    Подключить за {plan.price} ₽
                  </div>
                )}
                {isActive && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-xl text-xs text-emerald-700 font-medium">
                      <Icon name="CheckCircle" size={13} className="text-emerald-500" />
                      Тариф активен · {user.paidQuestions} вопр. · {user.paidDocs} доку.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-5 pb-5 pt-2 shrink-0">
          <p className="text-[11px] text-center text-muted-foreground">
            Вопросы и документы начисляются сразу после оплаты · Без подписки, без списаний
          </p>
        </div>
      </div>
    </div>
  );
}

export { PLANS, getActivePlan };
