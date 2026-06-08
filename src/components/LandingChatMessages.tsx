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
      style={{ height: "clamp(300px, 42vh, 480px)" }}
    >
      {messages.map((msg, i) => (
        <div key={i}>
          {/* Приветственный блок (первое сообщение AI) */}
          {i === 0 && msg.role === "ai" ? (
            <div className="flex gap-2 items-start">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}>
                <Icon name="Scale" size={11} color="#e8a820" />
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 space-y-3"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)", maxWidth: "85%" }}>

                {/* Строка 1 */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #e8a820cc, #c97d10cc)" }}>
                    <Icon name="FileText" size={12} color="#fff" />
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>
                    Укажите, какой документ нужен — <span className="text-white font-medium">иск, претензия, договор, возражение</span> и т.п. AI подготовит его за <span className="text-white font-medium">5 минут</span>. Чем детальнее опишете ситуацию, тем качественнее результат.
                  </p>
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

                {/* Строка 2 */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(232,168,32,0.18)", border: "1px solid rgba(232,168,32,0.3)" }}>
                    <Icon name="Banknote" size={12} color="#e8a820" />
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>
                    После создания документа вы сможете направить его на проверку <span className="text-white font-medium">живому юристу-эксперту</span> прямо из предпросмотра.
                  </p>
                </div>



              </div>
            </div>
          ) : (
          <div className={`flex gap-2.5 items-end ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "ai" && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mb-0.5"
                style={{ background: "linear-gradient(135deg, #0a1628, #1a3a6b)", border: "1px solid rgba(232,168,32,0.35)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                <Icon name="Scale" size={11} color="#e8a820" />
              </div>
            )}
            <div className={`max-w-[84%] ${msg.role === "user" ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm"}`}
              style={
                msg.role === "user"
                  ? {
                      background: "linear-gradient(135deg, #1e3f7a, #0f2650)",
                      border: "1px solid rgba(232,168,32,0.22)",
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.93)",
                      fontSize: "0.82rem",
                      lineHeight: "1.6",
                    }
                  : {
                      background: "linear-gradient(160deg, rgba(255,255,255,0.095) 0%, rgba(255,255,255,0.06) 100%)",
                      border: "1px solid rgba(255,255,255,0.11)",
                      backdropFilter: "blur(8px)",
                      padding: "12px 15px",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "0.82rem",
                      lineHeight: "1.7",
                    }
              }
            >
              {msg.typing ? (
                <div className="flex items-center gap-1 py-0.5">
                  {[0, 160, 320].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "#e8a820", animationDelay: `${d}ms` }} />
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, rgba(232,168,32,0.2), rgba(232,168,32,0.1))",
                    border: "1px solid rgba(232,168,32,0.35)",
                    color: "#f0c060",
                    boxShadow: "0 2px 8px rgba(232,168,32,0.1)",
                  }}
                >
                  <Icon name="FileText" size={11} color="#f0c060" />
                  Создать {DOC_LABELS[msg.suggestDocType] ?? "документ"}
                </button>
              )}
              {onSendToLawyer && (
                <button
                  onClick={() => onSendToLawyer(msg.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 hover:brightness-110"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  <Icon name="UserCheck" size={11} color="rgba(255,255,255,0.55)" />
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