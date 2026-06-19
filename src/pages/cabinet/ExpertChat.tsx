import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AttachmentModal, AttachmentBar, AttachPanel } from "./ExpertAttachPanel";
import MsgBubble from "./ExpertChatMsgBubble";
import { EXPERT_NAME } from "./ExpertChatUtils";
import type { ExpertChatProps } from "./ExpertChatUtils";
import type { LawyerMessage } from "@/lib/auth";
import { subscribeToPush, isPushSupported, isPushGranted } from "@/lib/pushNotifications";

/* ── CSS-анимации ───────────────────────────────────────────────── */
const CSS = `
@keyframes lc-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes lc-dot{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
@keyframes lc-fade{from{opacity:0}to{opacity:1}}
@keyframes lc-pulse{0%,100%{box-shadow:0 0 0 0 rgba(6,182,247,.4)}70%{box-shadow:0 0 0 8px rgba(6,182,247,0)}}
.lc-scroll::-webkit-scrollbar{width:4px}
.lc-scroll::-webkit-scrollbar-track{background:transparent}
.lc-scroll::-webkit-scrollbar-thumb{background:rgba(6,182,247,.2);border-radius:4px}
.lc-input:focus{outline:none;border-color:rgba(6,182,247,.6);box-shadow:0 0 0 3px rgba(6,182,247,.1),4px 4px 12px rgba(0,0,0,.3),-2px -2px 8px rgba(255,255,255,.03)}
.lc-btn:hover{opacity:.85;transform:scale(1.06)}
.lc-btn:active{transform:scale(.95)}
`;

/* ── Тема ───────────────────────────────────────────────────────── */
const DARK = {
  bg:       "#0f172a",
  surface:  "#1e293b",
  surface2: "#162032",
  border:   "rgba(255,255,255,.07)",
  accent:   "#06b6f7",
  text:     "#e2e8f0",
  sub:      "#64748b",
  msgArea:  "#0d1526",
};

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

  /* ── Push ──────────────────────────────────────────────────────── */
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

  /* ── Idle → Chat AI ────────────────────────────────────────────── */
  useEffect(() => {
    if (!onGoToChat) return;
    let t: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(t); t = setTimeout(onGoToChat, 5 * 60 * 1000); };
    const evs = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    evs.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); evs.forEach(e => window.removeEventListener(e, reset)); };
  }, [onGoToChat]);

  /* ── Скролл ────────────────────────────────────────────────────── */
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

  /* ── Reply ─────────────────────────────────────────────────────── */
  const [replyTo, setReplyTo] = useState<LawyerMessage | null>(null);

  /* ── FREE flags ────────────────────────────────────────────────── */
  const hasSentQ = isFreeUser && lmsgs.some(m => m.sender === "user");
  const hasReply = isFreeUser && lmsgs.some(m => m.sender === "admin");

  /* ── Typing indicator (пока sending) ──────────────────────────── */
  const showTyping = sending && !isAdmin;

  /* ── Консультации — цвет бейджа ────────────────────────────────── */
  const qBadgeColor = lawyerQLeft === 0 ? "#ef4444" : lawyerQLeft <= 2 ? "#f59e0b" : "#06b6f7";

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      height: "clamp(520px, calc(100svh - 180px), 820px)",
      maxWidth: 760, width: "100%", margin: "0 auto",
    }}>
      <style>{CSS}</style>

      {/* ══ ШАПКА ═════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: DARK.surface,
        borderRadius: 20,
        border: `1px solid ${DARK.border}`,
        padding: "12px 16px",
        boxShadow: "4px 4px 16px rgba(0,0,0,.35),-2px -2px 8px rgba(255,255,255,.03)",
        flexShrink: 0,
      }}>
        {isAdmin && (
          <button onClick={onBack} className="lc-btn" style={{
            width: 36, height: 36, borderRadius: 12,
            background: DARK.surface2,
            border: `1px solid ${DARK.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
            boxShadow: "3px 3px 8px rgba(0,0,0,.3),-1px -1px 4px rgba(255,255,255,.03)",
          }}>
            <Icon name="ArrowLeft" size={16} style={{ color: DARK.accent }} />
          </button>
        )}

        {/* Аватар с pulse */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: "linear-gradient(135deg,#0369a1,#0f4c81)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(6,182,247,.25)",
            animation: "lc-pulse 2.5s infinite",
          }}>
            <Icon name="Scale" size={18} style={{ color: "#fff" }} />
          </div>
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: 12, height: 12, borderRadius: "50%",
            background: "#22c55e",
            border: `2px solid ${DARK.surface}`,
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: DARK.text, margin: 0, lineHeight: 1.3, truncate: true }}>
            {isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
          </p>
          <p style={{ fontSize: 11, color: isAdmin ? DARK.sub : "#22c55e", margin: 0, marginTop: 1 }}>
            {isAdmin
              ? (currentDialog?.email ?? "")
              : isDialogClosed
                ? "🔒 Консультация завершена"
                : "● Онлайн · ответит за 1–3 ч"}
          </p>
        </div>

        {/* Правые кнопки */}
        {isAdmin ? (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* Завершить */}
            <button onClick={onCompleteConsultation} className="lc-btn" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 12,
              background: "linear-gradient(135deg,#dc2626,#ef4444)",
              border: "none", color: "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(220,38,38,.35)",
            }}>
              <span>🛑</span>
              <span className="hidden sm:inline">Завершить</span>
            </button>
            <button onClick={onHideDialog} className="lc-btn" style={{
              width: 34, height: 34, borderRadius: 10,
              background: DARK.surface2, border: `1px solid ${DARK.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <Icon name="EyeOff" size={14} style={{ color: DARK.sub }} />
            </button>
            <button onClick={onRefresh} className="lc-btn" style={{
              width: 34, height: 34, borderRadius: 10,
              background: DARK.surface2, border: `1px solid ${DARK.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <Icon name="RefreshCw" size={14} style={{ color: DARK.sub }} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Бейдж консультаций */}
            {!isFreeUser && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 20,
                background: DARK.surface2,
                border: `1px solid ${qBadgeColor}40`,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: qBadgeColor }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: qBadgeColor }}>{lawyerQLeft}</span>
                <span style={{ fontSize: 10, color: DARK.sub }}>конс.</span>
              </div>
            )}
            {isFreeUser && (
              <div style={{
                padding: "4px 10px", borderRadius: 20,
                background: "rgba(245,158,11,.1)",
                border: "1px solid rgba(245,158,11,.3)",
                fontSize: 11, fontWeight: 700, color: "#f59e0b",
              }}>🎁 Бесплатно</div>
            )}
            {/* Push */}
            {pushSetup && !pushDone && (
              <button onClick={enablePush} disabled={pushLoading} className="lc-btn" style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 10,
                background: "rgba(6,182,247,.1)", border: "1px solid rgba(6,182,247,.25)",
                color: DARK.accent, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                {pushLoading
                  ? <span style={{ width: 12, height: 12, border: "2px solid rgba(6,182,247,.3)", borderTopColor: DARK.accent, borderRadius: "50%", display: "inline-block", animation: "spin 1s linear infinite" }} />
                  : <Icon name="Bell" size={12} />}
                <span className="hidden sm:inline">Уведомления</span>
              </button>
            )}
            {pushDone && <Icon name="BellRing" size={16} style={{ color: "#22c55e" }} />}
            <button onClick={onRefresh} className="lc-btn" style={{
              width: 34, height: 34, borderRadius: 10,
              background: DARK.surface2, border: `1px solid ${DARK.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <Icon name="RefreshCw" size={14} style={{ color: DARK.sub }} />
            </button>
          </div>
        )}
      </div>

      {/* ══ БАННЕР FREE ════════════════════════════════════════════════ */}
      {isFreeUser && !hasSentQ && (
        <div style={{
          flexShrink: 0, borderRadius: 16,
          background: "linear-gradient(135deg,rgba(245,158,11,.08),rgba(251,191,36,.04))",
          border: "1px solid rgba(245,158,11,.2)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
          animation: "lc-fade .3s ease",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            background: "rgba(245,158,11,.12)",
            border: "1px solid rgba(245,158,11,.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="Gift" size={16} style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", margin: 0 }}>1 бесплатный вопрос юристу</p>
            <p style={{ fontSize: 11, color: "#92400e", margin: 0, marginTop: 2 }}>Опишите ситуацию — ответ в течение 1–3 часов</p>
          </div>
        </div>
      )}

      {/* ══ REPLY-строка ══════════════════════════════════════════════ */}
      {replyTo && (
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 12,
          background: "rgba(6,182,247,.06)",
          borderLeft: `3px solid ${DARK.accent}`,
          border: "1px solid rgba(6,182,247,.15)",
          animation: "lc-fade .2s ease",
        }}>
          <Icon name="CornerDownRight" size={12} style={{ color: DARK.accent, flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: DARK.sub, flex: 1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 700, color: DARK.accent }}>
              {replyTo.sender === "admin" ? EXPERT_NAME : "Вы"}:{" "}
            </span>
            {replyTo.body?.slice(0, 80)}
          </p>
          <button onClick={() => setReplyTo(null)} style={{
            width: 22, height: 22, borderRadius: 6,
            background: "rgba(255,255,255,.05)", border: `1px solid ${DARK.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <Icon name="X" size={11} style={{ color: DARK.sub }} />
          </button>
        </div>
      )}

      {/* ══ СООБЩЕНИЯ ══════════════════════════════════════════════════ */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {/* Кнопка ↓ N новых */}
        {showDown && (
          <button onClick={goBottom} className="lc-btn" style={{
            position: "absolute", bottom: 12, right: 12, zIndex: 20,
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 20,
            background: "linear-gradient(135deg,#0369a1,#06b6f7)",
            border: "none", color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 6px 20px rgba(6,182,247,.4)",
            animation: "lc-up .25s ease",
          }}>
            <Icon name="ChevronDown" size={13} />
            {newCnt > 0 ? `${newCnt} новых` : "Вниз"}
          </button>
        )}

        <div
          ref={listRef}
          onScroll={onListScroll}
          className="lc-scroll"
          style={{
            height: "100%",
            overflowY: "auto",
            background: DARK.msgArea,
            borderRadius: 20,
            border: `1px solid ${DARK.border}`,
            padding: "16px 14px",
            display: "flex", flexDirection: "column", gap: 12,
            boxShadow: "inset 4px 4px 16px rgba(0,0,0,.2),inset -2px -2px 8px rgba(255,255,255,.01)",
          }}
        >
          {/* Загрузка */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, padding: "60px 0" }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(6,182,247,.2)", borderTopColor: DARK.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: 12, color: DARK.sub, margin: 0 }}>Загружаем историю...</p>
            </div>
          )}

          {/* Пустой чат */}
          {!loading && lmsgs.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, padding: "60px 0", textAlign: "center", animation: "lc-fade .4s ease" }}>
              <div style={{
                width: 72, height: 72, borderRadius: 24,
                background: "linear-gradient(135deg,#0369a1,#0f4c81)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 24px rgba(6,182,247,.25),4px 4px 16px rgba(0,0,0,.4),-2px -2px 8px rgba(255,255,255,.04)",
              }}>
                <Icon name="MessageSquarePlus" size={28} style={{ color: "#06b6f7" }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: DARK.text, margin: 0 }}>Начните консультацию</p>
                <p style={{ fontSize: 12, color: DARK.sub, margin: "6px 0 0", maxWidth: 240 }}>
                  Опишите вашу юридическую ситуацию — юрист ответит в течение 1–3 часов
                </p>
              </div>
              {!isAdmin && (
                <button onClick={onToggleAttachPanel} className="lc-btn" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 18px", borderRadius: 12,
                  background: "rgba(6,182,247,.08)", border: "1px solid rgba(6,182,247,.2)",
                  color: DARK.accent, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  <Icon name="Paperclip" size={14} /> Прикрепить документы
                </button>
              )}
            </div>
          )}

          {/* Сообщения */}
          {!loading && lmsgs.map(m => (
            <MsgBubble
              key={m.id}
              msg={m}
              isAdmin={isAdmin}
              onReply={!isDialogClosed ? setReplyTo : undefined}
            />
          ))}

          {/* Воронки FREE */}
          {isFreeUser && hasSentQ && isBlocked && !hasReply && !loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "lc-fade .3s ease" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg,#06b6f7,#0284c7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(6,182,247,.3)",
              }}>
                <Icon name="Scale" size={15} style={{ color: "#fff" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: DARK.accent, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: ".05em", textTransform: "uppercase" }}>{EXPERT_NAME}</span>
                <div style={{
                  background: "linear-gradient(135deg,#0f2044,#162d55)",
                  border: "1px solid rgba(6,182,247,.15)",
                  borderRadius: "4px 18px 18px 18px",
                  padding: "12px 16px",
                  boxShadow: "4px 4px 16px rgba(0,0,0,.35)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(6,182,247,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="CheckCircle" size={14} style={{ color: "#06b6f7" }} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Юрист получил ваш вопрос</p>
                  </div>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Среднее время ответа — <span style={{ color: "#06b6f7", fontWeight: 600 }}>1–3 часа</span></p>
                </div>
                <div style={{
                  marginTop: 8,
                  background: DARK.surface,
                  border: `1px solid ${DARK.border}`,
                  borderRadius: "4px 18px 18px 18px",
                  padding: "12px 16px",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: DARK.text, margin: "0 0 8px" }}>Пока ждёте:</p>
                  {["Подготовка документов AI", "Проверка документов юристом", "Полноценная консультация"].map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Icon name="Check" size={11} style={{ color: "#22c55e", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: DARK.sub }}>{t}</span>
                    </div>
                  ))}
                  <button onClick={onUpgradePlan} className="lc-btn" style={{
                    width: "100%", marginTop: 10, padding: "9px 0",
                    borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,#06b6f7,#0284c7)",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(6,182,247,.3)",
                  }}>
                    Посмотреть тарифы →
                  </button>
                </div>
              </div>
            </div>
          )}

          {isFreeUser && hasReply && isBlocked && !loading && (
            <div style={{ animation: "lc-fade .3s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 12px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: DARK.sub, letterSpacing: ".1em", textTransform: "uppercase" }}>Продолжить работу</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
              </div>
              <div style={{
                background: DARK.surface, borderRadius: 18,
                border: `1px solid ${DARK.border}`, overflow: "hidden",
                boxShadow: "4px 4px 16px rgba(0,0,0,.3)",
              }}>
                <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,#0f2044,#162d55)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(6,182,247,.15)", border: "1px solid rgba(6,182,247,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="Star" size={14} style={{ color: "#06b6f7" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Тариф «Старт»</p>
                      <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>Всё для решения вашего вопроса</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <button onClick={onUpgradePlan} className="lc-btn" style={{
                    width: "100%", padding: "10px 0", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#06b6f7,#0284c7)",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(6,182,247,.3)",
                  }}>
                    Оформить «Старт»
                  </button>
                  <button onClick={onUpgradePlan} style={{
                    width: "100%", marginTop: 6, padding: "6px 0",
                    background: "none", border: "none",
                    fontSize: 11, color: DARK.sub, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}>
                    Все тарифы <Icon name="ChevronRight" size={11} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Исчерпание консультаций */}
          {isBlocked && !isAdmin && !isFreeUser && !loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", animation: "lc-fade .3s ease" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg,#06b6f7,#0284c7)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="Scale" size={15} style={{ color: "#fff" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: DARK.accent, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: ".05em", textTransform: "uppercase" }}>{EXPERT_NAME}</span>
                <div style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Icon name="Lock" size={13} style={{ color: "#f59e0b" }} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: DARK.text, margin: 0 }}>Консультации исчерпаны</p>
                  </div>
                  <p style={{ fontSize: 11, color: DARK.sub, margin: 0 }}>Докупите консультацию или обновите тариф</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={onBuyLawyerQuestions} className="lc-btn" style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 14,
                    background: "linear-gradient(135deg,#0f2044,#1a3a6b)",
                    border: "1px solid rgba(6,182,247,.2)",
                    cursor: "pointer",
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(6,182,247,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="UserCheck" size={14} style={{ color: "#06b6f7" }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>+1 консультация юриста</p>
                      <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>Ответ 1–3 часа</p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#06b6f7" }}>990 ₽</span>
                  </button>
                  {currentPlanId !== "plan_max" && (
                    <button onClick={onUpgradePlan} className="lc-btn" style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", borderRadius: 14,
                      background: DARK.surface,
                      border: `1px solid ${DARK.border}`,
                      cursor: "pointer",
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(6,182,247,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="TrendingUp" size={14} style={{ color: DARK.accent }} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: DARK.text, margin: 0 }}>
                          {currentPlanId === "plan_starter" ? "Тариф «Профи»" : "Тариф «Максимум»"}
                        </p>
                        <p style={{ fontSize: 10, color: DARK.sub, margin: 0 }}>
                          {currentPlanId === "plan_starter" ? "+5 конс. · 100 вопросов AI" : "+10 конс. · 300 вопросов AI"}
                        </p>
                      </div>
                      <Icon name="ChevronRight" size={13} style={{ color: DARK.sub }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {showTyping && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", animation: "lc-fade .2s ease" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12,
                background: "linear-gradient(135deg,#06b6f7,#0284c7)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="Scale" size={15} style={{ color: "#fff" }} />
              </div>
              <div>
                <span style={{ fontSize: 10, color: DARK.accent, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: ".05em", textTransform: "uppercase" }}>{EXPERT_NAME}</span>
                <div style={{
                  background: DARK.surface,
                  border: `1px solid ${DARK.border}`,
                  borderRadius: "4px 18px 18px 18px",
                  padding: "12px 18px",
                  display: "flex", alignItems: "center", gap: 6,
                  boxShadow: "4px 4px 12px rgba(0,0,0,.3)",
                }}>
                  <span style={{ fontSize: 11, color: DARK.sub, marginRight: 4 }}>печатает</span>
                  {[0, .2, .4].map(d => (
                    <span key={d} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: DARK.accent,
                      display: "inline-block",
                      animation: `lc-dot 1.3s infinite ${d}s`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Чат закрыт */}
          {isDialogClosed && lmsgs.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 20,
                background: "rgba(255,255,255,.03)",
                border: `1px solid ${DARK.border}`,
                fontSize: 11, color: DARK.sub,
              }}>
                <Icon name="Lock" size={11} style={{ color: DARK.sub }} />
                Консультация завершена · история сохранена
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ══ ПАНЕЛЬ ВВОДА ═══════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        background: DARK.surface,
        borderRadius: 20,
        border: `1px solid ${DARK.border}`,
        overflow: "hidden",
        boxShadow: "4px 4px 16px rgba(0,0,0,.3),-2px -2px 8px rgba(255,255,255,.02)",
      }}>
        {/* Прогресс загрузки */}
        {sending && uploadProgress > 0 && uploadProgress < 100 && (
          <div style={{ padding: "10px 16px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 12, height: 12, border: "2px solid rgba(6,182,247,.3)", borderTopColor: DARK.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 11, color: DARK.sub, flex: 1 }}>Загрузка файлов...</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: DARK.accent }}>{uploadProgress}%</span>
            </div>
            <div style={{ height: 3, background: DARK.surface2, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: `linear-gradient(90deg,${DARK.accent},#0284c7)`, borderRadius: 2, width: `${uploadProgress}%`, transition: "width .3s" }} />
            </div>
          </div>
        )}

        {/* Вложения */}
        {attachments.length > 0 && (
          <div style={{ padding: "10px 16px 0" }}>
            <AttachmentBar attachments={attachments} onView={onViewFullMsg} onRemove={onRemoveAttachment} />
          </div>
        )}

        {/* Панель выбора */}
        {showAttachPanel && (
          <div style={{ padding: "10px 16px 0" }}>
            <AttachPanel
              aiAnswers={aiAnswers} genDocs={genDocs} currentCount={attachments.length}
              onSelectContent={onAddAttachment} onFilesAdded={onAddFiles} onClose={onHideAttachPanel}
            />
          </div>
        )}

        {/* Чат закрыт — заблокированный ввод */}
        {isDialogClosed ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(100,116,139,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="Lock" size={15} style={{ color: DARK.sub }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: DARK.sub }}>Чат закрыт 🔒</span>
          </div>
        ) : (
          /* Поле ввода */
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 12px" }}>
            <button onClick={onToggleAttachPanel} disabled={sending} className="lc-btn" style={{
              position: "relative", width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: showAttachPanel || attachments.length > 0
                ? "rgba(6,182,247,.15)" : DARK.surface2,
              border: `1px solid ${showAttachPanel || attachments.length > 0 ? "rgba(6,182,247,.35)" : DARK.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", marginBottom: 1,
            }}>
              <Icon name="Paperclip" size={17} style={{ color: showAttachPanel || attachments.length > 0 ? DARK.accent : DARK.sub }} />
              {attachments.length > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  minWidth: 16, height: 16, borderRadius: 8, padding: "0 3px",
                  background: DARK.accent, color: "#fff", fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${DARK.surface}`,
                }}>
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
                  if (!isBlocked) { onSend(); setReplyTo(null); }
                }
              }}
              disabled={sending || isBlocked}
              placeholder={
                isBlocked ? "Консультации исчерпаны"
                  : isAdmin ? "Ответить клиенту..."
                  : "Опишите вопрос для юриста..."
              }
              className="lc-input"
              style={{
                flex: 1, resize: "none",
                background: isBlocked ? "rgba(15,23,42,.5)" : DARK.surface2,
                border: `1px solid ${DARK.border}`,
                borderRadius: 14, padding: "9px 14px",
                fontSize: 13, color: isBlocked ? DARK.sub : DARK.text,
                lineHeight: 1.5, minHeight: 40, maxHeight: 160,
                cursor: isBlocked ? "not-allowed" : "text",
                transition: "border-color .2s,box-shadow .2s",
              }}
            />

            <button
              onClick={() => { onSend(); setReplyTo(null); }}
              disabled={isBlocked || sending || (!input.trim() && attachments.length === 0)}
              className="lc-btn"
              style={{
                width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                background: isBlocked || (!input.trim() && attachments.length === 0)
                  ? DARK.surface2
                  : "linear-gradient(135deg,#06b6f7,#0284c7)",
                border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isBlocked || (!input.trim() && attachments.length === 0) ? "not-allowed" : "pointer",
                boxShadow: isBlocked || (!input.trim() && attachments.length === 0)
                  ? "none" : "0 4px 14px rgba(6,182,247,.35)",
                marginBottom: 1, opacity: isBlocked || sending ? .4 : 1,
              }}
            >
              {sending
                ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                : <Icon name="Send" size={16} style={{ color: isBlocked || (!input.trim() && attachments.length === 0) ? DARK.sub : "#fff" }} />}
            </button>
          </div>
        )}

        {/* Ошибка */}
        {err && (
          <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="AlertCircle" size={12} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#ef4444", flex: 1 }}>{err}</span>
            <button onClick={onSend} disabled={sending} style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 700, color: "#ef4444",
              background: "none", border: "none", cursor: "pointer",
              textDecoration: "underline",
            }}>
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

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
