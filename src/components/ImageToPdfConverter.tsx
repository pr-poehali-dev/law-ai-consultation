import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import Icon from "@/components/ui/icon";
import {
  MAX_FILES, MAX_FILE_MB, ACCEPT_EXT,
  IMG_TYPES, getKind, packAllInto3Pdfs,
  type FileItem, type PdfResult,
} from "./imageToPdfUtils";
import ImageToPdfDropZone from "./ImageToPdfDropZone";
import ImageToPdfFileGrid from "./ImageToPdfFileGrid";
import ImageToPdfResults from "./ImageToPdfResults";

interface Props {
  onClose: () => void;
  onSendToAI: (files: { name: string; b64: string; size: string }[]) => void;
}

export default function ImageToPdfConverter({ onClose, onSendToAI }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [pdfResults, setPdfResults] = useState<PdfResult[]>([]);
  const [docxFiles, setDocxFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [sendingToAI, setSendingToAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetResults = () => { setPdfResults([]); setDocxFiles([]); };

  const addFiles = useCallback((incoming: File[]) => {
    setError("");
    const valid = incoming.filter(f => {
      const name = f.name.toLowerCase();
      const ok = IMG_TYPES.includes(f.type) || /\.(jpg|jpeg|png|bmp|webp|gif|tiff?|pdf|docx?)$/i.test(name);
      return ok && f.size <= MAX_FILE_MB * 1024 * 1024;
    });
    setFiles(prev => {
      const combined = [...prev];
      for (const f of valid) {
        if (combined.length >= MAX_FILES) { setError(`Максимум ${MAX_FILES} файлов`); break; }
        const kind = getKind(f);
        combined.push({ id: Math.random().toString(36).slice(2), file: f, kind, preview: kind === "image" ? URL.createObjectURL(f) : null });
      }
      return combined;
    });
    resetResults();
  }, []);

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); };
  const removeFile = (id: string) => {
    setFiles(prev => { const f = prev.find(x => x.id === id); if (f?.preview) URL.revokeObjectURL(f.preview); return prev.filter(x => x.id !== id); });
    resetResults();
  };
  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFiles(prev => { const arr = [...prev]; const [m] = arr.splice(dragIdx, 1); arr.splice(idx, 0, m); setDragIdx(idx); return arr; });
  };
  const onDragEnd = () => setDragIdx(null);

  const convert = async () => {
    if (files.length === 0) return;
    setConverting(true); resetResults(); setError(""); setProgress(0);
    try {
      const { pdfResults: pr, docxFiles: dx } = await packAllInto3Pdfs(
        files,
        (p, l) => { setProgress(p); setProgressLabel(l); }
      );
      setPdfResults(pr);
      setDocxFiles(dx);
    } catch (e) {
      setError("Ошибка: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setConverting(false);
    }
  };

  const downloadOne = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAll = async () => {
    if (pdfResults.length === 1 && docxFiles.length === 0) { downloadOne(pdfResults[0].blob, pdfResults[0].name); return; }
    const zip = new JSZip();
    for (const r of pdfResults) zip.file(r.name, r.blob);
    for (const f of docxFiles) zip.file(f.file.name, f.file);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "documents.zip"; a.click();
  };

  const sendToAI = async () => {
    setSendingToAI(true);
    setError("");
    const list: { name: string; b64: string; size: string }[] = [];

    for (const r of pdfResults) {
      const b64 = await new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.readAsDataURL(r.blob);
      });
      list.push({ name: r.name, b64, size: `${r.sizeMb} МБ` });
    }

    for (const f of docxFiles) {
      const reader = new FileReader();
      const b64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(f.file);
      });
      list.push({ name: f.file.name, b64, size: `${Math.round(f.file.size / 1024 / 102.4) / 10} МБ` });
    }

    const totalB64 = list.reduce((sum, f) => sum + f.b64.length, 0);
    if (totalB64 > 4.5 * 1024 * 1024) {
      const totalMb = (totalB64 / 1024 / 1024).toFixed(1);
      setError(`Суммарный размер пакетов ${totalMb} МБ — превышает лимит (~4.5 МБ). Загружайте документы меньшего размера или по одному через обычную загрузку.`);
      setSendingToAI(false);
      return;
    }

    onSendToAI(list.slice(0, 3));
    setSendingToAI(false);
    onClose();
  };

  const images = files.filter(f => f.kind === "image");
  const pdfsIn = files.filter(f => f.kind === "pdf");
  const docxIn = files.filter(f => f.kind === "docx");
  const hasResults = pdfResults.length > 0 || docxFiles.length > 0;
  const totalOut = pdfResults.length + docxFiles.length;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[95svh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <Icon name="Files" size={18} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-navy-900">Массовая загрузка</p>
              <p className="text-[11px] text-muted-foreground">До {MAX_FILES} файлов → упаковка в 3 пакета → анализ AI</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
            <Icon name="X" size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          {files.length === 0 ? (
            <ImageToPdfDropZone
              isDragging={isDragging}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            />
          ) : (
            <ImageToPdfFileGrid
              files={files}
              dragIdx={dragIdx}
              hasResults={hasResults}
              converting={converting}
              images={images}
              pdfsIn={pdfsIn}
              docxIn={docxIn}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onRemove={removeFile}
              onAddClick={() => fileInputRef.current?.click()}
            />
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0" />{error}
            </div>
          )}

          {converting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-navy-700 font-medium">{progressLabel}</span>
                <span className="text-muted-foreground font-semibold">{progress}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg,#0f4c81,#1a6bb5)" }} />
              </div>
              <p className="text-[10px] text-slate-400 text-center">Обрабатываю {files.length} файлов — может занять до минуты</p>
            </div>
          )}

          {hasResults && !converting && (
            <ImageToPdfResults
              pdfResults={pdfResults}
              docxFiles={docxFiles}
              sendingToAI={sendingToAI}
              totalOut={totalOut}
              filesCount={files.length}
              onDownloadOne={downloadOne}
              onDownloadAll={downloadAll}
              onSendToAI={sendToAI}
            />
          )}
        </div>

        {/* Кнопка запуска */}
        {files.length > 0 && !converting && !hasResults && (
          <div className="px-5 pb-5 shrink-0">
            <button
              onClick={convert}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white", boxShadow: "0 4px 16px rgba(15,76,129,0.3)" }}
            >
              <span className="flex items-center justify-center gap-2">
                <Icon name="FileOutput" size={15} />
                Упаковать {files.length} файлов в {Math.min(3, files.length)} пакета для AI
              </span>
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_EXT}
        className="hidden"
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
      />
    </div>
  );
}
