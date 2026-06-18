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
