import Icon from "@/components/ui/icon";

const QUICK_ITEMS = [
  { icon: "Calculator", label: "Калькулятор неустойки", labelMobile: "Неустойка", text: "__penalty__",     color: "#f59e0b", bg: "#fffbeb", border: "#f59e0b30", sub: "По ГК РФ · договорная и законная" },
  { icon: "Landmark",   label: "Госпошлина",            labelMobile: "Пошлина",   text: "__duty__",         color: "#0f4c81", bg: "#eff6ff", border: "#0f4c8128", sub: "По НК РФ · все виды судов" },
  { icon: "BookOpen",   label: "Судебная практика",     labelMobile: "Практика",  text: "__case_law__",     color: "#059669", bg: "#f0fdf4", border: "#05966928", sub: "Поиск по базе и интернету" },
  { icon: "MapPin",     label: "Подсудность",           labelMobile: "Суд",       text: "__jurisdiction__", color: "#7c3aed", bg: "#faf5ff", border: "#7c3aed28", sub: "Определить нужный суд" },
];

interface ChatInputQuickActionsProps {
  typing: boolean;
  showToolsSheet: boolean;
  onToggleToolsSheet: (v: boolean) => void;
  onQuickAction?: (text: string) => void;
}

export default function ChatInputQuickActions({
  typing,
  showToolsSheet,
  onToggleToolsSheet,
  onQuickAction,
}: ChatInputQuickActionsProps) {
  return (
    <>
      {/* Desktop: pill buttons */}
      <div className="hidden md:flex items-center gap-2 mt-2 flex-wrap">
        {QUICK_ITEMS.map(({ icon, label, text }) => (
          <button
            key={label}
            onClick={() => onQuickAction?.(text)}
            disabled={typing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all active:scale-95 disabled:opacity-40 hover:shadow-sm"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1.5px solid rgba(203,213,225,0.8)",
              color: "#475569",
              backdropFilter: "blur(8px)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={12} color="#64748b" />
            {label}
          </button>
        ))}
      </div>

      {/* Mobile: компактная строка инструментов */}
      <div className="md:hidden mt-1.5 flex items-center gap-1.5 flex-wrap">
        {QUICK_ITEMS.map(({ icon, labelMobile, text, color }) => (
          <button
            key={text}
            onClick={() => onQuickAction?.(text)}
            disabled={typing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: `${color}12`, border: `1px solid ${color}28`, color }}
          >
            <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={11} color={color} />
            {labelMobile}
          </button>
        ))}
      </div>

      {/* Bottom sheet */}
      {showToolsSheet && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => onToggleToolsSheet(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[61] bg-white"
            style={{
              borderRadius: "24px 24px 0 0",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 20px)",
              boxShadow: "0 -12px 48px rgba(0,0,0,0.18)",
              animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to   { transform: translateY(0); }
              }
            `}</style>
            <div className="flex justify-center pt-3 pb-0.5">
              <div className="w-9 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div>
                <p className="text-[17px] font-bold text-navy-900">Инструменты юриста</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Списывается 1 вопрос за использование</p>
              </div>
              <button
                onClick={() => onToggleToolsSheet(false)}
                className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
              >
                <Icon name="X" size={17} color="#64748b" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 px-4 pt-2 pb-2">
              {QUICK_ITEMS.map(({ icon, label, sub, text, color, bg, border }) => (
                <button
                  key={text}
                  onClick={() => { onToggleToolsSheet(false); setTimeout(() => onQuickAction?.(text), 80); }}
                  disabled={typing}
                  className="flex flex-col items-start p-4 rounded-2xl transition-all active:scale-[0.96] text-left"
                  style={{ background: bg, border: `1.5px solid ${border}` }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 shrink-0"
                    style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}
                  >
                    <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={20} color="#fff" />
                  </div>
                  <p className="text-[14px] font-bold leading-snug whitespace-pre-line" style={{ color: "#0f172a" }}>{label}</p>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: "#94a3b8" }}>{sub}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
