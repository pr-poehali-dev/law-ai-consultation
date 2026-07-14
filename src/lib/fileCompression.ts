import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import type * as PdfJsLib from "pdfjs-dist";

let _pdfjsLibPromise: Promise<typeof PdfJsLib> | null = null;
// pdfjs-dist грузится динамически (отдельным чанком) — нужен только для растрового
// сжатия сканов, которое требуется редко, не стоит тянуть его в основной бандл.
async function loadPdfJs(): Promise<typeof PdfJsLib> {
  if (!_pdfjsLibPromise) {
    _pdfjsLibPromise = (async () => {
      const lib = await import("pdfjs-dist");
      // @ts-expect-error — Vite ?url импорт воркера, типов у него нет
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return _pdfjsLibPromise;
}

/**
 * Автоматическое сжатие вложений (PDF/DOCX) перед отправкой на backend,
 * чтобы уложиться в допустимый размер, не потерять суть документа и не
 * упереться в таймаут AI-анализа. Работает полностью в браузере, без
 * дополнительных npm-пакетов (pdf-lib и jszip уже используются в проекте).
 */

export interface CompressResult {
  blob: Blob;
  name: string;
  originalSize: number;
  finalSize: number;
  wasCompressed: boolean;
  /** Короткое пояснение что именно было сжато — показывается пользователю */
  note?: string;
}

// Backend (ai-docs) читает из PDF только первые 15 страниц / 8000 символов —
// страницы сверх этого лимита AI всё равно не увидит, поэтому их отсечение
// не теряет смысл документа, а лишь убирает бесполезный вес.
const PDF_PAGE_STEPS = [40, 25, 15, 10, 6];

/**
 * Растровое сжатие PDF: рендерит каждую страницу в JPEG сниженного качества
 * и собирает новый PDF из картинок. Единственный способ реально уменьшить вес
 * PDF-сканов (фото/скан документа) — там вес сидит в разрешении картинок,
 * а не в количестве страниц, поэтому обрезка страниц (compressPdf) не спасает.
 */
async function rasterCompressPdf(file: File, targetBytes: number, maxPages: number): Promise<CompressResult> {
  const originalSize = file.size;
  const QUALITY_STEPS: { quality: number; scale: number }[] = [
    { quality: 0.6, scale: 1.3 },
    { quality: 0.45, scale: 1.1 },
    { quality: 0.35, scale: 0.9 },
    { quality: 0.25, scale: 0.75 },
  ];

  let pdf: PdfJsLib.PDFDocumentProxy;
  try {
    const pdfjsLib = await loadPdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  } catch {
    return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
  }

  const pageCount = Math.min(pdf.numPages, maxPages);
  let lastBlob: Blob | null = null;

  for (let s = 0; s < QUALITY_STEPS.length; s++) {
    const { quality, scale } = QUALITY_STEPS[s];
    const isLastStep = s === QUALITY_STEPS.length - 1;
    let out: jsPDF | null = null;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      const isLand = canvas.width > canvas.height;
      const pw = isLand ? 297 : 210, ph = isLand ? 210 : 297;
      if (!out) {
        out = new jsPDF({ unit: "mm", format: "a4", orientation: isLand ? "landscape" : "portrait" });
      } else {
        out.addPage([pw, ph], isLand ? "landscape" : "portrait");
      }
      const imgScale = Math.min(pw / canvas.width, ph / canvas.height);
      out.addImage(dataUrl, "JPEG", (pw - canvas.width * imgScale) / 2, (ph - canvas.height * imgScale) / 2, canvas.width * imgScale, canvas.height * imgScale, undefined, "FAST");
    }

    if (!out) continue;
    const blob = out.output("blob");
    lastBlob = blob;
    if (blob.size <= targetBytes || isLastStep) {
      const note = pageCount < pdf.numPages
        ? `Отсканированный PDF сжат (кач-во снижено, оставлены первые ${pageCount} из ${pdf.numPages} стр.) — текст остаётся читаемым для AI`
        : `Отсканированный PDF сжат снижением качества изображений — текст остаётся читаемым для AI`;
      return { blob, name: file.name, originalSize, finalSize: blob.size, wasCompressed: true, note };
    }
  }

  return { blob: lastBlob || file, name: file.name, originalSize, finalSize: (lastBlob || file).size, wasCompressed: true };
}

async function compressPdf(file: File, targetBytes: number): Promise<CompressResult> {
  const originalSize = file.size;
  if (originalSize <= targetBytes) {
    return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
  }

  let srcDoc: PDFDocument;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    // Не удалось разобрать PDF на клиенте — отправляем как есть, backend разберётся сам
    return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
  }

  const totalPages = srcDoc.getPageCount();
  let bestResult: CompressResult | null = null;

  for (const maxPages of PDF_PAGE_STEPS) {
    const isLastStep = maxPages === PDF_PAGE_STEPS[PDF_PAGE_STEPS.length - 1];
    if (maxPages >= totalPages && !isLastStep) continue; // обрезка не уменьшит размер — пробуем шаг жёстче

    const keepCount = Math.min(totalPages, maxPages);
    const trimmed = await PDFDocument.create();
    const indices = Array.from({ length: keepCount }, (_, i) => i);
    const pages = await trimmed.copyPages(srcDoc, indices);
    pages.forEach(p => trimmed.addPage(p));
    const outBytes = await trimmed.save({ useObjectStreams: true });

    if (outBytes.byteLength <= targetBytes) {
      const blob = new Blob([outBytes.slice()], { type: "application/pdf" });
      const note = keepCount < totalPages
        ? `Оставлены первые ${keepCount} из ${totalPages} стр. — этого достаточно для анализа AI`
        : undefined;
      return { blob, name: file.name, originalSize, finalSize: blob.size, wasCompressed: true, note };
    }
    if (isLastStep) {
      bestResult = { blob: new Blob([outBytes.slice()], { type: "application/pdf" }), name: file.name, originalSize, finalSize: outBytes.byteLength, wasCompressed: keepCount < totalPages };
    }
  }

  // Обрезка страниц не дала нужного размера (типично для сканов — вес в качестве
  // картинок, а не в числе страниц) — досжимаем растрово через рендер + JPEG.
  if (bestResult && bestResult.finalSize > targetBytes) {
    return rasterCompressPdf(file, targetBytes, Math.min(totalPages, PDF_PAGE_STEPS[PDF_PAGE_STEPS.length - 1]));
  }

  return bestResult || { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
}

async function stripDocxMedia(file: File, targetBytes: number): Promise<CompressResult> {
  const originalSize = file.size;
  if (originalSize <= targetBytes) {
    return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
  }

  try {
    const zip = await JSZip.loadAsync(file);
    const mediaFiles = Object.keys(zip.files).filter(
      p => p.startsWith("word/media/") || p.startsWith("word/embeddings/")
    );
    if (mediaFiles.length === 0) {
      return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
    }
    mediaFiles.forEach(p => zip.remove(p));
    const outBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    // Backend читает из DOCX только текст параграфов/таблиц — картинки и вложенные
    // объекты на анализ не влияют, их удаление абсолютно безопасно для смысла документа.
    const note = `Изображения внутри Word-файла удалены (${mediaFiles.length} шт.) — на анализ текста это не влияет`;
    return { blob: outBlob, name: file.name, originalSize, finalSize: outBlob.size, wasCompressed: true, note };
  } catch {
    return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
  }
}

/** Сжимает вложение до targetBytes, если это возможно для данного формата. */
export async function compressAttachment(file: File, targetBytes: number): Promise<CompressResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return compressPdf(file, targetBytes);
  if (ext === "docx") return stripDocxMedia(file, targetBytes);
  // Старый бинарный .doc — безопасно модифицировать на клиенте нельзя, отправляем как есть
  return { blob: file, name: file.name, originalSize: file.size, finalSize: file.size, wasCompressed: false };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// Ограничение платформы poehali.dev на загрузку документов — совокупный вес вложений
// (сырые байты, до base64) должен укладываться в этот бюджет. Backend анализирует лишь
// первые страницы/символы независимо от веса файла, поэтому таймаут в 150 сек тут ни при
// чём — узкое место именно приём/передача тела запроса, а не скорость AI-анализа.
export const PLATFORM_TOTAL_LIMIT_MB = 10;

export interface BatchCompressResult {
  results: CompressResult[];
  totalFinalSize: number;
  /** true — даже после максимального сжатия сумма вложений больше лимита платформы */
  exceeded: boolean;
}

/**
 * Сжимает вложения ТОЛЬКО если их совокупный вес превышает лимит платформы —
 * если сумма и так укладывается, файлы возвращаются как есть без изменений.
 * При превышении — сжимает в несколько раундов, следя за СОВОКУПНЫМ бюджетом
 * (а не только индивидуальным), донажимая самые тяжёлые файлы жёстче. Если даже
 * после этого сумма больше лимита — возвращает exceeded=true, чтобы UI показал
 * пользователю понятную ошибку вместо тихого обрезания или падения на backend.
 */
export async function compressAttachmentsBatch(
  files: File[],
  totalTargetBytes: number = PLATFORM_TOTAL_LIMIT_MB * 1024 * 1024
): Promise<BatchCompressResult> {
  const totalOriginal = files.reduce((s, f) => s + f.size, 0);
  if (totalOriginal <= totalTargetBytes) {
    const results = files.map(f => ({ blob: f as Blob, name: f.name, originalSize: f.size, finalSize: f.size, wasCompressed: false }));
    return { results, totalFinalSize: totalOriginal, exceeded: false };
  }

  const perFileTarget = Math.floor(totalTargetBytes / files.length);
  let results = await Promise.all(files.map(f => compressAttachment(f, perFileTarget)));
  let total = results.reduce((s, r) => s + r.finalSize, 0);

  // До 3 донажимов — каждый раз ужимаем самые тяжёлые файлы пропорционально перевесу
  const MIN_TARGET_BYTES = 250 * 1024;
  for (let attempt = 0; attempt < 3 && total > totalTargetBytes; attempt++) {
    const overshoot = total / totalTargetBytes;
    results = await Promise.all(
      files.map((f, i) => {
        const r = results[i];
        const stricterTarget = Math.max(MIN_TARGET_BYTES, Math.floor(r.finalSize / overshoot));
        return r.finalSize > stricterTarget ? compressAttachment(f, stricterTarget) : Promise.resolve(r);
      })
    );
    total = results.reduce((s, r) => s + r.finalSize, 0);
  }

  return { results, totalFinalSize: total, exceeded: total > totalTargetBytes };
}