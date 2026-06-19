import Icon from "@/components/ui/icon";
import { EXPERT_NAME } from "./ExpertChatUtils";

interface FunnelFreeBeforeReplyProps {
  onUpgradePlan?: () => void;
}

export function FunnelFreeBeforeReply({ onUpgradePlan }: FunnelFreeBeforeReplyProps) {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex gap-2 sm:gap-3 items-start max-w-[92%] sm:max-w-[85%]">
        <div className="w-9 h-9 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md mt-1">
          <Icon name="UserCheck" size={15} className="text-gold-400" />
        </div>
        <div className="flex-1">
          <p className="text-[10.5px] font-semibold text-navy-500 ml-1 mb-1.5">{EXPERT_NAME}</p>
          <div className="rounded-2xl rounded-tl-sm shadow-sm mb-2 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0f2044 0%, #1a3260 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-4 pt-3.5 pb-3">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-6 h-6 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(232,168,32,0.2)" }}>
                  <Icon name="CheckCircle" size={13} color="#e8a820" />
                </div>
                <p className="text-sm font-bold text-white">Юрист получил ваш вопрос</p>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                Среднее время ответа — <span className="text-white font-semibold">1–3 часа</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-100 shadow-sm px-3.5 py-2.5 mb-2">
            <div className="flex items-center gap-2">
              <Icon name="Smartphone" size={13} className="text-blue-400 shrink-0" />
              <p className="text-xs text-slate-500">Добавьте приложение на телефон, чтобы не пропустить ответ</p>
            </div>
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-100 shadow-sm px-3.5 py-3">
            <p className="text-xs font-semibold text-navy-800 mb-2">Пока ждёте — ознакомьтесь с возможностями</p>
            <div className="flex flex-col gap-1 mb-2.5">
              {["Подготовка документов AI", "Проверка документов юристом", "Полноценная консультация"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <Icon name="Check" size={11} className="text-emerald-500 shrink-0" />
                  <span className="text-[11px] text-slate-600">{t}</span>
                </div>
              ))}
            </div>
            <button onClick={onUpgradePlan}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #e8a820 0%, #f0c060 100%)", color: "#0a1628" }}>
              <Icon name="Sparkles" size={12} color="#0a1628" />
              Посмотреть тарифные планы
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FunnelFreeAfterReplyProps {
  onUpgradePlan?: () => void;
  onBuyLawyerQuestions?: () => void;
}

export function FunnelFreeAfterReply({ onUpgradePlan, onBuyLawyerQuestions }: FunnelFreeAfterReplyProps) {
  return (
    <div className="animate-fade-in mt-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Продолжить работу</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        <div className="px-4 py-3" style={{ background: "linear-gradient(135deg, #0f2044 0%, #1a3260 100%)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(232,168,32,0.2)", border: "1px solid rgba(232,168,32,0.25)" }}>
              <Icon name="Star" size={13} color="#e8a820" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Начните с тарифа «Старт»</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>Всё необходимое для решения вопроса</p>
            </div>
          </div>
        </div>

        <div className="bg-white px-4 py-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
            {[
              { icon: "UserCheck", text: "1 полная консультация юриста" },
              { icon: "FileText", text: "5 документов через AI" },
              { icon: "ShieldCheck", text: "Проверка документа юристом" },
              { icon: "ScanSearch", text: "Анализ документов через AI" },
              { icon: "Bot", text: "30 вопросов к AI-юристу" },
              { icon: "Calculator", text: "Калькуляторы и инструменты" },
            ].map(item => (
              <div key={item.text} className="flex items-start gap-1.5">
                <div className="w-4 h-4 rounded-md bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name={item.icon as "FileText"} size={10} className="text-emerald-600" />
                </div>
                <span className="text-[11px] text-slate-600 leading-snug">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onUpgradePlan}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold mb-1.5 transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #e8a820 0%, #f0c060 100%)", color: "#0a1628" }}
          >
            <Icon name="Sparkles" size={12} color="#0a1628" />
            Тариф «Старт» — от 990 ₽
          </button>

          <button
            onClick={onBuyLawyerQuestions}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.98] border border-slate-200 hover:bg-slate-50"
            style={{ color: "#334155" }}
          >
            <Icon name="UserCheck" size={12} className="text-navy-600" />
            Ещё 1 консультация — 990 ₽
          </button>
        </div>
      </div>
    </div>
  );
}

interface FunnelPaidExhaustedProps {
  currentPlanId?: string;
  onBuyLawyerQuestions?: () => void;
  onUpgradePlan?: () => void;
}

export function FunnelPaidExhausted({ currentPlanId = "plan_starter", onBuyLawyerQuestions, onUpgradePlan }: FunnelPaidExhaustedProps) {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex gap-2 sm:gap-3 items-end max-w-[92%] sm:max-w-[80%]">
        <div className="w-9 h-9 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
          <Icon name="UserCheck" size={15} className="text-gold-400" />
        </div>
        <div className="flex-1">
          <p className="text-[10.5px] font-semibold text-navy-500 ml-1 mb-1">{EXPERT_NAME}</p>
          <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-100 shadow px-4 py-3 mb-2">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Icon name="Lock" size={12} className="text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-navy-800">Все консультации использованы</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Вы можете читать переписку, но отправка новых сообщений недоступна. Обновите тариф или докупите доступ.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={onBuyLawyerQuestions}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98] text-left bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 shadow-sm"
            >
              <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <Icon name="UserCheck" size={16} className="text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">+1 консультация юриста</p>
                <p className="text-xs text-white/60 mt-0.5">Ответ в течение 1–3 часов</p>
              </div>
              <span className="text-sm font-bold text-gold-400 shrink-0">990 ₽</span>
            </button>

            {currentPlanId !== "plan_max" && (
              <button
                onClick={onUpgradePlan}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-[0.98] text-left shadow-sm"
              >
                <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name="TrendingUp" size={16} className="text-navy-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-800 leading-tight">
                    {currentPlanId === "plan_starter" ? "Перейти на тариф «Профи»" : "Перейти на тариф «Максимум»"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentPlanId === "plan_starter"
                      ? "+5 консультаций юриста · 100 вопросов AI · 20 документов"
                      : "+10 консультаций юриста · 300 вопросов AI · 100 документов"}
                  </p>
                </div>
                <Icon name="ChevronRight" size={14} className="text-slate-400 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
