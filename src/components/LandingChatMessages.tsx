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
  onBuyDoc: () => void;
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
  onBuyDoc,
  onLogin,
  onSendToLawyer,
}: LandingChatMessagesProps) {
  return (
    <div
      ref={chatBoxRef}
      className="overflow-y-auto px-4 py-4 space-y-3"
      style={{ height: "clamp(280px, 38vh, 440px)" }}
    >
      {messages.map((msg, i) => (
        <div key={i}>
          <div className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "ai" && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}>
                <Icon name="Scale" size={11} color="#e8a820" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm"}`}
              style={
                msg.role === "user"
                  ? { background: "linear-gradient(135deg, #162d5a, #0a1e3f)", border: "1px solid rgba(232,168,32,0.2)" }
                  : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }
              }
            >
              {msg.typing ? (
                <div className="flex items-center gap-1 py-1">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "#e8a820", animationDelay: `${d}ms` }} />
                  ))}
                </div>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
              )}
            </div>
          </div>

          {/* Кнопки под ответом AI — только не под приветствием (i > 0) */}
          {msg.role === "ai" && !msg.typing && msg.text.length > 30 && i > 0 && (
            <div className="ml-9 mt-2 flex flex-wrap gap-2">
              {msg.suggestDocType && (
                <button
                  onClick={() => onCreateDoc(msg.suggestDocType!)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, rgba(232,168,32,0.18), rgba(232,168,32,0.08))",
                    border: "1px solid rgba(232,168,32,0.3)",
                    color: "#f0c060",
                  }}
                >
                  <Icon name="FileText" size={13} color="#f0c060" />
                  Создать {DOC_LABELS[msg.suggestDocType] ?? "документ"}
                </button>
              )}
              {onSendToLawyer && (
                <button
                  onClick={() => onSendToLawyer(msg.text)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  <Icon name="UserCheck" size={13} color="rgba(255,255,255,0.65)" />
                  Отправить юристу
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
          onBuyDoc={onBuyDoc}
          onLogin={onLogin}
        />
      )}

      <div ref={chatEndRef} />
    </div>
  );
}