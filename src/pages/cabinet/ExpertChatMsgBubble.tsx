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
  const isOptimistic = msg.id < 0;

  const attType = msg.attachment_type;
  const attName = msg.attachment_name || "";
  const attIcon = attType === "document" ? "FileText" : "Bot";

  return (
    <>
      <style>{`
        @keyframes lc-in {
          from { opacity:0; transform:translateY(6px) scale(.98); }
          to   { opacity:1; transform:translateY(0)  scale(1); }
        }
      `}</style>

      <div
        className={`flex gap-2.5 items-end ${isMe ? "flex-row-reverse" : ""}`}
        style={{ animation: "lc-in .2s ease both", opacity: isOptimistic ? .7 : 1 }}
      >
        {/* Аватар */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold shadow-sm ${
          isMe
            ? "bg-gradient-to-br from-navy-100 to-navy-200 text-navy-700 border border-navy-200"
            : "gradient-navy text-gold-400"
        }`}>
          {isMe
            ? (isAdmin ? "A" : (text?.[0]?.toUpperCase() ?? "Вы"))
            : <Icon name="UserCheck" size={13} />
          }
        </div>

        {/* Контент */}
        <div className={`flex flex-col gap-0.5 max-w-[78%] sm:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
          {/* Имя */}
          {!isMe && (
            <span className="text-[10px] font-semibold text-navy-400 ml-1 mb-0.5 tracking-wide">{EXPERT_NAME}</span>
          )}

          {/* Пузырь */}
          <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm flex flex-col gap-2 min-w-0 ${
            isMe
              ? "bg-gradient-to-br from-[#0f2d5e] to-[#193f7a] text-white rounded-br-[4px]"
              : "bg-white border border-slate-100 text-navy-800 rounded-bl-[4px]"
          }`}>

            {/* Вложение AI-ответ или документ */}
            {(attType === "chat_answer" || attType === "document") && attName && (
              <button
                onClick={() => hasContent && setViewAtt(true)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold w-full text-left transition-all ${
                  isMe
                    ? "bg-white/10 text-white/90 hover:bg-white/20"
                    : attType === "document"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                      : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                } ${hasContent ? "cursor-pointer" : "cursor-default opacity-70"}`}
              >
                <Icon name={attIcon} size={12} className="shrink-0" />
                <span className="flex-1 truncate leading-tight">
                  {attType === "document" ? "📄 Документ" : "🤖 Ответ AI"}: {attName.slice(0, 48)}{attName.length > 48 ? "…" : ""}
                </span>
                {hasContent && <Icon name="ExternalLink" size={10} className="shrink-0 opacity-50" />}
              </button>
            )}

            {/* Текст сообщения */}
            {text && (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words font-golos">{text}</p>
            )}

            {/* Файлы */}
            {files.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                {files.map((f, i) => <FileLink key={i} name={f.name} url={f.url} isMe={isMe} />)}
              </div>
            )}
          </div>

          {/* Время + статус доставки */}
          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
            <span className="text-[9.5px] text-slate-400 tabular-nums">{fmtTime(msg.created_at)}</span>
            {isMe && (
              isOptimistic
                ? <Icon name="Clock" size={10} className="text-slate-300" />
                : msg.is_read
                  ? <Icon name="CheckCheck" size={11} className="text-[#e8a820]" />
                  : <Icon name="Check" size={11} className="text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Модалка вложения */}
      {viewAtt && msg.attachment_content && (
        <AttachmentModal
          title={attName}
          content={msg.attachment_content}
          type={attType || ""}
          onClose={() => setViewAtt(false)}
        />
      )}
    </>
  );
}
