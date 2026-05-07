import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken, getUser, hasActiveSubscription, canUseDoc, consumeDoc, canAskQuestion, consumeQuestion } from "@/lib/auth";
import PenaltyCalcPanel from "@/components/PenaltyCalcPanel";
import RecommendationDocPanel from "@/components/RecommendationDocPanel";
import { downloadDoc } from "@/lib/docUtils";
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
  initialMode?: "recs" | "ai";
  onClose: () => void;
  onPaymentRequired: () => void;
  onDocUpdated?: (newContent: string) => void;
}

type PanelMode = "recs" | "ai_analysis" | "penalty" | "rec_doc" | "edit";

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

async function checkProAccess(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")) return true;
  return user.paidQuestions >= 30 || user.paidDocs >= 10;
}

async function checkStarterAccess(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "docs")) return true;
  return user.paidDocs >= 1;
}

// Оценка токенов для редактирования
function estimateEditTokens(docContent: string, instruction: string): number {
  const totalChars = docContent.length + instruction.length;
  return Math.ceil(totalChars / 4) + 800; // ~4 символа = 1 токен + буфер ответа
}

function tokensToResources(tokens: number): { docs: number; questions: number } {
  const docs = Math.max(1, Math.ceil(tokens / 1000));
  return { docs, questions: 1 };
}

export default function DocAssistantPanel({ doc, initialMode = "recs", onClose, onPaymentRequired, onDocUpdated }: DocAssistantPanelProps) {
  const [mode, setMode] = useState<PanelMode>(initialMode === "ai" ? "ai_analysis" : "recs");
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});
  const [activeRecIdx, setActiveRecIdx] = useState<number | null>(null);
  const [activeRecData, setActiveRecData] = useState<DocRecommendationItem | null>(null);

  // AI анализ
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiRecs, setAiRecs] = useState<DocRecommendationItem[]>([]);
  const [aiErr, setAiErr] = useState("");
  const [aiDone, setAiDone] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "ai" | "user"; text: string }[]>([]);

  // Редактирование документа
  const [editInstruction, setEditInstruction] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editResult, setEditResult] = useState("");
  const [editErr, setEditErr] = useState("");
  const [editTokenEst, setEditTokenEst] = useState<{ tokens: number; docs: number; questions: number } | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [currentContent, setCurrentContent] = useState(doc.content);
  const [editHistory, setEditHistory] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recs = doc.recommendations || [];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Автоскролл чата
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, aiAnalyzing]);

  // Автозапуск AI анализа если открыт режим AI
  useEffect(() => {
    if ((initialMode === "ai" || mode === "ai_analysis") && !aiDone && !aiAnalyzing) {
      handleRunAiAnalysis();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
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
    setAiMessages([{ role: "ai", text: "Добрый день! Я AI-помощник. Приступаю к анализу вашего документа — проверяю юридическую корректность, оцениваю перспективу и изучаю судебную практику..." }]);
    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "doc_ai_review",
          doc_name: doc.name,
          doc_content: currentContent.slice(0, 3500),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      const answer = data.answer || "";
      const parsedRecs: DocRecommendationItem[] = data.recommendations || [];
      setAiResult(answer);
      setAiRecs(parsedRecs);
      setAiDone(true);
      setAiMessages(prev => [...prev, { role: "ai", text: answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка анализа. Попробуйте ещё раз.";
      setAiErr(msg);
      setAiMessages(prev => [...prev, { role: "ai", text: `⚠️ ${msg}` }]);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleRecAction = async (rec: DocRecommendationItem, i: number) => {
    if (rec.type === "penalty_calc") {
      const hasPro = await checkProAccess();
      if (!hasPro) { onPaymentRequired(); return; }
      setActiveRecIdx(i); setActiveRecData(rec); setMode("penalty");
    } else {
      const hasStarter = await checkStarterAccess();
      if (!hasStarter) { onPaymentRequired(); return; }
      setActiveRecIdx(i); setActiveRecData(rec); setMode("rec_doc");
    }
  };

  // Оценка стоимости редактирования
  const handleInstructionChange = (v: string) => {
    setEditInstruction(v);
    if (v.trim().length > 10) {
      const tokens = estimateEditTokens(currentContent, v);
      const res = tokensToResources(tokens);
      setEditTokenEst({ tokens, ...res });
    } else {
      setEditTokenEst(null);
    }
  };

  // Запрос редактирования — сначала показываем стоимость
  const handleEditRequest = () => {
    if (!editInstruction.trim()) return;
    setPendingEdit(true);
  };

  // Подтверждение и выполнение редактирования
  const handleConfirmEdit = async () => {
    if (!editTokenEst) return;
    setPendingEdit(false);
    setEditLoading(true);
    setEditErr("");
    setEditResult("");

    // Списываем ресурсы
    const canDoc = await canUseDoc();
    if (!canDoc) { setEditLoading(false); onPaymentRequired(); return; }
    const canAsk = await canAskQuestion();
    if (!canAsk) { setEditLoading(false); onPaymentRequired(); return; }

    // Списываем нужное кол-во документов
    let docsLeft = editTokenEst.docs;
    while (docsLeft > 0) {
      const ok = await consumeDoc();
      if (!ok) { setEditLoading(false); onPaymentRequired(); return; }
      docsLeft--;
    }
    await consumeQuestion();

    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "doc_edit",
          doc_name: doc.name,
          doc_content: currentContent,
          edit_instruction: editInstruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка редактирования");
      const newContent = data.answer || "";
      setEditHistory(prev => [...prev, currentContent]);
      setCurrentContent(newContent);
      setEditResult(newContent);
      if (onDocUpdated) onDocUpdated(newContent);
      setEditInstruction("");
      setEditTokenEst(null);
      setAiMessages(prev => [
        ...prev,
        { role: "user", text: editInstruction },
        { role: "ai", text: `Редакция внесена. Документ обновлён (потрачено ${editTokenEst.docs} ${editTokenEst.docs === 1 ? "документ" : "документа"} и 1 вопрос). Скачайте обновлённую версию.` },
      ]);
      setMode("ai_analysis");
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Ошибка. Попробуйте ещё раз.");
    } finally {
      setEditLoading(false);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={`fixed bottom-5 right-4 sm:right-5 z-[65] flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-navy-800 to-navy-700 hover:from-navy-900 hover:to-navy-800 text-white rounded-2xl shadow-2xl border border-navy-600/30 transition-all active:scale-95 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        style={{ transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="relative">
          <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
            <Icon name="Sparkles" size={12} className="text-gold-400" />
          </div>
          {recs.length > 0 && (
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center border border-white">
              <span className="text-[8px] font-bold text-navy-900">{recs.length}</span>
            </div>
          )}
        </div>
        <span className="text-xs font-semibold">AI-помощник</span>
        <Icon name="ChevronUp" size={12} className="text-white/60" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-3 sm:bottom-5 sm:right-4 z-[65] w-[calc(100vw-24px)] sm:w-[310px] max-w-[330px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden transition-all duration-300 ease-out ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"}`}
      style={{ maxHeight: "min(500px, 78dvh)" }}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-navy-800 via-navy-700 to-indigo-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
            <Icon name="Sparkles" size={13} className="text-gold-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">AI-помощник</p>
            <p className="text-[9px] text-white/50 leading-none truncate max-w-[140px]">{doc.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCollapsed(true)} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors" title="Свернуть">
            <Icon name="Minus" size={11} />
          </button>
          <button onClick={handleClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <Icon name="X" size={11} />
          </button>
        </div>
      </div>

      {/* Навигация */}
      {mode !== "penalty" && mode !== "rec_doc" && (
        <div className="flex border-b border-slate-100 shrink-0 bg-slate-50">
          {recs.length > 0 && (
            <button onClick={() => setMode("recs")} className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${mode === "recs" ? "text-navy-700 border-b-2 border-navy-600 bg-white" : "text-slate-400 hover:text-navy-600"}`}>
              <Icon name="ListChecks" size={11} />Рекомендации
              {recs.length > 0 && <span className="px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">{recs.length}</span>}
            </button>
          )}
          <button onClick={() => { if (!aiDone) handleRunAiAnalysis(); else setMode("ai_analysis"); }} className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${mode === "ai_analysis" ? "text-navy-700 border-b-2 border-navy-600 bg-white" : "text-slate-400 hover:text-navy-600"}`}>
            <Icon name="BrainCircuit" size={11} />Анализ
          </button>
          <button onClick={() => setMode("edit")} className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${mode === "edit" ? "text-navy-700 border-b-2 border-navy-600 bg-white" : "text-slate-400 hover:text-navy-600"}`}>
            <Icon name="PenLine" size={11} />Правки
          </button>
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Режим: Рекомендации */}
        {mode === "recs" && (
          <div className="p-3 space-y-2">
            {recs.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Icon name="CheckCircle" size={18} className="text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-navy-800">Документ полный</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">Дополнительных документов не требуется</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-500 leading-relaxed pb-1">
                  AI выявил {recs.length} рекомендаци{recs.length === 1 ? "ю" : "и"} к документу
                </p>
                {recs.map((rec, i) => (
                  <div key={i} className={`rounded-xl border transition-all ${doneMap[i] ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-navy-200 hover:bg-white"}`}>
                    <div className="p-2.5">
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${doneMap[i] ? "bg-emerald-100" : "bg-white border border-slate-200 shadow-sm"}`}>
                          {doneMap[i] ? <Icon name="CheckCircle" size={13} className="text-emerald-600" /> : <Icon name={getRecIcon(rec)} size={12} className="text-navy-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-navy-800 leading-tight">{rec.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{rec.reason}</p>
                        </div>
                      </div>
                      {!doneMap[i] && (
                        <button onClick={() => handleRecAction(rec, i)} className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95">
                          <Icon name={rec.type === "penalty_calc" ? "Calculator" : "Sparkles"} size={10} />
                          {rec.type === "penalty_calc" ? "Рассчитать" : "Подготовить"}
                        </button>
                      )}
                      {doneMap[i] && (
                        <div className="mt-1.5 flex items-center gap-1">
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

        {/* Режим: AI анализ — чат */}
        {mode === "ai_analysis" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-6 h-6 rounded-lg gradient-navy flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="Sparkles" size={11} className="text-gold-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${msg.role === "ai" ? "bg-slate-50 border border-slate-100 text-navy-700 rounded-tl-sm" : "bg-navy-700 text-white rounded-tr-sm"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {aiAnalyzing && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-lg gradient-navy flex items-center justify-center shrink-0">
                    <Icon name="Sparkles" size={11} className="text-gold-400 animate-pulse" />
                  </div>
                  <div className="flex gap-1 items-center bg-slate-50 rounded-2xl rounded-tl-sm px-3 py-2">
                    {[0, 1, 2].map(j => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-bounce" style={{ animationDelay: `${j * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              {aiErr && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-2.5">
                  <Icon name="AlertCircle" size={12} className="text-red-500 shrink-0" />
                  <p className="text-[11px] text-red-600">{aiErr}</p>
                </div>
              )}
              {aiDone && aiRecs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide px-1">Рекомендую дополнительно:</p>
                  {aiRecs.map((rec, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="flex items-start gap-1.5 mb-1.5">
                        <Icon name={getRecIcon(rec)} size={11} className="text-navy-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-navy-800">{rec.title}</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">{rec.reason}</p>
                        </div>
                      </div>
                      {!doneMap[i + 100] && (
                        <button onClick={() => { handleRecAction(rec, i + 100); }} className="w-full py-1 rounded-lg text-[10px] font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1 active:scale-95">
                          <Icon name={rec.type === "penalty_calc" ? "Calculator" : "Sparkles"} size={9} />
                          {rec.type === "penalty_calc" ? "Рассчитать" : "Подготовить"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Ввод правки из AI чата */}
            {aiDone && !aiAnalyzing && (
              <div className="border-t border-slate-100 p-2 shrink-0 space-y-1.5">
                <div className="flex gap-1.5">
                  <button onClick={() => setMode("edit")} className="flex-1 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-1 active:scale-95">
                    <Icon name="PenLine" size={11} />Внести правки в документ
                  </button>
                  <button onClick={() => downloadDoc(doc.name, currentContent)} className="py-1.5 px-3 rounded-xl text-[11px] font-semibold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center gap-1">
                    <Icon name="Download" size={11} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Режим: Правки */}
        {mode === "edit" && (
          <div className="p-3 space-y-3">
            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <div className="flex items-start gap-2 mb-2">
                <Icon name="PenLine" size={12} className="text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-indigo-700">Редактирование документа</p>
                  <p className="text-[10px] text-indigo-500 leading-relaxed">AI внесёт правки в уже созданный документ. Стоимость: 1 вопрос + 1 документ за каждые 1000 токенов</p>
                </div>
              </div>
            </div>

            {editHistory.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100">
                <Icon name="CheckCircle" size={11} />
                Редакций внесено: {editHistory.length}
              </div>
            )}

            {pendingEdit && editTokenEst ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-amber-800">Подтвердите редактирование</p>
                <p className="text-[10px] text-amber-700 leading-relaxed">Инструкция: <span className="font-medium">«{editInstruction}»</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2 border border-amber-200 text-center">
                    <p className="text-lg font-bold text-navy-800">{editTokenEst.docs}</p>
                    <p className="text-[9px] text-slate-500">{editTokenEst.docs === 1 ? "документ" : "документа"}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-amber-200 text-center">
                    <p className="text-lg font-bold text-navy-800">1</p>
                    <p className="text-[9px] text-slate-500">вопрос</p>
                  </div>
                </div>
                <p className="text-[9px] text-amber-600">≈ {editTokenEst.tokens.toLocaleString("ru")} токенов · Согласны?</p>
                <div className="flex gap-2">
                  <button onClick={() => setPendingEdit(false)} className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">Отмена</button>
                  <button onClick={handleConfirmEdit} className="flex-1 py-1.5 rounded-xl text-[11px] font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors active:scale-95">Подтвердить</button>
                </div>
              </div>
            ) : editLoading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-100 animate-ping" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-navy-700 flex items-center justify-center shadow-lg">
                    <Icon name="PenLine" size={20} className="text-white" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-navy-800">AI редактирует документ...</p>
                <div className="flex gap-1">
                  {[0, 1, 2].map(j => (
                    <div key={j} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${j * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : editResult ? (
              <div className="space-y-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon name="CheckCircle" size={13} className="text-emerald-600" />
                    <p className="text-[11px] font-bold text-emerald-700">Правки внесены!</p>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Документ обновлён. Скачайте новую версию.</p>
                </div>
                <button onClick={() => downloadDoc(doc.name, currentContent)} className="w-full py-2 rounded-xl text-xs font-bold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95">
                  <Icon name="Download" size={13} />Скачать обновлённый .docx
                </button>
                <button onClick={() => { setEditResult(""); setEditInstruction(""); }} className="w-full py-1.5 rounded-xl text-[11px] text-slate-400 hover:text-navy-600 border border-slate-200 hover:border-navy-200 transition-colors">
                  Внести ещё правки
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-navy-700 block">Что изменить?</label>
                <textarea
                  value={editInstruction}
                  onChange={e => handleInstructionChange(e.target.value)}
                  placeholder="Например: добавь расчёт неустойки по ст.395 ГК РФ, уточни дату договора, добавь требование о возврате судебных расходов..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[11px] outline-none focus:border-indigo-300 resize-none bg-white leading-relaxed placeholder:text-slate-300"
                />
                {editTokenEst && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5">
                    <Icon name="Banknote" size={11} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700">Примерная стоимость: <b>{editTokenEst.docs} {editTokenEst.docs === 1 ? "документ" : "документа"}</b> + <b>1 вопрос</b></span>
                  </div>
                )}
                {editErr && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-2.5 py-2">
                    <Icon name="AlertCircle" size={11} className="text-red-500 shrink-0" />
                    <span className="text-[10px] text-red-600">{editErr}</span>
                  </div>
                )}
                <button
                  onClick={handleEditRequest}
                  disabled={!editInstruction.trim()}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Icon name="Wand2" size={13} />Внести правки в документ
                </button>
              </div>
            )}
          </div>
        )}

        {/* Режим: Расчёт неустойки */}
        {mode === "penalty" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-slate-100 shrink-0">
              <button onClick={() => setMode(recs.length > 0 ? "recs" : "ai_analysis")} className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-700 transition-colors">
                <Icon name="ArrowLeft" size={13} />
              </button>
              <p className="text-[11px] font-semibold text-navy-700">Расчёт неустойки</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PenaltyCalcPanel
                onClose={() => setMode(recs.length > 0 ? "recs" : "ai_analysis")}
                onPaymentRequired={onPaymentRequired}
                embedded
              />
            </div>
          </div>
        )}

        {/* Режим: Дополнительный документ */}
        {mode === "rec_doc" && activeRecData && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-slate-100 shrink-0">
              <button onClick={() => setMode(recs.length > 0 ? "recs" : "ai_analysis")} className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-700 transition-colors">
                <Icon name="ArrowLeft" size={13} />
              </button>
              <p className="text-[11px] font-semibold text-navy-700 truncate">{activeRecData.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RecommendationDocPanel
                recDocType={activeRecData.doc_type || ""}
                recTitle={activeRecData.title}
                recReason={activeRecData.reason}
                docContext={currentContent.slice(0, 2000)}
                onClose={() => setMode(recs.length > 0 ? "recs" : "ai_analysis")}
                onPaymentRequired={onPaymentRequired}
                onSuccess={() => {
                  if (activeRecIdx !== null) markDone(activeRecIdx);
                  setMode(recs.length > 0 ? "recs" : "ai_analysis");
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}