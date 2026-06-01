import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ymGoal } from "@/lib/metrika";
import { sendReport } from "@/lib/auth";
import UpsellCard from "@/pages/cabinet/UpsellCard";
import { AnimatedMessage, LegalText, TypingIndicator } from "@/pages/cabinet/ChatTextRenderer";
import type { ChatMsg, DocHint } from "@/pages/cabinet/ChatTab";
import type { User } from "@/lib/auth";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";

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
  onSendToLawyer?: (msgText: string, prevUserText?: string) => void;
}

// Ключевые слова для показа кнопки «Сообщить о проблеме»
const SUPPORT_KEYWORDS = [
  "обратитесь в поддержку", "сообщите о проблеме", "напишите в поддержку",
  "технической поддержк", "ошибка генерации", "ошибка сервиса", "проблема с сервисом",
  "не удалось сгенерировать", "не могу создать документ", "повторите попытку",
  "обратитесь в службу", "служба поддержки", "тех. поддержка",
];

function ReportButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    await sendReport(text.trim());
    setSending(false);
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); setText(""); }, 2000);
  };

  return (
    <div className="mt-2 relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border"
        style={{ background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.3)", color: "#92400e" }}
      >
        <Icon name="LifeBuoy" size={12} />Сообщить о проблеме
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-68 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3"
          onClick={e => e.stopPropagation()}>
          {sent ? (
            <div className="flex items-center gap-2 text-emerald-600 py-1">
              <Icon name="CheckCircle" size={14} /><span className="text-sm font-medium">Отправлено!</span>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-navy-800 mb-2">Сообщить о проблеме</p>
              <textarea
                value={text} onChange={e => setText(e.target.value)}
                placeholder="Опишите что случилось..."
                rows={3} autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs outline-none focus:border-navy-400 resize-none mb-2"
              />
              <button onClick={handleSend} disabled={sending || !text.trim()}
                className="w-full py-2 rounded-xl text-xs font-semibold btn-gold disabled:opacity-50 flex items-center justify-center gap-1.5">
                {sending ? <><Icon name="Loader" size={11} className="animate-spin" />Отправка...</> : <><Icon name="Send" size={11} />Отправить</>}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PenaltyCalcChatMessage({ text, onPayClick }: { text: string; onPayClick: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2 items-start">
      <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <Icon name="Scale" size={13} className="text-gold-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
          <div className="px-3 py-3">
            <p className="text-[13px] text-navy-700 leading-relaxed font-golos whitespace-pre-line">{text.replace(/\*\*/g, "")}</p>
            <button
              onClick={() => setOpen(v => !v)}
              className="mt-3 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm w-full justify-center"
            >
              <Icon name="Calculator" size={13} />
              {open ? "Скрыть калькулятор" : "Открыть калькулятор неустойки"}
            </button>
          </div>
          {open && (
            <div className="border-t border-slate-100" style={{ maxHeight: "540px", overflowY: "auto" }}>
              <PenaltyCalcPanel onClose={() => setOpen(false)} onPaymentRequired={onPayClick} embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  onSendToLawyer,
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

            // Калькулятор неустойки — кнопка раскрывает встроенный калькулятор
            if (msg.isPenaltyCalc) return (
              <PenaltyCalcChatMessage key={i} text={msg.text} onPayClick={onPayClick} />
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
                    {/* Кнопка создания документа — для обычных ответов и после анализа файлов */}
                    {onCreateDocFromMsg && !typing && !msg.isFile && msg.text.length > 80 && i === lastAiIdx && prevUserMsg && (msg.docHint != null || prevUserMsg.isFile || prevUserMsg.text.trim().length > 10) && (
                      <button
                        onClick={() => { if (!creatingDocFromChat) { ymGoal("create_doc_from_chat"); onCreateDocFromMsg(msg.text, prevUserMsg?.text || "", msg.docHint); } }}
                        disabled={creatingDocFromChat}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-gold-400/15 hover:bg-gold-400/25 border border-gold-400/30 text-navy-700 text-xs font-semibold rounded-xl w-full justify-center transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {creatingDocFromChat
                          ? <><span className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />Подготавливаю документ...</>
                          : <><Icon name="FilePlus" size={12} />Создать документ</>
                        }
                      </button>
                    )}
                    {/* Кнопка «Сообщить о проблеме» — когда AI упоминает поддержку или ошибку */}
                    {!typing && !msg.isFile && SUPPORT_KEYWORDS.some(k => msg.text.toLowerCase().includes(k)) && (
                      <ReportButton />
                    )}
                    {/* Кнопка «Отправить юристу» — только не под первым приветствием */}
                    {onSendToLawyer && !typing && !msg.isFile && !msg.isUpsell && msg.text.length > 30 && i > 0 && (
                      <button
                        onClick={() => onSendToLawyer(msg.text, prevUserMsg?.text)}
                        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl w-full justify-center text-xs font-semibold transition-all active:scale-[0.98]"
                        style={{ background: "rgba(10,22,40,0.05)", border: "1px solid rgba(10,22,40,0.1)", color: "#4a5568" }}
                      >
                        <Icon name="UserCheck" size={13} color="#6b7280" />
                        Отправить на проверку живому юристу
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