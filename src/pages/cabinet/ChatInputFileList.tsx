import Icon from "@/components/ui/icon";

const MAX_FILES = 3;

interface ChatInputFileListProps {
  attachedFiles: { name: string; b64: string; size: string }[];
  typing: boolean;
  fileUploading: boolean;
  onAttachClick: () => void;
  onRemoveFile: (idx: number) => void;
}

export default function ChatInputFileList({
  attachedFiles,
  typing,
  fileUploading,
  onAttachClick,
  onRemoveFile,
}: ChatInputFileListProps) {
  const canAddMore = attachedFiles.length < MAX_FILES;

  return (
    <div className="mt-2 space-y-1.5">
      {attachedFiles.map((f, idx) => (
        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-xl">
          <div className="w-7 h-7 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
            <Icon
              name={/\.(jpg|jpeg|png)$/i.test(f.name) ? "Image" : "FileText"}
              size={13}
              className="text-navy-600"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-navy-800 truncate">
              {/^package(_\d+)?\.pdf$/i.test(f.name)
                ? `📦 Запакованные документы${f.name.includes("_") ? ` (часть ${f.name.match(/\d+/)?.[0]})` : ""}`
                : f.name}
            </p>
            <p className="text-[10px] text-muted-foreground">{f.size}</p>
          </div>
          <button
            onClick={() => onRemoveFile(idx)}
            className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
            title="Удалить файл"
          >
            <Icon name="X" size={13} />
          </button>
        </div>
      ))}
      {canAddMore ? (
        <button
          onClick={onAttachClick}
          disabled={typing || fileUploading}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-navy-500 hover:text-navy-700 border border-dashed border-navy-200 rounded-xl hover:border-navy-400 transition-colors disabled:opacity-40"
        >
          <Icon name="Plus" size={11} />
          Добавить ещё файл ({attachedFiles.length}/{MAX_FILES})
        </button>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground py-0.5">
          Максимум {MAX_FILES} файлов · до 5МБ каждый (суммарно до 7МБ)
        </p>
      )}
      {attachedFiles.some(f => /\.(jpg|jpeg|png)$/i.test(f.name)) && (
        <p className="text-[11px] text-amber-600 px-1">⚠ Фото должны быть чёткими — плохое качество снизит точность AI</p>
      )}
    </div>
  );
}
