import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { type DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";
import RecommendationDocPanel from "@/components/RecommendationDocPanel";

interface DocRecsPanelProps {
  recommendations: DocRecommendationItem[];
  docContent: string;
  onClose: () => void;
  onPaymentRequired: () => void;
}

type SubMode = "list" | "penalty" | "rec_doc";

const REC_ICONS: Record<string, string> = {
  penalty_calc: "Calculator",
  motion_restore_term: "Clock",
  motion_evidence: "Search",
  motion_witness: "Users",
  motion_third_party: "UserPlus",
  motion_expertise: "Microscope",
  motion_enforcement: "Shield",
  pretension: "FileWarning",
  complaint: "AlertTriangle",
  appeal: "ArrowUp",
};

function getIcon(rec: DocRecommendationItem) {
  if (rec.type === "penalty_calc") return "Calculator";
  return REC_ICONS[rec.doc_type || ""] || "FileText";
}

export default function DocRecsPanel({ recommendations, docContent, onClose, onPaymentRequired }: DocRecsPanelProps) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<SubMode>("list");
  const [activeRec, setActiveRec] = useState<DocRecommendationItem | null>(null);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  const handleAction = (rec: DocRecommendationItem) => {
    setActiveRec(rec);
    setMode(rec.type === "penalty_calc" ? "penalty" : "rec_doc");
  };

  const handleBack = () => { setMode("list"); setActiveRec(null); };

  const markDone = (rec: DocRecommendationItem) => {
    const idx = recommendations.indexOf(rec);
    if (idx !== -1) setDoneMap(p => ({ ...p, [idx]: true }));
    handleBack();
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={`fixed bottom-24 right-3 sm:bottom-5 sm:right-5 z-[65] flex items-center gap-2 px-3 py-2.5 rounded-2xl shadow-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold active:scale-95 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        style={{ transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <Icon name="Sparkles" size={13} />
        <span className="hidden xs:inline">Рекомендации AI</span>
        <span className="xs:hidden">AI</span>
        {recommendations.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-white text-amber-600 text-[10px] font-bold flex items-center justify-center">{recommendations.length}</span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-3 sm:bottom-5 sm:right-4 z-[65] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden transition-all duration-300 ease-out
        w-[min(calc(100vw-24px),320px)]
        ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-6 opacity-0 scale-95"}`}
      style={{ maxHeight: "min(460px, 60dvh)" }}
      onClick={e => e.stopPropagation()}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 shrink-0">
        <div className="flex items-center gap-2">
          {mode !== "list" && (
            <button onClick={handleBack} className="w-6 h-6 rounded-lg hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors">
              <Icon name="ArrowLeft" size={12} />
            </button>
          )}
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon name="Sparkles" size={12} className="text-white" />
          </div>
          <p className="text-xs font-bold text-white">
            {mode === "list" ? `Рекомендации AI · ${recommendations.length}` : mode === "penalty" ? "Расчёт неустойки" : "Дополнительный документ"}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCollapsed(true)} className="w-6 h-6 rounded-lg hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <Icon name="Minus" size={11} />
          </button>
          <button onClick={handleClose} className="w-6 h-6 rounded-lg hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <Icon name="X" size={11} />
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {mode === "list" && (
          <div className="p-3 space-y-2">
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Icon name="CheckCircle" size={18} className="text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-navy-800">Дополнений не требуется</p>
              </div>
            ) : (
              recommendations.map((rec, i) => {
                const done = doneMap[i];
                return (
                  <div key={i} className={`rounded-xl border p-2.5 transition-all ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-amber-200 hover:bg-white"}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${done ? "bg-emerald-100" : "bg-white border border-slate-200"}`}>
                        {done
                          ? <Icon name="CheckCircle" size={13} className="text-emerald-600" />
                          : <Icon name={getIcon(rec)} size={12} className="text-navy-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-navy-800 leading-tight">{rec.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{rec.reason}</p>
                      </div>
                    </div>
                    {!done && (
                      <button
                        onClick={() => handleAction(rec)}
                        className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Icon name={rec.type === "penalty_calc" ? "Calculator" : "Sparkles"} size={10} />
                        {rec.type === "penalty_calc" ? "Рассчитать" : "Подготовить документ"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {mode === "penalty" && (
          <PenaltyCalcPanel
            onClose={handleBack}
            onPaymentRequired={onPaymentRequired}
            embedded
            docContext={docContent}
          />
        )}

        {mode === "rec_doc" && activeRec && (
          <RecommendationDocPanel
            recDocType={activeRec.doc_type || ""}
            recTitle={activeRec.title}
            recReason={activeRec.reason}
            docContext={docContent.slice(0, 2000)}
            onClose={handleBack}
            onPaymentRequired={onPaymentRequired}
            onSuccess={() => markDone(activeRec)}
          />
        )}
      </div>
    </div>
  );
}