import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken, getUser, hasActiveSubscription } from "@/lib/auth";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";
import RecommendationDocPanel from "@/components/RecommendationDocPanel";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

export interface DocRecommendationItem {
  type: "penalty_calc" | "doc";
  title: string;
  reason: string;
  doc_type?: string;
}

interface DocAssistantPanelProps {
  doc: { name: string; content: string; recommendations?: DocRecommendationItem[] };
  onClose: () => void;
  onPaymentRequired: () => void;
}

type PanelMode = "recs" | "ai_analysis" | "penalty" | "rec_doc";

async function checkProAccess(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "consult")) return true;
  return user.paidQuestions >= 100;
}

async function checkStarterAccess(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "docs")) return true;
  return user.paidDocs >= 5 || user.paidQuestions >= 30;
}

const REC_DOC_ICONS: Record<string, string> = {
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

export default function DocAssistantPanel({ doc, onClose, onPaymentRequired }: DocAssistantPanelProps) {
  const [mode, setMode] = useState<PanelMode>("recs");
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});
  const [activeRecIdx, setActiveRecIdx] = useState<number | null>(null);

  // AI анализ
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiRecs, setAiRecs] = useState<DocRecommendationItem[]>([]);
  const [aiErr, setAiErr] = useState("");
  const [aiDone, setAiDone] = useState(false);

  const recs = doc.recommendations || [];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const markDone = (i: number) => setDoneMap(prev => ({ ...prev, [i]: true }));

  const getRecIcon = (rec: DocRecommendationItem) => {
    if (rec.type === "penalty_calc") return "Calculator";
    return REC_DOC_ICONS[rec.doc_type || ""] || "FileText";
  };

  const handleRunAiAnalysis = async () => {
    const hasPro = await checkProAccess();
    if (!hasPro) { onPaymentRequired(); return; }
    setMode("ai_analysis");
    setAiAnalyzing(true);
    setAiErr("");
    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "doc_ai_review",
          doc_name: doc.name,
          doc_content: doc.content.slice(0, 3500),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      setAiResult(data.answer || "");
      const parsedRecs: DocRecommendationItem[] = data.recommendations || [];
      setAiRecs(parsedRecs);
      setAiDone(true);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "Ошибка анализа. Попробуйте ещё раз.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleRecAction = async (rec: DocRecommendationItem, i: number) => {
    if (rec.type === "penalty_calc") {
      const hasPro = await checkProAccess();
      if (!hasPro) { onPaymentRequired(); return; }
      setActiveRecIdx(i);
      setMode("penalty");
    } else {
      const hasStarter = await checkStarterAccess();
      if (!hasStarter) { onPaymentRequired(); return; }
      setActiveRecIdx(i);
      setMode("rec_doc");
    }
  };

  const currentRecs = mode === "ai_analysis" && aiDone ? aiRecs : recs;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={`fixed bottom-6 right-4 sm:right-6 z-[65] flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-navy-700 to-navy-600 hover:from-navy-800 hover:to-navy-700 text-white rounded-2xl shadow-2xl transition-all active:scale-95 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        style={{ transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="relative">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon name="Sparkles" size={12} className="text-gold-400" />
          </div>
          {recs.length > 0 && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center">
              <span className="text-[8px] font-bold text-navy-900">{recs.length}</span>
            </div>
          )}
        </div>
        <span className="text-xs font-semibold">Рекомендации AI</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-3 sm:bottom-6 sm:right-5 z-[65] w-[calc(100vw-24px)] sm:w-[300px] max-w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ease-out ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-6 opacity-0 scale-95"}`}
      style={{ maxHeight: "min(480px, 75dvh)" }}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-navy-800 to-navy-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="Sparkles" size={13} className="text-gold-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">
              {mode === "ai_analysis" ? "AI-помощник" : "Рекомендации"}
            </p>
            <p className="text-[10px] text-white/60 leading-none">{doc.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            title="Свернуть"
          >
            <Icon name="Minus" size={12} />
          </button>
          <button
            onClick={handleClose}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      </div>

      {/* Навигация режимов */}
      {mode !== "penalty" && mode !== "rec_doc" && (
        <div className="flex border-b border-slate-100 shrink-0">
          <button
            onClick={() => setMode("recs")}
            className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${mode === "recs" ? "text-navy-700 border-b-2 border-navy-600 bg-slate-50" : "text-slate-400 hover:text-navy-600"}`}
          >
            Рекомендации {recs.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-navy-100 text-navy-700 text-[9px] font-bold">{recs.length}</span>}
          </button>
          <button
            onClick={() => { if (!aiDone) handleRunAiAnalysis(); else setMode("ai_analysis"); }}
            className={`flex-1 py-2 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${mode === "ai_analysis" ? "text-navy-700 border-b-2 border-navy-600 bg-slate-50" : "text-slate-400 hover:text-navy-600"}`}
          >
            <Icon name="BrainCircuit" size={11} />AI-помощник
            {!aiDone && <span className="text-[9px] text-amber-500 font-medium">Профи</span>}
          </button>
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Режим: Рекомендации */}
        {mode === "recs" && (
          <div className="p-3 space-y-2">
            {recs.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Icon name="CheckCircle" size={18} className="text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-navy-800">Документ полный</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">Дополнительных документов не требуется</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-500 leading-relaxed pb-1">
                  AI выявил {recs.length} рекомендаци{recs.length === 1 ? "ю" : "и"} к вашему делу
                </p>
                {recs.map((rec, i) => (
                  <div key={i} className={`rounded-xl border transition-all ${doneMap[i] ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-navy-200 hover:bg-white"}`}>
                    <div className="p-2.5">
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${doneMap[i] ? "bg-emerald-100" : "bg-white border border-slate-200 shadow-sm"}`}>
                          {doneMap[i]
                            ? <Icon name="CheckCircle" size={13} className="text-emerald-600" />
                            : <Icon name={getRecIcon(rec)} size={12} className="text-navy-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-navy-800 leading-tight">{rec.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{rec.reason}</p>
                        </div>
                      </div>
                      {!doneMap[i] && (
                        <button
                          onClick={() => handleRecAction(rec, i)}
                          className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Icon name={rec.type === "penalty_calc" ? "Calculator" : "Sparkles"} size={10} />
                          {rec.type === "penalty_calc" ? "Рассчитать" : "Подготовить"}
                        </button>
                      )}
                      {doneMap[i] && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Icon name="CheckCircle" size={11} className="text-emerald-500" />
                          <span className="text-[10px] font-semibold text-emerald-600">Выполнено</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Режим: AI анализ */}
        {mode === "ai_analysis" && (
          <div className="p-3 space-y-2">
            {aiAnalyzing ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-100 animate-ping" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center shadow-lg">
                    <Icon name="BrainCircuit" size={20} className="text-gold-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-navy-800">AI изучает документ</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Оцениваем перспективу, проверяем ошибки и судебную практику</p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map(j => (
                    <div key={j} className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-bounce" style={{ animationDelay: `${j * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : aiErr ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <Icon name="AlertCircle" size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{aiErr}</p>
              </div>
            ) : aiResult ? (
              <>
                <div className="bg-navy-50 border border-navy-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon name="BrainCircuit" size={12} className="text-navy-600" />
                    <span className="text-[11px] font-bold text-navy-700 uppercase tracking-wide">Заключение AI</span>
                  </div>
                  <p className="text-[11px] text-navy-700 leading-relaxed whitespace-pre-wrap">{aiResult}</p>
                </div>
                {aiRecs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Дополнительно рекомендуем</p>
                    {aiRecs.map((rec, i) => (
                      <div key={i} className={`rounded-xl border p-2.5 ${doneMap[i + 100] ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-start gap-2 mb-1.5">
                          <Icon name={getRecIcon(rec)} size={12} className="text-navy-600 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-navy-800">{rec.title}</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{rec.reason}</p>
                          </div>
                        </div>
                        {!doneMap[i + 100] && (
                          <button
                            onClick={() => handleRecAction(rec, i + 100)}
                            className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <Icon name={rec.type === "penalty_calc" ? "Calculator" : "Sparkles"} size={10} />
                            {rec.type === "penalty_calc" ? "Рассчитать" : "Подготовить"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Режим: Расчёт неустойки */}
        {mode === "penalty" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-slate-100 shrink-0">
              <button onClick={() => { setMode(aiDone ? "ai_analysis" : "recs"); setActiveRecIdx(null); }} className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-600 transition-colors">
                <Icon name="ChevronLeft" size={13} />
              </button>
              <span className="text-xs font-semibold text-navy-700">← Назад к рекомендациям</span>
            </div>
            <div className="flex-1 min-h-0">
              <PenaltyCalcPanel
                onClose={() => { setMode(aiDone ? "ai_analysis" : "recs"); if (activeRecIdx !== null) markDone(activeRecIdx); setActiveRecIdx(null); }}
                onPaymentRequired={onPaymentRequired}
                embedded
              />
            </div>
          </div>
        )}

        {/* Режим: Дополнительный документ */}
        {mode === "rec_doc" && activeRecIdx !== null && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-slate-100 shrink-0">
              <button onClick={() => { setMode(aiDone ? "ai_analysis" : "recs"); setActiveRecIdx(null); }} className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-600 transition-colors">
                <Icon name="ChevronLeft" size={13} />
              </button>
              <span className="text-xs font-semibold text-navy-700">← Назад к рекомендациям</span>
            </div>
            <div className="flex-1 min-h-0">
              {(() => {
                const rec = currentRecs[activeRecIdx >= 100 ? activeRecIdx - 100 : activeRecIdx];
                if (!rec) return null;
                return (
                  <RecommendationDocPanel
                    recDocType={rec.doc_type || ""}
                    recTitle={rec.title}
                    recReason={rec.reason}
                    docContext={doc.content.slice(0, 2000)}
                    onClose={() => { setMode(aiDone ? "ai_analysis" : "recs"); setActiveRecIdx(null); }}
                    onPaymentRequired={onPaymentRequired}
                    onSuccess={() => markDone(activeRecIdx)}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
