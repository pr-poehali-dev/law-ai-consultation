import Icon from "@/components/ui/icon";
import { downloadDoc } from "@/lib/docUtils";

interface DocAiChatHeaderProps {
  docName: string;
  currentContent: string;
  justUpdated: boolean;
  analyzing: boolean;
  editLoading: boolean;
  editCount: number;
  historyCount?: number;
  editStageInfo?: { current: number; total: number } | null;
  onClose: () => void;
  onMinimize?: () => void;
  onToggleHistory?: () => void;
  showHistory?: boolean;
}

export default function DocAiChatHeader({
  docName,
  currentContent,
  justUpdated,
  analyzing,
  editLoading,
  editCount,
  historyCount = 0,
  editStageInfo,
  onClose,
  onMinimize,
  onToggleHistory,
  showHistory,
}: DocAiChatHeaderProps) {
  const statusText = () => {
    if (editLoading && editStageInfo && editStageInfo.total > 1) {
      return `Этап ${editStageInfo.current} из ${editStageInfo.total}...`;
    }
    if (editLoading) return "Вношу правку...";
    if (justUpdated && editCount > 0) return `Правка #${editCount} — изменения подсвечены`;
    if (analyzing) return "Анализирую документ...";
    return docName;
  };

  return (
    <>
      {/* ── Шапка ── */}
      <div className={`flex items-center gap-3 px-4 py-3 shrink-0 border-b border-slate-200 transition-colors ${justUpdated ? "bg-emerald-50" : "bg-white"}`}>
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-navy-800 shadow-sm">
            {justUpdated
              ? <Icon name="CheckCircle" size={18} className="text-emerald-400" />
              : editLoading
                ? <Icon name="PenLine" size={18} className="text-gold-400 animate-pulse" />
                : <Icon name="PenLine" size={18} className="text-gold-400" />
            }
          </div>
          {editLoading && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-400 animate-ping" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-navy-800 leading-tight">
              {justUpdated ? "Правка внесена!" : "AI-редактор"}
            </p>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-navy-100 text-navy-600 border border-navy-200">
              Профи+
            </span>
          </div>
          <p className="text-[10px] text-slate-500 truncate">{statusText()}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleHistory && (
            <button
              onClick={onToggleHistory}
              title="История версий"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors border ${
                showHistory
                  ? "bg-navy-800 text-gold-400 border-navy-700"
                  : "text-slate-500 hover:text-navy-700 hover:bg-slate-100 border-slate-200"
              }`}
            >
              <Icon name="History" size={12} />
              {historyCount > 0 && <span>{historyCount}</span>}
            </button>
          )}
          {editCount > 0 && (
            <button
              onClick={() => downloadDoc(docName, currentContent)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors active:scale-95 bg-navy-800 text-gold-400 hover:bg-navy-700 border border-navy-700"
            >
              <Icon name="Download" size={12} />
              <span className="hidden sm:inline">Скачать</span>
            </button>
          )}
          {onMinimize && (
            <button onClick={onMinimize} title="Свернуть" className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <Icon name="Minus" size={15} />
            </button>
          )}
          <button onClick={onClose} title="Закрыть" className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <Icon name="X" size={15} />
          </button>
        </div>
      </div>

      {/* Стоимость */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0 border-b border-slate-100 bg-slate-50">
        <p className="text-[10px] text-slate-500">
          1 правка = 5 вопросов · изменения сохраняются в браузере
        </p>
        {editCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
            Правок: {editCount}
          </span>
        )}
      </div>
    </>
  );
}
