import JSZip from "jszip";

export interface FileAttachment {
  type: "file";
  name: string;
  b64: string;
  size: number;
  mimeType: string;
}

// Порог для сжатия в ZIP: если суммарно > 3 МБ → упаковываем
export const ZIP_THRESHOLD_BYTES = 3 * 1024 * 1024;

// Максимальный размер одной ZIP-части (с запасом под base64 +33% и лимит платформы ~6 МБ)
// 3 МБ raw → ~4 МБ base64 → гарантированно проходит
const ZIP_PART_MAX_BYTES = 3 * 1024 * 1024;

/** Возвращает суммарный размер файловых вложений в байтах */
export function totalFilesSize(attachments: FileAttachment[]): number {
  return attachments.reduce((sum, f) => sum + f.size, 0);
}

async function blobToB64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dateStr(): string {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1)
    .toString().padStart(2, "0")}.${now.getFullYear()}`;
}

/**
 * Упаковывает файлы в один или несколько ZIP-архивов по ~3 МБ каждый.
 * Возвращает массив FileAttachment (1 или более ZIP-файлов).
 * Если файлы <= ZIP_THRESHOLD_BYTES — возвращает null (отправлять как есть).
 */
export async function packToZipParts(
  files: FileAttachment[]
): Promise<FileAttachment[] | null> {
  if (files.length === 0) return null;
  const total = totalFilesSize(files);
  if (total <= ZIP_THRESHOLD_BYTES) return null;

  const parts: FileAttachment[] = [];
  const ds = dateStr();
  let partIndex = 1;
  let currentZip = new JSZip();
  let currentSize = 0;

  const flush = async (index: number) => {
    const blob = await currentZip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const b64 = await blobToB64(blob);
    const suffix = parts.length > 0 || files.length > 1 ? `_часть${index}` : "";
    parts.push({
      type: "file",
      name: `документы_${ds}${suffix}.zip`,
      b64,
      size: blob.size,
      mimeType: "application/zip",
    });
  };

  for (const f of files) {
    const binary = atob(f.b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Если один файл сам по себе больше лимита части — кладём его отдельно
    if (f.size > ZIP_PART_MAX_BYTES) {
      if (currentSize > 0) {
        await flush(partIndex++);
        currentZip = new JSZip();
        currentSize = 0;
      }
      const singleZip = new JSZip();
      singleZip.file(f.name, bytes);
      const blob = await singleZip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const b64 = await blobToB64(blob);
      parts.push({
        type: "file",
        name: `документы_${ds}_часть${partIndex++}.zip`,
        b64,
        size: blob.size,
        mimeType: "application/zip",
      });
      continue;
    }

    // Если добавление файла превысит лимит части — сначала сбрасываем текущий ZIP
    if (currentSize + f.size > ZIP_PART_MAX_BYTES && currentSize > 0) {
      await flush(partIndex++);
      currentZip = new JSZip();
      currentSize = 0;
    }

    currentZip.file(f.name, bytes);
    currentSize += f.size;
  }

  if (currentSize > 0) {
    await flush(partIndex);
  }

  // Если получилась только 1 часть — убираем суффикс "_часть1"
  if (parts.length === 1) {
    parts[0] = { ...parts[0], name: `документы_${ds}.zip` };
  }

  return parts;
}

/** Устаревший вариант — оставлен для совместимости, делегирует в packToZipParts */
export async function packToZipIfNeeded(
  files: FileAttachment[]
): Promise<FileAttachment | null> {
  const parts = await packToZipParts(files);
  return parts ? parts[0] : null;
}
