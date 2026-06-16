import Icon from "@/components/ui/icon";
import { downloadDoc } from "@/lib/docUtils";

interface ViewDocModalHeaderProps {
  docName: string;
  docDate: string;
  copied: boolean;
  currentDocContent: string;
  showFillPanel: boolean;
  hasPlaceholders: boolean;
  fillValues?: Record<string, string>;
  placeholders: string[];
  onCopy: () => void;
  onClose: () => void;
  onToggleFillPanel: () => void;
  onFillChange?: (key: string, val: string) => void;
  onApplyFill: () => void;
}

export default function ViewDocModalHeader({
  docName,
  docDate,
  copied,
  currentDocContent,
  showFillPanel,
  hasPlaceholders,
  fillValues,
  placeholders,
  onCopy,
  onClose,
  onToggleFillPanel,
  onFillChange,
  onApplyFill,
}: ViewDocModalHeaderProps) {
  return (
    <>
      {/* Шапка */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
          <Icon name="FileText" size={16} className="text-gold-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-navy-800 text-sm truncate">{docName}</p>
          <p className="text-[11px] text-muted-foreground">{docDate} · Предпросмотр</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasPlaceholders && (
            <button
              onClick={onToggleFillPanel}
              className={`h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors sm:hidden ${showFillPanel ? "bg-navy-100 text-navy-700" : "text-navy-600 hover:bg-slate-100"}`}
            >
              <Icon name="PenLine" size={13} />Заполнить
            </button>
          )}
          <button onClick={onCopy} className="h-8 px-3 rounded-xl text-xs font-medium text-navy-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5">
            <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-emerald-500" : ""} />
            <span className="hidden sm:inline">{copied ? "Скопировано" : "Копировать"}</span>
          </button>
          <button onClick={() => downloadDoc(docName, currentDocContent)} className="h-8 px-3 rounded-xl text-xs font-medium bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center gap-1.5">
            <Icon name="Download" size={13} />
            <span className="hidden sm:inline">Скачать .docx</span>
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground hover:text-navy-700 transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>

      {/* Мобильная панель реквизитов (под шапкой) */}
      {hasPlaceholders && showFillPanel && (
        <div className="sm:hidden shrink-0 border-b border-slate-100 bg-slate-50">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-navy-700 mb-3 flex items-center gap-1.5">
              <Icon name="PenLine" size={12} />Реквизиты документа
            </p>
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {placeholders.map(key => (
                <div key={key}>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 block">{key.replace(/_/g, " ")}</label>
                  <input
                    type="text"
                    value={fillValues?.[key] || ""}
                    onChange={e => onFillChange?.(key, e.target.value)}
                    placeholder={`Введите ${key.replace(/_/g, " ").toLowerCase()}`}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 transition-colors"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={onApplyFill}
              className="btn-gold w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 mt-3 text-sm"
            >
              <Icon name="CheckCircle" size={14} />Применить реквизиты
            </button>
          </div>
        </div>
      )}
    </>
  );
}
