import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/ui/icon";
import { AttachmentModal, AttachmentBar, AttachPanel } from "./ExpertAttachPanel";
import MsgBubble from "./ExpertChatMsgBubble";
import { EXPERT_NAME } from "./ExpertChatUtils";
import type { ExpertChatProps } from "./ExpertChatUtils";
import { subscribeToPush, isPushSupported, isPushGranted } from "@/lib/pushNotifications";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export default function ExpertChat({
  isAdmin, isFreeUser = false, isDialogClosed = false, selectedUserId, currentDialog, lmsgs, loading,
  input, sending, uploadProgress, err, attachments, showAttachPanel, viewFullMsg,
  aiAnswers, genDocs, isBlocked = false, lawyerQLeft = 0, currentPlanId = "plan_starter",
  onBack, onRefresh, onInputChange, onSend,
  onToggleAttachPanel, onHideAttachPanel,
  onAddAttachment, onAddFiles, onRemoveAttachment,
  onViewFullMsg, onCloseFullMsg,
  onBuyLawyerQuestions, onUpgradePlan,
  onCompleteConsultation, onHideDialog, onGoToChat,
  textareaRef, bottomRef, adjustTextarea,
}: ExpertChatProps) {
  const hasSentQuestion = isFreeUser && lmsgs.some(m => m.sender === "user");
  const hasLawyerReply = isFreeUser && lmsgs.some(m => m.sender === "admin");

  // ── Скролл и кнопка «↓ Новые» ───────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevLenRef = useRef(lmsgs.length);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(dist > 120);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const added = lmsgs.length - prevLenRef.current;
    if (added > 0) {
      if (dist > 120) setNewCount(n => n + added);
      else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    prevLenRef.current = lmsgs.length;
  }, [lmsgs.length]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowScrollBtn(false);
    setNewCount(0);
  };

  // ── Push-уведомления ────────────────────────────────────────────────
  const [pushNeedsSetup, setPushNeedsSetup] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || isAdmin) return;
    if (!isPushGranted()) { setPushNeedsSetup(true); return; }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => { if (!sub) setPushNeedsSetup(true); })
    ).catch(() => {});
  }, [isAdmin]);

  const handleEnablePush = useCallback(async () => {
    setPushLoading(true);
    const ok = await subscribeToPush(true);
    setPushLoading(false);
    if (ok) { setPushDone(true); setPushNeedsSetup(false); }
  }, []);

  // ── Автопереход на Chat AI при бездействии ──────────────────────────
  useEffect(() => {
    if (!onGoToChat) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onGoToChat, IDLE_TIMEOUT_MS);
    };
    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [onGoToChat]);

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-2 sm:gap-3" style={{ height: "clamp(480px, calc(100svh - 190px), 740px)" }}>

      {/* ── Шапка ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl border border-border px-3 sm:px-4 py-3 shadow-sm shrink-0">
        {isAdmin && (
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Icon name="ArrowLeft" size={16} className="text-navy-600" />
          </button>
        )}
        <div className="relative shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
            <Icon name="UserCheck" size={15} className="text-gold-400" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-800 truncate">
            {isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
          </p>
          <p className="text-[11px] font-medium truncate" style={{ color: isAdmin ? "#64748b" : "#059669" }}>
            {isAdmin ? (currentDialog?.email ?? "") : "Онлайн · ответит в течение 1–3 ч"}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onCompleteConsultation}
              title="Завершить консультацию (списать 1 консультацию)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:shadow-sm active:scale-95"
              style={{ background: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.2)" }}
            >
              <Icon name="CheckCircle" size={13} />
              <span className="hidden sm:inline">Завершить</span>
            </button>
            <button onClick={onHideDialog} title="Скрыть диалог" className="p-2 rounded-xl transition-colors hover:bg-slate-100">
              <Icon name="EyeOff" size={14} className="text-slate-400" />
            </button>
            <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
            </button>
          </div>
        )}

        {!isAdmin && (
          <>
            {isFreeUser ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 bg-amber-50 border border-amber-200">
                <Icon name="Gift" size={11} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-700">Бесплатно</span>
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 ${
                lawyerQLeft === 0 ? "bg-red-50 border border-red-200"
                : lawyerQLeft <= 2 ? "bg-amber-50 border border-amber-200"
                : "bg-emerald-50 border border-emerald-200"
              }`}>
                <Icon name="UserCheck" size={11}
                  className={lawyerQLeft === 0 ? "text-red-500" : lawyerQLeft <= 2 ? "text-amber-500" : "text-emerald-600"} />
                <span className={`text-[11px] font-bold ${lawyerQLeft === 0 ? "text-red-600" : lawyerQLeft <= 2 ? "text-amber-700" : "text-emerald-700"}`}>
                  {lawyerQLeft}
                </span>
                <span className={`text-[10px] font-medium ${lawyerQLeft === 0 ? "text-red-400" : lawyerQLeft <= 2 ? "text-amber-500" : "text-emerald-500"}`}>
                  конс.
                </span>
              </div>
            )}
            {pushNeedsSetup && !pushDone && (
              <button
                onClick={handleEnablePush}
                disabled={pushLoading}
                title="Включить уведомления"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 shrink-0"
                style={{ background: "rgba(15,76,129,0.08)", color: "#0f4c81", border: "1px solid rgba(15,76,129,0.2)" }}
              >
                {pushLoading
                  ? <span className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
                  : <Icon name="Bell" size={12} />}
                <span className="hidden sm:inline">Уведомления</span>
              </button>
            )}
            {pushDone && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold px-2">
                <Icon name="BellRing" size={12} />
                <span className="hidden sm:inline">Включены</span>
              </span>
            )}
            <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
            </button>
          </>
        )}
      </div>

      {/* ── Баннер бесплатного вопроса ────────────────────────────────── */}
      {isFreeUser && !hasSentQuestion && (
        <div className="shrink-0 rounded-2xl overflow-hidden border border-amber-200/60 shadow-sm"
          style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" }}>
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <Icon name="Gift" size={16} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 leading-snug">
                Вы можете задать 1 вопрос юристу-эксперту совершенно бесплатно
              </p>
              <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                Опишите вашу ситуацию как можно подробнее — юрист ответит в течение 1–3 часов.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Область сообщений ─────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        {/* Кнопка «↓ Новые» */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToBottom}
              className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", boxShadow: "0 4px 16px rgba(15,76,129,0.4)" }}
            >
              <Icon name="ChevronDown" size={13} />
              {newCount > 0 ? `${newCount} новых` : "Вниз"}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Список сообщений */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-5"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            </div>
          ) : lmsgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center h-full">
              <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg mx-auto">
                <Icon name="MessageSquarePlus" size={24} className="text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-700 mb-1">Начните диалог</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Опишите вашу ситуацию, прикрепите документы или ответ AI-консультанта
                </p>
              </div>
              {!isAdmin && (
                <button
                  onClick={onToggleAttachPanel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy-50 hover:bg-navy-100 rounded-xl text-xs font-medium text-navy-700 transition-colors border border-navy-200"
                >
                  <Icon name="Paperclip" size={13} />
                  Прикрепить файлы или материалы
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:gap-4">
              {lmsgs.map((m) => (
                <MsgBubble key={m.id} msg={m} isAdmin={isAdmin} />
              ))}

              {/* Воронка free: до ответа юриста */}
              {isFreeUser && hasSentQuestion && isBlocked && !hasLawyerReply && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
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
                            <div className="w-6 h-6 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.2)" }}>
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
                </motion.div>
              )}

              {/* Воронка free: после ответа юриста */}
              {isFreeUser && hasLawyerReply && isBlocked && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
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
                      <button onClick={onUpgradePlan}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold mb-1.5 transition-all active:scale-[0.98]"
                        style={{ background: "linear-gradient(135deg, #e8a820 0%, #f0c060 100%)", color: "#0a1628", boxShadow: "0 3px 14px rgba(232,168,32,0.35)" }}>
                        <Icon name="Sparkles" size={12} color="#0a1628" />
                        Оформить тариф «Старт»
                      </button>
                      <button onClick={onUpgradePlan}
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-medium text-slate-500 hover:text-navy-700 transition-colors">
                        Сравнить все тарифы
                        <Icon name="ChevronRight" size={12} className="text-slate-400" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Воронка при исчерпании вопросов */}
              {isBlocked && !isAdmin && !isFreeUser && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
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
                        <button onClick={onBuyLawyerQuestions}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98] text-left bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 shadow-sm">
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
                          <button onClick={onUpgradePlan}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-[0.98] text-left shadow-sm">
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
                </motion.div>
              )}
            </div>
          )}

          {/* Typing indicator */}
          <AnimatePresence>
            {sending && !isAdmin && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex gap-2 items-end justify-start mt-3"
              >
                <div className="w-9 h-9 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
                  <Icon name="UserCheck" size={15} className="text-gold-400" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <span className="flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-navy-400" style={{ animation: "typingDot 1.2s infinite 0s" }} />
                    <span className="w-2 h-2 rounded-full bg-navy-400" style={{ animation: "typingDot 1.2s infinite 0.2s" }} />
                    <span className="w-2 h-2 rounded-full bg-navy-400" style={{ animation: "typingDot 1.2s infinite 0.4s" }} />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <style>{`
            @keyframes typingDot {
              0%,100% { opacity:.3; transform:scale(.8); }
              50% { opacity:1; transform:scale(1.15); }
            }
          `}</style>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Панель ввода ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border shadow-sm shrink-0 overflow-hidden">
        {sending && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[11px] text-muted-foreground">Загрузка файлов...</p>
              <p className="text-[11px] font-semibold text-navy-700 ml-auto">{uploadProgress}%</p>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-navy-500 to-navy-700 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="px-4 pt-3">
            <AttachmentBar attachments={attachments} onView={onViewFullMsg} onRemove={onRemoveAttachment} />
          </div>
        )}

        {showAttachPanel && (
          <div className="px-4 pt-3">
            <AttachPanel
              aiAnswers={aiAnswers} genDocs={genDocs}
              currentCount={attachments.length}
              onSelectContent={onAddAttachment} onFilesAdded={onAddFiles} onClose={onHideAttachPanel}
            />
          </div>
        )}

        <div className="flex items-end gap-2 px-3 sm:px-4 py-3">
          <button
            onClick={onToggleAttachPanel}
            disabled={sending}
            className={`relative p-2 rounded-xl transition-colors shrink-0 mb-0.5 ${
              showAttachPanel || attachments.length > 0
                ? "bg-navy-100 text-navy-700"
                : "text-muted-foreground hover:text-navy-700 hover:bg-slate-100"
            }`}
          >
            <Icon name="Paperclip" size={16} />
            {attachments.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-navy-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {attachments.length}
              </span>
            )}
          </button>

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { onInputChange(e.target.value); adjustTextarea(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isBlocked) onSend(); }
              }}
              disabled={sending || isBlocked || isDialogClosed}
              placeholder={
                isDialogClosed ? "Консультация завершена" :
                isBlocked ? "Предварительная консультация использована" :
                isAdmin ? "Ответить клиенту..." : "Опишите вопрос для юриста..."
              }
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none leading-relaxed transition-colors ${
                isBlocked || isDialogClosed
                  ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-50 border-slate-200 text-navy-800 placeholder:text-muted-foreground focus:border-navy-300 focus:bg-white"
              }`}
              style={{ minHeight: "40px", maxHeight: "180px" }}
            />
          </div>

          <button
            onClick={onSend}
            disabled={isBlocked || sending || (!input.trim() && attachments.length === 0)}
            className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shrink-0 mb-0.5 disabled:opacity-40 hover:opacity-90 transition-all shadow-sm active:scale-95"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Icon name="Send" size={16} className="text-white" />}
          </button>
        </div>

        {err && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <Icon name="AlertCircle" size={11} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-500 flex-1">{err}</p>
            <button onClick={onSend} disabled={sending}
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 shrink-0 underline underline-offset-2 transition-colors">
              <Icon name="RotateCcw" size={11} />
              Повторить
            </button>
          </div>
        )}
      </div>

      {/* Модалка предпросмотра */}
      {viewFullMsg && (
        <AttachmentModal
          title={viewFullMsg.title}
          content={viewFullMsg.content}
          type={viewFullMsg.type}
          downloadUrl={viewFullMsg.downloadUrl}
          onClose={onCloseFullMsg}
        />
      )}
    </div>
  );
}
