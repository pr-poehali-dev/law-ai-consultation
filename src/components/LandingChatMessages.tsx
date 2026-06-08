import Icon from "@/components/ui/icon";
import { type Message, DOC_LABELS, formatMessage } from "@/components/landingChatUtils";
import { UpsellBlock } from "@/components/LandingChatUpsell";

interface LandingChatMessagesProps {
  messages: Message[];
  showUpsell: boolean;
  chatBoxRef: React.RefObject<HTMLDivElement>;
  chatEndRef: React.RefObject<HTMLDivElement>;
  onCreateDoc: (docTypeId: string) => void;
  onBuyPlan: () => void;
  onBuyQuickQuestions: () => void;
  onLogin: () => void;
  onSendToLawyer?: (msgText: string) => void;
}

export default function LandingChatMessages({
  messages,
  showUpsell,
  chatBoxRef,
  chatEndRef,
  onCreateDoc,
  onBuyPlan,
  onBuyQuickQuestions,
  onLogin,
  onSendToLawyer,
}: LandingChatMessagesProps) {
  return (
    <div
      ref={chatBoxRef}
      className="overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide"
      style={{ height: "clamp(300px, 42vh, 480px)", background: "#f4f6fb" }}
    >
      {messages.map((msg, i) => (
        <div key={i}>
          {/* Приветственный блок (первое сообщение AI) */}
          {i === 0 && msg.role === "ai" ? (
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)", boxShadow: "0 2px 8px rgba(10,22,40,0.2)" }}>
                <Icon name="Scale" size={11} color="#e8a820" />
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 space-y-3"
                style={{ background: "#ffffff", border: "1px solid #e2e8f0", maxWidth: "85%", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

                <div className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #e8a820, #c97d10)" }}>
                    <Icon name="FileText" size={12} color="#fff" />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">
                    Укажите, какой документ нужен — <span className="text-slate-900 font-semibold">иск, претензия, договор, возражение</span> и т.п. AI подготовит его за <span className="text-slate-900 font-semibold">5 минут</span>. Чем детальнее опишете ситуацию, тем качественнее результат.
                  </p>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9" }} />

                <div className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.25)" }}>
                    <Icon name="UserCheck" size={12} color="#c97d10" />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">
                    После создания документа направьте его на проверку <span className="text-slate-900 font-semibold">живому юристу-эксперту</span> прямо из предпросмотра.
                  </p>
                </div>

              </div>
            </div>
          ) : (
          <div className={`flex gap-2.5 items-end ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "ai" && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mb-0.5"
                style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)", boxShadow: "0 2px 8px rgba(10,22,40,0.2)" }}>
                <Icon name="Scale" size={11} color="#e8a820" />
              </div>
            )}
            <div className={`max-w-[84%] ${msg.role === "user" ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm"}`}
              style={
                msg.role === "user"
                  ? {
                      background: "linear-gradient(135deg, #0f2650, #162d5a)",
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.95)",
                      fontSize: "0.82rem",
                      lineHeight: "1.6",
                      boxShadow: "0 2px 8px rgba(10,22,40,0.25)",
                    }
                  : {
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      padding: "12px 15px",
                      color: "#1e293b",
                      fontSize: "0.82rem",
                      lineHeight: "1.7",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }
              }
            >
              {msg.typing ? (
                <div className="flex items-center gap-1 py-0.5">
                  {[0, 160, 320].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "#94a3b8", animationDelay: `${d}ms` }} />
                  ))}
                </div>
              ) : (
                <div
                  className="ai-message-body"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                />
              )}
            </div>
          </div>
          )}

          {/* Кнопки под ответом AI — только не под приветствием (i > 0) */}
          {msg.role === "ai" && !msg.typing && msg.text.length > 30 && i > 0 && (
            <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
              {msg.suggestDocType && (
                <button
                  onClick={() => onCreateDoc(msg.suggestDocType!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(232,168,32,0.1)",
                    border: "1px solid rgba(232,168,32,0.3)",
                    color: "#b45309",
                  }}
                >
                  <Icon name="FileText" size={11} color="#b45309" />
                  Создать {DOC_LABELS[msg.suggestDocType] ?? "документ"}
                </button>
              )}
              {onSendToLawyer && (
                <button
                  onClick={() => onSendToLawyer(msg.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                  }}
                >
                  <Icon name="UserCheck" size={11} color="#64748b" />
                  Проверить юристу
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Upsell-блок после исчерпания лимита */}
      {showUpsell && (
        <UpsellBlock
          onBuyPlan={onBuyPlan}
          onBuyQuickQuestions={onBuyQuickQuestions}
          onLogin={onLogin}
        />
      )}

      <div ref={chatEndRef} />
    </div>
  );
}