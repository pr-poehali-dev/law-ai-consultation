import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { LawyerMessage } from "@/lib/auth";
import { AttachmentModal } from "./ExpertAttachPanel";
import FileLink from "./ExpertChatFileLink";
import { EXPERT_NAME, fmtTime, parseFileLinks } from "./ExpertChatUtils";

interface MsgBubbleProps {
  msg: LawyerMessage;
  isAdmin: boolean;
  onReply?: (msg: LawyerMessage) => void;
  replyTo?: LawyerMessage | null;
}

/* Простой рендер markdown: **bold**, *italic*, `code` */
function renderMd(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style=\"background:rgba(0,0,0,.07);padding:1px 4px;border-radius:4px;font-size:.9em\">$1</code>")
    .replace(/\n/g, "<br/>");
}

export default function MsgBubble({ msg, isAdmin, onReply, replyTo }: MsgBubbleProps) {
  const isMe = isAdmin ? msg.sender === "admin" : msg.sender === "user";
  const [viewAtt, setViewAtt] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hasContent = !!(msg.attachment_content && msg.attachment_content.length > 5);
  const { text, files } = parseFileLinks(msg.body || "");
  const isOptimistic = msg.id < 0;
  const isSystem = !!(msg as LawyerMessage & { is_system?: boolean }).is_system;

  const attType = msg.attachment_type;
  const attName = msg.attachment_name || "";

  /* Системное сообщение */
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="rounded-2xl px-5 py-3 text-center max-w-sm border"
          style={{ background: "linear-gradient(135deg,#fef3c7,#fef9ee)", borderColor: "#fde68a" }}>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-base">🛑</span>
            <p className="text-[12px] font-bold text-amber-900">Консультация завершена</p>
          </div>
          {text && <p className="text-[11px] text-amber-700 whitespace-pre-wrap leading-relaxed">{text}</p>}
        </div>
      </div>
    );
  }

  /* Иконка статуса */
  const statusIcon = isOptimistic
    ? <Icon name="Clock" size={11} className="text-slate-300" />
    : msg.is_read
      ? <Icon name="CheckCheck" size={12} className="text-[#e8a820]" />
      : <Icon name="Check" size={12} className="text-slate-400" />;

  /* Текст статуса */
  const statusLabel = isOptimistic ? "Отправляется" : msg.is_read ? "Прочитано" : "Доставлено";

  return (
    <>
      <div
        className={`group flex gap-2 items-end ${isMe ? "flex-row-reverse" : ""}`}
        style={{
          animation: "lc-in .22s ease both",
          opacity: isOptimistic ? 0.7 : 1,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Аватар */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold shadow-sm mb-0.5 ${
          isMe
            ? "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border border-slate-200"
            : "bg-gradient-to-br from-[#0f2d5e] to-[#1a3f7a] text-[#e8a820]"
        }`}>
          {isMe
            ? <Icon name="User" size={14} className="text-slate-500" />
            : <Icon name="Scale" size={13} />}
        </div>

        <div className={`flex flex-col gap-0.5 max-w-[76%] sm:max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
          {/* Имя */}
          {!isMe && (
            <span className="text-[10px] font-bold text-navy-400 ml-2 mb-0.5 tracking-wide uppercase">
              {EXPERT_NAME}
            </span>
          )}

          {/* Блок reply-цитаты */}
          {replyTo && (
            <div className={`flex items-start gap-2 px-3 py-1.5 rounded-xl mb-1 max-w-full border-l-2 ${
              isMe
                ? "bg-white/10 border-white/40"
                : "bg-slate-50 border-navy-300"
            }`}>
              <Icon name="CornerDownRight" size={10} className={isMe ? "text-white/50 mt-0.5 shrink-0" : "text-navy-300 mt-0.5 shrink-0"} />
              <p className={`text-[10.5px] line-clamp-2 ${isMe ? "text-white/60" : "text-slate-500"}`}>
                {replyTo.body?.slice(0, 100) || "Сообщение"}
              </p>
            </div>
          )}

          {/* Пузырь */}
          <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm flex flex-col gap-2 min-w-0 relative ${
            isMe
              ? "bg-gradient-to-br from-[#0d2b5c] to-[#1a4080] text-white rounded-br-[4px]"
              : "bg-white border border-slate-100 text-navy-800 rounded-bl-[4px] shadow-[0_1px_8px_rgba(0,0,0,.06)]"
          }`}>

            {/* Кнопка reply при наведении */}
            {hovered && onReply && !isOptimistic && (
              <button
                onClick={() => onReply(msg)}
                className={`absolute -top-2 ${isMe ? "left-0" : "right-0"} flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold shadow-lg z-10 transition-all animate-fade-in`}
                style={{
                  background: isMe ? "#1a4080" : "#fff",
                  border: isMe ? "1px solid rgba(255,255,255,.2)" : "1px solid #e2e8f0",
                  color: isMe ? "rgba(255,255,255,.8)" : "#64748b",
                }}
              >
                <Icon name="CornerUpLeft" size={10} /> Ответить
              </button>
            )}

            {/* Вложение AI/документ */}
            {(attType === "chat_answer" || attType === "document") && attName && (
              <button
                onClick={() => hasContent && setViewAtt(true)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold w-full text-left transition-all ${
                  isMe
                    ? "bg-white/10 text-white/90 hover:bg-white/20 border border-white/10"
                    : attType === "document"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                      : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                } ${hasContent ? "cursor-pointer" : "cursor-default opacity-70"}`}
              >
                <Icon name={attType === "document" ? "FileText" : "Bot"} size={12} className="shrink-0" />
                <span className="flex-1 truncate">
                  {attType === "document" ? "📄 " : "🤖 "}{attName.slice(0, 50)}{attName.length > 50 ? "…" : ""}
                </span>
                {hasContent && <Icon name="Eye" size={10} className="shrink-0 opacity-60" />}
              </button>
            )}

            {/* Текст с markdown */}
            {text && (
              <p
                className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: renderMd(text) }}
              />
            )}

            {/* Файлы */}
            {files.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                {files.map((f, i) => <FileLink key={i} name={f.name} url={f.url} isMe={isMe} />)}
              </div>
            )}
          </div>

          {/* Время + статус */}
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
            <span className="text-[9px] text-slate-400 tabular-nums">{fmtTime(msg.created_at)}</span>
            {isMe && (
              <span className="flex items-center gap-0.5" title={statusLabel}>
                {statusIcon}
              </span>
            )}
          </div>
        </div>
      </div>

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