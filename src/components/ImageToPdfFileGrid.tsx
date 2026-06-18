import Icon from "@/components/ui/icon";
import { MAX_FILES, fileIconName, fileColor, type FileItem } from "./imageToPdfUtils";

interface Props {
  files: FileItem[];
  dragIdx: number | null;
  hasResults: boolean;
  converting: boolean;
  images: FileItem[];
  pdfsIn: FileItem[];
  docxIn: FileItem[];
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
}

export default function ImageToPdfFileGrid({
  files, dragIdx, hasResults, converting,
  images, pdfsIn, docxIn,
  onDragStart, onDragOver, onDragEnd, onRemove, onAddClick,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {images.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(15,76,129,0.08)", color: "#0f4c81" }}>
              <Icon name="Image" size={11} />{images.length} фото
            </span>
          )}
          {pdfsIn.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
              <Icon name="FileText" size={11} />{pdfsIn.length} PDF
            </span>
          )}
          {docxIn.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>
              <Icon name="FileSpreadsheet" size={11} />{docxIn.length} DOCX
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400">{files.length}/{MAX_FILES} файлов</p>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
        {files.map((f, idx) => (
          <div
            key={f.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            className={`relative rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing aspect-square transition-all ${dragIdx === idx ? "border-navy-400 opacity-60 scale-95" : "border-transparent hover:border-slate-200"}`}
          >
            {f.preview
              ? <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 p-1" style={{ background: `${fileColor(f.kind)}10` }}>
                  <Icon name={fileIconName(f.kind) as Parameters<typeof Icon>[0]["name"]} size={16} color={fileColor(f.kind)} />
                  <p className="text-[7px] text-slate-500 text-center truncate w-full px-0.5 leading-tight">{f.file.name.split(".").pop()?.toUpperCase()}</p>
                </div>
              )}
            <div className="absolute top-0.5 left-1 text-[7px] font-bold text-white drop-shadow select-none">{idx + 1}</div>
            <button
              onClick={() => onRemove(f.id)}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <Icon name="X" size={9} className="text-white" />
            </button>
          </div>
        ))}
        {files.length < MAX_FILES && (
          <button
            onClick={onAddClick}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-navy-300 flex items-center justify-center transition-colors"
          >
            <Icon name="Plus" size={14} className="text-slate-400" />
          </button>
        )}
      </div>

      {!hasResults && !converting && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs text-slate-500"
          style={{ background: "rgba(15,76,129,0.05)", border: "1px solid rgba(15,76,129,0.1)" }}
        >
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
  );
}
