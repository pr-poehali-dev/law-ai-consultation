import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; }

interface HistoryTabProps {
  user: User;
  messages: ChatMsg[];
  onGoToChat: () => void;
}

export default function HistoryTab({ user, messages, onGoToChat }: HistoryTabProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">История консультаций</h2>
      {messages.filter((m) => m.role === "user").length === 0 ? (
        <div className="bg-white rounded-3xl border border-border p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="Clock" size={24} className="text-navy-400" />
          </div>
          <p className="text-muted-foreground">Вопросов ещё не задавалось</p>
          <button onClick={onGoToChat} className="mt-4 btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">
            Задать вопрос
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg, i) => {
            if (msg.role !== "user") return null;
            const aiReply = messages[i + 1];
            return (
              <div key={i} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                      {user.name?.[0] ?? "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy-800">{msg.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date().toLocaleDateString("ru-RU")}</p>
                    </div>
                  </div>
                  {aiReply && (
                    <div className="ml-11 bg-blue-50/60 border-l-2 border-gold-400 rounded-2xl p-4 text-xs text-navy-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
                      {aiReply.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
