import Icon from "@/components/ui/icon";
import type { ServiceType } from "@/components/PaymentModal";

export type BizTool = "chat" | "counterparty" | "contract" | "doc_analyze" | "doc_compare" | "orders" | "pretension";

export const TOOLS: { id: BizTool; icon: string; label: string; desc: string; color: string }[] = [
  { id: "chat", icon: "Bot", label: "AI-консультант", desc: "Юридические вопросы для бизнеса", color: "blue" },
  { id: "counterparty", icon: "Search", label: "Проверка контрагента", desc: "Due diligence по ИНН", color: "purple" },
  { id: "contract", icon: "FileSignature", label: "Сложный договор", desc: "Лицензионный, опционный и др.", color: "emerald" },
  { id: "doc_analyze", icon: "FileSearch", label: "Анализ договора", desc: "PDF/DOC до 20 страниц", color: "orange" },
  { id: "doc_compare", icon: "GitCompare", label: "Сравнение договоров", desc: "Две версии PDF/DOC", color: "pink" },
  { id: "orders", icon: "Stamp", label: "Приказы и документы", desc: "Скачивание в .doc · кадровые", color: "teal" },
  { id: "pretension", icon: "FileWarning", label: "Претензионная работа", desc: "Претензии и ответы · скачивание .doc", color: "amber" },
];

interface BusinessSidebarProps {
  activeTool: BizTool;
  isAdmin: boolean;
  messageCounts: Record<BizTool, number>;
  onSelectTool: (tool: BizTool) => void;
  onPayClick: (type: ServiceType, name: string) => void;
}

export default function BusinessSidebar({ activeTool, isAdmin, messageCounts, onSelectTool, onPayClick }: BusinessSidebarProps) {
  return (
    <>
      {/* Сайдбар (только десктоп) */}
      <div className="hidden sm:flex flex-col gap-1 w-44 shrink-0 overflow-y-auto">
        {TOOLS.map(t => {
          const cnt = messageCounts[t.id] ?? 0;
          return (
            <button key={t.id} onClick={() => onSelectTool(t.id)}
              className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeTool===t.id?"bg-navy-800 text-white shadow-md":"bg-white border border-border hover:border-navy-200 hover:bg-slate-50 text-navy-700"}`}>
              <Icon name={t.icon} size={14} className={activeTool===t.id?"text-gold-400 mt-0.5 shrink-0":"text-navy-400 mt-0.5 shrink-0"} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight truncate">{t.label}</p>
                <p className={`text-[10px] leading-tight mt-0.5 truncate ${activeTool===t.id?"text-white/50":"text-muted-foreground"}`}>{t.desc}</p>
              </div>
              {cnt > 0 && <span className="shrink-0 w-4 h-4 bg-gold-400/30 text-gold-700 text-[9px] font-bold rounded-full flex items-center justify-center">{cnt}</span>}
            </button>
          );
        })}
        {!isAdmin && (
          <div className="mt-auto pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-1 font-medium px-1">Докупить:</p>
            {([["business_actions_10","+10","1 000 ₽"],["business_actions_30","+30","3 000 ₽"],["business_actions_50","+50","3 500 ₽"],["business_actions_150","+150","9 000 ₽"]] as [ServiceType,string,string][]).map(([t,l,p])=>(
              <button key={t} onClick={() => onPayClick(t, l)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 border border-border mb-1 transition-colors">
                <span className="text-[10px] text-navy-700 font-medium">{l}</span>
                <span className="text-[9px] text-navy-500">{p}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Мобильный выбор инструмента — горизонтальный скролл */}
      <div className="sm:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{scrollbarWidth:"none"}}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => onSelectTool(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-medium shrink-0 transition-all ${activeTool===t.id?"bg-navy-800 text-white shadow-md":"bg-white border border-border text-navy-600 hover:border-navy-200"}`}>
              <Icon name={t.icon} size={12} className={activeTool===t.id?"text-gold-400":"text-navy-400"} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
