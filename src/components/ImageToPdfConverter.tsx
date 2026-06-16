import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";

const MAX_FILES = 20;
const MAX_FILE_MB = 20;
const MAX_PDF_COUNT = 3;

const IMG_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/bmp", "image/webp", "image/gif", "image/tiff"];
const ACCEPT_EXT = ".jpg,.jpeg,.png,.bmp,.webp,.gif,.tiff,.tif,.pdf,.docx,.doc";

type FileKind = "image" | "pdf" | "docx";

interface FileItem {
  id: string;
  file: File;
  kind: FileKind;
  preview: string | null;
}

interface PdfResult {
  name: string;
  blob: Blob;
  pageCount: number;  // кол-во файлов в пакете
  sizeMb: number;
}

interface Props {
  onClose: () => void;
  onSendToAI: (files: { name: string; b64: string; size: string }[]) => void;
}

function getKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (IMG_TYPES.includes(file.type) || /\.(jpg|jpeg|png|bmp|webp|gif|tiff?)$/i.test(name)) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "docx";
}

function fileIconName(kind: FileKind): string {
  if (kind === "image") return "Image";
  if (kind === "pdf") return "FileText";
  return "FileSpreadsheet";
}

function fileColor(kind: FileKind): string {
  if (kind === "image") return "#0f4c81";
  if (kind === "pdf") return "#dc2626";
  return "#7c3aed";
}

async function compressImage(file: File, quality: number): Promise<string> {
  const opt = {
    maxSizeMB: MAX_FILE_MB,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
    initialQuality: quality / 100,
    maxWidthOrHeight: quality < 60 ? 1600 : 2400,
    exifOrientation: 1,
  };
  const compressed = await imageCompression(file, opt);
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(compressed);
  });
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = rej;
    reader.readAsArrayBuffer(file);
  });
}

// Собирает один PDF из группы файлов:
// - PDF → страницы склеиваются через pdf-lib
// - Фото → JPEG-страницы через jsPDF → потом тоже через pdf-lib
// - DOCX → страница-обложка (текст не извлечь в браузере)
async function buildMergedPdf(items: FileItem[], quality: number): Promise<Blob> {
  const merged = await PDFDocument.create();
  const A4_W_PT = 595.28, A4_H_PT = 841.89;

  for (const item of items) {
    if (item.kind === "image") {
      // Фото → временный jsPDF → потом страницы в merged
      const dataUrl = await compressImage(item.file, quality);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      const isLand = img.width > img.height;
      const pw = isLand ? 297 : 210, ph = isLand ? 210 : 297;
      const tmpPdf = new jsPDF({ unit: "mm", format: "a4", orientation: isLand ? "landscape" : "portrait" });
      const scale = Math.min(pw / img.width, ph / img.height);
      tmpPdf.addImage(dataUrl, "JPEG", (pw - img.width * scale) / 2, (ph - img.height * scale) / 2, img.width * scale, img.height * scale, undefined, "FAST");
      const tmpBytes = tmpPdf.output("arraybuffer");
      const tmpDoc = await PDFDocument.load(tmpBytes);
      const [copiedPage] = await merged.copyPages(tmpDoc, [0]);
      merged.addPage(copiedPage);

    } else if (item.kind === "pdf") {
      // PDF → склеиваем страницы, кол-во зависит от итерации сжатия
      // quality 85→8стр, 70→5стр, 50→3стр, 30→2стр
      const maxPages = [8, 5, 3, 2][quality === 85 ? 0 : quality === 70 ? 1 : quality === 50 ? 2 : 3];
      try {
        const bytes = await fileToBytes(item.file);
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pageCount = srcDoc.getPageCount();
        const indices = Array.from({ length: Math.min(pageCount, maxPages) }, (_, i) => i);
        const copiedPages = await merged.copyPages(srcDoc, indices);
        copiedPages.forEach(p => merged.addPage(p));
      } catch {
        // Если PDF зашифрован или сломан — добавляем обложку
        const page = merged.addPage([A4_W_PT, A4_H_PT]);
        const { rgb } = await import("pdf-lib");
        page.drawRectangle({ x: 30, y: A4_H_PT - 120, width: A4_W_PT - 60, height: 60, color: rgb(0.86, 0.15, 0.15) });
        page.drawText(`PDF: ${item.file.name}`, { x: 40, y: A4_H_PT - 90, size: 12, color: rgb(1, 1, 1) });
        page.drawText(`(файл зашифрован или повреждён)`, { x: 40, y: A4_H_PT - 115, size: 9, color: rgb(0.5, 0.5, 0.5) });
      }

    } else {
      // DOCX — добавляем информационную страницу
      const page = merged.addPage([A4_W_PT, A4_H_PT]);
      const { rgb } = await import("pdf-lib");
      page.drawRectangle({ x: 30, y: A4_H_PT - 120, width: A4_W_PT - 60, height: 60, color: rgb(0.49, 0.23, 0.93) });
      page.drawText(`DOCX: ${item.file.name}`, { x: 40, y: A4_H_PT - 85, size: 11, color: rgb(1, 1, 1) });
      const sizeMb = (item.file.size / 1024 / 1024).toFixed(1);
      page.drawText(`Размер: ${sizeMb} МБ  •  Документ Word`, { x: 40, y: A4_H_PT - 105, size: 9, color: rgb(0.9, 0.9, 0.9) });
      page.drawText(`Содержимое DOCX передаётся на анализ AI отдельно.`, { x: 40, y: A4_H_PT - 160, size: 9, color: rgb(0.4, 0.4, 0.4) });
    }
  }

  const bytes = await merged.save({ useObjectStreams: false, addDefaultPage: false });
  return new Blob([bytes], { type: "application/pdf" });
}

const QUALITY_STEPS = [85, 70, 50, 30];

async function packAllInto3Pdfs(
  items: FileItem[],
  onProgress: (p: number, label: string) => void
): Promise<{ pdfResults: PdfResult[]; docxFiles: FileItem[] }> {
  if (items.length === 0) return { pdfResults: [], docxFiles: [] };

  // DOCX передаём отдельно (бэкенд читает их нативно через python-docx)
  // PDF и фото — склеиваем в группы через pdf-lib
  const docxFiles = items.filter(i => i.kind === "docx");
  const mergeItems = items.filter(i => i.kind !== "docx"); // фото + PDF

  // Кол-во слотов для PDF-пакетов = 3 минус кол-во DOCX (макс 2 DOCX напрямую)
  const docxSlots = Math.min(docxFiles.length, MAX_PDF_COUNT - 1);
  const pdfSlots = Math.max(1, MAX_PDF_COUNT - docxSlots);
  const docxToPass = docxFiles.slice(0, docxSlots);

  let pdfResults: PdfResult[] = [];

  if (mergeItems.length > 0) {
    // Делим на группы round-robin
    const n = Math.min(pdfSlots, mergeItems.length);
    const groups: FileItem[][] = Array.from({ length: n }, () => []);
    mergeItems.forEach((item, i) => groups[i % n].push(item));

    let qualityIdx = 0;
    while (qualityIdx < QUALITY_STEPS.length) {
      const q = QUALITY_STEPS[qualityIdx];
      const built: PdfResult[] = [];
      let allOk = true;

      for (let gi = 0; gi < groups.length; gi++) {
        const pct = Math.round(5 + (qualityIdx * groups.length + gi) / (QUALITY_STEPS.length * groups.length) * 85);
        onProgress(pct, `Создаю пакет ${gi + 1}/${groups.length} (${groups[gi].length} файлов)...`);
        const blob = await buildMergedPdf(groups[gi], q);
        const sizeMb = Math.round(blob.size / 1024 / 102.4) / 10;
        // Если пакет >1.8 МБ и ещё можно пересжать фото — пробуем снова
        if (blob.size > 1.8 * 1024 * 1024 && qualityIdx < QUALITY_STEPS.length - 1) {
          allOk = false; break;
        }
        const nameMap = groups.length === 1
          ? ["package.pdf"]
          : groups.map((_, i) => `package_${i + 1}.pdf`);
        built.push({ name: nameMap[gi], blob, pageCount: groups[gi].length, sizeMb });
      }

      if (allOk || qualityIdx === QUALITY_STEPS.length - 1) { pdfResults = built; break; }
      qualityIdx++;
    }
  }

  onProgress(100, "Готово!");
  return { pdfResults, docxFiles: docxToPass };
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

    // PDF-пакеты (фото + склеенные PDF)
    for (const r of pdfResults) {
      const b64 = await new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.readAsDataURL(r.blob);
      });
      list.push({ name: r.name, b64, size: `${r.sizeMb} МБ` });
    }

    // DOCX напрямую (бэкенд читает текст через python-docx)
    for (const f of docxFiles) {
      const reader = new FileReader();
      const b64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(f.file);
      });
      list.push({ name: f.file.name, b64, size: `${Math.round(f.file.size / 1024 / 102.4) / 10} МБ` });
    }

    // Проверяем суммарный размер перед отправкой (лимит платформы ~7 МБ с overhead)
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
            <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isDragging ? "border-navy-500 bg-navy-50" : "border-slate-200 hover:border-navy-300 hover:bg-slate-50"}`}>
              <div className="w-14 h-14 rounded-2xl bg-navy-50 flex items-center justify-center">
                <Icon name="Upload" size={24} className="text-navy-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-navy-800">Перетащите файлы сюда</p>
                <p className="text-xs text-muted-foreground mt-1">или нажмите для выбора</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  {[{ icon: "Image", label: "Фото", color: "#0f4c81" }, { icon: "FileText", label: "PDF", color: "#dc2626" }, { icon: "FileSpreadsheet", label: "DOCX", color: "#7c3aed" }].map(t => (
                    <div key={t.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ background: `${t.color}12`, color: t.color }}>
                      <Icon name={t.icon as Parameters<typeof Icon>[0]["name"]} size={11} />{t.label}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">до {MAX_FILE_MB} МБ каждый · максимум {MAX_FILES} файлов</p>
              </div>
            </div>
          ) : (
            <>
              {/* Счётчики */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {images.length > 0 && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(15,76,129,0.08)", color: "#0f4c81" }}><Icon name="Image" size={11} />{images.length} фото</span>}
                  {pdfsIn.length > 0 && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}><Icon name="FileText" size={11} />{pdfsIn.length} PDF</span>}
                  {docxIn.length > 0 && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}><Icon name="FileSpreadsheet" size={11} />{docxIn.length} DOCX</span>}
                </div>
                <p className="text-[10px] text-slate-400">{files.length}/{MAX_FILES} файлов</p>
              </div>

              {/* Сетка превью */}
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
                {files.map((f, idx) => (
                  <div key={f.id} draggable onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)} onDragEnd={onDragEnd}
                    className={`relative rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing aspect-square transition-all ${dragIdx === idx ? "border-navy-400 opacity-60 scale-95" : "border-transparent hover:border-slate-200"}`}>
                    {f.preview
                      ? <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 p-1" style={{ background: `${fileColor(f.kind)}10` }}>
                          <Icon name={fileIconName(f.kind) as Parameters<typeof Icon>[0]["name"]} size={16} color={fileColor(f.kind)} />
                          <p className="text-[7px] text-slate-500 text-center truncate w-full px-0.5 leading-tight">{f.file.name.split(".").pop()?.toUpperCase()}</p>
                        </div>}
                    <div className="absolute top-0.5 left-1 text-[7px] font-bold text-white drop-shadow select-none">{idx + 1}</div>
                    <button onClick={() => removeFile(f.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center hover:bg-red-500 transition-colors">
                      <Icon name="X" size={9} className="text-white" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-navy-300 flex items-center justify-center transition-colors">
                    <Icon name="Plus" size={14} className="text-slate-400" />
                  </button>
                )}
              </div>

              {/* Пояснение */}
              {!hasResults && !converting && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs text-slate-500"
                  style={{ background: "rgba(15,76,129,0.05)", border: "1px solid rgba(15,76,129,0.1)" }}>
                  <Icon name="Info" size={13} className="text-navy-400 mt-0.5 shrink-0" />
                  <span>
                    Все {files.length} файлов будут склеены в {Math.min(3, files.length)} PDF-пакета.
                    {" "}Фото и PDF объединяются постранично.
                    {docxIn.length > 0 ? " DOCX передаются отдельно." : ""}
                    {" "}AI получит ровно {Math.min(3, files.length)} файла и проанализирует всё содержимое.
                  </span>
                </div>
              )}
            </>
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Icon name="Check" size={12} className="text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-navy-800">
                  Готово — все {files.length} файлов упакованы в {totalOut} пакета. AI прочитает всё содержимое.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Пакет</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Файлов</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Размер</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Статус</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pdfResults.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2.5 font-medium text-navy-800 max-w-[140px]">
                          <span className="flex items-center gap-1.5 truncate">
                            <Icon name="FileText" size={11} color="#dc2626" />{r.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.pageCount}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.sizeMb} МБ</td>
                        <td className="px-2 py-2.5 text-center"><span className="text-emerald-600 font-medium">✅ готов</span></td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={() => downloadOne(r.blob, r.name)} className="text-navy-600 hover:text-navy-800">
                            <Icon name="Download" size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {docxFiles.map((f, i) => (
                      <tr key={`dx-${i}`} className={i < docxFiles.length - 1 ? "border-b border-slate-100" : ""}>
                        <td className="px-3 py-2.5 font-medium text-navy-800 max-w-[140px]">
                          <span className="flex items-center gap-1.5 truncate">
                            <Icon name="FileSpreadsheet" size={11} color="#7c3aed" />{f.file.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-400">—</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{Math.round(f.file.size / 1024 / 102.4) / 10} МБ</td>
                        <td className="px-2 py-2.5 text-center"><span className="text-emerald-600 font-medium">✅ готов</span></td>
                        <td className="px-2 py-2.5" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={downloadAll}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white" }}>
                  <Icon name="Download" size={14} />
                  {totalOut === 1 ? "Скачать PDF" : "Скачать все (ZIP)"}
                </button>
                <button onClick={sendToAI} disabled={sendingToAI}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#e8a820,#f5cc5a)", color: "#0a1628" }}>
                  {sendingToAI
                    ? <><span className="w-4 h-4 border-2 border-navy-800/30 border-t-navy-800 rounded-full animate-spin" />Отправляю...</>
                    : <><Icon name="Upload" size={14} color="#0a1628" />Загрузить в чат</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Кнопка запуска */}
        {files.length > 0 && !converting && !hasResults && (
          <div className="px-5 pb-5 shrink-0">
            <button onClick={convert}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white", boxShadow: "0 4px 16px rgba(15,76,129,0.3)" }}>
              <span className="flex items-center justify-center gap-2">
                <Icon name="FileOutput" size={15} />
                Упаковать {files.length} файлов в {Math.min(3, files.length)} пакета для AI
              </span>
            </button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" multiple accept={ACCEPT_EXT} className="hidden"
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
    </div>
  );
}