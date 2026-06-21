import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { LawyerMessage } from "@/lib/auth";
import { AttachmentModal } from "./ExpertAttachPanel";
import FileLink from "./ExpertChatFileLink";
import { EXPERT_NAME, fmtTime, parseFileLinks } from "./ExpertChatUtils";

interface MsgBubbleProps {
  msg: LawyerMessage;
  isAdmin: boolean;
}

export default function MsgBubble({ msg, isAdmin }: MsgBubbleProps) {
  const isMe = isAdmin ? msg.sender === "admin" : msg.sender === "user";
  const [viewAtt, setViewAtt] = useState(false);
  const hasContent = !!(msg.attachment_content && msg.attachment_content.length > 5);
  const { text, files } = parseFileLinks(msg.body || "");

  const attIconName = msg.attachment_type === "document" ? "FileText" : "Bot";
  const attColors = msg.attachment_type === "document"
    ? isMe ? "bg-white/15 text-white/85 hover:bg-white/25" : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
    : isMe ? "bg-white/15 text-white/85 hover:bg-white/25" : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100";

  return (
    <div className={`flex gap-2 sm:gap-3 items-end ${isMe ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isMe && (
        <div className="w-9 h-9 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
          <Icon name="UserCheck" size={15} className="text-gold-400" />
        </div>
      )}
      <div className={`max-w-[80%] sm:max-w-[72%] min-w-0 flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <p className="text-[10.5px] font-semibold text-navy-500 ml-1">
            {msg.sender === "admin" ? EXPERT_NAME : "Клиент"}
          </p>
        )}
        <div className={`rounded-2xl px-4 py-3 shadow-sm transition-all flex flex-col gap-2 min-w-0 w-full ${
          isMe
            ? "bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm"
            : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm shadow"
        }`}>
          {/* Файл от юриста: attachment_type === "file", url в attachment_content */}
          {msg.attachment_type === "file" && msg.attachment_name && msg.attachment_content && (
            <FileLink name={msg.attachment_name} url={msg.attachment_content} isMe={isMe} />
          )}

          {/* Документ или ответ AI — кнопка просмотра */}
          {(msg.attachment_type === "chat_answer" || msg.attachment_type === "document") && msg.attachment_name && (
            <button
              onClick={() => hasContent && setViewAtt(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-full text-left transition-all ${attColors} ${hasContent ? "cursor-pointer" : "cursor-default opacity-70"}`}
            >
              <Icon name={attIconName} size={13} className="shrink-0" />
              <span className="flex-1 truncate">
                {msg.attachment_type === "document" ? "Документ" : "Ответ AI"}: {msg.attachment_name.slice(0, 50)}{msg.attachment_name.length > 50 ? "…" : ""}
              </span>
              {hasContent && <Icon name="ExternalLink" size={11} className="shrink-0 opacity-60" />}
            </button>
          )}
          {text && (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-golos">{text}</p>
          )}
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {files.map((f, i) => (
                <FileLink key={i} name={f.name} url={f.url} isMe={isMe} />
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
          <p className="text-[10px] text-muted-foreground/50">{fmtTime(msg.created_at)}</p>
          {isMe && msg.is_read && <Icon name="CheckCheck" size={12} className="text-gold-400" />}
        </div>
      </div>
      {isMe && (
        <div className="w-9 h-9 bg-gradient-to-br from-navy-100 to-navy-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase shadow-sm border border-navy-200">
          {isAdmin ? "A" : ((text || msg.attachment_name || "U")[0]?.toUpperCase() ?? "U")}
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