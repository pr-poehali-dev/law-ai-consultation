import Icon from "@/components/ui/icon";
import { downloadDoc } from "@/lib/docUtils";

interface DocAiChatHeaderProps {
  docName: string;
  currentContent: string;
  justUpdated: boolean;
  analyzing: boolean;
  editLoading: boolean;
  editCount: number;
  onClose: () => void;
}

export default function DocAiChatHeader({
  docName,
  currentContent,
  justUpdated,
  analyzing,
  editLoading,
  editCount,
  onClose,
}: DocAiChatHeaderProps) {
  return (
    <>
      {/* ── Шапка ── */}
      <div className={`flex items-center gap-3 px-4 py-3 shrink-0 border-b border-slate-200 ${justUpdated ? "bg-emerald-50" : "bg-white"}`}>
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-navy-800 shadow-sm">
            {justUpdated
              ? <Icon name="CheckCircle" size={18} className="text-emerald-400" />
              : <Icon name="Scale" size={18} className="text-gold-400" />
            }
          </div>
          {(analyzing || editLoading) && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${editLoading ? "bg-navy-600 animate-ping" : "bg-gold-500 animate-pulse"}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-navy-800 leading-tight">
              {justUpdated ? "Документ обновлён!" : "AI-редактор"}
            </p>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-navy-100 text-navy-600 border border-navy-200">
              Профи+
            </span>
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {justUpdated ? `Правка #${editCount} — изменения подсвечены в документе` : docName}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {editCount > 0 && (
            <button
              onClick={() => downloadDoc(docName, currentContent)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors active:scale-95 bg-navy-800 text-gold-400 hover:bg-navy-700 border border-navy-700"
            >
              <Icon name="Download" size={12} />
              <span className="hidden sm:inline">Скачать</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Icon name="X" size={15} />
          </button>
        </div>
      </div>

      {/* Полоска цены */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0 border-b border-slate-100 bg-slate-50">
        <p className="text-[10px] text-slate-500">
          1 правка = 5 вопросов + 1 документ
        </p>
        {editCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            Правок: {editCount}
          </span>
        )}
      </div>
    </>
  );
}
