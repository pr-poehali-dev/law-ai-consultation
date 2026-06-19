import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AttachmentModal, AttachmentBar, AttachPanel } from "./ExpertAttachPanel";
import MsgBubble from "./ExpertChatMsgBubble";
import { EXPERT_NAME } from "./ExpertChatUtils";
import type { ExpertChatProps } from "./ExpertChatUtils";
import type { LawyerMessage } from "@/lib/auth";
import { subscribeToPush, isPushSupported, isPushGranted } from "@/lib/pushNotifications";

const CHAT_CSS = `
  @keyframes lc-in{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes lc-dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
  @keyframes lc-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fade-in{from{opacity:0}to{opacity:1}}
  .lc-scroll::-webkit-scrollbar{display:none}
  .lc-scroll{scrollbar-width:none}
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

  /* ── PUSH ─────────────────────────────────────────────────────────── */
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

  /* ── IDLE → Chat AI ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!onGoToChat) return;
    let t: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(t); t = setTimeout(onGoToChat, 5 * 60 * 1000); };
    const evs = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    evs.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); evs.forEach(e => window.removeEventListener(e, reset)); };
  }, [onGoToChat]);

  /* ── СКРОЛЛ ───────────────────────────────────────────────────────── */
  const listRef = useRef<HTMLDivElement>(null);
  const [showDown, setShowDown] = useState(false);
  const [newCnt, setNewCnt] = useState(0);
  const prevLen = useRef(lmsgs.length);

  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setShowDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  useEffect(() => {
    const added = lmsgs.length - prevLen.current;
    prevLen.current = lmsgs.length;
    if (added <= 0) return;
    const el = listRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 120) {
      setNewCnt(n => n + added);
    } else {
      setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 60);
    }
  }, [lmsgs.length]);

  const goBottom = () => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    setShowDown(false); setNewCnt(0);
  };

  /* ── REPLY ────────────────────────────────────────────────────────── */
  const [replyTo, setReplyTo] = useState<LawyerMessage | null>(null);

  const handleReply = (msg: LawyerMessage) => {
    setReplyTo(msg);
    textareaRef.current?.focus();
  };

  /* ── TYPING ───────────────────────────────────────────────────────── */
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (sending && !isAdmin) {
      setIsTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsTyping(false), 3000);
    } else {
      setIsTyping(false);
    }
    return () => clearTimeout(typingTimer.current);
  }, [sending, isAdmin]);

  /* ── FREE user flags ──────────────────────────────────────────────── */
  const hasSentQ = isFreeUser && lmsgs.some(m => m.sender === "user");
  const hasReply = isFreeUser && lmsgs.some(m => m.sender === "admin");

  /* ── Счётчик консультаций ─────────────────────────────────────────── */
  const qColor = lawyerQLeft === 0 ? "red" : lawyerQLeft <= 2 ? "amber" : "emerald";
  const qMap = {
    red:     { pill: "bg-red-50 border-red-200 text-red-600" },
    amber:   { pill: "bg-amber-50 border-amber-200 text-amber-700" },
    emerald: { pill: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  };

  return (
    <div
      className="max-w-3xl w-full mx-auto flex flex-col gap-2 sm:gap-3"
      style={{ height: "clamp(520px, calc(100svh - 180px), 800px)" }}
    >
      <style>{CHAT_CSS}</style>

      {/* ═══ ШАПКА ══════════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-3 sm:px-4 py-3 shadow-sm"
        style={{ background: "linear-gradient(135deg,#fff 80%,rgba(15,76,129,.03))" }}>

        {isAdmin && (
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Icon name="ArrowLeft" size={16} className="text-navy-600" />
          </button>
        )}

        {/* Аватар */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow"
            style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
            <Icon name="Scale" size={17} className="text-[#e8a820]" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-navy-900 truncate leading-tight">
            {isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
          </p>
          <p className="text-[10.5px] truncate" style={{ color: isAdmin ? "#64748b" : "#059669" }}>
            {isAdmin
              ? (currentDialog?.email ?? "")
              : isDialogClosed
                ? "🔒 Консультация завершена"
                : "● Онлайн — ответит в течение 1–3 ч"}
          </p>
        </div>

        {/* Кнопки ADMIN */}
        {isAdmin ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onCompleteConsultation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}>
              <span>🛑</span>
              <span className="hidden sm:inline">Завершить</span>
            </button>
            <button onClick={onHideDialog} className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Скрыть">
              <Icon name="EyeOff" size={14} className="text-slate-400" />
            </button>
            <button onClick={onRefresh} className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Обновить">
              <Icon name="RefreshCw" size={14} className="text-slate-400" />
            </button>
          </div>
        ) : (
          /* Кнопки USER */
          <div className="flex items-center gap-2 shrink-0">
            {isFreeUser ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-xs">🎁</span>
                <span className="text-[11px] font-bold text-amber-700 hidden sm:inline">Бесплатно</span>
              </div>
            ) : (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${qMap[qColor].pill}`}>
                <Icon name="UserCheck" size={10} />
                <span>{lawyerQLeft}</span>
                <span className="text-[9px] font-medium opacity-70 hidden sm:inline">конс.</span>
              </div>
            )}
            {pushSetup && !pushDone && (
              <button onClick={enablePush} disabled={pushLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-semibold transition-all active:scale-95 border"
                style={{ background: "rgba(15,76,129,.06)", color: "#0f4c81", borderColor: "rgba(15,76,129,.15)" }}>
                {pushLoading
                  ? <span className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
                  : <Icon name="Bell" size={11} />}
                <span className="hidden sm:inline">Уведомления</span>
              </button>
            )}
            {pushDone && <Icon name="BellRing" size={14} className="text-emerald-500" />}
            <button onClick={onRefresh} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Icon name="RefreshCw" size={14} className="text-slate-400" />
            </button>
          </div>
        )}
      </div>

      {/* ═══ БАННЕР FREE ════════════════════════════════════════════════ */}
      {isFreeUser && !hasSentQ && (
        <div className="shrink-0 rounded-2xl border border-amber-200 px-4 py-3 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)" }}>
            <Icon name="Gift" size={15} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900">1 бесплатный вопрос юристу</p>
            <p className="text-[10.5px] text-amber-700/80">Опишите ситуацию подробнее — ответ в течение 1–3 часов</p>
          </div>
        </div>
      )}

      {/* ═══ REPLY-строка ════════════════════════════════════════════════ */}
      {replyTo && (
        <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border-l-4 border-navy-500 bg-navy-50 border border-navy-100">
          <Icon name="CornerDownRight" size={12} className="text-navy-400 shrink-0" />
          <p className="text-[11px] text-navy-600 flex-1 truncate">
            <span className="font-bold">{replyTo.sender === "admin" ? EXPERT_NAME : "Вы"}: </span>
            {replyTo.body?.slice(0, 80)}
          </p>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded-lg hover:bg-navy-100 transition-colors">
            <Icon name="X" size={12} className="text-navy-400" />
          </button>
        </div>
      )}

      {/* ═══ СПИСОК СООБЩЕНИЙ ════════════════════════════════════════════ */}
      <div
        ref={listRef}
        onScroll={onListScroll}
        className="lc-scroll flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 p-3 sm:p-5 space-y-3"
        style={{ background: "linear-gradient(180deg,#f8fafc 0%,#fff 100%)" }}
      >
        {/* ↓ Кнопка "Новые" */}
        {showDown && (
          <div className="sticky top-0 flex justify-center z-10 -mt-1 pb-1">
            <button onClick={goBottom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white shadow-xl"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", animation: "lc-up .2s ease" }}>
              <Icon name="ChevronDown" size={13} />
              {newCnt > 0 ? `↓ ${newCnt} новых` : "↓ Вниз"}
            </button>
          </div>
        )}

        {/* Загрузка */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Загружаем историю...</p>
          </div>
        )}

        {/* Пустой чат */}
        {!loading && lmsgs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
            <div className="w-18 h-18 flex items-center justify-center rounded-3xl shadow-xl"
              style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)", width: 72, height: 72 }}>
              <Icon name="MessageSquarePlus" size={28} className="text-[#e8a820]" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy-800 mb-1">Начните консультацию</p>
              <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                Опишите вашу ситуацию — юрист ответит в течение 1–3 часов
              </p>
            </div>
            {!isAdmin && (
              <button onClick={onToggleAttachPanel}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 hover:opacity-90"
                style={{ background: "rgba(15,76,129,.06)", borderColor: "rgba(15,76,129,.2)", color: "#0f4c81" }}>
                <Icon name="Paperclip" size={13} /> Прикрепить документы
              </button>
            )}
          </div>
        )}

        {/* Сообщения */}
        {!loading && lmsgs.length > 0 && (
          <>
            {lmsgs.map((m, idx) => (
              <MsgBubble
                key={m.id}
                msg={m}
                isAdmin={isAdmin}
                onReply={!isDialogClosed ? handleReply : undefined}
                replyTo={replyTo && idx === lmsgs.length - 1 ? replyTo : null}
              />
            ))}

            {/* Воронка FREE: до ответа */}
            {isFreeUser && hasSentQ && isBlocked && !hasReply && (
              <div className="flex gap-2.5 items-start" style={{ animation: "fade-in .3s ease" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5"
                  style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
                  <Icon name="Scale" size={13} className="text-[#e8a820]" />
                </div>
                <div className="flex-1 max-w-[82%]">
                  <span className="text-[10px] font-bold text-navy-400 ml-1 mb-1 block uppercase tracking-wide">{EXPERT_NAME}</span>
                  <div className="rounded-2xl rounded-tl-sm overflow-hidden shadow-sm"
                    style={{ background: "linear-gradient(135deg,#0f2044,#1a3260)" }}>
                    <div className="p-4">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(232,168,32,.2)" }}>
                          <Icon name="CheckCircle" size={13} color="#e8a820" />
                        </div>
                        <p className="text-[13px] font-bold text-white">Юрист получил ваш вопрос</p>
                      </div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                        Среднее время ответа — <span className="text-white font-semibold">1–3 часа</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-sm">
                    <p className="text-[11px] font-bold text-navy-700 mb-2">Пока ждёте:</p>
                    {["Подготовка документов AI", "Проверка документа юристом", "Полноценная консультация"].map(t => (
                      <div key={t} className="flex items-center gap-1.5 mb-1">
                        <Icon name="Check" size={10} className="text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-600">{t}</span>
                      </div>
                    ))}
                    <button onClick={onUpgradePlan}
                      className="w-full mt-2.5 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                      style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}>
                      Посмотреть тарифы →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Воронка FREE: после ответа */}
            {isFreeUser && hasReply && isBlocked && (
              <div style={{ animation: "fade-in .3s ease" }}>
                <div className="flex items-center gap-2 my-3 px-1">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Продолжить работу</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <div className="px-4 py-3.5" style={{ background: "linear-gradient(135deg,#0f2044,#1a3260)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(232,168,32,.2)", border: "1px solid rgba(232,168,32,.25)" }}>
                        <Icon name="Star" size={13} color="#e8a820" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Тариф «Старт»</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,.5)" }}>Всё для решения вашего вопроса</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <button onClick={onUpgradePlan}
                      className="w-full py-2.5 rounded-xl text-xs font-bold mb-1.5 transition-all active:scale-95"
                      style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628", boxShadow: "0 4px 14px rgba(232,168,32,.3)" }}>
                      Оформить «Старт»
                    </button>
                    <button onClick={onUpgradePlan}
                      className="w-full py-1.5 text-[11px] text-slate-400 flex items-center justify-center gap-1">
                      Все тарифы <Icon name="ChevronRight" size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Воронка исчерпания */}
            {isBlocked && !isAdmin && !isFreeUser && (
              <div className="flex gap-2.5 items-end" style={{ animation: "fade-in .3s ease" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md"
                  style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
                  <Icon name="Scale" size={13} className="text-[#e8a820]" />
                </div>
                <div className="flex-1 max-w-[82%]">
                  <span className="text-[10px] font-bold text-navy-400 ml-1 mb-1 block uppercase tracking-wide">{EXPERT_NAME}</span>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm shadow px-3.5 py-3 mb-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <Icon name="Lock" size={11} className="text-amber-500" />
                      </div>
                      <p className="text-[12.5px] font-bold text-navy-800">Все консультации использованы</p>
                    </div>
                    <p className="text-[11px] text-slate-500">Докупите консультацию или обновите тариф.</p>
                  </div>
                  <div className="space-y-1.5">
                    <button onClick={onBuyLawyerQuestions}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl shadow-sm active:scale-[.98] transition-all"
                      style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
                      <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                        <Icon name="UserCheck" size={14} className="text-[#e8a820]" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-white">+1 консультация юриста</p>
                        <p className="text-[10px] text-white/55">Ответ 1–3 часа</p>
                      </div>
                      <span className="text-[13px] font-bold text-[#e8a820] shrink-0">990 ₽</span>
                    </button>
                    {currentPlanId !== "plan_max" && (
                      <button onClick={onUpgradePlan}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm active:scale-[.98] transition-all">
                        <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                          <Icon name="TrendingUp" size={14} className="text-navy-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-xs font-semibold text-navy-800">
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

        {/* ✏️ Юрист печатает... */}
        {isTyping && !isAdmin && (
          <div className="flex gap-2.5 items-end" style={{ animation: "lc-in .2s ease" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
              <Icon name="Scale" size={13} className="text-[#e8a820]" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 ml-2 mb-0.5 font-semibold uppercase tracking-wide">{EXPERT_NAME}</p>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 mr-1">печатает</span>
                {[0, 0.2, 0.4].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-navy-400"
                    style={{ animation: `lc-dot 1.2s infinite ${d}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 🔒 Чат закрыт — системное сообщение */}
        {isDialogClosed && lmsgs.length > 0 && (
          <div className="flex justify-center py-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] text-slate-500"
              style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
              <Icon name="Lock" size={11} className="text-slate-400" />
              <span>Консультация завершена · история сохранена</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ═══ ПАНЕЛЬ ВВОДА ════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Прогресс загрузки */}
        {sending && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-3 h-3 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin shrink-0" />
              <p className="text-[11px] text-slate-500 flex-1">Загрузка файлов...</p>
              <p className="text-[11px] font-bold text-navy-700">{uploadProgress}%</p>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: "linear-gradient(90deg,#0f4c81,#1a6bb5)" }} />
            </div>
          </div>
        )}

        {/* Вложения */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3">
            <AttachmentBar attachments={attachments} onView={onViewFullMsg} onRemove={onRemoveAttachment} />
          </div>
        )}

        {/* Панель выбора */}
        {showAttachPanel && (
          <div className="px-4 pt-3">
            <AttachPanel
              aiAnswers={aiAnswers} genDocs={genDocs} currentCount={attachments.length}
              onSelectContent={onAddAttachment} onFilesAdded={onAddFiles} onClose={onHideAttachPanel}
            />
          </div>
        )}

        {/* Закрытый чат */}
        {isDialogClosed ? (
          <div className="flex items-center justify-center gap-2 px-4 py-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(100,116,139,.1)" }}>
              <Icon name="Lock" size={14} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Чат закрыт 🔒</p>
          </div>
        ) : (
          /* Поле ввода */
          <div className="flex items-end gap-2 px-3 sm:px-4 py-3">
            <button onClick={onToggleAttachPanel} disabled={sending}
              className={`relative p-2 rounded-xl transition-all shrink-0 mb-0.5 ${
                showAttachPanel || attachments.length > 0
                  ? "bg-navy-100 text-navy-700"
                  : "text-slate-400 hover:text-navy-600 hover:bg-slate-100"
              }`}>
              <Icon name="Paperclip" size={18} />
              {attachments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
                  {attachments.length}
                </span>
              )}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => { onInputChange(e.target.value); adjustTextarea(); }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isBlocked && !isDialogClosed) onSend();
                }
              }}
              disabled={sending || isBlocked}
              placeholder={
                isBlocked
                  ? "Консультации исчерпаны"
                  : isAdmin
                    ? "Ответить клиенту..."
                    : "Опишите вопрос для юриста..."
              }
              className={`flex-1 border rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none leading-relaxed transition-colors ${
                isBlocked
                  ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-50 border-slate-200 text-navy-800 placeholder:text-slate-400 focus:border-navy-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,76,129,.08)]"
              }`}
              style={{ minHeight: 42, maxHeight: 160 }}
            />

            <button onClick={() => { onSend(); setReplyTo(null); }}
              disabled={isBlocked || sending || (!input.trim() && attachments.length === 0)}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-0.5 transition-all active:scale-95 disabled:opacity-30"
              style={{
                background: isBlocked || (!input.trim() && attachments.length === 0)
                  ? "#e2e8f0"
                  : "linear-gradient(135deg,#0f2d5e,#1a4080)",
                boxShadow: isBlocked ? "none" : "0 2px 10px rgba(15,45,94,.3)",
              }}>
              {sending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="Send" size={16} className={isBlocked || (!input.trim() && attachments.length === 0) ? "text-slate-400" : "text-white"} />}
            </button>
          </div>
        )}

        {/* Ошибка */}
        {err && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <Icon name="AlertCircle" size={12} className="text-red-500 shrink-0" />
            <p className="text-[11px] text-red-500 flex-1">{err}</p>
            <button onClick={onSend} disabled={sending}
              className="flex items-center gap-1 text-[11px] font-bold text-red-600 underline underline-offset-2 hover:text-red-700">
              <Icon name="RotateCcw" size={10} /> Повторить
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
