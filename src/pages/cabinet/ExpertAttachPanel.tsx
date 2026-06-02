import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";

const MAX_FILES = 10;
const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_EXTS = ["pdf", "docx", "doc", "jpg", "jpeg", "png", "txt"];

export interface FileAttachment {
  type: "file";
  name: string;
  b64: string;
  size: number;
  mimeType: string;
}

export interface ContentAttachment {
  type: "chat_answer" | "document";
  name: string;
  content?: string;
}

export type Attachment = FileAttachment | ContentAttachment;

// ── Модальное окно предпросмотра ─────────────────────────────────────
export function AttachmentModal({ title, content, type, downloadUrl, onClose }: {
  title: string;
  content: string;
  type: string;
  downloadUrl?: string;
  onClose: () => void;
}) {
  const isImage = type === "image";
  const isFile = type === "file";

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = title;
      a.target = "_blank";
      a.click();
    } else if (content) {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = title + ".txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-navy-900/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 shrink-0 border-b border-border ${
          type === "document" ? "bg-gradient-to-r from-emerald-50 to-teal-50" :
          type === "chat_answer" ? "bg-gradient-to-r from-blue-50 to-indigo-50" :
          type === "file" ? "bg-gradient-to-r from-amber-50 to-orange-50" :
          "bg-gradient-to-r from-slate-50 to-gray-50"
        }`}>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
            type === "document" ? "bg-emerald-100" :
            type === "chat_answer" ? "bg-blue-100" :
            type === "file" ? "bg-amber-100" : "bg-slate-100"
          }`}>
            <Icon
              name={type === "document" ? "FileText" : type === "chat_answer" ? "Bot" : type === "image" ? "Image" : "File"}
              size={18}
              className={type === "document" ? "text-emerald-600" : type === "chat_answer" ? "text-blue-600" : type === "file" ? "text-amber-600" : "text-slate-600"}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {type === "document" ? "Документ" : type === "chat_answer" ? "Ответ AI" : "Файл"}
            </p>
            <p className="text-sm font-bold text-navy-800 truncate">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            {(downloadUrl || content) && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-700 text-white rounded-xl text-xs font-medium hover:bg-navy-800 transition-colors"
              >
                <Icon name="Download" size={12} />
                Скачать
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/70 rounded-xl transition-colors">
              <Icon name="X" size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isImage && downloadUrl ? (
            <div className="flex items-center justify-center p-6 bg-checkerboard min-h-[200px]">
              <img src={downloadUrl} alt={title} className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-lg" />
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
          ) : (
            <div className="p-5 text-sm text-navy-800 whitespace-pre-wrap leading-relaxed font-golos">
              {content || <span className="text-muted-foreground italic">Содержимое недоступно</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Превью прикреплённого материала (бар над вводом) ─────────────────
export function AttachmentBar({ attachments, onView, onRemove }: {
  attachments: Attachment[];
  onView: (v: { title: string; content: string; type: string; downloadUrl?: string }) => void;
  onRemove: (index: number) => void;
}) {
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
    </div>
  );
}

// ── Панель выбора/загрузки материала ─────────────────────────────────
export function AttachPanel({ aiAnswers, genDocs, currentCount, onSelectContent, onFilesAdded, onClose }: {
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  currentCount: number;
  onSelectContent: (att: ContentAttachment) => void;
  onFilesAdded: (files: FileAttachment[]) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        {/* Drag-and-drop зона */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
            dragOver ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:border-navy-300 hover:bg-slate-50"
          } ${currentCount >= MAX_FILES ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt,image/*"
            className="hidden"
            onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-navy-100 rounded-2xl flex items-center justify-center">
              <Icon name="Upload" size={18} className="text-navy-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-navy-700">Нажмите чтобы выбрать файл</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">PDF, DOCX, JPG, PNG · до {MAX_FILE_MB} МБ · макс. {MAX_FILES} файлов</p>
            </div>
          </div>
          {uploadErr && (
            <p className="text-[11px] text-red-500 mt-2 font-medium">{uploadErr}</p>
          )}
        </div>

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