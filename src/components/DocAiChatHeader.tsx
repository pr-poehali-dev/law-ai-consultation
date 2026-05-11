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
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-navy-700/60"
        style={{
          background: justUpdated
            ? "linear-gradient(135deg,#0f4028,#0a2820)"
            : "linear-gradient(135deg,#0a1628,#162d5a)",
        }}
      >
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.35)" }}
          >
            {justUpdated
              ? <Icon name="CheckCircle" size={18} className="text-gold-400" />
              : <Icon name="Scale" size={18} className="text-gold-400" />
            }
          </div>
          {(analyzing || editLoading) && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-navy-800 ${editLoading ? "bg-gold-400 animate-ping" : "bg-gold-500 animate-pulse"}`}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white leading-tight">
              {justUpdated ? "Документ обновлён!" : "AI-помощник"}
            </p>
            <span
              className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide"
              style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}
            >
              Профи+
            </span>
          </div>
          <p className="text-[10px] text-navy-300 truncate">
            {justUpdated ? `Правка #${editCount} — изменения подсвечены в документе` : docName}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {editCount > 0 && (
            <button
              onClick={() => downloadDoc(docName, currentContent)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors active:scale-95"
              style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}
            >
              <Icon name="Download" size={12} />
              <span className="hidden sm:inline">Скачать</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-navy-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <Icon name="X" size={15} />
          </button>
        </div>
      </div>

      {/* Полоска цены */}
      <div
        className="flex items-center justify-between px-4 py-1.5 shrink-0 border-b border-navy-700/40"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <p className="text-[10px] text-navy-400">
          1 правка = 1 вопрос + 1 документ / 2500 символов
        </p>
        {editCount > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(240,192,96,0.15)", color: "#f0c060" }}
          >
            Правок: {editCount}
          </span>
        )}
      </div>
    </>
  );
}
