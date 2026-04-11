import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { hasActiveSubscription, sendReport } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";

interface GenDoc { id: number; name: string; }

interface ProfileTabProps {
  user: User;
  genDocs: GenDoc[];
  onPay: (type: ServiceType, name: string) => void;
  onLogout: () => void;
}

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

export default function ProfileTab({ user, genDocs, onPay, onLogout }: ProfileTabProps) {
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [showReport, setShowReport] = useState(false);

  const consultSubActive = hasActiveSubscription(user, "consult");
  const docsSubActive = hasActiveSubscription(user, "docs");

  const handleReport = async () => {
    if (!reportText.trim()) return;
    setReportSending(true);
    setReportErr("");
    const result = await sendReport(reportText.trim());
    setReportSending(false);
    if (result.ok) {
      setReportSent(true);
      setReportText("");
      setTimeout(() => { setReportSent(false); setShowReport(false); }, 3000);
    } else {
      setReportErr(result.error || "Ошибка отправки");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">Профиль</h2>

      {/* Карточка пользователя */}
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center text-white text-2xl font-bold uppercase">
            {user.name?.[0] ?? "U"}
          </div>
          <div>
            <div className="font-semibold text-navy-800 text-lg">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            {user.isAdmin && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">Администратор</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Вопросов осталось", value: user.isAdmin ? "∞" : (user.paidQuestions ?? 0), icon: "MessageCircle", color: "text-blue-600 bg-blue-50" },
            { label: "Документов осталось", value: user.isAdmin ? "∞" : (user.paidDocs ?? 0), icon: "FileText", color: "text-amber-600 bg-amber-50" },
            { label: "Создано документов", value: genDocs.length, icon: "FolderOpen", color: "text-navy-600 bg-navy-50" },
            { label: "Проверок юристом", value: user.paidExpert ? "Активно" : "Нет", icon: "Shield", color: "text-purple-600 bg-purple-50" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border p-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${stat.color}`}>
                <Icon name={stat.icon} size={16} />
              </div>
              <div className="font-bold text-navy-800 text-lg">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Подписки */}
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
        <h3 className="font-semibold text-navy-800 mb-4 flex items-center gap-2">
          <Icon name="Crown" size={16} className="text-gold-500" />
          Подписки
        </h3>
        <div className="space-y-3">
          {/* Консультации */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${consultSubActive ? "border-emerald-200 bg-emerald-50" : "border-border"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${consultSubActive ? "bg-emerald-100" : "bg-navy-50"}`}>
                <Icon name="MessageCircle" size={16} className={consultSubActive ? "text-emerald-600" : "text-navy-500"} />
              </div>
              <div>
                <div className="text-sm font-medium text-navy-800">Безлимитные консультации</div>
                <div className="text-xs text-muted-foreground">1 990 ₽/мес · Безлимитные вопросы AI</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {consultSubActive
                ? <SubscriptionBadge until={user.subscriptionConsultUntil} />
                : <button onClick={() => onPay("subscription_consult", "Безлимитные консультации")} className="btn-gold text-xs px-3 py-1.5 rounded-xl">Подключить</button>
              }
            </div>
          </div>

          {/* Документы */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${docsSubActive ? "border-emerald-200 bg-emerald-50" : "border-border"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${docsSubActive ? "bg-emerald-100" : "bg-navy-50"}`}>
                <Icon name="FileText" size={16} className={docsSubActive ? "text-emerald-600" : "text-navy-500"} />
              </div>
              <div>
                <div className="text-sm font-medium text-navy-800">Безлимитные документы</div>
                <div className="text-xs text-muted-foreground">4 990 ₽/мес · Неограниченная генерация</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {docsSubActive
                ? <SubscriptionBadge until={user.subscriptionDocsUntil} />
                : <button onClick={() => onPay("subscription_docs", "Безлимитные документы")} className="btn-gold text-xs px-3 py-1.5 rounded-xl">Подключить</button>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Пополнить баланс */}
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
        <h3 className="font-semibold text-navy-800 mb-4">Пополнить баланс</h3>
        <div className="space-y-3">
          {[
            { label: "3 вопроса AI-юристу", price: "100 ₽", type: "consultation" as ServiceType, name: "AI-консультация (3 вопроса)", icon: "MessageCircle" },
            { label: "Подготовка документа", price: "500 ₽", type: "document" as ServiceType, name: "Подготовка документа", icon: "FileText" },
            { label: "Проверка экспертом-юристом", price: "1 500 ₽", type: "expert" as ServiceType, name: "Проверка юристом", icon: "UserCheck" },
            { label: "Договор для бизнеса", price: "1 000 ₽", type: "business" as ServiceType, name: "Договор для бизнеса", icon: "Briefcase" },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => onPay(item.type, item.name)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border hover:border-navy-300 hover:bg-navy-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center group-hover:bg-navy-100 transition-colors">
                  <Icon name={item.icon} size={15} className="text-navy-600" />
                </div>
                <span className="text-sm font-medium text-navy-800">{item.label}</span>
              </div>
              <span className="font-semibold text-navy-700 text-sm">{item.price}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Сообщить о проблеме */}
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
        <button
          onClick={() => setShowReport(!showReport)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
              <Icon name="AlertTriangle" size={15} className="text-orange-500" />
            </div>
            <span className="text-sm font-medium text-navy-800">Сообщить о проблеме</span>
          </div>
          <Icon name={showReport ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
        </button>

        {showReport && (
          <div className="mt-4">
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Опишите проблему подробно — что произошло, при каких действиях, что ожидалось..."
              rows={4}
              className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-3"
            />
            {reportErr && <p className="text-xs text-red-500 mb-2">{reportErr}</p>}
            {reportSent && <p className="text-xs text-emerald-600 mb-2">✓ Сообщение отправлено. Спасибо!</p>}
            <button
              onClick={handleReport}
              disabled={reportSending || !reportText.trim()}
              className="btn-gold px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {reportSending
                ? <><span className="typing-dot w-1.5 h-1.5 bg-navy-800 rounded-full" /><span className="typing-dot w-1.5 h-1.5 bg-navy-800 rounded-full" /><span className="typing-dot w-1.5 h-1.5 bg-navy-800 rounded-full" /></>
                : <><Icon name="Send" size={14} />Отправить</>
              }
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onLogout}
        className="w-full py-3 rounded-2xl border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all text-sm font-medium flex items-center justify-center gap-2"
      >
        <Icon name="LogOut" size={15} />
        Выйти из аккаунта
      </button>
    </div>
  );
}
