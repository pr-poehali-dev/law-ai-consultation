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