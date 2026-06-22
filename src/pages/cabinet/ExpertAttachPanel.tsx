import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import DocPreview from "@/components/DocPreview";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import { ZIP_THRESHOLD_BYTES, type FileAttachment } from "./zipAttachments";

const MAX_FILES = 10;
const MAX_FILE_MB = 4;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_TOTAL_MB = 8;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;
const ALLOWED_EXTS = ["pdf", "docx", "doc", "jpg", "jpeg", "png", "txt"];

export type { FileAttachment };

export interface ContentAttachment {
  type: "chat_answer" | "document";
  name: string;
  content?: string;
}

export type Attachment = FileAttachment | ContentAttachment;

// ── Модальное окно предпросмотра ─────────────────────────────────────
export function AttachmentModal({ title, content, type, downloadUrl, onClose,
  isAdmin, msgId, targetUserId, editedContent, editedAt,
}: {
  title: string;
  content: string;
  type: string;
  downloadUrl?: string;
  onClose: () => void;
  isAdmin?: boolean;
  msgId?: number;
  targetUserId?: number;
  editedContent?: string;
  editedAt?: string;
}) {
  const isImage = type === "image";
  const isFile = type === "file";
  const canEdit = isAdmin && type === "document" && !!msgId && !!targetUserId;

  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(editedContent || content || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const displayContent = editedContent || content;

  const handleDownload = () => {
    const src = editMode ? editText : displayContent;
    if (downloadUrl && !editMode) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = title;
      a.target = "_blank";
      a.click();
    } else if (src) {
      const blob = new Blob([src], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = title + ".txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSave = async () => {
    if (!canEdit || !msgId || !targetUserId) return;
    setSaving(true);
    setSaveErr("");
    const { lawyerEditDoc } = await import("@/lib/auth");
    const res = await lawyerEditDoc({
      target_user_id: targetUserId,
      msg_id: msgId,
      edited_content: editText,
      attachment_name: title,
    });
    setSaving(false);
    if (res.error) { setSaveErr(res.error); return; }
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-3xl sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl rounded-t-3xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 shrink-0 border-b border-slate-100">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            type === "document" ? (editMode ? "bg-amber-500" : "bg-navy-800") :
            type === "chat_answer" ? "bg-indigo-600" : "bg-amber-100"
          }`}>
            <Icon
              name={editMode ? "Pencil" : type === "document" ? "FileText" : type === "chat_answer" ? "Bot" : type === "image" ? "Image" : "File"}
              size={17}
              color={type === "file" ? "#d97706" : "white"}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {editMode ? "Редактирование документа" : editedAt ? `Отредактирован юристом · ${editedAt.slice(0,10)}` : type === "document" ? "Документ" : type === "chat_answer" ? "Ответ AI" : "Файл"}
            </p>
            <p className="text-sm font-bold text-navy-900 truncate leading-tight">{title}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {saved && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                <Icon name="CheckCheck" size={11} />Сохранено
              </span>
            )}
            {canEdit && !editMode && (
              <button
                onClick={() => { setEditText(editedContent || content || ""); setEditMode(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors"
              >
                <Icon name="Pencil" size={12} />
                Редактировать
              </button>
            )}
            {editMode && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {saving ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Icon name="Save" size={12} />}
                  Сохранить
                </button>
                <button
                  onClick={() => { setEditMode(false); setSaveErr(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Отмена
                </button>
              </>
            )}
            {!editMode && (downloadUrl || displayContent) && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 text-white rounded-xl text-xs font-semibold hover:bg-navy-700 transition-colors"
              >
                <Icon name="Download" size={12} />
                <span className="hidden sm:inline">Скачать</span>
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
              <Icon name="X" size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Ошибка сохранения */}
        {saveErr && (
          <div className="shrink-0 px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-center gap-2">
            <Icon name="AlertCircle" size={12} />
            {saveErr}
          </div>
        )}

        {/* Баннер об уже сохранённой правке (для пользователя) */}
        {!isAdmin && editedContent && editedAt && (
          <div className="shrink-0 px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
            <Icon name="CheckCircle" size={13} className="text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700 font-medium">
              Юрист внёс правки · {editedAt.slice(0, 10)} — скачайте обновлённую версию
            </p>
            <button
              onClick={handleDownload}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition-colors shrink-0"
            >
              <Icon name="Download" size={10} />Скачать
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {editMode ? (
            <div className="p-4 h-full flex flex-col gap-2">
              <p className="text-[11px] text-slate-400">Редактируйте текст документа — пользователь увидит правки после сохранения</p>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="flex-1 w-full border border-slate-200 rounded-xl p-4 text-sm text-navy-800 leading-relaxed resize-none outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-mono"
                style={{ minHeight: "400px" }}
                placeholder="Текст документа..."
              />
            </div>
          ) : isImage && downloadUrl ? (
            <div className="flex items-center justify-center p-6 min-h-[200px] bg-slate-50">
              <img src={downloadUrl} alt={title} className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-lg" />
            </div>
          ) : isFile && downloadUrl ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center border-2 border-amber-100">
                <Icon name="File" size={36} className="text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-navy-800 mb-1">{title}</p>
                <p className="text-sm text-muted-foreground">Нажмите «Скачать» для просмотра</p>
              </div>
            </div>
          ) : type === "document" && displayContent ? (
            <div className="px-4 sm:px-8 py-5 sm:py-6 bg-white">
              <DocPreview content={displayContent} fillValues={{}} />
            </div>
          ) : (
            <div className="p-5 text-sm text-navy-800 whitespace-pre-wrap leading-relaxed font-golos">
              {displayContent || <span className="text-muted-foreground italic">Содержимое недоступно</span>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Превью прикреплённого материала (бар над вводом) ─────────────────
export function AttachmentBar({ attachments, onView, onRemove }: {
  attachments: Attachment[];
  onView: (v: { title: string; content: string; type: string; downloadUrl?: string }) => void;
  onRemove: (index: number) => void;
}) {
  const fileAtts = attachments.filter((a): a is FileAttachment => a.type === "file");
  const totalBytes = fileAtts.reduce((s, f) => s + f.size, 0);
  const willZip = totalBytes > ZIP_THRESHOLD_BYTES;

  return (
    <div className="flex flex-col gap-1.5 shrink-0 animate-fade-in">
      {attachments.map((att, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-navy-50 border border-navy-200 rounded-2xl">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            att.type === "document" ? "bg-emerald-100" :
            att.type === "chat_answer" ? "bg-blue-100" : "bg-amber-100"
          }`}>
            <Icon
              name={att.type === "document" ? "FileText" : att.type === "chat_answer" ? "Bot" : "Paperclip"}
              size={13}
              className={att.type === "document" ? "text-emerald-600" : att.type === "chat_answer" ? "text-blue-600" : "text-amber-600"}
            />
          </div>
          <p className="text-xs font-medium text-navy-800 flex-1 truncate">
            {att.type === "document" ? "Документ" : att.type === "chat_answer" ? "Ответ AI" : "Файл"}: {att.name}
            {att.type === "file" && (
              <span className="text-muted-foreground ml-1">({(att.size / 1024 / 1024).toFixed(1)} МБ)</span>
            )}
          </p>
          {(att.type === "chat_answer" || att.type === "document") && att.content && (
            <button
              onClick={() => onView({ title: att.name, content: att.content!, type: att.type })}
              className="text-[11px] text-navy-500 hover:text-navy-700 px-2 py-1 hover:bg-navy-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <Icon name="Eye" size={11} />
              Открыть
            </button>
          )}
          <button onClick={() => onRemove(i)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
            <Icon name="X" size={13} />
          </button>
        </div>
      ))}
      {willZip && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <Icon name="Archive" size={12} className="text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-700">
            Суммарно {(totalBytes / 1024 / 1024).toFixed(1)} МБ — файлы будут сжаты в ZIP-архив при отправке
          </p>
        </div>
      )}
    </div>
  );
}

// ── Панель выбора/загрузки материала ─────────────────────────────────
export function AttachPanel({ aiAnswers, genDocs, currentCount, currentTotalBytes = 0, onSelectContent, onFilesAdded, onClose }: {
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  currentCount: number;
  currentTotalBytes?: number;
  onSelectContent: (att: ContentAttachment) => void;
  onFilesAdded: (files: FileAttachment[]) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setUploadErr("");
    const remaining = MAX_FILES - currentCount;
    if (remaining <= 0) {
      setUploadErr(`Максимум ${MAX_FILES} файлов`);
      return;
    }
    const toProcess = Array.from(fileList).slice(0, remaining);
    const results: FileAttachment[] = [];
    let processed = 0;
    let runningTotal = currentTotalBytes;

    toProcess.forEach(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTS.includes(ext)) {
        setUploadErr(`Формат .${ext} не поддерживается`);
        processed++;
        if (processed === toProcess.length && results.length > 0) onFilesAdded(results);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setUploadErr(`${file.name}: файл больше ${MAX_FILE_MB} МБ`);
        processed++;
        if (processed === toProcess.length && results.length > 0) onFilesAdded(results);
        return;
      }
      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        setUploadErr(`Суммарный размер файлов не может превышать ${MAX_TOTAL_MB} МБ`);
        processed++;
        if (processed === toProcess.length && results.length > 0) onFilesAdded(results);
        return;
      }
      runningTotal += file.size;
      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = (e.target?.result as string).split(",")[1] || "";
        results.push({ type: "file", name: file.name, b64, size: file.size, mimeType: file.type });
        processed++;
        if (processed === toProcess.length) onFilesAdded(results);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shrink-0 animate-fade-in shadow-lg">
      {/* Заголовок */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50">
        <p className="text-xs font-semibold text-navy-700">Прикрепить к сообщению</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{currentCount}/{MAX_FILES} файлов</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <Icon name="X" size={13} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Скрытые input-ы */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={photoInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
        />

        {/* Две кнопки загрузки */}
        <div className={`grid grid-cols-2 gap-2 ${currentCount >= MAX_FILES ? "opacity-50 pointer-events-none" : ""}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-navy-300 hover:bg-navy-50 active:scale-95 transition-all"
          >
            <div className="w-9 h-9 bg-navy-100 rounded-xl flex items-center justify-center">
              <Icon name="FileText" size={16} className="text-navy-600" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-navy-700">Документ</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, TXT · до {MAX_FILE_MB} МБ</p>
            </div>
          </button>
          <button
            onClick={() => photoInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-navy-300 hover:bg-navy-50 active:scale-95 transition-all"
          >
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Icon name="Camera" size={16} className="text-amber-600" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-navy-700">Фото</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG · до {MAX_FILE_MB} МБ</p>
            </div>
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground px-1">
          Суммарно до {MAX_TOTAL_MB} МБ · файлы свыше {MAX_TOTAL_MB / 2} МБ сжимаются в ZIP-архив автоматически
        </p>

        {uploadErr && (
          <p className="text-[11px] text-red-500 font-medium px-1">{uploadErr}</p>
        )}

        {/* AI-ответы и документы */}
        {(aiAnswers.length > 0 || genDocs.length > 0) && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Из кабинета</p>
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
              {aiAnswers.map((m, i) => (
                <button
                  key={i}
                  onClick={() => onSelectContent({ type: "chat_answer", name: `Ответ AI #${i + 1}: ${m.text.slice(0, 45)}…`, content: m.text })}
                  className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-left transition-all"
                >
                  <div className="w-6 h-6 bg-blue-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="Bot" size={12} className="text-blue-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-blue-800">Ответ AI #{i + 1}</p>
                    <p className="text-[11px] text-blue-600 line-clamp-2">{m.text.slice(0, 100)}</p>
                  </div>
                  <Icon name="Plus" size={12} className="text-blue-400 shrink-0 mt-1" />
                </button>
              ))}
              {genDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onSelectContent({ type: "document", name: doc.name, content: doc.filled || doc.content })}
                  className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl text-left transition-all"
                >
                  <div className="w-6 h-6 bg-emerald-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="FileText" size={12} className="text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-emerald-800">{doc.name}</p>
                    <p className="text-[11px] text-emerald-600">{doc.date}</p>
                  </div>
                  <Icon name="Plus" size={12} className="text-emerald-400 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function useAttachment() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [viewFullMsg, setViewFullMsg] = useState<{ title: string; content: string; type: string; downloadUrl?: string } | null>(null);

  const addAttachment = (att: Attachment) => {
    setAttachments(p => p.length < MAX_FILES ? [...p, att] : p);
  };
  const addFiles = (files: FileAttachment[]) => {
    setAttachments(p => {
      const remaining = MAX_FILES - p.length;
      return [...p, ...files.slice(0, remaining)];
    });
  };
  const removeAttachment = (i: number) => {
    setAttachments(p => p.filter((_, idx) => idx !== i));
  };
  const clearAttachments = () => setAttachments([]);

  return {
    attachments, addAttachment, addFiles, removeAttachment, clearAttachments,
    showAttachPanel, setShowAttachPanel,
    viewFullMsg, setViewFullMsg,
  };
}