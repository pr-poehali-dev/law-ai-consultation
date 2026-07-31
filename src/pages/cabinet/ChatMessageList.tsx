import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ymGoal } from "@/lib/metrika";
import { sendReport } from "@/lib/auth";
import UpsellCard from "@/pages/cabinet/UpsellCard";
import { AnimatedMessage, TypingIndicator } from "@/pages/cabinet/ChatTextRenderer";
import type { ChatMsg, DocHint } from "@/pages/cabinet/ChatTab";
import CaseLawResultsCard from "@/pages/cabinet/CaseLawResultsCard";
import CaseLawAssessmentCard from "@/pages/cabinet/CaseLawAssessmentCard";
import type { User } from "@/lib/auth";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";
import PenaltyResultMessage from "@/pages/cabinet/PenaltyResultMessage";
import DocFromChatPopover from "@/pages/cabinet/DocFromChatPopover";
import type { DocFromChatDraft } from "@/pages/cabinet/useCabinetDocFromChat";

interface ChatMessageListProps {
  user: User;
  messages: ChatMsg[];
  typing: boolean;
  typingStatus?: string;
  chatErr: string;
  lastAiIdx: number;
  chatEndRef: React.RefObject<HTMLDivElement>;
  onPayClick: () => void;
  onTrialClick: () => void;
  onSelectPlan: () => void;
  onGoToDocs: () => void;
  onContinueChat: (partialText: string) => void;
  onExpertClick: () => void;
  onRevealAnswer?: (msgIndex: number) => void;
  onCreateDocFromMsg?: (aiText: string, userText: string, docHint?: DocHint) => void;
  creatingDocFromChat?: boolean;
  onSendToLawyer?: (msgText: string, prevUserText?: string) => void;
  onSendMessage?: (text: string) => void;
  onSearchCaseLaw?: (aiText: string, msgIdx: number) => void;
  onAssessCaseLaw?: (caseLawMsgIdx: number) => void;
  /** Черновик документа — если задан, показывается всплывающая карточка над кнопкой «Создать документ» */
  docDraft?: DocFromChatDraft | null;
  docGenerating?: boolean;
  onConfirmDocDraft?: (label: string, addition: string) => void;
  onCloseDocDraft?: () => void;
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
  onTrialClick,
  onSelectPlan,
  onGoToDocs,
  onContinueChat,
  onExpertClick,
  onRevealAnswer,
  onCreateDocFromMsg,
  creatingDocFromChat,
  onSendToLawyer,
  onSendMessage,
  onSearchCaseLaw,
  onAssessCaseLaw,
  docDraft,
  docGenerating,
  onConfirmDocDraft,
  onCloseDocDraft,
}: ChatMessageListProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const animatedRef = useRef<number>(-1);
  // Кнопка «Создать документ», над которой раскрывается всплывающая карточка
  const [docBtnEl, setDocBtnEl] = useState<HTMLButtonElement | null>(null);

  const shouldAnimate = useCallback((idx: number) => {
    if (idx !== lastAiIdx) return false;
    if (animatedRef.current === idx) return false;
    animatedRef.current = idx;
    return true;
  }, [lastAiIdx]);

  // Скролл вниз при новых сообщениях и во время стриминга
  const isStreaming = messages.some(m => m.isStreaming);
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
    if (!isNearBottom && !typing && !isStreaming) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? "instant" : "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, typing, isStreaming]);

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
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-100 shadow-sm scrollbar-hide"
        style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}
      >
        <div className="p-4 space-y-4">

          {messages.map((msg, i) => {
            const isDocRedir = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
            const doAnim = msg.role === "ai" && !typing && shouldAnimate(i);

            if (msg.isCaseLawSearch) return (
              <CaseLawResultsCard
                key={i}
                query={msg.caseLawQuery}
                loading={msg.caseLawLoading}
                error={msg.caseLawError}
                results={msg.caseLawResults}
                assessed={msg.caseLawAssessed}
                onAssessClick={onAssessCaseLaw ? () => onAssessCaseLaw(i) : undefined}
              />
            );

            if (msg.isCaseLawAssessment) return (
              <CaseLawAssessmentCard
                key={i}
                text={msg.text}
                loading={msg.caseLawAssessmentLoading}
                error={msg.caseLawAssessmentError}
              />
            );

            if (msg.role === "user") {
              // Расчёт неустойки — отдельный компонент
              if (msg.penaltyData) return (
                <div key={i} className="w-full">
                  <PenaltyResultMessage
                    data={msg.penaltyData}
                    onSendToChat={(text) => onSendMessage?.(text)}
                  />
                </div>
              );
              return (
                <div key={i} className="flex gap-2 justify-end items-end" style={{ animation: "ai-msg-in 0.3s cubic-bezier(0.22,1,0.36,1) both" }}>
                  <div className="max-w-[80%]">
                    <div className="px-4 py-2.5 shadow-sm"
                      style={{
                        background: "linear-gradient(135deg, #0f4c81, #1a6bb5)",
                        borderRadius: "18px 18px 4px 18px",
                        boxShadow: "0 2px 12px rgba(15,76,129,0.2)",
                      }}>
                      <p className="text-white font-golos leading-relaxed" style={{ fontSize: "14.5px" }}>{msg.text}</p>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white uppercase shadow-sm"
                    style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                    {user.name?.[0] ?? "U"}
                  </div>
                </div>
              );
            }

            // Находим предшествующее сообщение пользователя
            const prevUserMsg = messages.slice(0, i).reverse().find(m => m.role === "user");

            if (msg.isUpsell) return (
              <UpsellCard key={i} user={user} onPayClick={onPayClick} onTrialClick={onTrialClick} onSelectPlan={onSelectPlan} />
            );

            // Калькулятор неустойки — кнопка раскрывает встроенный калькулятор
            if (msg.isPenaltyCalc) return (
              <PenaltyCalcChatMessage key={i} text={msg.text} onPayClick={onPayClick} />
            );

            // Ошибка с кнопкой повтора
            if (msg.isError) return (
              <div key={i} className="flex gap-2.5 items-start" style={{ animation: "ai-msg-in 0.38s cubic-bezier(0.22,1,0.36,1) both" }}>
                <style>{`@keyframes ai-msg-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-md" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                  <Icon name="AlertCircle" size={13} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="px-4 py-3" style={{ borderRadius: "4px 18px 18px 18px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(254,242,242,0.8)", boxShadow: "0 1px 8px rgba(239,68,68,0.08)" }}>
                    <p className="text-[13px] text-red-700 leading-relaxed font-golos">
                      Сервис временно недоступен. Вопрос не списан — попробуйте ещё раз.
                    </p>
                    {msg.retryText && (
                      <button
                        onClick={() => onSendMessage?.(msg.retryText!)}
                        className="mt-3 group flex items-center gap-2.5 transition-all active:scale-95"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 group-hover:shadow-md"
                          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                          <Icon name="RotateCcw" size={14} className="text-white" />
                        </span>
                        <span className="text-[13px] font-semibold text-navy-700 group-hover:text-navy-900 transition-colors">
                          Повторить вопрос
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <div key={i} className="flex gap-2.5 items-start" style={{ animation: i === lastAiIdx ? "ai-msg-in 0.38s cubic-bezier(0.22,1,0.36,1) both" : undefined }}>
                <style>{`@keyframes ai-msg-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <div className="w-8 h-8 gradient-navy rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                  <Icon name="Scale" size={13} className="text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-white px-4 py-3 shadow-sm"
                    style={{ borderRadius: "4px 18px 18px 18px", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                    <AnimatedMessage text={msg.text} animate={doAnim && !msg.isStreaming} />
                    {msg.isStreaming && (
                      <>
                        <style>{`@keyframes ai-blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
                        <span style={{ display: "inline-block", width: 2, height: 14, background: "#1a56b0", borderRadius: 2, marginLeft: 2, verticalAlign: "middle", animation: "ai-blink 0.7s step-end infinite" }} />
                      </>
                    )}

                    {isDocRedir && (
                      <button onClick={onGoToDocs} className="mt-3 flex items-center gap-2 px-3 py-2.5 text-white text-xs font-semibold rounded-xl w-full justify-center transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                        <Icon name="FileText" size={12} />Перейти в «Документы»
                      </button>
                    )}
                    {msg.truncated && i === lastAiIdx && !typing && (
                      <button onClick={() => onContinueChat(msg.text)} className="mt-2.5 flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl w-full justify-center transition-all active:scale-95"
                        style={{ background: "rgba(245,158,11,0.08)", color: "#92400e", border: "1px solid rgba(245,158,11,0.2)" }}>
                        <Icon name="ChevronDown" size={12} color="#d97706" />Читать дальше
                      </button>
                    )}
                    {msg.personalDataRefused && !typing && (
                      <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(254,243,199,0.6)", border: "1px solid rgba(252,211,77,0.4)" }}>
                        <p className="text-[12px] text-amber-800 leading-relaxed mb-2">
                          Укажите вопрос без персональных данных, названий городов и госорганов. Либо обратитесь к живому юристу.
                        </p>
                        <button onClick={onExpertClick}
                          className="flex items-center gap-2 px-3 py-2 text-white text-[12px] font-semibold rounded-lg w-full justify-center transition-all active:scale-95"
                          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                          <Icon name="UserCheck" size={13} />Задать вопрос юристу-эксперту
                        </button>
                      </div>
                    )}
                    {msg.needsExpert && !msg.personalDataRefused && !typing && (
                      <button onClick={onExpertClick}
                        className="mt-3 flex items-center gap-2 px-3 py-2.5 text-white text-xs font-semibold rounded-xl w-full justify-center transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                        <Icon name="UserCheck" size={13} />Подключить живого юриста-эксперта
                      </button>
                    )}
                    {/* Кнопки действий под ответом */}
                    {(!typing && !msg.isFile && i === lastAiIdx) && (
                      <div className="mt-3 flex flex-col gap-1.5">
                        {onCreateDocFromMsg && msg.text.length > 80 && prevUserMsg && (msg.docHint != null || prevUserMsg.isFile || prevUserMsg.text.trim().length > 10) && (
                          <button
                            ref={setDocBtnEl}
                            onClick={() => { if (!creatingDocFromChat) { ymGoal("create_doc_from_chat"); onCreateDocFromMsg(msg.text, prevUserMsg?.text || "", msg.docHint); } }}
                            disabled={creatingDocFromChat}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full justify-center text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60 border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          >
                            {creatingDocFromChat
                              ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />Определяю документ...</>
                              : <><Icon name="FilePlus" size={12} className="text-slate-500" />Создать документ</>}
                          </button>
                        )}
                        {onSearchCaseLaw && msg.text.length > 60 && i > 0 && (
                          <button
                            onClick={() => { ymGoal("case_law_from_chat_click"); onSearchCaseLaw(msg.text, i); }}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full justify-center text-xs font-semibold transition-all active:scale-[0.98] border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          >
                            <Icon name="Scale" size={12} className="text-slate-500" />
                            Найти судебную практику по ситуации
                          </button>
                        )}
                        {onSendToLawyer && !msg.isUpsell && msg.text.length > 30 && i > 0 && (
                          <button
                            onClick={() => onSendToLawyer(msg.text, prevUserMsg?.text)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl w-full justify-center text-xs font-medium transition-all active:scale-[0.98] border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          >
                            <Icon name="UserCheck" size={12} className="text-slate-400" />
                            Отправить на проверку живому юристу
                          </button>
                        )}
                      </div>
                    )}
                    {!typing && !msg.isFile && SUPPORT_KEYWORDS.some(k => msg.text.toLowerCase().includes(k)) && (
                      <ReportButton />
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
          className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", boxShadow: "0 4px 12px rgba(15,76,129,0.3)" }}
        >
          <Icon name="ChevronDown" size={16} className="text-white" />
        </button>
      )}

      {/* Всплывающая карточка подтверждения документа — раскрывается над кнопкой «Создать документ» */}
      {docDraft && onConfirmDocDraft && onCloseDocDraft && (
        <DocFromChatPopover
          anchorEl={docBtnEl}
          initialLabel={docDraft.label}
          loadingLabel={docDraft.loadingLabel}
          generating={!!docGenerating}
          onConfirm={onConfirmDocDraft}
          onClose={onCloseDocDraft}
          aiText={docDraft.aiText}
          userText={docDraft.userText}
        />
      )}
    </div>
  );
}