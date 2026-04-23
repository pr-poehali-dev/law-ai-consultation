import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ymGoal } from "@/lib/metrika";
import UpsellCard from "@/pages/cabinet/UpsellCard";
import { AnimatedMessage, LegalText, TypingIndicator } from "@/pages/cabinet/ChatTextRenderer";
import type { ChatMsg, DocHint } from "@/pages/cabinet/ChatTab";
import type { User } from "@/lib/auth";

interface ChatMessageListProps {
  user: User;
  messages: ChatMsg[];
  typing: boolean;
  typingStatus?: string;
  chatErr: string;
  lastAiIdx: number;
  chatEndRef: React.RefObject<HTMLDivElement>;
  onPayClick: () => void;
  onSelectPlan: () => void;
  onGoToDocs: () => void;
  onContinueChat: (partialText: string) => void;
  onExpertClick: () => void;
  onRevealAnswer?: (msgIndex: number) => void;
  onCreateDocFromMsg?: (aiText: string, userText: string, docHint?: DocHint) => void;
  creatingDocFromChat?: boolean;
}

export default function ChatMessageList({
  user,
  messages,
  typing,
  typingStatus,
  chatErr,
  lastAiIdx,
  chatEndRef,
  onPayClick,
  onSelectPlan,
  onGoToDocs,
  onContinueChat,
  onExpertClick,
  onRevealAnswer,
  onCreateDocFromMsg,
  creatingDocFromChat,
}: ChatMessageListProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const animatedRef = useRef<number>(-1);

  const shouldAnimate = useCallback((idx: number) => {
    if (idx !== lastAiIdx) return false;
    if (animatedRef.current === idx) return false;
    animatedRef.current = idx;
    return true;
  }, [lastAiIdx]);

  // Скролл вниз при новых сообщениях и при появлении кнопки "Читать дальше"
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    // Небольшая задержка чтобы DOM успел обновиться (кнопка "Читать дальше" рендерится после typing=false)
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, typing]);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const scrollToBottom = () => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={messagesRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 shadow-sm bg-white scrollbar-hide"
      >
        <div className="p-3 space-y-3">

          {messages.map((msg, i) => {
            const isDocRedir = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
            const doAnim = msg.role === "ai" && !typing && shouldAnimate(i);

            if (msg.role === "user") return (
              <div key={i} className="flex gap-2 justify-end items-end">
                <div className="max-w-[82%]">
                  <div className="bg-navy-700 text-white rounded-2xl rounded-br-sm px-3 py-2.5 shadow-sm">
                    <p className="whitespace-pre-wrap font-golos" style={{ fontSize: "15px", lineHeight: "1.5" }}>{msg.text}</p>
                  </div>
                </div>
                <div className="w-7 h-7 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                  {user.name?.[0] ?? "U"}
                </div>
              </div>
            );

            // Находим предшествующее сообщение пользователя
            const prevUserMsg = messages.slice(0, i).reverse().find(m => m.role === "user");

            if (msg.isUpsell) return (
              <UpsellCard key={i} onPayClick={onPayClick} onSelectPlan={onSelectPlan} />
            );

            // ── Воронка продаж: последний вопрос ──────────────────────────
            if (msg.isLastQuestion && msg.fullAnswer) {
              const blurText = msg.fullAnswer.slice(Math.floor(msg.fullAnswer.length / 2));
              return (
                <div key={i} className="flex gap-2 items-start upsell-animate">
                  {/* Иконка AI */}
                  <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Icon name="Scale" size={13} className="text-gold-400" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Видимая часть ответа */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-3 pt-3 pb-3 shadow-sm">
                      <AnimatedMessage text={msg.text} animate={doAnim} />
                    </div>

                    {/* Размытая часть */}
                    <div
                      className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 select-none pointer-events-none"
                      style={{ filter: "blur(5px)", opacity: 0.45, maxHeight: 64, overflow: "hidden" }}
                    >
                      <LegalText text={blurText} />
                    </div>

                    {/* Замок-баннер */}
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: "linear-gradient(150deg, #0a1628 0%, #0e2040 100%)",
                        border: "1px solid rgba(232,168,32,0.3)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                      }}
                    >
                      {/* Золотая линия сверху */}
                      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(232,168,32,0.6), transparent)" }} />

                      <div className="px-4 pt-4 pb-3">
                        {/* Шапка */}
                        <div className="flex items-start gap-2.5 mb-1">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.2)" }}
                          >
                            <Icon name="Lock" size={14} className="text-gold-400" />
                          </div>
                          <div>
                            <p className="text-[13.5px] font-bold leading-tight" style={{ color: "rgba(255,255,255,0.97)" }}>
                              Остаток ответа скрыт
                            </p>
                            <p className="text-[11.5px] leading-relaxed mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                              Оплатите <span style={{ color: "#f0c060", fontWeight: 600 }}>3 вопроса за 290 ₽</span> — и получите полный ответ прямо сейчас, а также 2 следующих вопроса в запасе.
                            </p>
                          </div>
                        </div>

                        {/* Разделитель */}
                        <div className="my-3" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

                        {/* Кнопка 1 — 3 вопроса */}
                        <button
                          onClick={() => onRevealAnswer?.(i)}
                          className="w-full rounded-xl btn-gold active:scale-[0.98] transition-transform mb-2"
                          style={{ padding: "12px 16px" }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Icon name="Zap" size={15} className="text-navy-900 shrink-0" />
                              <div className="text-left">
                                <p className="text-navy-900 text-[13px] font-bold leading-tight">Читать полный ответ · 3 вопроса</p>
                                <p className="text-[10.5px] font-medium" style={{ color: "rgba(10,22,40,0.55)" }}>Доступ открывается сразу после оплаты</p>
                              </div>
                            </div>
                            <span className="text-navy-900 text-[15px] font-bold ml-3 shrink-0">290 ₽</span>
                          </div>
                        </button>

                        {/* Кнопка 2 — тарифы */}
                        <button
                          onClick={onSelectPlan}
                          className="w-full rounded-xl active:scale-[0.98] transition-all"
                          style={{
                            padding: "11px 16px",
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.05)",
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Icon name="Crown" size={14} style={{ color: "#f0c060" }} className="shrink-0" />
                              <div className="text-left">
                                <p className="text-[12.5px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.9)" }}>Тарифные планы</p>
                                <p className="text-[10.5px]" style={{ color: "rgba(255,255,255,0.4)" }}>30–300 вопросов + юридические документы</p>
                              </div>
                            </div>
                            <Icon name="ChevronRight" size={15} style={{ color: "rgba(255,255,255,0.3)" }} className="shrink-0 ml-2" />
                          </div>
                        </button>

                        <p className="mt-2.5 text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                          Защищённая оплата · ЮКасса · Доступ сразу после оплаты
                        </p>
                      </div>

                      {/* Нижняя линия */}
                      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)" }} />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Icon name="Scale" size={13} className="text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-3 py-3 shadow-sm">
                    <AnimatedMessage text={msg.text} animate={doAnim} />
                    {isDocRedir && (
                      <button onClick={onGoToDocs} className="mt-3 flex items-center gap-2 px-3 py-2 bg-navy-700 text-white text-xs font-semibold rounded-xl w-full justify-center">
                        <Icon name="FileText" size={12} />Перейти в «Документы»
                      </button>
                    )}
                    {msg.truncated && i === lastAiIdx && !typing && (
                      <button onClick={() => onContinueChat(msg.text)} className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl w-full justify-center">
                        <Icon name="ChevronDown" size={12} />Читать дальше
                      </button>
                    )}
                    {/* Плашка + кнопка юриста при персональных данных */}
                    {msg.personalDataRefused && !typing && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <p className="text-[12px] text-amber-800 leading-relaxed mb-2">
                          Укажите ваш вопрос без использования персональных данных, наименования районов, городов, сёл и государственных органов. Либо обратитесь к живому юристу-эксперту.
                        </p>
                        <button
                          onClick={onExpertClick}
                          className="flex items-center gap-2 px-3 py-2 bg-navy-700 hover:bg-navy-800 text-white text-[12px] font-semibold rounded-lg w-full justify-center transition-colors"
                        >
                          <Icon name="UserCheck" size={13} />Задать вопрос юристу-эксперту
                        </button>
                      </div>
                    )}
                    {/* Кнопка живого юриста при отсутствии судебной практики */}
                    {msg.needsExpert && !msg.personalDataRefused && !typing && (
                      <button
                        onClick={onExpertClick}
                        className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-navy-700 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl w-full justify-center transition-colors"
                      >
                        <Icon name="UserCheck" size={13} />Подключить живого юриста-эксперта
                      </button>
                    )}
                    {/* Кнопка создания документа из ответа AI — только на последнем сообщении */}
                    {onCreateDocFromMsg && !typing && !msg.isFile && msg.text.length > 80 && i === lastAiIdx && (
                      <button
                        onClick={() => { if (!creatingDocFromChat) { ymGoal("create_doc_from_chat"); onCreateDocFromMsg(msg.text, prevUserMsg?.text || "", msg.docHint); } }}
                        disabled={creatingDocFromChat}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-gold-400/15 hover:bg-gold-400/25 border border-gold-400/30 text-navy-700 text-xs font-semibold rounded-xl w-full justify-center transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {creatingDocFromChat
                          ? <><span className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />Подготавливаю документ...</>
                          : msg.docHint?.doc_label
                            ? <><Icon name="FilePlus" size={12} />Составить: {msg.docHint.doc_label}</>
                            : <><Icon name="FilePlus" size={12} />Создать документ на основе этого ответа</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {typing && <TypingIndicator status={typingStatus || ""} />}

          {chatErr && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <Icon name="AlertCircle" size={12} className="shrink-0" />{chatErr}
            </div>
          )}

          <div ref={chatEndRef} className="h-1" />
        </div>
      </div>

      {/* Кнопка вниз */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full gradient-navy shadow-lg flex items-center justify-center"
          style={{ animation: "bounce 2s infinite" }}
        >
          <Icon name="ChevronDown" size={16} className="text-gold-400" />
        </button>
      )}
    </div>
  );
}