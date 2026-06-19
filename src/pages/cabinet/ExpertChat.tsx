/**
 * ExpertChat — юридический чат между клиентом и экспертом-юристом.
 * Полная перезапись. Поддерживает: мгновенный обмен сообщениями,
 * файлы, AI-ответы, документы, push-уведомления, воронки.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AttachmentModal, AttachmentBar, AttachPanel } from "./ExpertAttachPanel";
import MsgBubble from "./ExpertChatMsgBubble";
import { EXPERT_NAME } from "./ExpertChatUtils";
import type { ExpertChatProps } from "./ExpertChatUtils";
import { subscribeToPush, isPushSupported, isPushGranted } from "@/lib/pushNotifications";

const IDLE_MS = 5 * 60 * 1000; // 5 мин бездействия → переход на Chat AI

/* ── CSS-анимации (вставляем в <head> один раз) ─────────────────────── */
const CHAT_CSS = `
  @keyframes lc-dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
  @keyframes lc-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .lc-scrollbar::-webkit-scrollbar{display:none}
  .lc-scrollbar{scrollbar-width:none}
`;

export default function ExpertChat({
  isAdmin, isFreeUser = false, isDialogClosed = false,
  selectedUserId, currentDialog, lmsgs, loading,
  input, sending, uploadProgress, err,
  attachments, showAttachPanel, viewFullMsg,
  aiAnswers, genDocs,
  isBlocked = false, lawyerQLeft = 0, currentPlanId = "plan_starter",
  onBack, onRefresh, onInputChange, onSend,
  onToggleAttachPanel, onHideAttachPanel,
  onAddAttachment, onAddFiles, onRemoveAttachment,
  onViewFullMsg, onCloseFullMsg,
  onBuyLawyerQuestions, onUpgradePlan,
  onCompleteConsultation, onHideDialog, onGoToChat,
  textareaRef, bottomRef, adjustTextarea,
}: ExpertChatProps) {

  /* Вычисляемые флаги */
  const hasSentQ   = isFreeUser && lmsgs.some(m => m.sender === "user");
  const hasReply   = isFreeUser && lmsgs.some(m => m.sender === "admin");

  /* Push */
  const [pushSetup, setPushSetup] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || isAdmin) return;
    if (!isPushGranted()) { setPushSetup(true); return; }
    navigator.serviceWorker.ready
      .then(r => r.pushManager.getSubscription().then(s => { if (!s) setPushSetup(true); }))
      .catch(() => {});
  }, [isAdmin]);

  const enablePush = useCallback(async () => {
    setPushLoading(true);
    const ok = await subscribeToPush(true);
    setPushLoading(false);
    if (ok) { setPushDone(true); setPushSetup(false); }
  }, []);

  /* Автопереход на Chat AI */
  useEffect(() => {
    if (!onGoToChat) return;
    let t: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(t); t = setTimeout(onGoToChat, IDLE_MS); };
    const evs = ["mousemove","keydown","touchstart","click","scroll"];
    evs.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); evs.forEach(e => window.removeEventListener(e, reset)); };
  }, [onGoToChat]);

  /* Скролл + кнопка «↓ Новые» */
  const listRef  = useRef<HTMLDivElement>(null);
  const [showDown, setShowDown] = useState(false);
  const [newCnt,   setNewCnt]   = useState(0);
  const prevLen = useRef(lmsgs.length);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setShowDown(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  }, []);

  useEffect(() => {
    const added = lmsgs.length - prevLen.current;
    prevLen.current = lmsgs.length;
    if (added <= 0) return;
    const el = listRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 100) {
      setNewCnt(n => n + added);
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [lmsgs.length]);

  const goBottom = () => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    setShowDown(false); setNewCnt(0);
  };

  /* Счётчик консультаций — цвет */
  const qColor = lawyerQLeft === 0 ? "red" : lawyerQLeft <= 2 ? "amber" : "emerald";
  const qCls = {
    red:    { wrap: "bg-red-50 border-red-200",       icon: "text-red-500",   num: "text-red-600",   lbl: "text-red-400" },
    amber:  { wrap: "bg-amber-50 border-amber-200",   icon: "text-amber-500", num: "text-amber-700", lbl: "text-amber-500" },
    emerald:{ wrap: "bg-emerald-50 border-emerald-200",icon:"text-emerald-600",num:"text-emerald-700",lbl:"text-emerald-500"},
  }[qColor];

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-2 sm:gap-3"
      style={{ height: "clamp(480px, calc(100svh - 190px), 740px)" }}>

      <style>{CHAT_CSS}</style>

      {/* ══ ШАПКА ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-border px-3 sm:px-4 py-3 shadow-sm shrink-0">
        {isAdmin && (
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Icon name="ArrowLeft" size={16} className="text-navy-600" />
          </button>
        )}

        {/* Аватар + статус онлайн */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
            <Icon name="UserCheck" size={15} className="text-gold-400" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-800 truncate leading-tight">
            {isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
          </p>
          <p className="text-[10.5px] font-medium truncate"
            style={{ color: isAdmin ? "#64748b" : "#059669" }}>
            {isAdmin ? (currentDialog?.email ?? "") : "Онлайн · ответит в течение 1–3 ч"}
          </p>
        </div>

        {/* Кнопки ADMIN */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onCompleteConsultation}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
              style={{ background:"rgba(5,150,105,.1)", color:"#059669", border:"1px solid rgba(5,150,105,.2)" }}>
              <Icon name="CheckCircle" size={13} />
              <span className="hidden sm:inline">Завершить</span>
            </button>
            <button onClick={onHideDialog} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Icon name="EyeOff" size={14} className="text-slate-400" />
            </button>
            <button onClick={onRefresh} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Icon name="RefreshCw" size={14} className="text-slate-400" />
            </button>
          </div>
        )}

        {/* Кнопки USER */}
        {!isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Счётчик */}
            {!isFreeUser && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-xl border ${qCls.wrap}`}>
                <Icon name="UserCheck" size={10} className={qCls.icon} />
                <span className={`text-[11px] font-bold ${qCls.num}`}>{lawyerQLeft}</span>
                <span className={`text-[9px] font-medium ${qCls.lbl}`}>конс.</span>
              </div>
            )}
            {isFreeUser && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 border border-amber-200">
                <Icon name="Gift" size={10} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-700">Бесплатно</span>
              </div>
            )}
            {/* Push */}
            {pushSetup && !pushDone && (
              <button onClick={enablePush} disabled={pushLoading}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-[10.5px] font-semibold transition-all active:scale-95"
                style={{ background:"rgba(15,76,129,.07)", color:"#0f4c81", border:"1px solid rgba(15,76,129,.18)" }}>
                {pushLoading
                  ? <span className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
                  : <Icon name="Bell" size={11} />}
                <span className="hidden sm:inline">Уведомления</span>
              </button>
            )}
            {pushDone && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <Icon name="BellRing" size={12} /><span className="hidden sm:inline">Вкл</span>
              </span>
            )}
            <button onClick={onRefresh} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
              <Icon name="RefreshCw" size={14} className="text-slate-400" />
            </button>
          </div>
        )}
      </div>

      {/* ══ БАННЕР БЕСПЛАТНОГО ВОПРОСА ══════════════════════════════════ */}
      {isFreeUser && !hasSentQ && (
        <div className="shrink-0 rounded-2xl border border-amber-200/70 overflow-hidden"
          style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)" }}>
          <div className="flex items-start gap-3 p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background:"rgba(245,158,11,.15)", border:"1px solid rgba(245,158,11,.3)" }}>
              <Icon name="Gift" size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">1 бесплатный вопрос юристу-эксперту</p>
              <p className="text-xs text-amber-700/80 mt-0.5 leading-relaxed">
                Опишите ситуацию подробнее — ответ в течение 1–3 часов.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══ СПИСОК СООБЩЕНИЙ ═════════════════════════════════════════════ */}
      <div className="relative flex-1 min-h-0">

        {/* Кнопка «↓ Новые» */}
        {showDown && (
          <button onClick={goBottom}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white shadow-xl"
            style={{ background:"linear-gradient(135deg,#0f4c81,#1a6bb5)", animation:"lc-up .2s ease" }}>
            <Icon name="ChevronDown" size={13} />
            {newCnt > 0 ? `${newCnt} новых` : "Вниз"}
          </button>
        )}

        <div
          ref={listRef}
          onScroll={onScroll}
          className="lc-scrollbar h-full overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50/70 to-white p-3 sm:p-5 space-y-3 sm:space-y-4"
        >
          {/* Загрузка */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Пустой чат */}
          {!loading && lmsgs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
              <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg">
                <Icon name="MessageSquarePlus" size={26} className="text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-700 mb-1">Начните диалог</p>
                <p className="text-xs text-muted-foreground max-w-[260px]">
                  Опишите ситуацию, прикрепите документы или ответ AI-консультанта
                </p>
              </div>
              {!isAdmin && (
                <button onClick={onToggleAttachPanel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-xl text-xs font-semibold text-navy-700 transition-colors">
                  <Icon name="Paperclip" size={13} /> Прикрепить материалы
                </button>
              )}
            </div>
          )}

          {/* Сообщения */}
          {!loading && lmsgs.length > 0 && (
            <>
              {lmsgs.map(m => <MsgBubble key={m.id} msg={m} isAdmin={isAdmin} />)}

              {/* ─ Воронка FREE: до ответа юриста ─ */}
              {isFreeUser && hasSentQ && isBlocked && !hasReply && (
                <div className="flex gap-2.5 items-start animate-fade-in">
                  <div className="w-8 h-8 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md mt-1">
                    <Icon name="UserCheck" size={13} className="text-gold-400" />
                  </div>
                  <div className="flex-1 max-w-[80%]">
                    <span className="text-[10px] font-bold text-navy-400 ml-1 mb-1 block tracking-wide">{EXPERT_NAME}</span>
                    <div className="rounded-2xl rounded-tl-[4px] overflow-hidden shadow-sm"
                      style={{ background:"linear-gradient(135deg,#0f2044,#1a3260)", border:"1px solid rgba(255,255,255,.07)" }}>
                      <div className="p-4">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background:"rgba(232,168,32,.2)" }}>
                            <Icon name="CheckCircle" size={14} color="#e8a820" />
                          </div>
                          <p className="text-[13px] font-bold text-white">Юрист получил ваш вопрос</p>
                        </div>
                        <p className="text-xs" style={{ color:"rgba(255,255,255,.55)" }}>
                          Среднее время ответа — <span className="text-white font-semibold">1–3 часа</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 bg-white border border-slate-100 rounded-2xl rounded-tl-[4px] px-3.5 py-3 shadow-sm">
                      <p className="text-[11px] font-bold text-navy-700 mb-2">Пока ждёте</p>
                      {["Подготовка документов AI","Проверка документа юристом","Полноценная консультация"].map(t => (
                        <div key={t} className="flex items-center gap-1.5 mb-1">
                          <Icon name="Check" size={10} className="text-emerald-500 shrink-0" />
                          <span className="text-[11px] text-slate-600">{t}</span>
                        </div>
                      ))}
                      <button onClick={onUpgradePlan}
                        className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-[.98]"
                        style={{ background:"linear-gradient(135deg,#e8a820,#f0c060)", color:"#0a1628" }}>
                        <Icon name="Sparkles" size={11} color="#0a1628" /> Посмотреть тарифы
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Воронка FREE: после ответа юриста ─ */}
              {isFreeUser && hasReply && isBlocked && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-2 my-4 px-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400">Продолжить работу</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="px-4 py-3.5" style={{ background:"linear-gradient(135deg,#0f2044,#1a3260)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background:"rgba(232,168,32,.2)", border:"1px solid rgba(232,168,32,.25)" }}>
                          <Icon name="Star" size={14} color="#e8a820" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-white leading-tight">Тариф «Старт»</p>
                          <p className="text-[10px]" style={{ color:"rgba(255,255,255,.5)" }}>Всё для решения вашего вопроса</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white px-4 py-3">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          ["UserCheck","1 консультация юриста"],["FileText","5 документов AI"],
                          ["ShieldCheck","Проверка документа"],["Bot","30 вопросов AI"],
                        ].map(([icon,txt]) => (
                          <div key={txt} className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-emerald-50 flex items-center justify-center shrink-0">
                              <Icon name={icon as "Bot"} size={9} className="text-emerald-600" />
                            </div>
                            <span className="text-[10.5px] text-slate-600">{txt}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={onUpgradePlan}
                        className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-[.98] mb-1.5"
                        style={{ background:"linear-gradient(135deg,#e8a820,#f0c060)", color:"#0a1628", boxShadow:"0 4px 14px rgba(232,168,32,.35)" }}>
                        Оформить «Старт»
                      </button>
                      <button onClick={onUpgradePlan}
                        className="w-full py-1.5 text-[11px] text-slate-400 hover:text-navy-600 transition-colors flex items-center justify-center gap-1">
                        Все тарифы <Icon name="ChevronRight" size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Воронка исчерпания (платные) ─ */}
              {isBlocked && !isAdmin && !isFreeUser && (
                <div className="flex gap-2.5 items-end animate-fade-in">
                  <div className="w-8 h-8 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
                    <Icon name="UserCheck" size={13} className="text-gold-400" />
                  </div>
                  <div className="flex-1 max-w-[82%]">
                    <span className="text-[10px] font-bold text-navy-400 ml-1 mb-1 block">{EXPERT_NAME}</span>
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-[4px] shadow px-3.5 py-3 mb-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Icon name="Lock" size={11} className="text-amber-500" />
                        </div>
                        <p className="text-[12.5px] font-bold text-navy-800">Все консультации использованы</p>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Переписка доступна для чтения. Докупите консультацию или обновите тариф.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <button onClick={onBuyLawyerQuestions}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-navy-700 to-navy-800 shadow-sm active:scale-[.98] transition-all">
                        <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                          <Icon name="UserCheck" size={14} className="text-gold-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[12px] font-bold text-white">+1 консультация юриста</p>
                          <p className="text-[10px] text-white/55">Ответ 1–3 часа</p>
                        </div>
                        <span className="text-[13px] font-bold text-gold-400 shrink-0">990 ₽</span>
                      </button>
                      {currentPlanId !== "plan_max" && (
                        <button onClick={onUpgradePlan}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm active:scale-[.98] transition-all">
                          <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                            <Icon name="TrendingUp" size={14} className="text-navy-600" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-[12px] font-semibold text-navy-800">
                              {currentPlanId === "plan_starter" ? "Тариф «Профи»" : "Тариф «Максимум»"}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {currentPlanId === "plan_starter" ? "+5 конс. · 100 вопросов AI" : "+10 конс. · 300 вопросов AI"}
                            </p>
                          </div>
                          <Icon name="ChevronRight" size={13} className="text-slate-400 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Typing indicator */}
          {sending && !isAdmin && (
            <div className="flex gap-2.5 items-end animate-fade-in">
              <div className="w-8 h-8 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
                <Icon name="UserCheck" size={13} className="text-gold-400" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-[4px] px-3.5 py-3 shadow-sm">
                <span className="flex gap-1 items-center">
                  {[0, .2, .4].map(delay => (
                    <span key={delay} className="w-2 h-2 rounded-full bg-navy-400"
                      style={{ animation:`lc-dot 1.2s infinite ${delay}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Закрытый чат */}
          {isDialogClosed && lmsgs.length > 0 && (
            <div className="flex justify-center py-2">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 text-[11px] text-slate-500 border border-slate-200">
                <Icon name="Lock" size={11} /> Консультация завершена · история сохранена
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ══ ПАНЕЛЬ ВВОДА ═════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-border shadow-sm shrink-0 overflow-hidden">

        {/* Прогресс загрузки файла */}
        {sending && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-3 h-3 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin shrink-0" />
              <p className="text-[11px] text-slate-500 flex-1">Загрузка файлов...</p>
              <p className="text-[11px] font-bold text-navy-700">{uploadProgress}%</p>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-navy-500 to-navy-700 rounded-full transition-all duration-300"
                style={{ width:`${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Вложения */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3">
            <AttachmentBar attachments={attachments} onView={onViewFullMsg} onRemove={onRemoveAttachment} />
          </div>
        )}

        {/* Панель прикрепления */}
        {showAttachPanel && (
          <div className="px-4 pt-3">
            <AttachPanel
              aiAnswers={aiAnswers} genDocs={genDocs} currentCount={attachments.length}
              onSelectContent={onAddAttachment} onFilesAdded={onAddFiles} onClose={onHideAttachPanel}
            />
          </div>
        )}

        {/* Ввод */}
        <div className="flex items-end gap-2 px-3 sm:px-4 py-3">
          {/* Кнопка вложений */}
          <button onClick={onToggleAttachPanel} disabled={sending}
            className={`relative p-2 rounded-xl transition-colors shrink-0 mb-0.5 ${
              showAttachPanel || attachments.length > 0
                ? "bg-navy-100 text-navy-700"
                : "text-slate-400 hover:text-navy-600 hover:bg-slate-100"
            }`}>
            <Icon name="Paperclip" size={17} />
            {attachments.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 gradient-navy text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {attachments.length}
              </span>
            )}
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => { onInputChange(e.target.value); adjustTextarea(); }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isBlocked) onSend(); }
            }}
            disabled={sending || isBlocked || isDialogClosed}
            placeholder={
              isDialogClosed   ? "Консультация завершена"
              : isBlocked      ? "Предварительная консультация использована"
              : isAdmin        ? "Ответить клиенту..."
              : "Опишите вопрос для юриста..."
            }
            className={`flex-1 border rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none leading-relaxed transition-colors ${
              isBlocked || isDialogClosed
                ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-50 border-slate-200 text-navy-800 placeholder:text-slate-400 focus:border-navy-300 focus:bg-white"
            }`}
            style={{ minHeight:40, maxHeight:180 }}
          />

          {/* Кнопка отправки */}
          <button onClick={onSend}
            disabled={isBlocked || sending || (!input.trim() && attachments.length === 0)}
            className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shrink-0 mb-0.5 disabled:opacity-35 hover:opacity-90 transition-all shadow-sm active:scale-95">
            {sending
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Icon name="Send" size={16} className="text-white" />}
          </button>
        </div>

        {/* Ошибка */}
        {err && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <Icon name="AlertCircle" size={11} className="text-red-500 shrink-0" />
            <p className="text-[11px] text-red-500 flex-1">{err}</p>
            <button onClick={onSend} disabled={sending}
              className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 underline underline-offset-2 transition-colors">
              <Icon name="RotateCcw" size={10} /> Повторить
            </button>
          </div>
        )}
      </div>

      {/* Модалка предпросмотра вложения */}
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
