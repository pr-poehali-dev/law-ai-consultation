import Icon from "@/components/ui/icon";
import { hasActiveSubscription, type User } from "@/lib/auth";
import { getActivePlan, PLANS } from "@/pages/cabinet/PlanModal";

interface PlanBannerProps {
  user: User;
  mode: "chat" | "docs";
  onSelectPlan: () => void;
}

export default function PlanBanner({ user, mode, onSelectPlan }: PlanBannerProps) {
  if (user.isAdmin) return null;

  const activePlanId = getActivePlan(user);
  const activePlan = PLANS.find(p => p.id === activePlanId);

  const requests = user.paidRequests ?? 0;
  // Тариф куплен, но лимит запросов исчерпан и нет безлимитной подписки — нужно продлить
  const isExhausted = !!activePlan
    && requests <= 0
    && !hasActiveSubscription(user, "consult")
    && !hasActiveSubscription(user, "docs");

  // Тариф куплен, но лимит исчерпан — тревожный баннер с призывом продлить
  if (activePlan && isExhausted) {
    return (
      <div
        onClick={onSelectPlan}
        className="flex items-center justify-between gap-3 px-4 py-2.5 mb-3 bg-red-50 border border-red-200 rounded-2xl cursor-pointer hover:bg-red-100/70 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="AlertCircle" size={14} className="text-red-600" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-red-800">Тариф «{activePlan.name}» — лимит исчерпан</span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-red-600">Запросы закончились, продлите тариф</span>
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors px-3 py-1.5 rounded-xl shrink-0">
          Продлить
        </span>
      </div>
    );
  }

  // Если есть активный тариф с остатком — компактный зелёный баннер
  if (activePlan) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 mb-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Zap" size={14} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-emerald-800">Тариф «{activePlan.name}»</span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                <Icon name="MessageCircle" size={10} />{requests} запр.
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onSelectPlan}
          className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 shrink-0"
        >
          Сменить
        </button>
      </div>
    );
  }

  // Нет тарифа — яркий призыв
  return (
    <div
      onClick={onSelectPlan}
      className="flex items-center gap-3 px-4 py-3 mb-3 bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl cursor-pointer hover:from-navy-700 hover:to-navy-800 transition-all group"
    >
      <div className="w-8 h-8 bg-gold-500/20 rounded-xl flex items-center justify-center shrink-0">
        <Icon name="Zap" size={16} className="text-gold-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white leading-tight">
          Подключите выгодный тариф
        </p>
        <p className="text-[11px] text-white/60 mt-0.5">
          Доступно {requests} запрос{requests === 1 ? "" : requests < 5 ? "а" : "ов"} к AI · Тарифы от 290 ₽
        </p>
      </div>
      <div className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-400 text-navy-900 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors shrink-0">
        <Icon name="Zap" size={11} />
        Выбрать
      </div>
    </div>
  );
}
