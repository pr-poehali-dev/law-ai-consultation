import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { downloadDoc } from "@/lib/docUtils";
import { type AiMsg, renderAnalysisText } from "./DocAiChatTypes";

interface DocAiChatMessagesProps {
  messages: AiMsg[];
  analyzing: boolean;
  editLoading: boolean;
  pendingPartial: { note: string; instruction: string } | null;
  docName: string;
  currentContent: string;
  onContinuePartial: () => void;
  onDeclinePartial: () => void;
}

export default function DocAiChatMessages({
  messages,
  analyzing,
  editLoading,
  pendingPartial,
  docName,
  currentContent,
  onContinuePartial,
  onDeclinePartial,
}: DocAiChatMessagesProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, analyzing, editLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0 bg-white">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "ai" && (
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${msg.isEdited ? "bg-emerald-600" : "bg-navy-800"}`}>
              <Icon
                name={msg.isEdited ? "CheckCircle" : "Scale"}
                size={12}
                className="text-white"
              />
            </div>
          )}

          <div
            className={`max-w-[90%] rounded-2xl px-3 py-2.5 shadow-sm text-[12px] leading-relaxed border ${
              msg.role === "ai"
                ? msg.isEdited
                  ? "rounded-tl-sm bg-emerald-50 border-emerald-200"
                  : "rounded-tl-sm bg-slate-50 border-slate-200"
                : "rounded-tr-sm bg-navy-800 border-navy-700"
            }`}
          >
            {msg.isEdited && (
              <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-emerald-200">
                <Icon name="Pencil" size={10} className="text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                  Правка #{msg.editNum}
                </span>
              </div>
            )}

            {msg.role === "ai" && !msg.isEdited
              ? renderAnalysisText(msg.text)
              : <p className={`whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-slate-700"}`}>{msg.text}</p>
            }

            {msg.partialNote && (
              <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-[10px] font-bold text-amber-700 mb-0.5">Не было внесено:</p>
                <p className="text-[10px] text-amber-800 leading-relaxed">{msg.partialNote}</p>
              </div>
            )}

            {msg.isEdited && (
              <button
                onClick={() => downloadDoc(docName, currentContent)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-navy-800 text-gold-400 hover:bg-navy-700"
              >
                <Icon name="Download" size={12} />Скачать .docx
              </button>
            )}
          </div>

          {msg.role === "user" && (
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold bg-navy-700 text-gold-400 border border-navy-600">
              Я
            </div>
          )}
        </div>
      ))}

      {/* Предложение продолжить partial */}
      {pendingPartial && !editLoading && (
        <div className="rounded-2xl p-3 space-y-2 bg-amber-50 border border-amber-200">
          <p className="text-[11px] font-semibold text-amber-800">Внести оставшуюся часть правки?</p>
          <p className="text-[10px] text-amber-700 leading-relaxed">{pendingPartial.note}</p>
          <div className="flex gap-2">
            <button
              onClick={onDeclinePartial}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Нет
            </button>
            <button
              onClick={onContinuePartial}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-navy-800 text-white hover:bg-navy-700"
            >
              Да, внести
            </button>
          </div>
        </div>
      )}

      {/* Анализ */}
      {analyzing && (
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-navy-800 shadow-sm">
            <Icon name="Scale" size={12} className="text-gold-400 animate-pulse" />
          </div>
          <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(j => (
                <div key={j} className="w-1.5 h-1.5 rounded-full bg-navy-500 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
              ))}
              <span className="text-[11px] text-slate-600">Анализирую документ...</span>
            </div>
          </div>
        </div>
      )}

      {/* Редактирование */}
      {editLoading && (
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-emerald-600 shadow-sm">
            <Icon name="PenLine" size={12} className="text-white" />
          </div>
          <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(j => (
                <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
              ))}
              <span className="text-[11px] text-emerald-700 font-medium">Вношу правку в документ...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
