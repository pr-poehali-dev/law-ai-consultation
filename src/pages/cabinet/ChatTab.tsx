import { useRef } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

export interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; }

interface ChatTabProps {
  user: User;
  messages: ChatMsg[];
  input: string;
  typing: boolean;
  chatErr: string;
  attachedFile: { name: string; b64: string; size: string } | null;
  fileUploading: boolean;
  totalLeft: number;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
  onClearFile: () => void;
  onPayClick: () => void;
  onGoToDocs: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export default function ChatTab({
  user,
  messages,
  input,
  typing,
  chatErr,
  attachedFile,
  fileUploading,
  totalLeft,
  onInputChange,
  onSend,
  onSendFile,
  onFileSelect,
  onAttachClick,
  onClearFile,
  onPayClick,
  onGoToDocs,
  chatEndRef,
  fileInputRef,
}: ChatTabProps) {
  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${typing ? "bg-amber-400 animate-pulse" : "bg-green-400 animate-pulse"}`} />
          <span className="text-xs text-muted-foreground">
            {typing ? "AI-юрист формирует ответ..." : "AI-юрист онлайн · обучен реальными юристами"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {user.isAdmin ? (
            <span className="text-xs px-2.5 py-1 rounded-xl font-medium bg-purple-50 text-purple-700">
              Администратор
            </span>
          ) : totalLeft === 0 ? (
            <button
              onClick={onPayClick}
              className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
            >
              <Icon name="Plus" size={12} />
              100 ₽ / 3 вопроса
            </button>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-xl font-medium bg-emerald-50 text-emerald-700">
              {user.paidQuestions} вопр. осталось
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-3xl border border-border shadow-sm p-5 space-y-4 scrollbar-hide">
        {messages.map((msg, i) => {
          const isDocRedirect = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
          return (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="Scale" size={14} className="text-gold-400" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-navy-700 text-white rounded-br-sm"
                  : "bg-blue-50/60 border-l-2 border-gold-400 text-navy-800 rounded-bl-sm"
              }`}>
                {msg.text}
                {isDocRedirect && (
                  <button
                    onClick={onGoToDocs}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-navy-700 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl transition-colors w-full justify-center"
                  >
                    <Icon name="FileText" size={14} />
                    Перейти в раздел «Документы»
                  </button>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-navy-600 uppercase">
                  {user.name?.[0] ?? "U"}
                </div>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="flex gap-3">
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Scale" size={14} className="text-gold-400" />
            </div>
            <div className="bg-blue-50/60 border-l-2 border-gold-400 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {chatErr && (
        <div className="mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
          <Icon name="AlertCircle" size={13} className="shrink-0" />{chatErr}
        </div>
      )}

      {/* Превью прикреплённого файла */}
      {attachedFile && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-2xl">
          <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="FileText" size={14} className="text-navy-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-navy-800 truncate">{attachedFile.name}</div>
            <div className="text-xs text-muted-foreground">{attachedFile.size} · будет удалён через 30 мин</div>
          </div>
          <button onClick={onClearFile} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={onFileSelect}
        />
        <button
          onClick={onAttachClick}
          disabled={typing || fileUploading}
          title="Прикрепить документ (PDF, DOC, DOCX, JPEG, PNG)"
          className="w-12 h-12 rounded-2xl border border-border bg-white hover:bg-slate-50 hover:border-navy-300 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
        >
          {fileUploading
            ? <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full animate-pulse" />
            : <Icon name="Paperclip" size={18} className={attachedFile ? "text-navy-600" : "text-muted-foreground"} />
          }
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (attachedFile) { onSendFile(); } else { onSend(); }
            }
          }}
          disabled={typing}
          placeholder={
            attachedFile
              ? "Задайте вопрос к документу или отправьте без вопроса..."
              : (user.isAdmin || totalLeft > 0)
                ? "Задайте юридический вопрос или прикрепите документ..."
                : "Оплатите консультацию — 100 ₽ за 3 вопроса"
          }
          className="flex-1 bg-white border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors disabled:opacity-60"
        />
        <button
          onClick={attachedFile ? onSendFile : onSend}
          disabled={(!input.trim() && !attachedFile) || typing}
          className="btn-gold w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Icon name="Send" size={18} />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Ответы AI не заменяют консультацию практикующего юриста · Файлы удаляются через 30 минут
      </p>
    </div>
  );
}
