import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import DocPreview from "@/components/DocPreview";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";

const MAX_FILES = 10;
const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_EXTS = ["pdf", "docx", "doc", "jpg", "jpeg", "png", "gif", "webp", "txt", "mp4", "avi", "mov", "zip", "rar"];

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

/* ─── Форматирование размера ──────────────────────────────────────── */
function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/* ─── Иконка по типу файла ────────────────────────────────────────── */
function fileIcon(ext: string) {
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return { icon: "Image", color: "#8b5cf6" };
  if (ext === "pdf") return { icon: "FileText", color: "#ef4444" };
  if (["doc","docx"].includes(ext)) return { icon: "BookOpen", color: "#3b82f6" };
  if (["mp4","avi","mov"].includes(ext)) return { icon: "Video", color: "#f59e0b" };
  if (["zip","rar"].includes(ext)) return { icon: "Archive", color: "#6b7280" };
  return { icon: "File", color: "#64748b" };
}

/* ═══ МОДАЛКА ПРЕДПРОСМОТРА ══════════════════════════════════════════ */
export function AttachmentModal({ title, content, type, downloadUrl, onClose }: {
  title: string;
  content: string;
  type: string;
  downloadUrl?: string;
  onClose: () => void;
}) {
  const ext = title.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg","jpeg","png","gif","webp"].includes(ext) || type === "image";
  const isVideo = ["mp4","avi","mov"].includes(ext);
  const isPdf = ext === "pdf";
  const isZip = ["zip","rar"].includes(ext);
  const [imgZoom, setImgZoom] = useState(false);

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl; a.download = title; a.target = "_blank"; a.click();
    } else if (content) {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = title + ".txt"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const { icon, color } = fileIcon(ext);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-3xl sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl rounded-t-3xl">

        {/* Шапка */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 shrink-0 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: type === "document" ? "linear-gradient(135deg,#0f2d5e,#1a4080)"
                : type === "chat_answer" ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
                : `${color}18`,
            }}>
            <Icon
              name={type === "document" ? "FileText" : type === "chat_answer" ? "Bot" : icon}
              size={17}
              style={{ color: type === "document" || type === "chat_answer" ? "white" : color }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
              {type === "document" ? "Документ" : type === "chat_answer" ? "Ответ AI" : "Файл"}
            </p>
            <p className="text-sm font-bold text-navy-900 truncate leading-tight">{title}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(downloadUrl || content) && (
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)", color: "#fff" }}>
                <Icon name="Download" size={12} />
                <span className="hidden sm:inline">Скачать</span>
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
              <Icon name="X" size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Изображение */}
          {isImage && downloadUrl && (
            <div className="flex flex-col items-center p-4 bg-slate-950 min-h-[300px] justify-center gap-3">
              <img
                src={downloadUrl} alt={title}
                onClick={() => setImgZoom(z => !z)}
                className="rounded-xl shadow-2xl transition-transform duration-300 cursor-zoom-in"
                style={{
                  maxWidth: imgZoom ? "none" : "100%",
                  maxHeight: imgZoom ? "none" : "55vh",
                  transform: imgZoom ? "scale(1.4)" : "scale(1)",
                }}
              />
              <p className="text-[10px] text-white/40">{imgZoom ? "Нажмите для уменьшения" : "Нажмите для увеличения"}</p>
            </div>
          )}

          {/* Видео */}
          {isVideo && downloadUrl && (
            <div className="bg-black flex items-center justify-center p-4">
              <video controls className="max-w-full max-h-[55vh] rounded-xl">
                <source src={downloadUrl} />
                Видео не поддерживается браузером
              </video>
            </div>
          )}

          {/* PDF — встроенный iframe */}
          {isPdf && downloadUrl && (
            <div className="bg-slate-100 flex flex-col items-center gap-3 p-5" style={{ minHeight: 300 }}>
              <div className="w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-white" style={{ height: 420 }}>
                <iframe src={`${downloadUrl}#view=FitH`} className="w-full h-full border-0" title={title} />
              </div>
              <p className="text-[10px] text-slate-400">📄 Предпросмотр PDF · нажмите «Скачать» для полного просмотра</p>
            </div>
          )}

          {/* ZIP */}
          {isZip && (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center border-2 border-slate-100"
                style={{ background: "#f8fafc" }}>
                <Icon name="Archive" size={36} className="text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-navy-800 mb-1">{title}</p>
                <p className="text-sm text-slate-500">Архив · нажмите «Скачать» для извлечения файлов</p>
              </div>
            </div>
          )}

          {/* Документ */}
          {type === "document" && content && !isImage && !isVideo && !isPdf && !isZip && (
            <div className="px-4 sm:px-8 py-5 bg-white">
              <DocPreview content={content} fillValues={{}} />
            </div>
          )}

          {/* Текст / AI */}
          {(type === "chat_answer" || (!isImage && !isVideo && !isPdf && !isZip && type !== "document")) && (
            <div className="p-5 text-sm text-navy-800 whitespace-pre-wrap leading-relaxed">
              {content || <span className="text-slate-400 italic">Содержимое недоступно</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ БАР ВЛОЖЕНИЙ (над полем ввода) ════════════════════════════════ */
export function AttachmentBar({ attachments, onView, onRemove }: {
  attachments: Attachment[];
  onView: (v: { title: string; content: string; type: string; downloadUrl?: string }) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      {attachments.map((att, i) => {
        const ext = att.name.split(".").pop()?.toLowerCase() || "";
        const { icon, color } = fileIcon(ext);
        return (
          <div key={i} className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border"
            style={{ background: "rgba(15,76,129,.04)", borderColor: "rgba(15,76,129,.12)" }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: att.type === "document" ? "rgba(5,150,105,.1)"
                  : att.type === "chat_answer" ? "rgba(79,70,229,.1)"
                  : `${color}15`,
              }}>
              <Icon
                name={att.type === "document" ? "FileText" : att.type === "chat_answer" ? "Bot" : icon}
                size={12}
                style={{ color: att.type === "document" ? "#059669" : att.type === "chat_answer" ? "#4f46e5" : color }}
              />
            </div>
            <p className="text-xs font-medium text-navy-800 flex-1 truncate">
              {att.type === "document" ? "Документ" : att.type === "chat_answer" ? "Ответ AI" : "Файл"}: {att.name}
              {att.type === "file" && (
                <span className="text-slate-400 ml-1">({fmtSize(att.size)})</span>
              )}
            </p>
            {(att.type === "chat_answer" || att.type === "document") && att.content && (
              <button
                onClick={() => onView({ title: att.name, content: att.content!, type: att.type })}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                style={{ color: "#0f4c81", background: "rgba(15,76,129,.07)" }}>
                <Icon name="Eye" size={10} /> Открыть
              </button>
            )}
            <button onClick={() => onRemove(i)}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
              <Icon name="X" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ ПАНЕЛЬ ВЫБОРА ВЛОЖЕНИЙ ═════════════════════════════════════════ */
export function AttachPanel({ aiAnswers, genDocs, currentCount, onSelectContent, onFilesAdded, onClose }: {
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  currentCount: number;
  onSelectContent: (att: ContentAttachment) => void;
  onFilesAdded: (files: FileAttachment[]) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadErr, setUploadErr] = useState("");

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setUploadErr("");
    const remaining = MAX_FILES - currentCount;
    if (remaining <= 0) { setUploadErr(`Максимум ${MAX_FILES} файлов`); return; }
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
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold text-navy-700">📎 Прикрепить файл</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{currentCount}/{MAX_FILES}</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <Icon name="X" size={13} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Скрытые input */}
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.zip,.rar" className="hidden"
          onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }} />
        <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }} />
        <input ref={videoInputRef} type="file" multiple accept="video/*" className="hidden"
          onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }} />

        {/* Кнопки загрузки */}
        <div className={`grid grid-cols-3 gap-2 ${currentCount >= MAX_FILES ? "opacity-50 pointer-events-none" : ""}`}>
          {[
            { label: "Документ", sub: "PDF, DOCX, TXT", icon: "FileText", color: "#3b82f6", ref: fileInputRef },
            { label: "Фото", sub: "JPG, PNG, GIF", icon: "Image", color: "#8b5cf6", ref: photoInputRef },
            { label: "Видео", sub: "MP4, MOV", icon: "Video", color: "#f59e0b", ref: videoInputRef },
          ].map(btn => (
            <button key={btn.label} onClick={() => btn.ref.current?.click()}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-navy-300 hover:bg-navy-50 active:scale-95 transition-all">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${btn.color}15` }}>
                <Icon name={btn.icon} size={15} style={{ color: btn.color }} />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-navy-700">{btn.label}</p>
                <p className="text-[9px] text-slate-400">{btn.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {uploadErr && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
            <Icon name="AlertCircle" size={12} className="text-red-500 shrink-0" />
            <p className="text-[11px] text-red-600">{uploadErr}</p>
          </div>
        )}

        {/* Материалы из кабинета */}
        {(aiAnswers.length > 0 || genDocs.length > 0) && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Из кабинета</p>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {aiAnswers.map((m, i) => (
                <button key={i}
                  onClick={() => onSelectContent({ type: "chat_answer", name: `Ответ AI #${i + 1}: ${m.text.slice(0, 40)}…`, content: m.text })}
                  className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-left transition-all">
                  <div className="w-6 h-6 bg-indigo-200 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="Bot" size={12} className="text-indigo-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-indigo-800">Ответ AI #{i + 1}</p>
                    <p className="text-[10px] text-indigo-600 truncate">{m.text.slice(0, 60)}</p>
                  </div>
                  <Icon name="Plus" size={11} className="text-indigo-400 shrink-0" />
                </button>
              ))}
              {genDocs.map(doc => (
                <button key={doc.id}
                  onClick={() => onSelectContent({ type: "document", name: doc.name, content: doc.filled || doc.content })}
                  className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl text-left transition-all">
                  <div className="w-6 h-6 bg-emerald-200 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="FileText" size={12} className="text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-emerald-800">{doc.name}</p>
                    <p className="text-[10px] text-emerald-600">{doc.date}</p>
                  </div>
                  <Icon name="Plus" size={11} className="text-emerald-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ ХУКИ ══════════════════════════════════════════════════════════ */
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
  const removeAttachment = (i: number) => setAttachments(p => p.filter((_, idx) => idx !== i));
  const clearAttachments = () => setAttachments([]);

  return {
    attachments, addAttachment, addFiles, removeAttachment, clearAttachments,
    showAttachPanel, setShowAttachPanel,
    viewFullMsg, setViewFullMsg,
  };
}
