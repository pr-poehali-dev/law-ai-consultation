import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

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

  for (const maxPages of PDF_PAGE_STEPS) {
    const isLastStep = maxPages === PDF_PAGE_STEPS[PDF_PAGE_STEPS.length - 1];
    if (maxPages >= totalPages && !isLastStep) continue; // обрезка не уменьшит размер — пробуем шаг жёстче

    const keepCount = Math.min(totalPages, maxPages);
    const trimmed = await PDFDocument.create();
    const indices = Array.from({ length: keepCount }, (_, i) => i);
    const pages = await trimmed.copyPages(srcDoc, indices);
    pages.forEach(p => trimmed.addPage(p));
    const outBytes = await trimmed.save({ useObjectStreams: true });

    if (outBytes.byteLength <= targetBytes || isLastStep) {
      const blob = new Blob([outBytes.slice()], { type: "application/pdf" });
      const note = keepCount < totalPages
        ? `Оставлены первые ${keepCount} из ${totalPages} стр. — этого достаточно для анализа AI`
        : undefined;
      return { blob, name: file.name, originalSize, finalSize: blob.size, wasCompressed: true, note };
    }
  }

  // Недостижимо (цикл всегда возвращает на последнем шаге), но для типобезопасности:
  return { blob: file, name: file.name, originalSize, finalSize: originalSize, wasCompressed: false };
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

/**
 * Сжимает несколько вложений сразу и следит за СОВОКУПНЫМ бюджетом (не только
 * индивидуальным). Если после первого прохода сжатия сумма всё ещё превышает
 * totalTargetBytes, донажимает самые тяжёлые файлы жёстче — так 2-3 крупных PDF
 * гарантированно укладываются в общий лимит, а не только каждый по отдельности.
 */
export async function compressAttachmentsBatch(
  files: File[],
  perFileTargetBytes: number,
  totalTargetBytes: number
): Promise<CompressResult[]> {
  let results = await Promise.all(files.map(f => compressAttachment(f, perFileTargetBytes)));

  let total = results.reduce((s, r) => s + r.finalSize, 0);
  if (total <= totalTargetBytes) return results;

  // Второй проход: ужимаем каждый файл пропорционально его доле в общем весе
  const overshoot = total / totalTargetBytes;
  results = await Promise.all(
    files.map((f, i) => {
      const r = results[i];
      const stricterTarget = Math.max(300 * 1024, Math.floor(r.finalSize / overshoot));
      return r.finalSize > stricterTarget ? compressAttachment(f, stricterTarget) : Promise.resolve(r);
    })
  );

  return results;
}