import Icon from "@/components/ui/icon";

interface ViewDocFillPanelProps {
  placeholders: string[];
  fillValues?: Record<string, string>;
  onFillChange?: (key: string, val: string) => void;
  onApplyFill: () => void;
}

export default function ViewDocFillPanel({
  placeholders,
  fillValues,
  onFillChange,
  onApplyFill,
}: ViewDocFillPanelProps) {
  return (
    <div className="hidden sm:flex flex-col w-72 shrink-0 overflow-hidden rounded-r-3xl" style={{ background: "#f8fafc" }}>
      <div className="px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
            <Icon name="PenLine" size={13} className="text-gold-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-navy-800">Реквизиты</p>
            <p className="text-[10px] text-slate-400">{placeholders.length} полей</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
          <p className="text-[11px] text-blue-700 leading-relaxed">
            Введите данные — документ обновится автоматически после нажатия «Применить».
          </p>
        </div>
        {placeholders.map(key => (
          <div key={key}>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">{key.replace(/_/g, " ")}</label>
            <input
              type="text"
              value={fillValues?.[key] || ""}
              onChange={e => onFillChange?.(key, e.target.value)}
              placeholder={key.replace(/_/g, " ").toLowerCase()}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-navy-400 transition-colors placeholder:text-slate-300"
            />
          </div>
        ))}
      </div>

      <div className="shrink-0 px-4 py-4 border-t border-slate-100">
        <button
          onClick={onApplyFill}
          className="btn-gold w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
        >
          <Icon name="CheckCircle" size={15} />Применить реквизиты
        </button>
      </div>
    </div>
  );
}
