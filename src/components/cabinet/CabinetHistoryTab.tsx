import Icon from "@/components/ui/icon";

interface Consultation {
  id: number;
  question: string;
  date: string;
  status: string;
  preview: string;
}

interface CabinetHistoryTabProps {
  consultations: Consultation[];
  expandedId: number | null;
  onToggle: (id: number) => void;
}

export default function CabinetHistoryTab({
  consultations,
  expandedId,
  onToggle,
}: CabinetHistoryTabProps) {
  return (
    <div className="space-y-3 max-w-3xl">
      {consultations.map((c) => (
        <div key={c.id} className="bg-card rounded-2xl border border-border overflow-hidden">
          <button
            className="w-full p-5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
            onClick={() => onToggle(c.id)}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="MessageCircle" size={17} className="text-navy-600" />
              </div>
              <div>
                <div className="font-medium text-navy-800 text-sm mb-1">{c.question}</div>
                <div className="text-xs text-muted-foreground">{c.date}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">{c.status}</span>
              <Icon name={expandedId === c.id ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
            </div>
          </button>
          {expandedId === c.id && (
            <div className="px-5 pb-5 border-t border-border">
              <div className="mt-4 chat-bubble-ai rounded-2xl p-4 text-sm text-navy-700 leading-relaxed">{c.preview}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
