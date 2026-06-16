import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";

const MAX_FILES = 20;
const MAX_FILE_MB = 20;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
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
  pages: number;
  sizeMb: number;
  oversized: boolean;
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// Строит один PDF из группы файлов:
// - изображения → JPEG-страницы (масштаб A4)
// - PDF/DOCX → текстовая страница-обложка с именем файла + данные вложены в PDF как вложение
async function buildGroupPdf(items: FileItem[], quality: number): Promise<Blob> {
  const A4_W = 210, A4_H = 297;
  let pdf: jsPDF | null = null;

  for (const item of items) {
    if (item.kind === "image") {
      const dataUrl = await compressImage(item.file, quality);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      const isLand = img.width > img.height;
      const pw = isLand ? A4_H : A4_W;
      const ph = isLand ? A4_W : A4_H;
      const orient = isLand ? "landscape" : "portrait";
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: "a4", orientation: orient });
      else pdf.addPage("a4", orient);
      const scale = Math.min(pw / img.width, ph / img.height);
      pdf.addImage(dataUrl, "JPEG", (pw - img.width * scale) / 2, (ph - img.height * scale) / 2, img.width * scale, img.height * scale, undefined, "FAST");
    } else {
      // DOCX/PDF → страница с описанием (бэкенд получит оригинал отдельно)
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      else pdf.addPage("a4", "portrait");

      const ext = item.kind === "pdf" ? "PDF" : "DOCX";
      const color = item.kind === "pdf" ? [220, 38, 38] : [124, 58, 237];

      // Цветной блок-заголовок
      pdf.setFillColor(...(color as [number, number, number]));
      pdf.roundedRect(10, 20, 190, 16, 3, 3, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${ext}-документ: ${item.file.name}`, 15, 30, { maxWidth: 180 });

      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const sizeMb = (item.file.size / 1024 / 1024).toFixed(1);
      pdf.text([
        `Размер: ${sizeMb} МБ`,
        `Формат: ${ext}`,
        `Этот документ передаётся на анализ AI в исходном формате.`,
        `AI-юрист прочитает его текст и даст правовую оценку.`,
      ], 15, 46, { lineHeightFactor: 1.8 });
    }
  }
  return pdf ? pdf.output("blob") : new Blob([], { type: "application/pdf" });
}

const QUALITY_STEPS = [85, 70, 50, 30];

// Результат упаковки: PDF-пакеты из фото + оригинальные DOCX/PDF для прямой передачи
interface PackResult {
  pdfResults: PdfResult[];           // конвертированные фото-PDF
  passthroughFiles: FileItem[];      // DOCX/PDF — передаются напрямую бэкенду
}

async function packAllInto3Pdfs(
  items: FileItem[],
  onProgress: (p: number, label: string) => void
): Promise<PackResult> {
  const images = items.filter(i => i.kind === "image");
  const docs = items.filter(i => i.kind !== "image"); // PDF и DOCX

  // Слоты для фото = 3 минус кол-во документов (но не больше 3 и не меньше 0)
  const docSlots = Math.min(docs.length, MAX_PDF_COUNT);
  const imgSlots = Math.max(0, MAX_PDF_COUNT - docSlots);

  // Документы — первые docSlots штук (остальные отбрасываем, предупреждение в UI)
  const passthroughFiles = docs.slice(0, docSlots);

  // Фото — упаковываем в imgSlots PDF-файлов
  let pdfResults: PdfResult[] = [];

  if (images.length > 0 && imgSlots > 0) {
    const n = Math.min(imgSlots, images.length);
    const groups: FileItem[][] = Array.from({ length: n }, () => []);
    images.forEach((img, i) => groups[i % n].push(img));

    let qualityIdx = 0;
    while (qualityIdx < QUALITY_STEPS.length) {
      const q = QUALITY_STEPS[qualityIdx];
      onProgress(5 + qualityIdx * 10, `Конвертирую фото (качество ${q}%)...`);
      const built: PdfResult[] = [];
      let allFit = true;

      for (let gi = 0; gi < groups.length; gi++) {
        onProgress(5 + qualityIdx * 10 + Math.round(((gi + 1) / groups.length) * 45), `Создаю пакет фото ${gi + 1}/${groups.length}...`);
        // Только изображения в PDF (buildGroupPdf без DOCX/PDF)
        const blob = await buildGroupPdf(groups[gi].filter(f => f.kind === "image"), q);
        const sizeMb = Math.round(blob.size / 1024 / 102.4) / 10;
        const oversized = blob.size > MAX_PDF_BYTES;
        if (oversized && qualityIdx < QUALITY_STEPS.length - 1) { allFit = false; break; }
        const nameMap = groups.length === 1
          ? ["photos.pdf"]
          : groups.map((_, i) => `photos_part${i + 1}.pdf`);
        built.push({ name: nameMap[gi], blob, pages: groups[gi].length, sizeMb, oversized });
      }

      if (allFit || qualityIdx === QUALITY_STEPS.length - 1) { pdfResults = built; break; }
      qualityIdx++;
    }
  }

  onProgress(95, "Готово!");
  return { pdfResults, passthroughFiles };
}

export default function ImageToPdfConverter({ onClose, onSendToAI }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [pdfResults, setPdfResults] = useState<PdfResult[]>([]);
  const [passthroughFiles, setPassthroughFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [sendingToAI, setSendingToAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPdfResults([]); setPassthroughFiles([]);
  }, []);

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); };
  const removeFile = (id: string) => {
    setFiles(prev => { const f = prev.find(x => x.id === id); if (f?.preview) URL.revokeObjectURL(f.preview); return prev.filter(x => x.id !== id); });
    setPdfResults([]); setPassthroughFiles([]);
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
    setConverting(true); setPdfResults([]); setPassthroughFiles([]); setError(""); setProgress(0);
    try {
      const { pdfResults: pr, passthroughFiles: pt } = await packAllInto3Pdfs(files, (p, l) => { setProgress(p); setProgressLabel(l); });
      setPdfResults(pr);
      setPassthroughFiles(pt);
      setProgress(100); setProgressLabel("Готово!");
    } catch (e) {
      setError("Ошибка: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setConverting(false);
    }
  };

  const downloadOne = (r: PdfResult) => {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a"); a.href = url; a.download = r.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAll = async () => {
    if (pdfResults.length === 1 && passthroughFiles.length === 0) { downloadOne(pdfResults[0]); return; }
    const zip = new JSZip();
    for (const r of pdfResults) zip.file(r.name, r.blob);
    for (const f of passthroughFiles) zip.file(f.file.name, f.file);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "documents.zip"; a.click();
  };

  const sendToAI = async () => {
    setSendingToAI(true);
    const list: { name: string; b64: string; size: string }[] = [];

    // Сначала оригинальные DOCX/PDF (бэкенд читает текст нативно)
    for (const f of passthroughFiles) {
      const du = await fileToDataUrl(f.file);
      const sizeMb = Math.round(f.file.size / 1024 / 102.4) / 10;
      list.push({ name: f.file.name, b64: du.split(",")[1], size: `${sizeMb} МБ` });
    }

    // Затем конвертированные PDF из фото
    for (const r of pdfResults) {
      const b64 = await new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.readAsDataURL(r.blob);
      });
      list.push({ name: r.name, b64, size: `${r.sizeMb} МБ` });
    }

    onSendToAI(list.slice(0, 3));
    setSendingToAI(false);
    onClose();
  };

  const images = files.filter(f => f.kind === "image");
  const pdfsIn = files.filter(f => f.kind === "pdf");
  const docxIn = files.filter(f => f.kind === "docx");
  const hasImages = images.length > 0;
  const totalOut = pdfResults.length + passthroughFiles.length;

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
              <p className="text-[11px] text-muted-foreground">До {MAX_FILES} файлов → 3 пакета → анализ AI</p>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {hasImages && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(15,76,129,0.08)", color: "#0f4c81" }}><Icon name="Image" size={11} />{images.length} фото</span>}
                  {pdfsIn.length > 0 && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}><Icon name="FileText" size={11} />{pdfsIn.length} PDF</span>}
                  {docxIn.length > 0 && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}><Icon name="FileSpreadsheet" size={11} />{docxIn.length} DOCX</span>}
                </div>
                <p className="text-[10px] text-slate-400">{files.length}/{MAX_FILES}</p>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {files.map((f, idx) => (
                  <div key={f.id} draggable onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)} onDragEnd={onDragEnd}
                    className={`relative rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing aspect-square transition-all ${dragIdx === idx ? "border-navy-400 opacity-60 scale-95" : "border-transparent hover:border-slate-200"}`}>
                    {f.preview
                      ? <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1" style={{ background: `${fileColor(f.kind)}10` }}>
                          <Icon name={fileIconName(f.kind) as Parameters<typeof Icon>[0]["name"]} size={18} color={fileColor(f.kind)} />
                          <p className="text-[8px] text-slate-500 text-center truncate w-full px-1 leading-tight">{f.file.name.split(".").pop()?.toUpperCase()}</p>
                        </div>}
                    <div className="absolute top-0.5 left-1 text-[8px] font-bold text-white drop-shadow select-none">{idx + 1}</div>
                    <button onClick={() => removeFile(f.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center hover:bg-red-500 transition-colors">
                      <Icon name="X" size={9} className="text-white" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-navy-300 flex items-center justify-center transition-colors">
                    <Icon name="Plus" size={16} className="text-slate-400" />
                  </button>
                )}
              </div>

              {/* Схема упаковки */}
              {pdfResults.length === 0 && passthroughFiles.length === 0 && !converting && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs text-slate-500"
                  style={{ background: "rgba(15,76,129,0.05)", border: "1px solid rgba(15,76,129,0.1)" }}>
                  <Icon name="Info" size={13} className="text-navy-400 mt-0.5 shrink-0" />
                  <span>
                    {images.length > 0 && (pdfsIn.length + docxIn.length) > 0
                      ? `Фото (${images.length} шт.) → сгруппируются в PDF. PDF/DOCX (${pdfsIn.length + docxIn.length} шт.) → передадутся напрямую. AI получит до 3 файлов.`
                      : images.length > 0
                        ? `${images.length} фото → сгруппируются в до ${Math.min(3, images.length)} PDF для анализа AI.`
                        : `${pdfsIn.length + docxIn.length} документов → AI прочитает их текст напрямую (до 3 файлов).`}
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
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(90deg,#0f4c81,#1a6bb5)" }} />
              </div>
            </div>
          )}

          {(pdfResults.length > 0 || passthroughFiles.length > 0) && !converting && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-navy-700">Готово к отправке — AI получит {totalOut} файла</p>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Файл</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Страниц</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Размер</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Статус</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {/* Оригинальные DOCX/PDF (AI читает текст нативно) */}
                    {passthroughFiles.map((f, i) => (
                      <tr key={`pt-${i}`} className="border-b border-slate-100">
                        <td className="px-3 py-2.5 font-medium text-navy-800 max-w-[140px]">
                          <span className="flex items-center gap-1.5 truncate">
                            <Icon name={fileIconName(f.kind) as Parameters<typeof Icon>[0]["name"]} size={11} color={fileColor(f.kind)} />
                            {f.file.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-400">—</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{Math.round(f.file.size / 1024 / 102.4) / 10} МБ</td>
                        <td className="px-2 py-2.5 text-center"><span className="text-emerald-600 text-[10px] font-medium">✅ читает текст</span></td>
                        <td className="px-2 py-2.5" />
                      </tr>
                    ))}
                    {/* Конвертированные PDF из фото */}
                    {pdfResults.map((r, i) => (
                      <tr key={`pdf-${i}`} className={i < pdfResults.length - 1 ? "border-b border-slate-100" : ""}>
                        <td className="px-3 py-2.5 font-medium text-navy-800 max-w-[140px]">
                          <span className="flex items-center gap-1.5 truncate">
                            <Icon name="Image" size={11} color="#0f4c81" />{r.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.pages} фото</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.sizeMb} МБ</td>
                        <td className="px-2 py-2.5 text-center">{r.oversized ? <span className="text-amber-600">⚠ &gt;5МБ</span> : <span className="text-emerald-600">✅ готов</span>}</td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={() => downloadOne(r)} className="text-navy-600 hover:text-navy-800"><Icon name="Download" size={13} /></button>
                        </td>
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
                  {totalOut === 1 ? "Скачать" : "Скачать все (ZIP)"}
                </button>
                <button onClick={sendToAI} disabled={sendingToAI}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#e8a820,#f5cc5a)", color: "#0a1628" }}>
                  {sendingToAI
                    ? <><span className="w-4 h-4 border-2 border-navy-800/30 border-t-navy-800 rounded-full animate-spin" />Отправляю...</>
                    : <><Icon name="Bot" size={14} color="#0a1628" />Отправить на анализ AI</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {files.length > 0 && !converting && pdfResults.length === 0 && passthroughFiles.length === 0 && (
          <div className="px-5 pb-5 shrink-0">
            <button onClick={convert}
              className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white", boxShadow: "0 4px 16px rgba(15,76,129,0.3)" }}>
              <span className="flex items-center justify-center gap-2">
                <Icon name="FileOutput" size={15} />
                Подготовить {files.length} {files.length === 1 ? "файл" : files.length < 5 ? "файла" : "файлов"} для анализа AI
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