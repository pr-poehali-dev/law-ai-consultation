import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";
import RecommendationDocPanel from "@/components/RecommendationDocPanel";

export interface DocRecommendation {
  type: "penalty_calc" | "doc";
  title: string;
  reason: string;
  doc_type?: string;
}

interface DocRecommendationsPanelProps {
  recommendations: DocRecommendation[];
  docContent: string;
  docName: string;
  onClose: () => void;
  onPaymentRequired: () => void;
}

type SubPanelState = {
  index: number;
  type: "penalty_calc" | "doc";
  done: boolean;
} | null;

export default function DocRecommendationsPanel({
  recommendations,
  docContent,
  docName,
  onClose,
  onPaymentRequired,
}: DocRecommendationsPanelProps) {
  const [analyzing, setAnalyzing] = useState(true);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});
  const [openPanels, setOpenPanels] = useState<SubPanelState[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 20);
    const timer = setTimeout(() => setAnalyzing(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  // Автозакрытие главной панели когда все рекомендации выполнены
  useEffect(() => {
    if (!analyzing && recommendations.length > 0 && Object.keys(doneMap).length === recommendations.length) {
      const allDone = Object.values(doneMap).every(Boolean);
      if (allDone) {
        setTimeout(() => handleClose(), 1200);
      }
    }
  }, [doneMap, analyzing, recommendations.length]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const openPanel = (index: number, type: "penalty_calc" | "doc") => {
    const existing = openPanels.findIndex(p => p?.index === index);
    if (existing !== -1) return;
    if (openPanels.filter(Boolean).length >= 2) return;
    setOpenPanels(prev => [...prev, { index, type, done: false }]);
  };

  const closePanel = (index: number) => {
    setOpenPanels(prev => prev.filter(p => p?.index !== index));
  };

  const markDone = (index: number) => {
    setDoneMap(prev => ({ ...prev, [index]: true }));
    setOpenPanels(prev =>
      prev.map(p => p?.index === index ? { ...p, done: true } : p)
    );
  };

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

  const getIcon = (rec: DocRecommendation) => {
    if (rec.type === "penalty_calc") return "Calculator";
    return REC_ICONS[rec.doc_type || ""] || "FileText";
  };

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex">
      {/* Оверлей тёмный — кликабельный */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${visible ? "bg-black/20" : "bg-transparent"} pointer-events-auto`}
        onClick={handleClose}
      />

      {/* Панели — справа */}
      <div className="relative ml-auto flex items-end sm:items-center gap-2 p-3 sm:p-4 pointer-events-auto">

        {/* Суб-панели (расчёт / доп. документы) */}
        {openPanels.map((panel) => {
          if (!panel) return null;
          const rec = recommendations[panel.index];
          return (
            <div
              key={panel.index}
              className={`w-[300px] sm:w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col transition-all duration-300 ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
              style={{ maxHeight: "min(520px, 80dvh)" }}
            >
              {rec.type === "penalty_calc" ? (
                <PenaltyCalcPanel
                  onClose={() => closePanel(panel.index)}
                  onPaymentRequired={onPaymentRequired}
                />
              ) : (
                <RecommendationDocPanel
                  recDocType={rec.doc_type || ""}
                  recTitle={rec.title}
                  recReason={rec.reason}
                  docContext={docContent.slice(0, 2000)}
                  onClose={() => closePanel(panel.index)}
                  onPaymentRequired={onPaymentRequired}
                  onSuccess={() => markDone(panel.index)}
                />
              )}
            </div>
          );
        })}

        {/* Главная панель рекомендаций */}
        <div
          className={`w-[280px] sm:w-[300px] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col transition-all duration-300 ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
          style={{ maxHeight: "min(480px, 78dvh)" }}
        >
          {/* Шапка */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${analyzing ? "bg-blue-100" : "bg-emerald-100"}`}>
                {analyzing
                  ? <Icon name="Loader" size={14} className="text-blue-600 animate-spin" />
                  : <Icon name="Sparkles" size={14} className="text-emerald-600" />
                }
              </div>
              <span className="font-semibold text-navy-800 text-sm">
                {analyzing ? "Анализируем..." : "Рекомендации AI"}
              </span>
            </div>
            <button onClick={handleClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-700 transition-colors">
              <Icon name="X" size={14} />
            </button>
          </div>

          {/* Контент */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-100 animate-ping" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-navy-600 flex items-center justify-center shadow-lg">
                    <Icon name="Scale" size={20} className="text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-navy-800 mb-1">AI анализирует документ</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Проверяем необходимость дополнительных действий. Пожалуйста, не закрывайте окно.</p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Icon name="CheckCircle" size={18} className="text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-navy-800">Документ готов!</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">AI не выявил необходимости дополнительных документов или расчётов.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  AI подготовил {recommendations.length} рекомендац{recommendations.length === 1 ? "ию" : "ии"} для вашего дела
                </p>
                {recommendations.map((rec, i) => {
                  const isDone = doneMap[i];
                  const isOpen = openPanels.some(p => p?.index === i);
                  return (
                    <div key={i} className={`rounded-xl border transition-all ${isDone ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-navy-200 hover:bg-white"}`}>
                      <div className="p-3">
                        <div className="flex items-start gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDone ? "bg-emerald-100" : "bg-white border border-slate-200"}`}>
                            {isDone
                              ? <Icon name="CheckCircle" size={14} className="text-emerald-600" />
                              : <Icon name={getIcon(rec)} size={13} className="text-navy-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-navy-800 leading-tight mb-0.5">{rec.title}</p>
                            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{rec.reason}</p>
                          </div>
                        </div>
                        {!isDone && (
                          <button
                            onClick={() => openPanel(i, rec.type)}
                            disabled={isOpen || openPanels.filter(Boolean).length >= 2}
                            className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-semibold bg-navy-700 hover:bg-navy-800 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isOpen ? (
                              <><Icon name="ExternalLink" size={10} />Открыто в панели</>
                            ) : (
                              <><Icon name="Play" size={10} />{rec.type === "penalty_calc" ? "Рассчитать" : "Подготовить"}</>
                            )}
                          </button>
                        )}
                        {isDone && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Icon name="CheckCircle" size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-medium text-emerald-600">Выполнено</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Нижняя кнопка закрыть если нет рекомендаций */}
          {!analyzing && recommendations.length === 0 && (
            <div className="px-4 pb-3 shrink-0">
              <button onClick={handleClose} className="w-full py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-navy-700 border border-slate-200 hover:border-navy-200 transition-colors">
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
