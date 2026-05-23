import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";

function SubscriptionBadge({ until }: { until: string | null }) {
  if (!until) return null;
  const date = new Date(until);
  const isActive = date > new Date();
  if (!isActive) return <span className="text-xs text-red-500">Истекла</span>;
  return (
    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
      до {date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
    </span>
  );
}

interface ProfileUserCardProps {
  user: User;
  onPay: (type: ServiceType, name: string) => void;
}

export default function ProfileUserCard({ user, onPay }: ProfileUserCardProps) {
  const consultSubActive = hasActiveSubscription(user, "consult");
  const docsSubActive = hasActiveSubscription(user, "docs");
  const bizSubActive = !!(user.businessSubscriptionUntil && new Date(user.businessSubscriptionUntil) > new Date());

  return (
    <>
      {/* Карточка пользователя */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-navy rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-bold uppercase shrink-0">
            {user.name?.[0] ?? "U"}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-navy-800 text-base sm:text-lg truncate">{user.name}</div>
            <div className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</div>
            {user.isAdmin && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">Администратор</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {[
            { label: "Вопросов осталось", value: user.isAdmin ? "∞" : (user.paidQuestions ?? 0), icon: "MessageCircle", color: "text-blue-600 bg-blue-50" },
            { label: "Документов осталось", value: user.isAdmin ? "∞" : (user.paidDocs ?? 0), icon: "FileText", color: "text-amber-600 bg-amber-50" },
            { label: "Бизнес-действий", value: user.isAdmin ? "∞" : bizSubActive ? (user.businessActionsLeft ?? 0) : "—", icon: "Briefcase", color: bizSubActive ? "text-navy-600 bg-navy-50" : "text-slate-400 bg-slate-50" },
            { label: "Проверок юристом", value: user.paidExpert ? "Активно" : "Нет", icon: "Shield", color: "text-purple-600 bg-purple-50" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border p-3 sm:p-4">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center mb-2 ${stat.color}`}>
                <Icon name={stat.icon} size={14} />
              </div>
              <div className="font-bold text-navy-800 text-base sm:text-lg">{stat.value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Подписки */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2 text-sm">
          <Icon name="Crown" size={16} className="text-gold-500" />
          Активные подписки
        </h3>
        <div className="space-y-3">
          {consultSubActive && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100">
                  <Icon name="MessageCircle" size={16} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-navy-800">Безлимитные консультации</div>
                  <div className="text-xs text-muted-foreground">Безлимитные вопросы AI</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <SubscriptionBadge until={user.subscriptionConsultUntil} />
              </div>
            </div>
          )}
          {docsSubActive && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100">
                  <Icon name="FileText" size={16} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-navy-800">Безлимитные документы</div>
                  <div className="text-xs text-muted-foreground">Неограниченная генерация документов</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <SubscriptionBadge until={user.subscriptionDocsUntil} />
              </div>
            </div>
          )}

          {/* Бизнес-тариф */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border ${bizSubActive ? "border-navy-200 bg-navy-50" : "border-border"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bizSubActive ? "bg-navy-200" : "bg-navy-50"}`}>
                <Icon name="Briefcase" size={16} className={bizSubActive ? "text-navy-700" : "text-navy-400"} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-navy-800">Бизнес-тариф</span>
                  {bizSubActive && (
                    <span className="text-[10px] font-bold bg-gold-400/20 text-gold-700 px-1.5 py-0.5 rounded-full">Активен</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {bizSubActive
                    ? `${user.businessActionsLeft ?? 0} действий осталось · PDF/DOC · .doc выгрузка`
                    : "4 990 ₽/мес · 150 действий · PDF/DOC анализ · .doc"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              {bizSubActive
                ? <SubscriptionBadge until={user.businessSubscriptionUntil} />
                : <button onClick={() => onPay("business_subscription", "Бизнес-тариф")} className="bg-navy-800 hover:bg-navy-700 text-white text-xs px-3 py-2 rounded-xl transition-colors w-full sm:w-auto">Подключить</button>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Тарифы и пополнение */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <h3 className="font-semibold text-navy-800 mb-4 text-sm flex items-center gap-2">
          <Icon name="CreditCard" size={15} className="text-navy-500" />
          Тарифы и пополнение
        </h3>

        {/* Пользовательские пакеты */}
        <div className="space-y-2 mb-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Пакеты вопросов и документов</p>
          {[
            { label: "Старт", sub: "30 вопросов + 5 документов", price: "1 490 ₽", type: "plan_starter" as ServiceType, name: "Тариф Старт", icon: "Zap", badge: "" },
            { label: "Профи", sub: "100 вопросов + 20 документов", price: "3 990 ₽", type: "plan_pro" as ServiceType, name: "Тариф Профи", icon: "Star", badge: "Популярный" },
            { label: "Максимум", sub: "300 вопросов + 50 документов", price: "5 990 ₽", type: "plan_max" as ServiceType, name: "Тариф Максимум", icon: "Crown", badge: "" },
          ].map((item) => (
            <button key={item.type} onClick={() => onPay(item.type, item.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-border hover:border-navy-300 hover:bg-navy-50/50 transition-all group">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center group-hover:bg-navy-100 transition-colors shrink-0">
                  <Icon name={item.icon} size={14} className="text-navy-600" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-navy-800">{item.label}</span>
                    {item.badge && <span className="text-[9px] font-bold bg-gold-400/20 text-gold-700 px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                </div>
              </div>
              <span className="font-semibold text-navy-700 text-sm shrink-0 ml-2">{item.price}</span>
            </button>
          ))}
        </div>

        {/* Разовые */}
        <div className="space-y-2 mb-4 pt-3 border-t border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Разовые услуги</p>
          {[
            { label: "3 вопроса AI-юристу", price: "100 ₽", type: "consultation" as ServiceType, name: "AI-консультация", icon: "MessageCircle" },
            { label: "Подготовка документа", price: "500 ₽", type: "document" as ServiceType, name: "Подготовка документа", icon: "FileText" },
            { label: "Проверка юристом", price: "1 500 ₽", type: "expert" as ServiceType, name: "Проверка юристом", icon: "UserCheck" },
          ].map((item) => (
            <button key={item.type} onClick={() => onPay(item.type, item.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-border hover:border-navy-300 hover:bg-slate-50 transition-all group">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-slate-100 transition-colors shrink-0">
                  <Icon name={item.icon} size={14} className="text-navy-500" />
                </div>
                <span className="text-sm font-medium text-navy-700">{item.label}</span>
              </div>
              <span className="font-semibold text-navy-600 text-sm shrink-0 ml-2">{item.price}</span>
            </button>
          ))}
        </div>

        {/* Докупка бизнес-действий (только если подписка активна) */}
        {bizSubActive && (
          <div className="pt-3 border-t border-border">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Докупить бизнес-действия</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { type: "business_actions_10" as ServiceType, label: "+10 действий", price: "1 000 ₽" },
                { type: "business_actions_30" as ServiceType, label: "+30 действий", price: "3 000 ₽" },
                { type: "business_actions_50" as ServiceType, label: "+50 действий", price: "3 500 ₽" },
                { type: "business_actions_150" as ServiceType, label: "+150 действий", price: "9 000 ₽" },
              ]).map(a => (
                <button key={a.type} onClick={() => onPay(a.type, a.label)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border border-border hover:border-navy-300 hover:bg-navy-50 transition-all text-left">
                  <span className="text-xs font-medium text-navy-700">{a.label}</span>
                  <span className="text-xs font-semibold text-navy-600 shrink-0 ml-1">{a.price}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}