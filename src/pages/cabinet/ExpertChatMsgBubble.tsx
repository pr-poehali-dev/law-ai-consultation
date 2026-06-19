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
}

/* ── Простой markdown: **bold**, *italic*, `code`, > quote ──────── */
function renderMarkdown(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#93c5fd;font-style:italic">$1</em>')
    .replace(/`(.+?)`/g, '<code style="font-family:JetBrains Mono,monospace;background:rgba(6,182,247,.12);color:#06b6f7;padding:1px 5px;border-radius:4px;font-size:.85em">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #06b6f7;padding:4px 10px;margin:4px 0;background:rgba(6,182,247,.07);border-radius:0 6px 6px 0;color:inherit">$1</blockquote>')
    .replace(/\n/g, "<br/>");
}

const CSS = `
@keyframes msg-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes dot-pulse{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
@keyframes reply-flash{0%,100%{background:transparent}50%{background:rgba(6,182,247,.15)}}
`;

export default function MsgBubble({ msg, isAdmin, onReply }: MsgBubbleProps) {
  const isMe = isAdmin ? msg.sender === "admin" : msg.sender === "user";
  const [viewAtt, setViewAtt] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hasContent = !!(msg.attachment_content && msg.attachment_content.length > 5);
  const { text, files } = parseFileLinks(msg.body || "");
  const isOptimistic = msg.id < 0;
  const isSystem = !!(msg as LawyerMessage & { is_system?: boolean }).is_system;

  /* ── Системное сообщение о завершении ── */
  if (isSystem) {
    return (
      <div className="flex justify-center my-3 px-2">
        <div style={{
          background: "linear-gradient(135deg,rgba(220,38,38,.08),rgba(239,68,68,.04))",
          border: "1px solid rgba(220,38,38,.25)",
          borderRadius: 16,
          padding: "12px 20px",
          maxWidth: 340,
          textAlign: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>🛑</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>Консультация завершена</span>
          </div>
          {text && <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{text}</p>}
        </div>
      </div>
    );
  }

  /* ── Цвета по стороне ── */
  const bubble = isMe ? {
    bg: "linear-gradient(135deg,#0f4c81,#1a3a6b)",
    shadow: "4px 4px 12px rgba(0,0,0,.35),-2px -2px 8px rgba(255,255,255,.04)",
    color: "#e2e8f0",
    border: "1px solid rgba(6,182,247,.2)",
  } : {
    bg: "linear-gradient(135deg,#1e293b,#162032)",
    shadow: "4px 4px 12px rgba(0,0,0,.3),-2px -2px 8px rgba(255,255,255,.03)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,.07)",
  };

  /* ── Статус иконка ── */
  const statusIcon = isOptimistic
    ? <Icon name="Clock" size={11} style={{ color: "#475569" }} />
    : msg.is_read
      ? <Icon name="CheckCheck" size={12} style={{ color: "#06b6f7" }} />
      : <Icon name="Check" size={12} style={{ color: "#475569" }} />;

  return (
    <>
      <style>{CSS}</style>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexDirection: isMe ? "row-reverse" : "row",
          animation: "msg-in .25s cubic-bezier(.34,1.56,.64,1) both",
          opacity: isOptimistic ? 0.7 : 1,
          position: "relative",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Аватар */}
        <div style={{
          width: 34, height: 34, borderRadius: 12, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, marginBottom: 2,
          background: isMe
            ? "linear-gradient(135deg,#1e3a5f,#2d5282)"
            : "linear-gradient(135deg,#06b6f7,#0284c7)",
          boxShadow: "0 4px 10px rgba(0,0,0,.3)",
          color: "#fff",
        }}>
          {isMe
            ? (isAdmin ? "A" : "Я")
            : <Icon name="Scale" size={15} style={{ color: "#fff" }} />}
        </div>

        <div style={{
          display: "flex", flexDirection: "column", gap: 3,
          maxWidth: "72%", alignItems: isMe ? "flex-end" : "flex-start",
        }}>
          {/* Имя */}
          {!isMe && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6f7", marginLeft: 4, letterSpacing: ".05em", textTransform: "uppercase" }}>
              {EXPERT_NAME}
            </span>
          )}

          {/* Пузырь */}
          <div style={{
            background: bubble.bg,
            boxShadow: bubble.shadow,
            border: bubble.border,
            borderRadius: isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
            padding: "10px 14px",
            display: "flex", flexDirection: "column", gap: 8,
            position: "relative",
          }}>
            {/* Кнопка Reply при наведении */}
            {hovered && onReply && !isOptimistic && (
              <button
                onClick={() => onReply(msg)}
                style={{
                  position: "absolute",
                  top: -28,
                  [isMe ? "left" : "right"]: 0,
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 20,
                  background: "#1e293b",
                  border: "1px solid rgba(6,182,247,.3)",
                  color: "#94a3b8", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                  boxShadow: "0 4px 12px rgba(0,0,0,.3)",
                  animation: "msg-in .15s ease",
                  zIndex: 10,
                }}
              >
                <Icon name="CornerUpLeft" size={11} /> Ответить
              </button>
            )}

            {/* Вложение AI/документ */}
            {(msg.attachment_type === "chat_answer" || msg.attachment_type === "document") && msg.attachment_name && (
              <button
                onClick={() => hasContent && setViewAtt(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 10,
                  background: msg.attachment_type === "document"
                    ? "rgba(5,150,105,.12)" : "rgba(79,70,229,.12)",
                  border: msg.attachment_type === "document"
                    ? "1px solid rgba(5,150,105,.25)" : "1px solid rgba(79,70,229,.25)",
                  color: msg.attachment_type === "document" ? "#34d399" : "#a5b4fc",
                  fontSize: 12, fontWeight: 600,
                  cursor: hasContent ? "pointer" : "default",
                  textAlign: "left", width: "100%",
                }}
              >
                <Icon name={msg.attachment_type === "document" ? "FileText" : "Bot"} size={13} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {msg.attachment_type === "document" ? "📄 " : "🤖 "}
                  {(msg.attachment_name || "").slice(0, 45)}{(msg.attachment_name || "").length > 45 ? "…" : ""}
                </span>
                {hasContent && <Icon name="Eye" size={11} style={{ opacity: .6 }} />}
              </button>
            )}

            {/* Текст с markdown */}
            {text && (
              <p
                style={{ fontSize: 13.5, lineHeight: 1.6, color: bubble.color, margin: 0, wordBreak: "break-word" }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
              />
            )}

            {/* Файлы */}
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {files.map((f, i) => <FileLink key={i} name={f.name} url={f.url} isMe={isMe} />)}
              </div>
            )}
          </div>

          {/* Время + статус */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            flexDirection: isMe ? "row-reverse" : "row",
            paddingLeft: 4, paddingRight: 4,
          }}>
            <span style={{ fontSize: 10, color: "#475569" }}>{fmtTime(msg.created_at)}</span>
            {isMe && statusIcon}
          </div>
        </div>
      </div>

      {viewAtt && msg.attachment_content && (
        <AttachmentModal
          title={msg.attachment_name || ""}
          content={msg.attachment_content}
          type={msg.attachment_type || ""}
          onClose={() => setViewAtt(false)}
        />
      )}
    </>
  );
}
