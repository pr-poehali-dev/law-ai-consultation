import Icon from "@/components/ui/icon";
import { MAX_FILE_MB, MAX_FILES } from "./imageToPdfUtils";

interface Props {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export default function ImageToPdfDropZone({ isDragging, onDragOver, onDragLeave, onDrop, onClick }: Props) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isDragging ? "border-navy-500 bg-navy-50" : "border-slate-200 hover:border-navy-300 hover:bg-slate-50"}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-navy-50 flex items-center justify-center">
        <Icon name="Upload" size={24} className="text-navy-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-navy-800">Перетащите файлы сюда</p>
        <p className="text-xs text-muted-foreground mt-1">или нажмите для выбора</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          {[
            { icon: "Image", label: "Фото", color: "#0f4c81" },
            { icon: "FileText", label: "PDF", color: "#dc2626" },
            { icon: "FileSpreadsheet", label: "DOCX", color: "#7c3aed" },
          ].map(t => (
            <div
              key={t.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
              style={{ background: `${t.color}12`, color: t.color }}
            >
              <Icon name={t.icon as Parameters<typeof Icon>[0]["name"]} size={11} />
              {t.label}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">до {MAX_FILE_MB} МБ каждый · максимум {MAX_FILES} файлов</p>
      </div>
    </div>
  );
}
