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
      className="overflow-y-auto scrollbar-hide"
      style={{
        height: "clamp(300px, 42vh, 480px)",
        background: "linear-gradient(180deg, #f8fafd 0%, #f2f5fb 100%)",
        padding: "20px 16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {messages.map((msg, i) => (
        <div key={i}>

          {/* ── Приветственный блок ── */}
          {i === 0 && msg.role === "ai" ? (
            <div className="flex gap-2.5 items-start">
              {/* Аватар */}
              <div className="shrink-0 mt-0.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(145deg, #0d2040, #162d5a)",
                    boxShadow: "0 2px 8px rgba(10,22,40,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}>
                  <Icon name="Scale" size={12} color="#e8a820" />
                </div>
              </div>

              {/* Карточка */}
              <div className="rounded-2xl rounded-tl-md overflow-hidden"
                style={{
                  maxWidth: "86%",
                  background: "#ffffff",
                  boxShadow: "0 2px 12px rgba(10,22,40,0.08), 0 0 0 1px rgba(226,232,240,0.8)",
                }}>
                {/* Цветная полоска сверху */}
                <div style={{ height: 2, background: "linear-gradient(90deg, #e8a820, #f0c060 50%, #e8a820)" }} />

                <div className="px-4 py-3.5 space-y-3">
                  <div className="flex gap-2.5 items-start">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg, #e8a820, #c97d10)", boxShadow: "0 2px 6px rgba(232,168,32,0.3)" }}>
                      <Icon name="FileText" size={11} color="#fff" />
                    </div>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "#374151" }}>
                      Укажите, какой документ нужен — иск, претензия, договор, возражение и т.п. AI-консультант поможет с подготовкой за 5-ть минут!
                    </p>
                  </div>

                  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e5e9f0, transparent)" }} />

                  <div className="flex gap-2.5 items-start">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "rgba(232,168,32,0.1)", border: "1px solid rgba(232,168,32,0.2)" }}>
                      <Icon name="Download" size={11} color="#b45309" />
                    </div>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "#374151" }}>
                      Готовый документ скачивается в формате{" "}
                      <span className="font-semibold" style={{ color: "#111827" }}>.doc</span>.{" "}
                      Проверка юристом доступна с тарифа{" "}
                      <span className="font-semibold" style={{ color: "#111827" }}>«Старт»</span>.
                    </p>
                  </div>

                  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e5e9f0, transparent)" }} />

                  <div className="flex gap-2 items-center px-3 py-2 rounded-xl" style={{ background: "rgba(232,168,32,0.06)", border: "1px solid rgba(232,168,32,0.15)" }}>
                    <p className="text-[12px] leading-snug" style={{ color: "#374151" }}>
                      Для быстрой подготовки нажмите{" "}
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded mx-0.5 font-medium" style={{ background: "rgba(232,168,32,0.15)", color: "#b45309" }}>
                        <Icon name="FileText" size={9} color="#b45309" />
                      </span>
                      {" "}снизу, выберите документ и опишите задачу.
                    </p>
                  </div>

                  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e5e9f0, transparent)" }} />

                  {/* Блок регистрации */}
                  <button
                    onClick={onLogin}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] group"
                    style={{
                      background: "linear-gradient(135deg, rgba(13,32,64,0.04), rgba(22,45,90,0.07))",
                      border: "1px solid rgba(13,32,64,0.12)",
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #0d2040, #162d5a)", boxShadow: "0 2px 6px rgba(10,22,40,0.2)" }}>
                      <Icon name="LogIn" size={12} color="#e8a820" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-semibold leading-tight" style={{ color: "#0d2040" }}>
                        Для доступа ко всем функциям
                      </p>
                      <p className="text-[11px] leading-tight mt-0.5" style={{ color: "#64748b" }}>
                        зарегистрируйтесь или авторизуйтесь
                      </p>
                    </div>
                    <Icon name="ChevronRight" size={13} color="#94a3b8" />
                  </button>
                </div>
              </div>
            </div>

          ) : (
            /* ── Обычные сообщения ── */
            <div className={`flex gap-2.5 items-end ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "ai" && (
                <div className="shrink-0 mb-0.5">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(145deg, #0d2040, #162d5a)",
                      boxShadow: "0 2px 8px rgba(10,22,40,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}>
                    <Icon name="Scale" size={12} color="#e8a820" />
                  </div>
                </div>
              )}

              <div className={`max-w-[82%] ${msg.role === "user" ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"}`}
                style={
                  msg.role === "user"
                    ? {
                        background: "linear-gradient(145deg, #0f2855, #162d5a)",
                        padding: "10px 15px",
                        color: "rgba(255,255,255,0.95)",
                        fontSize: "13px",
                        lineHeight: "1.65",
                        boxShadow: "0 3px 14px rgba(10,22,40,0.3)",
                      }
                    : {
                        background: "#ffffff",
                        padding: "12px 15px",
                        color: "#1e293b",
                        fontSize: "13px",
                        lineHeight: "1.7",
                        boxShadow: "0 2px 12px rgba(10,22,40,0.07), 0 0 0 1px rgba(226,232,240,0.8)",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                      }
                }
              >
                {msg.typing ? (
                  <div className="flex items-center gap-1.5 py-0.5">
                    {[0, 180, 360].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: msg.role === "user" ? "rgba(255,255,255,0.5)" : "#94a3b8", animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                ) : msg.role === "user" ? (
                  <span style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontWeight: 400 }}>{msg.text}</span>
                ) : (
                  <div className="ai-message-body" dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                )}
              </div>
            </div>
          )}

          {/* ── Кнопки под ответом AI ── */}
          {msg.role === "ai" && !msg.typing && msg.text.length > 30 && i > 0 && (
            <div className="ml-9 mt-2 flex flex-wrap gap-2">
              {msg.suggestDocType && (
                <button
                  onClick={() => onCreateDoc(msg.suggestDocType!)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-[0.97] hover:shadow-md"
                  style={{
                    background: "linear-gradient(135deg, #e8a820, #f0c060)",
                    color: "#0a1628",
                    boxShadow: "0 2px 8px rgba(232,168,32,0.25)",
                  }}
                >
                  <Icon name="FileText" size={12} color="#0a1628" />
                  Создать {DOC_LABELS[msg.suggestDocType] ?? "документ"}
                </button>
              )}
              {onSendToLawyer && (
                <button
                  onClick={() => onSendToLawyer(msg.text)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-[0.97]"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #dde3ed",
                    color: "#475569",
                    boxShadow: "0 1px 4px rgba(10,22,40,0.06)",
                  }}
                >
                  <Icon name="UserCheck" size={12} color="#64748b" />
                  Проверить юристу
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Upsell */}
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