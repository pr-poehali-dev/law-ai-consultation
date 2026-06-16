import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";

const MAX_FILES = 10;
const MAX_FILE_MB = 20;
const MAX_PDF_MB = 5;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;
const MAX_PDFS = 3;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/bmp", "image/webp", "image/gif", "image/tiff"];
const ACCEPT_EXT = ".jpg,.jpeg,.png,.bmp,.webp,.gif,.tiff,.tif";

interface ImgFile {
  file: File;
  preview: string;
  id: string;
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

async function compressImage(file: File, quality: number): Promise<string> {
  const opt = {
    maxSizeMB: MAX_FILE_MB,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
    initialQuality: quality / 100,
    alwaysKeepResolution: false,
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

async function buildPdf(dataUrls: string[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const A4_W = 210;
  const A4_H = 297;

  for (let i = 0; i < dataUrls.length; i++) {
    if (i > 0) pdf.addPage();
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = dataUrls[i];
    });
    const isLandscape = img.width > img.height;
    const pw = isLandscape ? A4_H : A4_W;
    const ph = isLandscape ? A4_W : A4_H;
    if (isLandscape) pdf.setPage(i + 1);

    const scale = Math.min(pw / img.width, ph / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const x = (pw - dw) / 2;
    const y = (ph - dh) / 2;

    if (isLandscape) {
      const lpdf = new jsPDF({ unit: "mm", format: [ph, pw], orientation: "landscape" });
      if (i > 0 || dataUrls.length === 1) {
        // handled below per-page in single doc
      }
    }

    pdf.addImage(dataUrls[i], "JPEG", x, y, dw, dh, undefined, "FAST");
  }
  return pdf.output("blob");
}

async function buildPdfWithOrientation(dataUrls: string[]): Promise<Blob> {
  const A4_W = 210;
  const A4_H = 297;
  let pdf: jsPDF | null = null;

  for (let i = 0; i < dataUrls.length; i++) {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrls[i]; });
    const isLand = img.width > img.height;
    const pw = isLand ? A4_H : A4_W;
    const ph = isLand ? A4_W : A4_H;
    const orient = isLand ? "landscape" : "portrait";

    if (!pdf) {
      pdf = new jsPDF({ unit: "mm", format: "a4", orientation: orient });
    } else {
      pdf.addPage("a4", orient);
    }

    const scale = Math.min(pw / img.width, ph / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const x = (pw - dw) / 2;
    const y = (ph - dh) / 2;
    pdf.addImage(dataUrls[i], "JPEG", x, y, dw, dh, undefined, "FAST");
  }
  return pdf!.output("blob");
}

const QUALITY_STEPS = [85, 70, 50, 30];

async function compressAndBuildPdf(
  files: File[],
  onProgress: (p: number, label: string) => void
): Promise<PdfResult[]> {
  const totalFiles = files.length;

  // Step 1: compress all images at step 0 quality
  onProgress(5, "Сжимаю изображения...");
  let qualityIdx = 0;
  let dataUrls: string[] = [];

  const compressAll = async (q: number) => {
    const result: string[] = [];
    for (let i = 0; i < files.length; i++) {
      result.push(await compressImage(files[i], q));
      onProgress(5 + Math.round((i + 1) / totalFiles * 30), `Сжимаю ${i + 1}/${totalFiles}...`);
    }
    return result;
  };

  dataUrls = await compressAll(QUALITY_STEPS[0]);

  // Step 2: distribute into buckets greedily
  const distribute = async (): Promise<{ buckets: string[][], oversized: boolean }> => {
    const buckets: string[][] = [[]];
    let currentPdfEstimate = 0;
    const AVG_JPEG_OVERHEAD = 1.37; // base64 → binary ratio approx

    for (let i = 0; i < dataUrls.length; i++) {
      const b64Len = dataUrls[i].length - (dataUrls[i].indexOf(",") + 1);
      const estBytes = (b64Len * 3 / 4) * AVG_JPEG_OVERHEAD;

      if (currentPdfEstimate + estBytes > MAX_PDF_BYTES && buckets[buckets.length - 1].length > 0) {
        if (buckets.length < MAX_PDFS) {
          buckets.push([]);
          currentPdfEstimate = 0;
        }
      }
      buckets[buckets.length - 1].push(dataUrls[i]);
      currentPdfEstimate += estBytes;
    }
    return { buckets, oversized: false };
  };

  // Step 3: try building PDFs, recompress if needed
  let results: PdfResult[] = [];
  let oversizedWarning = false;

  while (qualityIdx < QUALITY_STEPS.length) {
    const q = QUALITY_STEPS[qualityIdx];
    if (qualityIdx > 0) {
      onProgress(35 + qualityIdx * 10, `Повторное сжатие (${q}%)...`);
      dataUrls = await compressAll(q);
    }

    const { buckets } = await distribute();
    onProgress(70, "Создаю PDF...");

    results = [];
    oversizedWarning = false;
    const nameMap = buckets.length === 1
      ? ["converted.pdf"]
      : buckets.map((_, i) => `converted_part${i + 1}.pdf`);

    let allFit = true;
    for (let bi = 0; bi < buckets.length; bi++) {
      const blob = await buildPdfWithOrientation(buckets[bi]);
      const sizeMb = blob.size / (1024 * 1024);
      const oversized = blob.size > MAX_PDF_BYTES;
      if (oversized && qualityIdx < QUALITY_STEPS.length - 1) {
        allFit = false;
        break;
      }
      if (oversized) oversizedWarning = true;
      results.push({ name: nameMap[bi], blob, pages: buckets[bi].length, sizeMb: Math.round(sizeMb * 10) / 10, oversized });
      onProgress(70 + Math.round((bi + 1) / buckets.length * 25), `Обрабатываю PDF ${bi + 1}/${buckets.length}...`);
    }
    if (allFit || qualityIdx === QUALITY_STEPS.length - 1) break;
    qualityIdx++;
  }

  onProgress(100, "Готово!");
  return results;
}

export default function ImageToPdfConverter({ onClose, onSendToAI }: Props) {
  const [files, setFiles] = useState<ImgFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [results, setResults] = useState<PdfResult[]>([]);
  const [error, setError] = useState("");
  const [oversizedDialog, setOversizedDialog] = useState(false);
  const [pendingResults, setPendingResults] = useState<PdfResult[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [sendingToAI, setSendingToAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    setError("");
    const valid = incoming.filter(f => {
      if (!ACCEPTED.includes(f.type)) return false;
      if (f.size > MAX_FILE_MB * 1024 * 1024) return false;
      return true;
    });
    setFiles(prev => {
      const combined = [...prev];
      for (const f of valid) {
        if (combined.length >= MAX_FILES) break;
        const id = Math.random().toString(36).slice(2);
        const preview = URL.createObjectURL(f);
        combined.push({ file: f, preview, id });
      }
      if (combined.length >= MAX_FILES && incoming.length > MAX_FILES - prev.length) {
        setError(`Максимум ${MAX_FILES} файлов`);
      }
      return combined;
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (id: string) => {
    setFiles(prev => { const f = prev.find(x => x.id === id); if (f) URL.revokeObjectURL(f.preview); return prev.filter(x => x.id !== id); });
    setResults([]);
  };

  // Drag-to-reorder
  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFiles(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      setDragIdx(idx);
      return arr;
    });
  };
  const onDragEnd = () => setDragIdx(null);

  const convert = async () => {
    if (files.length === 0) return;
    setConverting(true); setResults([]); setError(""); setProgress(0);
    try {
      const res = await compressAndBuildPdf(
        files.map(f => f.file),
        (p, label) => { setProgress(p); setProgressLabel(label); }
      );
      const hasOversized = res.some(r => r.oversized);
      if (hasOversized) {
        setPendingResults(res);
        setOversizedDialog(true);
      } else {
        setResults(res);
      }
    } catch (e) {
      setError("Ошибка конвертации: " + (e instanceof Error ? e.message : String(e)));
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
    if (results.length === 1) { downloadOne(results[0]); return; }
    const zip = new JSZip();
    for (const r of results) zip.file(r.name, r.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "converted_pdfs.zip"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sendToAI = async () => {
    setSendingToAI(true);
    const list: { name: string; b64: string; size: string }[] = [];
    for (const r of results) {
      const b64 = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => {
          const full = reader.result as string;
          res(full.split(",")[1]);
        };
        reader.readAsDataURL(r.blob);
      });
      list.push({ name: r.name, b64, size: `${r.sizeMb} МБ` });
    }
    onSendToAI(list);
    setSendingToAI(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[95svh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <Icon name="FileImage" size={18} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-navy-900">Конвертор изображений в PDF</p>
              <p className="text-[11px] text-muted-foreground">До {MAX_FILES} файлов · до {MAX_PDF_MB} МБ на PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
            <Icon name="X" size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          {/* Drop zone */}
          {files.length === 0 ? (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isDragging ? "border-navy-500 bg-navy-50" : "border-slate-200 hover:border-navy-300 hover:bg-slate-50"}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-navy-50 flex items-center justify-center">
                <Icon name="Upload" size={24} className="text-navy-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-navy-800">Перетащите изображения сюда</p>
                <p className="text-xs text-muted-foreground mt-1">или нажмите для выбора файлов</p>
                <p className="text-[11px] text-slate-400 mt-2">JPEG · PNG · BMP · WEBP · GIF · TIFF · до {MAX_FILE_MB} МБ каждый</p>
              </div>
            </div>
          ) : (
            <>
              {/* Миниатюры */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-navy-700">Изображения <span className="text-slate-400">({files.length}/{MAX_FILES})</span></p>
                  <p className="text-[10px] text-slate-400">Перетащите для сортировки</p>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {files.map((f, idx) => (
                    <div key={f.id}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={e => onDragOver(e, idx)}
                      onDragEnd={onDragEnd}
                      className={`relative rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all aspect-square ${dragIdx === idx ? "border-navy-400 opacity-60 scale-95" : "border-transparent hover:border-navy-200"}`}
                    >
                      <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
                      <div className="absolute top-0.5 left-1 text-[9px] font-bold text-white drop-shadow">{idx + 1}</div>
                      <button
                        onClick={() => removeFile(f.id)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
                        style={{ opacity: 1 }}
                      >
                        <Icon name="X" size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                  {files.length < MAX_FILES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-navy-300 flex items-center justify-center transition-colors"
                    >
                      <Icon name="Plus" size={18} className="text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <Icon name="AlertCircle" size={14} className="text-red-500 shrink-0" />
              {error}
            </div>
          )}

          {/* Прогресс */}
          {converting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-navy-700 font-medium">{progressLabel}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg,#0f4c81,#1a6bb5)" }}
                />
              </div>
            </div>
          )}

          {/* Результаты */}
          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-navy-700">Результат конвертации</p>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Файл</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Стр.</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Размер</th>
                      <th className="text-center px-2 py-2 text-slate-500 font-medium">Статус</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className={i < results.length - 1 ? "border-b border-slate-100" : ""}>
                        <td className="px-3 py-2.5 font-medium text-navy-800 truncate max-w-[120px]">{r.name}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.pages}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.sizeMb} МБ</td>
                        <td className="px-2 py-2.5 text-center">
                          {r.oversized
                            ? <span className="text-amber-600 font-medium">⚠ {r.sizeMb} МБ</span>
                            : <span className="text-emerald-600 font-medium">✅</span>}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={() => downloadOne(r)} className="text-navy-600 hover:text-navy-800 transition-colors">
                            <Icon name="Download" size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Кнопки */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={downloadAll}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white" }}
                >
                  <Icon name="Download" size={14} />
                  {results.length === 1 ? "Скачать PDF" : "Скачать все (ZIP)"}
                </button>
                <button
                  onClick={sendToAI}
                  disabled={sendingToAI}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#e8a820,#f5cc5a)", color: "#0a1628" }}
                >
                  {sendingToAI
                    ? <><span className="w-4 h-4 border-2 border-navy-800/30 border-t-navy-800 rounded-full animate-spin" />Отправляю...</>
                    : <><Icon name="Bot" size={14} color="#0a1628" />Отправить на анализ AI</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Нижняя панель с кнопкой */}
        {files.length > 0 && !converting && results.length === 0 && (
          <div className="px-5 pb-5 shrink-0">
            <button
              onClick={convert}
              disabled={files.length === 0}
              className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white", boxShadow: "0 4px 16px rgba(15,76,129,0.3)" }}
            >
              <span className="flex items-center justify-center gap-2">
                <Icon name="FileOutput" size={15} />
                Конвертировать в PDF ({files.length} фото)
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Диалог oversized */}
      {oversizedDialog && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Icon name="AlertTriangle" size={18} className="text-amber-500" />
              </div>
              <p className="text-sm font-bold text-navy-900">Некоторые PDF превышают 5 МБ</p>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Даже при минимальном сжатии не удалось уложиться в 5 МБ. Скачать файлы как есть?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setOversizedDialog(false); setPendingResults([]); }}
                className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >Отмена</button>
              <button
                onClick={() => { setResults(pendingResults); setOversizedDialog(false); setPendingResults([]); }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
              >Скачать как есть</button>
            </div>
          </div>
        </div>
      )}

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
