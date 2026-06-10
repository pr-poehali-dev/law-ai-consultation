import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import type { GenDoc } from "@/pages/cabinet/DocsTab";

interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; }

interface HistoryTabProps {
  user: User;
  messages: ChatMsg[];
  genDocs?: GenDoc[];
  onGoToChat: () => void;
  onAskAI: (prompt: string) => void;
  onOpenDoc?: (doc: GenDoc) => void;
}

function getApproxDate(idx: number, total: number): string {
  const msAgo = (total - idx) * 60 * 1000;
  return new Date(Date.now() - msAgo).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long",
  });
}

export default function HistoryTab({ user, messages, genDocs = [], onGoToChat, onAskAI, onOpenDoc }: HistoryTabProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [sparkIdx, setSparkIdx] = useState<number | null>(null);

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
      <style>{`
        @keyframes ai-btn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.35); }
          50% { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
        }
        @keyframes ai-btn-shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .ai-clarify-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 12px;
          border: 1.5px solid transparent;
          background: linear-gradient(135deg, #1e2e5a 0%, #3b47a0 50%, #1e2e5a 100%);
          background-size: 200% auto;
          color: #f5c842;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.18s ease, opacity 0.18s ease;
          animation: ai-btn-pulse 2.4s ease-in-out infinite;
        }
        .ai-clarify-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(245,200,66,0.18) 50%, transparent 60%);
          background-size: 200% auto;
          animation: ai-btn-shine 2.8s linear infinite;
        }
        .ai-clarify-btn:hover {
          transform: translateY(-1px) scale(1.03);
          opacity: 0.93;
        }
        .ai-clarify-btn:active {
          transform: scale(0.97);
        }
        .ai-clarify-btn.sparking {
          animation: none;
          transform: scale(0.95);
          opacity: 0.7;
        }
      `}</style>

      <div className="flex items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800">История консультаций</h2>
        <span className="text-xs text-muted-foreground bg-slate-100 px-2.5 py-1.5 rounded-xl shrink-0">
          {userMessages.length} {userMessages.length === 1 ? "вопрос" : userMessages.length < 5 ? "вопроса" : "вопросов"}
        </span>
      </div>

      <div className="space-y-3">
        {userMessages.map(({ text, i }, listIdx) => {
          const aiReply = messages[i + 1]?.role === "ai" ? messages[i + 1] : null;
          const isOpen = openIdx === listIdx;

          const handleAskAI = (e: React.MouseEvent) => {
            e.stopPropagation();
            setSparkIdx(listIdx);
            const prompt = aiReply
              ? `Уточни информацию по этому ответу исходя из запроса пользователя.\n\nВопрос пользователя:\n${text}\n\nОтвет AI:\n${aiReply.text}`
              : `Дай подробную юридическую консультацию по следующему вопросу:\n\n${text}`;
            setTimeout(() => {
              setSparkIdx(null);
              onAskAI(prompt);
            }, 350);
          };

          return (
            <div
              key={i}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${
                isOpen ? "border-navy-200 shadow-md" : "border-border hover:border-navy-100"
              }`}
            >
              {/* Заголовок карточки */}
              <div className="p-5 flex items-start gap-3">
                <button
                  onClick={() => setOpenIdx(isOpen ? null : listIdx)}
                  className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-navy-700 uppercase hover:bg-navy-200 transition-colors"
                >
                  {user.name?.[0] ?? "U"}
                </button>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setOpenIdx(isOpen ? null : listIdx)}
                >
                  <p className="text-sm font-medium text-navy-800 leading-relaxed line-clamp-2">
                    {text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getApproxDate(i, messages.length)}
                    {aiReply && <span className="ml-2 text-emerald-600">· есть ответ</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className={`ai-clarify-btn${sparkIdx === listIdx ? " sparking" : ""}`}
                    onClick={handleAskAI}
                  >
                    <Icon name="Sparkles" size={12} />
                    <span className="hidden sm:inline">Уточнить у AI Юриста</span>
                    <span className="sm:hidden">AI</span>
                  </button>
                  <div
                    className={`transition-transform duration-300 cursor-pointer text-muted-foreground ${isOpen ? "rotate-180" : ""}`}
                    onClick={() => setOpenIdx(isOpen ? null : listIdx)}
                  >
                    <Icon name="ChevronDown" size={16} />
                  </div>
                </div>
              </div>

              {/* Раскрывающийся ответ AI */}
              <div
                className={`overflow-hidden transition-all duration-400 ease-in-out ${
                  isOpen ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"
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
                        <div className="flex-1 min-w-0 bg-blue-50/60 border-l-2 border-gold-400 rounded-2xl px-3 sm:px-4 py-3 text-sm text-navy-700 leading-relaxed whitespace-pre-wrap overflow-hidden">
                          {aiReply.text}
                        </div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={onGoToChat}
                          className="text-xs text-muted-foreground hover:text-navy-700 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          <Icon name="MessageCircle" size={12} />
                          Перейти в чат
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

      {/* Созданные документы */}
      {genDocs.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800">Созданные документы</h2>
            <span className="text-xs text-muted-foreground bg-slate-100 px-2.5 py-1.5 rounded-xl shrink-0">
              {genDocs.length} {genDocs.length === 1 ? "документ" : genDocs.length < 5 ? "документа" : "документов"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-4 text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            Документы хранятся в вашем браузере — скачайте, чтобы не потерять при очистке
          </div>
          <div className="space-y-2">
            {genDocs.map((doc) => (
              <div key={doc.id} className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name="FileText" size={16} className="text-navy-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-800 truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {onOpenDoc && (
                    <button
                      onClick={() => onOpenDoc(doc)}
                      className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1 border border-border"
                    >
                      <Icon name="Eye" size={12} />
                      <span className="hidden sm:inline">Просмотр</span>
                    </button>
                  )}
                  <button
                    onClick={() => downloadDoc(doc.name, doc.filled)}
                    className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1 border border-border"
                  >
                    <Icon name="Download" size={12} />
                    <span className="hidden sm:inline">Скачать</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}