import Icon from "@/components/ui/icon";
import { AttachmentBar, AttachPanel, AttachmentModal } from "./ExpertAttachPanel";
import type { ExpertChatProps } from "./ExpertChatUtils";

type Props = Pick<
  ExpertChatProps,
  | "isAdmin" | "isBlocked" | "isDialogClosed"
  | "input" | "sending" | "uploadProgress" | "err"
  | "attachments" | "showAttachPanel" | "viewFullMsg"
  | "aiAnswers" | "genDocs"
  | "onInputChange" | "onSend"
  | "onToggleAttachPanel" | "onHideAttachPanel"
  | "onAddAttachment" | "onAddFiles" | "onRemoveAttachment"
  | "onViewFullMsg" | "onCloseFullMsg"
  | "textareaRef" | "adjustTextarea"
>;

export default function ExpertChatInput({
  isAdmin, isBlocked = false, isDialogClosed = false,
  input, sending, uploadProgress, err,
  attachments, showAttachPanel, viewFullMsg,
  aiAnswers, genDocs,
  onInputChange, onSend,
  onToggleAttachPanel, onHideAttachPanel,
  onAddAttachment, onAddFiles, onRemoveAttachment,
  onViewFullMsg, onCloseFullMsg,
  textareaRef, adjustTextarea,
}: Props) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-border shadow-sm shrink-0 overflow-hidden">
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

        {attachments.length > 0 && (
          <div className="px-4 pt-3">
            <AttachmentBar
              attachments={attachments}
              onView={onViewFullMsg}
              onRemove={onRemoveAttachment}
            />
          </div>
        )}

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
              disabled={sending || isBlocked || isDialogClosed}
              placeholder={
                isDialogClosed ? "Консультация завершена" :
                isBlocked ? "Предварительная консультация использована" :
                isAdmin ? "Ответить клиенту..." : "Опишите вопрос для юриста..."
              }
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none leading-relaxed transition-colors ${
                isBlocked || isDialogClosed
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
          <div className="px-4 pb-3 flex items-center gap-2">
            <Icon name="AlertCircle" size={11} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-500 flex-1">{err}</p>
            <button
              onClick={onSend}
              disabled={sending}
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 shrink-0 underline underline-offset-2 transition-colors"
            >
              <Icon name="RotateCcw" size={11} />
              Повторить
            </button>
          </div>
        )}
      </div>

      {viewFullMsg && (
        <AttachmentModal
          title={viewFullMsg.title}
          content={viewFullMsg.content}
          type={viewFullMsg.type}
          downloadUrl={viewFullMsg.downloadUrl}
          onClose={onCloseFullMsg}
        />
      )}
    </>
  );
}