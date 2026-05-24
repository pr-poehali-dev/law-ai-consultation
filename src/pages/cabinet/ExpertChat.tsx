import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import type { Attachment, ContentAttachment, FileAttachment } from "./ExpertAttachPanel";
import { AttachmentModal, AttachmentBar, AttachPanel } from "./ExpertAttachPanel";

const EXPERT_NAME = "Эксперт-юрист Поварчук И.В.";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Парсим ссылки на файлы из тела сообщения
function parseFileLinks(body: string): { text: string; files: { name: string; url: string }[] } {
  // Маркер может быть в начале строки или после \n
  const MARKER = "[Прикреплённые файлы]";
  const idx = body.indexOf(MARKER);
  if (idx === -1) return { text: body, files: [] };
  const text = body.slice(0, idx).trim();
  const filesSection = body.slice(idx + MARKER.length);
  const files: { name: string; url: string }[] = [];
  filesSection.split("\n").forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(/^📎 (.+?): (https?:\/\/.+)$/);
    if (match) files.push({ name: match[1], url: match[2] });
  });
  return { text, files };
}

function FileLink({ name, url, isMe }: { name: string; url: string; isMe: boolean }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png"].includes(ext);
  const [preview, setPreview] = useState(false);
  const iconName = isImage ? "Image" : ext === "pdf" ? "FileText" : "File";

  return (
    <>
      {/* Контрастный стиль для обоих сторон: белый фон с рамкой */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border"
        style={isMe
          ? { background: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }
          : { background: "#fff", borderColor: "#e2e8f0", color: "#1e3a5f" }
        }
      >
        <Icon name={iconName} size={13} className="shrink-0 opacity-80" />
        <span className="flex-1 truncate font-semibold">{name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isImage && (
            <button
              onClick={() => setPreview(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors"
              style={isMe ? { background: "rgba(255,255,255,0.15)" } : { background: "#f1f5f9" }}
            >
              <Icon name="Eye" size={10} />
            </button>
          )}
          <a
            href={url} download={name} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
            style={isMe ? { background: "rgba(255,255,255,0.15)" } : { background: "#f1f5f9" }}
          >
            <Icon name="Download" size={10} />Скачать
          </a>
        </div>
      </div>
      {preview && (
        <AttachmentModal
          title={name}
          content=""
          type="image"
          downloadUrl={url}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

function MsgBubble({ msg, isAdmin }: { msg: LawyerMessage; isAdmin: boolean }) {
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
      <div className={`max-w-[85%] sm:max-w-[72%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <p className="text-[10.5px] font-semibold text-navy-500 ml-1">{EXPERT_NAME}</p>
        )}
        <div className={`rounded-2xl px-4 py-3 shadow-sm transition-all flex flex-col gap-2 ${
          isMe
            ? "bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm"
            : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm shadow"
        }`}>
          {/* Вложение (AI ответ / документ) */}
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
          {/* Основной текст */}
          {text && (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-golos">{text}</p>
          )}
          {/* Прикреплённые файлы */}
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
          {isAdmin ? "A" : (text?.[0]?.toUpperCase() ?? "U")}
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
  uploadProgress: number;
  err: string;
  attachments: Attachment[];
  showAttachPanel: boolean;
  viewFullMsg: { title: string; content: string; type: string; downloadUrl?: string } | null;
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  isBlocked?: boolean;
  lawyerQLeft?: number;
  currentPlanId?: string;
  onBack: () => void;
  onRefresh: () => void;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onToggleAttachPanel: () => void;
  onHideAttachPanel: () => void;
  onAddAttachment: (att: ContentAttachment) => void;
  onAddFiles: (files: FileAttachment[]) => void;
  onRemoveAttachment: (i: number) => void;
  onViewFullMsg: (v: { title: string; content: string; type: string; downloadUrl?: string }) => void;
  onCloseFullMsg: () => void;
  onBuyLawyerQuestions?: () => void;
  onUpgradePlan?: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  adjustTextarea: () => void;
}

export default function ExpertChat({
  isAdmin, selectedUserId, currentDialog, lmsgs, loading,
  input, sending, uploadProgress, err, attachments, showAttachPanel, viewFullMsg,
  aiAnswers, genDocs, isBlocked = false, lawyerQLeft = 0, currentPlanId = "plan_starter",
  onBack, onRefresh, onInputChange, onSend,
  onToggleAttachPanel, onHideAttachPanel,
  onAddAttachment, onAddFiles, onRemoveAttachment,
  onViewFullMsg, onCloseFullMsg,
  onBuyLawyerQuestions, onUpgradePlan,
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
        {/* Счётчик вопросов юриста */}
        {!isAdmin && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 ${
            isBlocked
              ? "bg-red-50 border border-red-200"
              : lawyerQLeft <= 2
                ? "bg-amber-50 border border-amber-200"
                : "bg-emerald-50 border border-emerald-200"
          }`}>
            <Icon name="User" size={11} className={isBlocked ? "text-red-500" : lawyerQLeft <= 2 ? "text-amber-500" : "text-emerald-600"} />
            <span className={`text-[11px] font-bold ${isBlocked ? "text-red-600" : lawyerQLeft <= 2 ? "text-amber-700" : "text-emerald-700"}`}>
              {isBlocked ? "0" : lawyerQLeft}
            </span>
          </div>
        )}
        <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Сообщения */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-5 space-y-3 sm:space-y-4" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          </div>
        ) : lmsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg mx-auto">
              <Icon name="MessageSquarePlus" size={24} className="text-gold-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1">Начните диалог</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Опишите вашу ситуацию, прикрепите документы или ответы AI для анализа
              </p>
            </div>
            {!isAdmin && (
              <button
                onClick={onToggleAttachPanel}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-50 hover:bg-navy-100 rounded-xl text-xs font-medium text-navy-700 transition-colors border border-navy-200"
              >
                <Icon name="Paperclip" size={13} />
                Прикрепить файлы или материалы
              </button>
            )}
          </div>
        ) : (
          <>
            {lmsgs.map((m) => <MsgBubble key={m.id} msg={m} isAdmin={isAdmin} />)}
            {/* Воронка при исчерпании вопросов — в конце ленты как системное сообщение */}
            {isBlocked && !isAdmin && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex gap-2 sm:gap-3 items-end max-w-[92%] sm:max-w-[80%]">
                  <div className="w-9 h-9 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
                    <Icon name="UserCheck" size={15} className="text-gold-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10.5px] font-semibold text-navy-500 ml-1 mb-1">{EXPERT_NAME}</p>
                    {/* Системное сообщение */}
                    <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-100 shadow px-4 py-3 mb-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Icon name="Lock" size={12} className="text-amber-500" />
                        </div>
                        <p className="text-sm font-semibold text-navy-800">Вопросы к юристу исчерпаны</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Вы можете читать переписку, но отправка новых сообщений недоступна. Пополните вопросы или перейдите на более высокий тариф.
                      </p>
                    </div>
                    {/* Кнопки воронки */}
                    <div className="space-y-2">
                      <button
                        onClick={onBuyLawyerQuestions}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98] text-left bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 shadow-sm"
                      >
                        <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                          <Icon name="MessageCircle" size={16} className="text-gold-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight">+5 вопросов юристу</p>
                          <p className="text-xs text-white/60 mt-0.5">Ответ в течение 24 часов</p>
                        </div>
                        <span className="text-sm font-bold text-gold-400 shrink-0">990 ₽</span>
                      </button>

                      {currentPlanId !== "plan_max" && (
                        <button
                          onClick={onUpgradePlan}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-[0.98] text-left shadow-sm"
                        >
                          <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                            <Icon name="TrendingUp" size={16} className="text-navy-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-navy-800 leading-tight">
                              {currentPlanId === "plan_starter" ? "Перейти на тариф «Профи»" : "Перейти на тариф «Максимум»"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {currentPlanId === "plan_starter"
                                ? "+5 вопросов юристу · 100 вопросов AI"
                                : "+30 вопросов юристу · 300 вопросов AI"}
                            </p>
                          </div>
                          <Icon name="ChevronRight" size={14} className="text-slate-400 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Панель ввода */}
      <div className="bg-white rounded-2xl border border-border shadow-sm shrink-0 overflow-hidden">
        {/* Прогресс загрузки */}
        {sending && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[11px] text-muted-foreground">Загрузка файлов...</p>
              <p className="text-[11px] font-semibold text-navy-700 ml-auto">{uploadProgress}%</p>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-navy-500 to-navy-700 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Вложения */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3">
            <AttachmentBar
              attachments={attachments}
              onView={onViewFullMsg}
              onRemove={onRemoveAttachment}
            />
          </div>
        )}

        {/* Панель выбора вложений */}
        {showAttachPanel && (
          <div className="px-4 pt-3">
            <AttachPanel
              aiAnswers={aiAnswers}
              genDocs={genDocs}
              currentCount={attachments.length}
              onSelectContent={onAddAttachment}
              onFilesAdded={onAddFiles}
              onClose={onHideAttachPanel}
            />
          </div>
        )}

        {/* Ввод сообщения */}
        <div className="flex items-end gap-2 px-3 sm:px-4 py-3">
          <button
            onClick={onToggleAttachPanel}
            disabled={sending}
            className={`p-2 rounded-xl transition-colors shrink-0 mb-0.5 ${
              showAttachPanel || attachments.length > 0
                ? "bg-navy-100 text-navy-700"
                : "text-muted-foreground hover:text-navy-700 hover:bg-slate-100"
            }`}
          >
            <Icon name="Paperclip" size={16} />
            {attachments.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-navy-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {attachments.length}
              </span>
            )}
          </button>

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { onInputChange(e.target.value); adjustTextarea(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isBlocked) onSend(); }
              }}
              disabled={sending || isBlocked}
              placeholder={isBlocked ? "Вопросы к юристу исчерпаны" : isAdmin ? "Ответить клиенту..." : "Опишите вопрос для юриста..."}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none leading-relaxed transition-colors ${
                isBlocked
                  ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-50 border-slate-200 text-navy-800 placeholder:text-muted-foreground focus:border-navy-300 focus:bg-white"
              }`}
              style={{ minHeight: "40px", maxHeight: "180px" }}
            />
          </div>

          <button
            onClick={onSend}
            disabled={isBlocked || sending || (!input.trim() && attachments.length === 0)}
            className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shrink-0 mb-0.5 disabled:opacity-40 hover:opacity-90 transition-all shadow-sm active:scale-95"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Icon name="Send" size={16} className="text-white" />
            )}
          </button>
        </div>

        {err && (
          <div className="px-4 pb-3">
            <p className="text-xs text-red-500 flex items-center gap-1">
              <Icon name="AlertCircle" size={11} />
              {err}
            </p>
          </div>
        )}
      </div>

      {/* Модальное окно предпросмотра */}
      {viewFullMsg && (
        <AttachmentModal
          title={viewFullMsg.title}
          content={viewFullMsg.content}
          type={viewFullMsg.type}
          downloadUrl={viewFullMsg.downloadUrl}
          onClose={onCloseFullMsg}
        />
      )}
    </div>
  );
}