import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; }

interface HistoryTabProps {
  user: User;
  messages: ChatMsg[];
  onGoToChat: () => void;
}

/** Вычисляет дату создания сообщения (из localStorage мы не храним дату — используем приближение) */
function getApproxDate(idx: number, total: number): string {
  // Последние сообщения — сегодня, более ранние — убываем по дням
  const msAgo = (total - idx) * 60 * 1000; // грубо: по 1 мин на сообщение
  return new Date(Date.now() - msAgo).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long",
  });
}

export default function HistoryTab({ user, messages, onGoToChat }: HistoryTabProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Собираем только вопросы пользователя с индексами
  const userMessages = messages
    .map((m, i) => ({ ...m, i }))
    .filter((m) => m.role === "user");

  if (userMessages.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">История консультаций</h2>
        <div className="bg-white rounded-3xl border border-border p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="Clock" size={24} className="text-navy-400" />
          </div>
          <p className="text-muted-foreground mb-1">Вопросов ещё не задавалось</p>
          <p className="text-xs text-muted-foreground/70 mb-4">История хранится 3 месяца</p>
          <button onClick={onGoToChat} className="btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">
            Задать вопрос
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-cormorant font-bold text-3xl text-navy-800">История консультаций</h2>
        <span className="text-xs text-muted-foreground bg-slate-100 px-3 py-1.5 rounded-xl">
          {userMessages.length} {userMessages.length === 1 ? "вопрос" : userMessages.length < 5 ? "вопроса" : "вопросов"} · хранится 3 мес.
        </span>
      </div>

      <div className="space-y-3">
        {userMessages.map(({ text, i }, listIdx) => {
          const aiReply = messages[i + 1]?.role === "ai" ? messages[i + 1] : null;
          const isOpen = openIdx === listIdx;

          return (
            <div
              key={i}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${
                isOpen ? "border-navy-200 shadow-md" : "border-border hover:border-navy-100"
              }`}
            >
              {/* Заголовок вопроса — кликабельный */}
              <button
                onClick={() => setOpenIdx(isOpen ? null : listIdx)}
                className="w-full text-left p-5 flex items-start gap-3 group"
              >
                <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-navy-700 uppercase group-hover:bg-navy-200 transition-colors">
                  {user.name?.[0] ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-800 leading-relaxed line-clamp-2">
                    {text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getApproxDate(i, messages.length)}
                    {aiReply && <span className="ml-2 text-emerald-600">· есть ответ</span>}
                  </p>
                </div>
                <div className={`shrink-0 mt-1 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
                  <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
                </div>
              </button>

              {/* Раскрывающийся ответ AI */}
              <div
                className={`overflow-hidden transition-all duration-400 ease-in-out ${
                  isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}
                style={{ transition: "max-height 0.35s ease, opacity 0.25s ease" }}
              >
                {aiReply ? (
                  <div className="mx-5 mb-5">
                    <div className="border-t border-border/60 pt-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          <Icon name="Scale" size={14} className="text-gold-400" />
                        </div>
                        <div className="flex-1 bg-blue-50/60 border-l-2 border-gold-400 rounded-2xl px-4 py-3 text-sm text-navy-700 leading-relaxed whitespace-pre-wrap">
                          {aiReply.text}
                        </div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={onGoToChat}
                          className="text-xs text-navy-600 hover:text-navy-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-navy-50 transition-colors"
                        >
                          <Icon name="MessageCircle" size={12} />
                          Уточнить в чате
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-5 mb-5 pt-4 border-t border-border/60 text-xs text-muted-foreground italic">
                    Ответ не получен
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
