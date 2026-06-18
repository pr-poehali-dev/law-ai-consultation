import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import imageCompression from "browser-image-compression";

export const MAX_FILES = 10;
export const MAX_FILE_MB = 20;
export const MAX_PDF_COUNT = 3;

export const IMG_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/bmp", "image/webp", "image/gif", "image/tiff"];
export const ACCEPT_EXT = ".jpg,.jpeg,.png,.bmp,.webp,.gif,.tiff,.tif,.pdf,.docx,.doc";

export type FileKind = "image" | "pdf" | "docx";

export interface FileItem {
  id: string;
  file: File;
  kind: FileKind;
  preview: string | null;
}

export interface PdfResult {
  name: string;
  blob: Blob;
  pageCount: number;
  sizeMb: number;
}

export function getKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (IMG_TYPES.includes(file.type) || /\.(jpg|jpeg|png|bmp|webp|gif|tiff?)$/i.test(name)) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "docx";
}

export function fileIconName(kind: FileKind): string {
  if (kind === "image") return "Image";
  if (kind === "pdf") return "FileText";
  return "FileSpreadsheet";
}

export function fileColor(kind: FileKind): string {
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

async function buildMergedPdf(items: FileItem[], quality: number): Promise<Blob> {
  const merged = await PDFDocument.create();
  const A4_W_PT = 595.28, A4_H_PT = 841.89;

  for (const item of items) {
    if (item.kind === "image") {
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
      const maxPages = [8, 5, 3, 2][quality === 85 ? 0 : quality === 70 ? 1 : quality === 50 ? 2 : 3];
      try {
        const bytes = await fileToBytes(item.file);
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pageCount = srcDoc.getPageCount();
        const indices = Array.from({ length: Math.min(pageCount, maxPages) }, (_, i) => i);
        const copiedPages = await merged.copyPages(srcDoc, indices);
        copiedPages.forEach(p => merged.addPage(p));
      } catch {
        const page = merged.addPage([A4_W_PT, A4_H_PT]);
        const { rgb } = await import("pdf-lib");
        page.drawRectangle({ x: 30, y: A4_H_PT - 120, width: A4_W_PT - 60, height: 60, color: rgb(0.86, 0.15, 0.15) });
        page.drawText(`PDF: ${item.file.name}`, { x: 40, y: A4_H_PT - 90, size: 12, color: rgb(1, 1, 1) });
        page.drawText(`(файл зашифрован или повреждён)`, { x: 40, y: A4_H_PT - 115, size: 9, color: rgb(0.5, 0.5, 0.5) });
      }

    } else {
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

export async function packAllInto3Pdfs(
  items: FileItem[],
  onProgress: (p: number, label: string) => void
): Promise<{ pdfResults: PdfResult[]; docxFiles: FileItem[] }> {
  if (items.length === 0) return { pdfResults: [], docxFiles: [] };

  const docxFiles = items.filter(i => i.kind === "docx");
  const mergeItems = items.filter(i => i.kind !== "docx");

  const docxSlots = Math.min(docxFiles.length, MAX_PDF_COUNT - 1);
  const pdfSlots = Math.max(1, MAX_PDF_COUNT - docxSlots);
  const docxToPass = docxFiles.slice(0, docxSlots);

  let pdfResults: PdfResult[] = [];

  if (mergeItems.length > 0) {
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
