import JSZip from "jszip";

export interface FileAttachment {
  type: "file";
  name: string;
  b64: string;
  size: number;
  mimeType: string;
}

const ZIP_THRESHOLD_BYTES = 4 * 1024 * 1024; // >4 МБ суммарно → ZIP (после сжатия укладывается в лимит платформы)

/** Возвращает суммарный размер файловых вложений в байтах */
export function totalFilesSize(attachments: FileAttachment[]): number {
  return attachments.reduce((sum, f) => sum + f.size, 0);
}

/**
 * Если суммарный размер файлов > 10 МБ — упаковывает всё в один ZIP и возвращает его как FileAttachment.
 * Иначе возвращает null (отправлять файлы как есть).
 */
export async function packToZipIfNeeded(
  files: FileAttachment[]
): Promise<FileAttachment | null> {
  if (files.length === 0) return null;
  const total = totalFilesSize(files);
  if (total <= ZIP_THRESHOLD_BYTES) return null;

  const zip = new JSZip();
  for (const f of files) {
    const binary = atob(f.b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    zip.file(f.name, bytes);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${now.getFullYear()}`;
  const zipName = `документы_${dateStr}.zip`;

  return {
    type: "file",
    name: zipName,
    b64,
    size: blob.size,
    mimeType: "application/zip",
  };
}

export { ZIP_THRESHOLD_BYTES };