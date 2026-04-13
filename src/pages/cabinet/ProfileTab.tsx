import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { hasActiveSubscription, sendReport, getMyReports, getAdminReports, replyToReport, closeReport, type Report } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";

function ReferralBlock({ user }: { user: User }) {
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);

  const refCode = user.referralCode || "";
  const refUrl = refCode ? `${window.location.origin}/?ref=${refCode}` : "";

  const handleCopy = () => {
    if (!refUrl) return;
    navigator.clipboard.writeText(refUrl).then(() => {
      setCopied(true);
      setPulse(true);
      setTimeout(() => { setCopied(false); setPulse(false); }, 2500);
    });
  };

  const handleShare = () => {
    if (navigator.share && refUrl) {
      navigator.share({
        title: "ИИ-Право.рф — AI-юрист онлайн",
        text: "Пользуюсь AI-юристом — советую! По моей ссылке получишь 2 бесплатных вопроса:",
        url: refUrl,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  if (!refCode) return null;

  return (
    <div className="bg-gradient-to-br from-gold-400/10 to-amber-50 border border-gold-300 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 bg-gold-400/20 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${pulse ? "scale-125" : "scale-100"}`} style={{transition:"transform 0.3s"}}>
          <Icon name="Gift" size={18} className="text-gold-600" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-800 text-sm">Пригласи друга — получи 2 вопроса</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Вы и ваш друг получат по 2 бесплатных вопроса к AI-юристу после его регистрации</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gold-200 px-3 py-2 flex items-center gap-2 mb-3 group cursor-pointer" onClick={handleCopy}>
        <Icon name="Link" size={13} className="text-gold-500 shrink-0" />
        <span className="text-xs text-navy-700 flex-1 truncate font-mono">{refUrl}</span>
        <button className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${copied ? "bg-emerald-100 text-emerald-700" : "bg-gold-100 text-gold-700 hover:bg-gold-200"}`}>
          {copied ? "✓ Скопировано" : "Копировать"}
        </button>
      </div>

      <button
        onClick={handleShare}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${pulse ? "bg-gold-500 text-white scale-[1.02] shadow-lg shadow-gold-300/50" : "btn-gold"}`}
      >
        <Icon name="Share2" size={15} />
        Поделиться с другом
        {pulse && <span className="text-xs opacity-80">🎉</span>}
      </button>
    </div>
  );
}

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Компонент для отображения репортов пользователя ───────
function MyReports({ userId }: { userId: number }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReports().then(r => { setReports(r); setLoading(false); });
  }, [userId]);

  if (loading) return <p className="text-xs text-muted-foreground py-2">Загрузка...</p>;
  if (!reports.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-navy-700 uppercase tracking-wider">Ваши обращения</p>
      {reports.map(r => (
        <div key={r.id} className={`rounded-2xl border p-3 text-xs space-y-1.5 ${r.status === "replied" ? "border-emerald-200 bg-emerald-50/60" : r.status === "closed" ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50/60"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
            <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${r.status === "replied" ? "bg-emerald-100 text-emerald-700" : r.status === "closed" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>
              {r.status === "new" ? "Новое" : r.status === "replied" ? "Получен ответ" : "Закрыто"}
            </span>
          </div>
          <p className="text-navy-700 leading-relaxed line-clamp-3">{r.message}</p>
          {r.admin_reply && (
            <div className="mt-2 pl-3 border-l-2 border-emerald-400">
              <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">Ответ администратора:</p>
              <p className="text-navy-700 leading-relaxed">{r.admin_reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Админ-кабинет: работа с жалобами ───────────────────────
function AdminReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "replied" | "closed">("all");
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async (f: string) => {
    setLoading(true);
    const r = await getAdminReports(f);
    setReports(r);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleReply = async (id: number) => {
    if (!replyText.trim()) return;
    setSending(true);
    await replyToReport(id, replyText.trim());
    setReplyingId(null);
    setReplyText("");
    setSending(false);
    load(filter);
  };

  const handleClose = async (id: number) => {
    await closeReport(id);
    load(filter);
  };

  const newCount = reports.filter(r => r.status === "new").length;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Inbox" size={16} className="text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-800 text-sm">Жалобы и обращения</h3>
          {newCount > 0 && <p className="text-xs text-orange-600">{newCount} новых</p>}
        </div>
        <button onClick={() => load(filter)} className="ml-auto p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {(["all", "new", "replied", "closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${filter === f ? "bg-navy-700 text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200"}`}>
            {f === "all" ? "Все" : f === "new" ? "Новые" : f === "replied" ? "Отвечены" : "Закрыты"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Загрузка...</p>
      ) : reports.length === 0 ? (
        <div className="text-center py-6">
          <Icon name="CheckCircle" size={28} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Нет обращений</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {reports.map(r => (
            <div key={r.id} className={`rounded-2xl border p-3 space-y-2 ${r.status === "new" ? "border-amber-200 bg-amber-50/40" : r.status === "replied" ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-navy-800 truncate">{r.user_name} · {r.user_email}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(r.created_at)}</p>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === "new" ? "bg-amber-100 text-amber-700" : r.status === "replied" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {r.status === "new" ? "Новое" : r.status === "replied" ? "Отвечено" : "Закрыто"}
                </span>
              </div>
              <p className="text-xs text-navy-700 leading-relaxed">{r.message}</p>
              {r.admin_reply && (
                <div className="pl-3 border-l-2 border-emerald-400">
                  <p className="text-[10px] text-emerald-700 font-semibold mb-0.5">Ваш ответ:</p>
                  <p className="text-xs text-navy-600">{r.admin_reply}</p>
                </div>
              )}

              {/* Форма ответа */}
              {replyingId === r.id ? (
                <div className="space-y-2 mt-1">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Напишите ответ пользователю..."
                    rows={3}
                    className="w-full text-xs bg-white border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleReply(r.id)} disabled={sending || !replyText.trim()}
                      className="flex-1 btn-gold text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <Icon name="Send" size={12} />{sending ? "..." : "Ответить"}
                    </button>
                    <button onClick={() => { setReplyingId(null); setReplyText(""); }}
                      className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-slate-50 transition-colors">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                r.status !== "closed" && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { setReplyingId(r.id); setReplyText(""); }}
                      className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors">
                      Ответить
                    </button>
                    <button onClick={() => handleClose(r.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-muted-foreground hover:bg-slate-50 transition-colors">
                      Закрыть
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileTab({ user, genDocs, onPay, onLogout }: ProfileTabProps) {
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportKey, setReportKey] = useState(0);

  const consultSubActive = hasActiveSubscription(user, "consult");
  const docsSubActive = hasActiveSubscription(user, "docs");
  const bizSubActive = !!(user.businessSubscriptionUntil && new Date(user.businessSubscriptionUntil) > new Date());

  const handleReport = async () => {
    if (!reportText.trim()) return;
    setReportSending(true);
    setReportErr("");
    const result = await sendReport(reportText.trim());
    setReportSending(false);
    if (result.ok) {
      setReportSent(true);
      setReportText("");
      setReportKey(k => k + 1);
      setTimeout(() => { setReportSent(false); setShowReport(false); }, 3000);
    } else {
      setReportErr(result.error || "Ошибка отправки");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-3 sm:space-y-4">
      <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800 mb-4 sm:mb-6">Профиль</h2>

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
          {/* Показываем безлимитные только если активны */}
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
            { label: "Профи", sub: "100 вопросов + 20 документов", price: "3 990 ₽", type: "plan_pro" as ServiceType, name: "Тариф Профи", icon: "Star", badge: "Хит" },
            { label: "Максимум", sub: "до 300 вопросов + 50 документов", price: "5 990 ₽", type: "plan_max" as ServiceType, name: "Тариф Максимум", icon: "Crown", badge: "" },
          ].map((item) => (
            <button key={item.type} onClick={() => onPay(item.type, item.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-border hover:border-navy-300 hover:bg-navy-50 transition-all group">
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

      {/* Реферальный блок */}
      {!user.isAdmin && <ReferralBlock user={user} />}

      {/* Сообщить о проблеме */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <button
          onClick={() => setShowReport(!showReport)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
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
            {reportSent && <p className="text-xs text-emerald-600 mb-2">✓ Обращение отправлено. Ответ появится здесь.</p>}
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
            <MyReports key={reportKey} userId={user.id} />
          </div>
        )}
      </div>

      {/* Кабинет администратора */}
      {user.isAdmin && <AdminReportsPanel />}

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