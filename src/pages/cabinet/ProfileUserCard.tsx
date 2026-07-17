import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";

function getActivePlanInfo(user: User): { id: string; name: string; color: string } | null {
  const q = user.paidQuestions ?? 0;
  const d = user.paidDocs ?? 0;
  if (q >= 300 || d >= 50) return { id: "plan_max", name: "Максимум", color: "from-slate-700 to-navy-800" };
  if (q >= 100 || d >= 20) return { id: "plan_pro", name: "Профи", color: "from-navy-700 to-navy-900" };
  if (q >= 30 || d >= 5)   return { id: "plan_starter", name: "Старт", color: "from-navy-600 to-navy-800" };
  return null;
}

interface ProfileUserCardProps {
  user: User;
  onPay: (type: ServiceType, name: string) => void;
}

export default function ProfileUserCard({ user, onPay }: ProfileUserCardProps) {
  const consultSubActive = hasActiveSubscription(user, "consult");
  const docsSubActive = hasActiveSubscription(user, "docs");
  const bizSubActive = !!(user.businessSubscriptionUntil && new Date(user.businessSubscriptionUntil) > new Date());
  const activePlan = user.isAdmin ? null : getActivePlanInfo(user);
  const lawyerQ = user.lawyerConsultationsLeft ?? 0;

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

        {/* Остатки — тёмные карточки */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { label: "Вопросов AI",     value: user.isAdmin ? "∞" : (user.paidQuestions ?? 0),   icon: "MessageCircle", accent: "#60a5fa" },
            { label: "Документов",      value: user.isAdmin ? "∞" : (user.paidDocs ?? 0),         icon: "FileText",      accent: "#fbbf24" },
            { label: "Консультаций", value: user.isAdmin ? "∞" : lawyerQ, icon: "UserCheck", accent: lawyerQ > 0 || user.isAdmin ? "#34d399" : "#64748b" },
            { label: "Бизнес",          value: user.isAdmin ? "∞" : (bizSubActive ? (user.businessActionsLeft ?? 0) : "—"), icon: "Briefcase", accent: bizSubActive || user.isAdmin ? "#a78bfa" : "#64748b" },
          ] as const).map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-3 sm:p-4 flex flex-col"
              style={{ background: "linear-gradient(145deg,#0f172a,#1e293b)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name={stat.icon as Parameters<typeof Icon>[0]["name"]} size={11} color={stat.accent} />
                <span className="text-[10px] font-medium leading-none" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</span>
              </div>
              <div className="font-bold text-2xl sm:text-3xl leading-none" style={{ color: stat.accent }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Активный тариф + подписки */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2 text-sm">
          <Icon name="Crown" size={16} className="text-gold-500" />
          Активные подписки
        </h3>

        <div className="space-y-3">
          {/* Активный тариф */}
          {activePlan && (
            <div className={`rounded-2xl p-4 bg-gradient-to-br ${activePlan.color} text-white`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon name="Zap" size={14} className="text-gold-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Тариф</span>
                  </div>
                  <p className="text-lg font-bold text-white">«{activePlan.name}»</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/15 text-white">Активен</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/10 p-2.5 text-center">
                  <p className="text-lg font-bold text-white">{user.paidQuestions ?? 0}</p>
                  <p className="text-[9px] text-white/60 font-medium mt-0.5">вопросов AI</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5 text-center">
                  <p className="text-lg font-bold text-white">{user.paidDocs ?? 0}</p>
                  <p className="text-[9px] text-white/60 font-medium mt-0.5">документов</p>
                </div>
                <div className={`rounded-xl p-2.5 text-center ${lawyerQ > 0 ? "bg-gold-400/20 border border-gold-400/30" : "bg-white/10"}`}>
                  <p className={`text-lg font-bold ${lawyerQ > 0 ? "text-gold-300" : "text-white"}`}>{lawyerQ}</p>
                  <p className="text-[9px] text-white/60 font-medium mt-0.5">консультаций</p>
                </div>
              </div>

              {lawyerQ === 0 && (
                <button
                  onClick={() => onPay("lawyer_questions", "+1 консультация юриста")}
                  className="mt-3 w-full py-2 rounded-xl text-xs font-bold bg-gold-500 hover:bg-gold-400 text-navy-900 transition-colors active:scale-[0.98]"
                >
                  +1 консультация юриста · 990 ₽
                </button>
              )}
            </div>
          )}

          {/* Нет тарифа */}
          {!activePlan && !user.isAdmin && (
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 text-center">
              <Icon name="Package" size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-navy-800 mb-1">Тариф не подключён</p>
              <p className="text-xs text-slate-500 mb-3">Подключите тариф для доступа к AI-юристу, документам и консультации живого юриста</p>
              <button
                onClick={() => onPay("plan_starter", "Тариф «Старт»")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-navy-800 text-white hover:bg-navy-700 transition-colors"
              >
                Выбрать тариф
              </button>
            </div>
          )}

          {/* Безлимитные подписки */}
          {consultSubActive && (
            <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icon name="MessageCircle" size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-800">Безлимитные консультации AI</p>
                  <p className="text-xs text-muted-foreground">до {new Date(user.subscriptionConsultUntil!).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Активна</span>
            </div>
          )}

          {docsSubActive && (
            <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icon name="FileText" size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-800">Безлимитные документы</p>
                  <p className="text-xs text-muted-foreground">до {new Date(user.subscriptionDocsUntil!).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Активна</span>
            </div>
          )}

          {/* Бизнес-тариф */}
          {bizSubActive && (
            <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border border-navy-200 bg-navy-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-navy-200 flex items-center justify-center">
                  <Icon name="Briefcase" size={14} className="text-navy-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-800">Бизнес-тариф</p>
                  <p className="text-xs text-muted-foreground">{user.businessActionsLeft ?? 0} действий · до {new Date(user.businessSubscriptionUntil!).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy-200 text-navy-700">Активен</span>
            </div>
          )}
        </div>
      </div>

      {/* Пополнение */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <h3 className="font-semibold text-navy-800 mb-4 text-sm flex items-center gap-2">
          <Icon name="CreditCard" size={15} className="text-navy-500" />
          Тарифы и пополнение
        </h3>

        <div className="space-y-2">
          {[
            ...(!user.purchasedPlan
              ? [{ label: "Тариф «Пробный»", sub: "5 вопросов AI · 2 документа · доступ к тарифу «Старт» · разово", price: "290 ₽", type: "document" as ServiceType }]
              : []),
            { label: "Тариф «Старт»", sub: "30 вопросов AI · 5 документов · 3 вопроса юристу", price: "990 ₽", type: "plan_starter" as ServiceType },
            { label: "Тариф «Профи»", sub: "100 вопросов AI · 20 документов · 5 вопросов юристу", price: "3 990 ₽", type: "plan_pro" as ServiceType, badge: "Хит" },
            { label: "Тариф «Максимум»", sub: "300 вопросов AI · 50 документов · 30 вопросов юристу", price: "5 990 ₽", type: "plan_max" as ServiceType },
            { label: "Тариф «Корпоративный»", sub: "300 вопросов AI · 100 документов · 20 консультаций юриста", price: "9 990 ₽", type: "plan_corporate" as ServiceType },
            { label: "+1 консультация юриста", sub: "Полная консультация юриста-эксперта", price: "990 ₽", type: "lawyer_questions" as ServiceType },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => onPay(item.type, item.label)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-border hover:border-navy-300 hover:bg-navy-50/50 transition-all group text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center group-hover:bg-navy-100 transition-colors shrink-0">
                  <Icon name="Zap" size={14} className="text-navy-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-navy-800">{item.label}</span>
                    {"badge" in item && item.badge && (
                      <span className="text-[9px] font-bold bg-gold-400/20 text-gold-700 px-1.5 py-0.5 rounded-full">{item.badge}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.sub}</div>
                </div>
              </div>
              <span className="text-sm font-bold text-navy-700 shrink-0 ml-2">{item.price}</span>
            </button>
          ))}
        </div>

      </div>
    </>
  );
}