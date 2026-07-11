import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { type DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";
import RecommendationDocPanel from "@/components/RecommendationDocPanel";

interface DocRecsPanelProps {
  recommendations: DocRecommendationItem[];
  docContent: string;
  docId?: number | string;
  onClose: () => void;
  onPaymentRequired: () => void;
  /** Открыть инструмент «Судебная практика» в разделе «Чат с AI» */
  onOpenCaseLaw?: () => void;
  /** Открыть инструмент «Госпошлина» в разделе «Чат с AI» */
  onOpenDuty?: () => void;
}

type SubMode = "list" | "penalty" | "rec_doc";

const REC_ICONS: Record<string, string> = {
  penalty_calc: "Calculator",
  state_duty: "Banknote",
  general: "Lightbulb",
  case_law_check: "Scale",
  duty_check: "Landmark",
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
  if (rec.type === "general") return "Lightbulb";
  if (rec.type === "state_duty") return "Banknote";
  if (rec.type === "penalty_calc") return "Calculator";
  if (rec.type === "case_law_check") return "Scale";
  if (rec.type === "duty_check") return "Landmark";
  return REC_ICONS[rec.doc_type || ""] || "FileText";
}

// localStorage для выполненных рекомендаций
function getDoneKey(docId?: number | string) {
  return docId ? `rec_done_${docId}` : null;
}
function loadDoneMap(docId?: number | string): Record<number, boolean> {
  const key = getDoneKey(docId);
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function saveDoneMap(docId: number | string | undefined, map: Record<number, boolean>) {
  const key = getDoneKey(docId);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore */ }
}

export default function DocRecsPanel({ recommendations, docContent, docId, onClose, onPaymentRequired, onOpenCaseLaw, onOpenDuty }: DocRecsPanelProps) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<SubMode>("list");
  const [activeRec, setActiveRec] = useState<DocRecommendationItem | null>(null);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>(() => loadDoneMap(docId));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  const handleAction = (rec: DocRecommendationItem) => {
    if (rec.type === "case_law_check") { onOpenCaseLaw?.(); return; }
    if (rec.type === "duty_check") { onOpenDuty?.(); return; }
    if (rec.type === "general" || rec.type === "state_duty") return; // нет действия-панели
    setActiveRec(rec);
    setMode(rec.type === "penalty_calc" ? "penalty" : "rec_doc");
  };

  const handleBack = () => { setMode("list"); setActiveRec(null); };

  const markDone = (rec: DocRecommendationItem) => {
    const idx = recommendations.indexOf(rec);
    if (idx !== -1) {
      const newMap = { ...doneMap, [idx]: true };
      setDoneMap(newMap);
      saveDoneMap(docId, newMap);
    }
    handleBack();
  };

  const hasAction = (rec: DocRecommendationItem) =>
    rec.type === "penalty_calc" || rec.type === "doc" || rec.type === "case_law_check" || rec.type === "duty_check";

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
          <span className="w-5 h-5 rounded-full bg-white text-amber-600 text-[10px] font-bold flex items-center justify-center">
            {recommendations.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-3 sm:bottom-5 sm:right-4 z-[65] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden transition-all duration-300 ease-out
        w-[min(calc(100vw-24px),340px)]
        ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-6 opacity-0 scale-95"}`}
      style={{ maxHeight: "min(500px, 65dvh)" }}
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
            {mode === "list"
              ? `Рекомендации AI · ${recommendations.length}`
              : mode === "penalty" ? "Расчёт неустойки"
              : "Дополнительный документ"}
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
          <div className="px-3 py-3 space-y-2">
            {recommendations.map((rec, idx) => {
              const done = doneMap[idx];
              const isActionable = hasAction(rec);
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 transition-all ${
                    done
                      ? "bg-emerald-50 border-emerald-200"
                      : rec.type === "case_law_check"
                        ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300 hover:shadow-sm cursor-pointer"
                        : rec.type === "duty_check"
                          ? "bg-indigo-50/50 border-indigo-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer"
                          : isActionable
                            ? "bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm cursor-pointer"
                            : "bg-slate-50 border-slate-100"
                  }`}
                  onClick={isActionable && !done ? () => handleAction(rec) : undefined}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      done ? "bg-emerald-100"
                      : rec.type === "general" ? "bg-amber-50"
                      : rec.type === "state_duty" ? "bg-blue-50"
                      : rec.type === "case_law_check" ? "bg-emerald-100"
                      : rec.type === "duty_check" ? "bg-indigo-100"
                      : "bg-navy-50"
                    }`}>
                      {done
                        ? <Icon name="CheckCircle" size={14} className="text-emerald-600" />
                        : <Icon name={getIcon(rec)} size={13} className={
                            rec.type === "general" ? "text-amber-600"
                            : rec.type === "state_duty" ? "text-blue-600"
                            : rec.type === "case_law_check" ? "text-emerald-700"
                            : rec.type === "duty_check" ? "text-indigo-700"
                            : "text-navy-700"
                          } />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-[11px] font-bold leading-tight ${done ? "text-emerald-700" : "text-navy-800"}`}>
                          {rec.title}
                        </p>
                        {done && (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                            Выполнено
                          </span>
                        )}
                        {!done && (rec.type === "case_law_check" || rec.type === "duty_check") && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            rec.type === "case_law_check" ? "text-emerald-700 bg-emerald-100" : "text-indigo-700 bg-indigo-100"
                          }`}>
                            Важно
                          </span>
                        )}
                        {!done && !isActionable && (
                          <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                            Совет
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                        {rec.reason}
                      </p>
                      {(rec.type === "general" && rec.advice) && (
                        <p className="text-[10px] text-amber-700 leading-relaxed mt-1 font-medium">
                          {rec.advice}
                        </p>
                      )}
                      {(rec.type === "state_duty" && rec.duty_note) && (
                        <p className="text-[10px] text-blue-700 leading-relaxed mt-1 font-medium">
                          {rec.duty_note}
                        </p>
                      )}
                      {(rec.type === "case_law_check" && !done) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-1.5">
                          <Icon name="Scale" size={11} />Открыть «Судебная практика»
                          <Icon name="ArrowRight" size={10} />
                        </span>
                      )}
                      {(rec.type === "duty_check" && !done) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 mt-1.5">
                          <Icon name="Landmark" size={11} />Открыть «Госпошлина»
                          <Icon name="ArrowRight" size={10} />
                        </span>
                      )}
                    </div>
                    {isActionable && !done && (
                      <Icon name="ChevronRight" size={13} className="text-slate-400 shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              );
            })}

            {recommendations.length === 0 && (
              <div className="text-center py-6">
                <Icon name="CheckCircle" size={28} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Документ не требует дополнительных действий</p>
              </div>
            )}
          </div>
        )}

        {mode === "penalty" && activeRec && (
          <PenaltyCalcPanel
            docContext={docContent}
            onClose={handleBack}
            onPaymentRequired={onPaymentRequired}
            onSuccess={() => markDone(activeRec)}
          />
        )}

        {mode === "rec_doc" && activeRec && activeRec.doc_type && (
          <RecommendationDocPanel
            recDocType={activeRec.doc_type}
            recTitle={activeRec.title}
            recReason={activeRec.reason}
            docContext={docContent}
            onClose={handleBack}
            onPaymentRequired={onPaymentRequired}
            onSuccess={() => markDone(activeRec)}
          />
        )}
      </div>
    </div>
  );
}