import Icon from "@/components/ui/icon";

const MAX_FILES = 3;

interface ChatInputDragOverlayProps {
  isDragging: boolean;
}

export default function ChatInputDragOverlay({ isDragging }: ChatInputDragOverlayProps) {
  if (!isDragging) return null;
  return (
    <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-navy-400 bg-navy-50/95 flex flex-col items-center justify-center gap-2 pointer-events-none">
      <div className="w-12 h-12 rounded-2xl bg-navy-100 flex items-center justify-center">
        <Icon name="Upload" size={22} className="text-navy-600" />
      </div>
      <p className="text-sm font-semibold text-navy-700">Отпустите файлы для загрузки</p>
      <p className="text-[11px] text-navy-500">PDF, DOCX, JPG, PNG · до {MAX_FILES} файлов</p>
    </div>
  );
}
