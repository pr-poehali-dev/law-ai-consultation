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
    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "ai" && (
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
              style={{
                background: msg.isEdited ? "linear-gradient(135deg,#0f4028,#0a3020)" : "linear-gradient(135deg,#162d5a,#0f2040)",
                border: `1px solid ${msg.isEdited ? "rgba(52,211,153,0.3)" : "rgba(240,192,96,0.25)"}`,
              }}
            >
              <Icon
                name={msg.isEdited ? "CheckCircle" : "Scale"}
                size={12}
                className={msg.isEdited ? "text-emerald-400" : "text-gold-400"}
              />
            </div>
          )}

          <div
            className={`max-w-[90%] rounded-2xl px-3 py-2.5 shadow-sm text-[12px] leading-relaxed ${
              msg.role === "ai"
                ? msg.isEdited
                  ? "rounded-tl-sm border border-emerald-500/30"
                  : "rounded-tl-sm border border-navy-600/50"
                : "rounded-tr-sm"
            }`}
            style={{
              background: msg.role === "user"
                ? "linear-gradient(135deg,#1e3a6e,#162d5a)"
                : msg.isEdited
                  ? "rgba(16,60,40,0.8)"
                  : "rgba(22,45,90,0.6)",
            }}
          >
            {msg.isEdited && (
              <div
                className="flex items-center gap-1.5 mb-1.5 pb-1.5"
                style={{ borderBottom: "1px solid rgba(52,211,153,0.2)" }}
              >
                <Icon name="Pencil" size={10} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                  Правка #{msg.editNum}
                </span>
              </div>
            )}

            {msg.role === "ai" && !msg.isEdited
              ? renderAnalysisText(msg.text)
              : <p className="whitespace-pre-wrap text-navy-100">{msg.text}</p>
            }

            {msg.partialNote && (
              <div
                className="mt-2 p-2 rounded-lg"
                style={{ background: "rgba(240,192,96,0.1)", border: "1px solid rgba(240,192,96,0.2)" }}
              >
                <p className="text-[10px] font-bold text-gold-400 mb-0.5">Не было внесено:</p>
                <p className="text-[10px] text-navy-300 leading-relaxed">{msg.partialNote}</p>
              </div>
            )}

            {msg.isEdited && (
              <button
                onClick={() => downloadDoc(docName, currentContent)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95"
                style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}
              >
                <Icon name="Download" size={12} />Скачать .docx
              </button>
            )}
          </div>

          {msg.role === "user" && (
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold"
              style={{ background: "linear-gradient(135deg,#1e3a6e,#162d5a)", border: "1px solid rgba(240,192,96,0.2)", color: "#f0c060" }}
            >
              Я
            </div>
          )}
        </div>
      ))}

      {/* Предложение продолжить partial */}
      {pendingPartial && !editLoading && (
        <div
          className="rounded-2xl p-3 space-y-2 border border-gold-500/30"
          style={{ background: "rgba(240,192,96,0.08)" }}
        >
          <p className="text-[11px] font-semibold text-gold-400">Внести оставшуюся часть правки?</p>
          <p className="text-[10px] text-navy-300 leading-relaxed">{pendingPartial.note}</p>
          <div className="flex gap-2">
            <button
              onClick={onDeclinePartial}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-navy-600 text-navy-300 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              Нет
            </button>
            <button
              onClick={onContinuePartial}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95"
              style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}
            >
              Да, внести
            </button>
          </div>
        </div>
      )}

      {/* Анализ */}
      {analyzing && (
        <div className="flex gap-2 items-start">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.25)" }}
          >
            <Icon name="Scale" size={12} className="text-gold-400 animate-pulse" />
          </div>
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2.5 border border-navy-600/50"
            style={{ background: "rgba(22,45,90,0.6)" }}
          >
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(j => (
                <div key={j} className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
              ))}
              <span className="text-[11px] text-navy-300">Анализирую документ...</span>
            </div>
          </div>
        </div>
      )}

      {/* Редактирование */}
      {editLoading && (
        <div className="flex gap-2 items-start">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4028,#0a3020)", border: "1px solid rgba(52,211,153,0.3)" }}
          >
            <Icon name="PenLine" size={12} className="text-emerald-400" />
          </div>
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2.5 border border-emerald-500/20"
            style={{ background: "rgba(16,60,40,0.7)" }}
          >
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(j => (
                <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
              ))}
              <span className="text-[11px] text-emerald-400 font-medium">Вношу правку в документ...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
