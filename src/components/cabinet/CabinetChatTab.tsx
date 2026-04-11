import Icon from "@/components/ui/icon";

interface ChatMessage {
  role: string;
  text: string;
}

interface CabinetChatTabProps {
  chatMessages: ChatMessage[];
  input: string;
  isTyping: boolean;
  chatError: string | null;
  canAsk: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onPayClick: () => void;
}

export default function CabinetChatTab({
  chatMessages,
  input,
  isTyping,
  chatError,
  canAsk,
  onInputChange,
  onSend,
  onPayClick,
}: CabinetChatTabProps) {
  return (
    <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm max-w-3xl">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center">
            <Icon name="Bot" size={18} className="text-gold-400" />
          </div>
          <div>
            <div className="font-semibold text-navy-800 text-sm">AI-Юрист</div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isTyping ? "bg-amber-400" : "bg-green-400"}`} />
              <span className="text-xs text-muted-foreground">
                {isTyping ? "AI-юрист формирует ответ..." : "Онлайн · Обучен реальными юристами"}
              </span>
            </div>
          </div>
        </div>
        {!canAsk && (
          <button
            onClick={onPayClick}
            className="btn-gold px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
          >
            <Icon name="Zap" size={12} />
            100 ₽ / 3 вопроса
          </button>
        )}
      </div>

      <div className="h-80 overflow-y-auto p-5 space-y-4 scrollbar-hide">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (
              <div className="w-7 h-7 gradient-navy rounded-lg flex items-center justify-center mr-2 mt-1 shrink-0">
                <Icon name="Scale" size={13} className="text-gold-400" />
              </div>
            )}
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-navy-700 text-white rounded-br-sm" : "chat-bubble-ai text-navy-800 rounded-bl-sm"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-navy rounded-lg flex items-center justify-center shrink-0">
              <Icon name="Scale" size={13} className="text-gold-400" />
            </div>
            <div className="chat-bubble-ai rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full inline-block" />
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full inline-block" />
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full inline-block" />
            </div>
          </div>
        )}
      </div>

      {chatError && (
        <div className="mx-4 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{chatError}</div>
      )}

      <div className="p-4 border-t border-border flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
          placeholder={canAsk ? "Задайте юридический вопрос..." : "Оплатите консультацию для продолжения..."}
          disabled={isTyping}
          className="flex-1 bg-slate-50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-navy-400 transition-colors disabled:opacity-60"
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isTyping}
          className="btn-gold px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="Send" size={16} />
        </button>
      </div>
    </div>
  );
}
