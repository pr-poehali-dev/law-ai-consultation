import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import { AttachmentModal, AttachmentBar, AttachPanel } from "./ExpertAttachPanel";

const EXPERT_NAME = "Эксперт-юрист Поварчук И.В.";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MsgBubble({ msg, isAdmin }: { msg: LawyerMessage; isAdmin: boolean }) {
  const isMe = isAdmin ? msg.sender === "admin" : msg.sender === "user";
  const [viewAtt, setViewAtt] = useState(false);
  const hasContent = !!(msg.attachment_content && msg.attachment_content.length > 5);

  return (
    <div className={`flex gap-2 sm:gap-3 items-end ${isMe ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isMe && (
        <div className="w-8 h-8 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
          <Icon name="UserCheck" size={14} className="text-gold-400" />
        </div>
      )}
      <div className={`max-w-[85%] sm:max-w-[72%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <p className="text-[10.5px] font-semibold text-navy-500 ml-1">{EXPERT_NAME}</p>
        )}
        <div className={`rounded-2xl px-4 py-3 shadow-sm transition-all ${
          isMe
            ? "bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm"
            : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm shadow"
        }`}>
          {(msg.attachment_type === "chat_answer" || msg.attachment_type === "document") && msg.attachment_name && (
            <button
              onClick={() => hasContent && setViewAtt(true)}
              className={`flex items-center gap-2 mb-2.5 px-3 py-2 rounded-xl text-xs font-medium w-full text-left transition-all ${
                msg.attachment_type === "chat_answer"
                  ? isMe
                    ? "bg-white/15 text-white/85 hover:bg-white/25"
                    : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                  : isMe
                    ? "bg-white/15 text-white/85 hover:bg-white/25"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
              } ${hasContent ? "cursor-pointer" : "cursor-default opacity-70"}`}
            >
              <Icon name={msg.attachment_type === "document" ? "FileText" : "Bot"} size={13} className="shrink-0" />
              <span className="flex-1 truncate">
                {msg.attachment_type === "document" ? "Документ" : "Ответ AI"}: {msg.attachment_name.slice(0, 50)}{msg.attachment_name.length > 50 ? "…" : ""}
              </span>
              {hasContent && <Icon name="ExternalLink" size={11} className="shrink-0 opacity-60" />}
            </button>
          )}
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-golos">{msg.body}</p>
        </div>
        <div className={`flex items-center gap-1 ${isMe ? "flex-row-reverse" : ""}`}>
          <p className="text-[10px] text-muted-foreground/50">{fmtTime(msg.created_at)}</p>
          {isMe && msg.is_read && <Icon name="CheckCheck" size={12} className="text-gold-400" />}
        </div>
      </div>
      {isMe && (
        <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase shadow-sm">
          {isAdmin ? "A" : (msg.body?.[0]?.toUpperCase() ?? "U")}
        </div>
      )}
      {viewAtt && msg.attachment_content && (
        <AttachmentModal
          title={msg.attachment_name || ""}
          content={msg.attachment_content}
          type={msg.attachment_type || ""}
          onClose={() => setViewAtt(false)}
        />
      )}
    </div>
  );
}

interface ExpertChatProps {
  isAdmin: boolean;
  selectedUserId: number | null;
  currentDialog: LawyerDialog | null | undefined;
  lmsgs: LawyerMessage[];
  loading: boolean;
  input: string;
  sending: boolean;
  err: string;
  attachment: { type: string; name: string; content?: string } | null;
  showAttachPanel: boolean;
  viewFullMsg: { title: string; content: string; type: string } | null;
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  onBack: () => void;
  onRefresh: () => void;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onToggleAttachPanel: () => void;
  onShowAttachPanel: () => void;
  onHideAttachPanel: () => void;
  onSelectAttachment: (att: { type: string; name: string; content?: string }) => void;
  onRemoveAttachment: () => void;
  onViewFullMsg: (v: { title: string; content: string; type: string }) => void;
  onCloseFullMsg: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  adjustTextarea: () => void;
}

export default function ExpertChat({
  isAdmin, selectedUserId, currentDialog, lmsgs, loading,
  input, sending, err, attachment, showAttachPanel, viewFullMsg,
  aiAnswers, genDocs,
  onBack, onRefresh, onInputChange, onSend,
  onToggleAttachPanel, onShowAttachPanel, onHideAttachPanel,
  onSelectAttachment, onRemoveAttachment, onViewFullMsg, onCloseFullMsg,
  textareaRef, bottomRef, adjustTextarea,
}: ExpertChatProps) {
  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-2 sm:gap-3" style={{ height: "clamp(480px, calc(100svh - 190px), 740px)" }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl border border-border px-3 sm:px-4 py-3 shadow-sm shrink-0">
        {isAdmin && (
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
            <Icon name="ArrowLeft" size={16} className="text-navy-600" />
          </button>
        )}
        <div className="relative">
          <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
            <Icon name="UserCheck" size={15} className="text-gold-400" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-800 truncate">
            {isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium">
            {isAdmin ? currentDialog?.email : "Онлайн · ответит в течение 24 ч"}
          </p>
        </div>
        <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Сообщения */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50 to-white p-3 sm:p-5 space-y-3 sm:space-y-4" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          </div>
        ) : lmsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg mx-auto">
              <Icon name="MessageSquarePlus" size={24} className="text-gold-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1">Начните диалог</p>
              <p className="text-xs text-muted-foreground max-w-xs">Опишите вашу ситуацию или прикрепите ответ AI / документ для анализа</p>
            </div>
            {!isAdmin && (aiAnswers.length > 0 || genDocs.length > 0) && (
              <button
                onClick={onShowAttachPanel}
                className="mt-1 flex items-center gap-2 px-4 py-2 bg-navy-50 hover:bg-navy-100 rounded-xl text-xs font-medium text-navy-700 transition-colors"
              >
                <Icon name="Paperclip" size={13} />
                Прикрепить ответ AI или документ
              </button>
            )}
          </div>
        ) : (
          lmsgs.map((m) => <MsgBubble key={m.id} msg={m} isAdmin={isAdmin} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Прикреплённый материал */}
      {attachment && (
        <AttachmentBar
          attachment={attachment}
          onView={onViewFullMsg}
          onRemove={onRemoveAttachment}
        />
      )}

      {/* Панель выбора материала */}
      {showAttachPanel && !isAdmin && (
        <AttachPanel
          aiAnswers={aiAnswers}
          genDocs={genDocs}
          onSelect={(att) => { onSelectAttachment(att); onHideAttachPanel(); }}
          onClose={onHideAttachPanel}
        />
      )}

      {err && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 shrink-0">
          <Icon name="AlertCircle" size={13} className="shrink-0" />{err}
        </div>
      )}

      {/* Поле ввода */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
        <div className="flex items-end gap-2 px-3 py-2.5">
          {!isAdmin && (
            <button
              onClick={onToggleAttachPanel}
              className={`p-2 rounded-xl transition-colors shrink-0 ${showAttachPanel ? "bg-navy-100 text-navy-700" : "hover:bg-slate-100 text-muted-foreground hover:text-navy-600"}`}
              title="Прикрепить материал"
            >
              <Icon name="Paperclip" size={16} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => { onInputChange(e.target.value); adjustTextarea(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            disabled={sending}
            placeholder={isAdmin ? "Ответить клиенту..." : "Опишите вопрос для юриста..."}
            className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 text-sm outline-none resize-none leading-relaxed py-1"
            style={{ minHeight: "24px", maxHeight: "120px" }}
          />
          <button
            onClick={onSend}
            disabled={sending || (!input.trim() && !attachment)}
            className="w-9 h-9 bg-navy-700 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Icon name="Send" size={15} className="text-white" />}
          </button>
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">Enter — отправить · Shift+Enter — новая строка</p>
          {!isAdmin && (
            <button
              onClick={onShowAttachPanel}
              className="text-[10px] text-navy-500 hover:text-navy-700 flex items-center gap-1 transition-colors"
            >
              <Icon name="Paperclip" size={10} />
              прикрепить документ
            </button>
          )}
        </div>
      </div>

      {/* Модалка просмотра полного вложения */}
      {viewFullMsg && (
        <AttachmentModal
          title={viewFullMsg.title}
          content={viewFullMsg.content}
          type={viewFullMsg.type}
          onClose={onCloseFullMsg}
        />
      )}
    </div>
  );
}
