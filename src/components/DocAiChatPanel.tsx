import { useState, useEffect, useRef, useCallback } from "react";
import {
  getToken,
  checkProAccess,
  checkAndConsumeEditResources,
} from "@/lib/auth";
import { type DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import func2url from "../../backend/func2url.json";
import { type AiMsg, calcEditCost } from "./DocAiChatTypes";
import DocAiChatHeader from "./DocAiChatHeader";
import DocAiChatMessages from "./DocAiChatMessages";
import DocAiChatInput from "./DocAiChatInput";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

// ─── localStorage ────────────────────────────────────────────────────────────
function getStorageKey(docId: number | string) {
  return `doc_ai_history_${docId}`;
}

export interface EditHistoryEntry {
  editNum: number;
  instruction: string;
  content: string;
  date: string;
  changesSummary?: string;
}

function loadHistory(docId: number | string): EditHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(docId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(docId: number | string, entries: EditHistoryEntry[]) {
  try {
    localStorage.setItem(getStorageKey(docId), JSON.stringify(entries.slice(-30)));
  } catch { /* ignore */ }
}

// ─── Оценка сложности правки ─────────────────────────────────────────────────
function estimateEditStages(docContent: string, instruction: string): number {
  // ~4 символа = 1 токен. Порог = 2000 токенов ≈ 8000 символов итого (документ + инструкция)
  const TOKENS_PER_STAGE = 2000;
  const CHARS_PER_TOKEN = 4;
  const LIMIT = TOKENS_PER_STAGE * CHARS_PER_TOKEN;
  const total = docContent.length + instruction.length;
  if (total <= LIMIT) return 1;
  return Math.min(Math.ceil(total / LIMIT), 4);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface DocAiChatPanelProps {
  doc: { id?: number; name: string; content: string; recommendations?: DocRecommendationItem[] };
  onClose: () => void;
  onPaymentRequired: () => void;
  onDocUpdated?: (newContent: string, prevContent: string) => void;
  onScrollToChanges?: () => void;
}

type PanelState = "full" | "minimized";

export default function DocAiChatPanel({
  doc, onClose, onPaymentRequired, onDocUpdated, onScrollToChanges,
}: DocAiChatPanelProps) {
  const docId = doc.id ?? doc.name;
  const [visible, setVisible] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>("full");
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [currentContent, setCurrentContent] = useState(doc.content);
  const currentContentRef = useRef(doc.content);
  const [editInput, setEditInput] = useState("");
  const [editCost, setEditCost] = useState<{ docs: number; questions: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editStageInfo, setEditStageInfo] = useState<{ current: number; total: number } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [pendingMultiStage, setPendingMultiStage] = useState<{ stages: number; totalQ: number; instruction: string } | null>(null);
  const [editErr, setEditErr] = useState("");
  const [editCount, setEditCount] = useState(0);
  const editCountRef = useRef(0);
  const [justUpdated, setJustUpdated] = useState(false);
  const [pendingPartial, setPendingPartial] = useState<{ note: string; instruction: string } | null>(null);
  const [history, setHistory] = useState<EditHistoryEntry[]>(() => loadHistory(docId));
  const historyRef = useRef<EditHistoryEntry[]>(loadHistory(docId));

  // Показ панели истории
  const [showHistory, setShowHistory] = useState(false);

  // ─── Инициализация ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = loadHistory(docId);
    historyRef.current = h;
    setHistory(h);
    if (h.length > 0) {
      const last = h[h.length - 1];
      currentContentRef.current = last.content;
      setCurrentContent(last.content);
      editCountRef.current = last.editNum;
      setEditCount(last.editNum);
      if (onDocUpdated) onDocUpdated(last.content, doc.content);
      const histMsgs: AiMsg[] = [];
      h.forEach(e => {
        histMsgs.push({ role: "user", text: e.instruction });
        histMsgs.push({
          role: "ai",
          text: `Правка #${e.editNum} внесена ${e.date}.`,
          isEdited: true,
          editNum: e.editNum,
          changesSummary: e.changesSummary,
        });
      });
      setMessages(histMsgs);
      setAnalysisDone(true);
    }
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const check = async () => {
      const result = await checkProAccess();
      if (!result.ok) { onPaymentRequired(); return; }
      setAccessChecked(true);
      const h = loadHistory(docId);
      if (h.length === 0) {
        setMessages([{
          role: "ai",
          text: "Готов редактировать документ. Опишите что нужно изменить — внесу точечную правку без изменения структуры и содержания остального текста.",
        }]);
        setAnalysisDone(true);
      }
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Ввод ────────────────────────────────────────────────────────────────
  const handleEditInputChange = (v: string) => {
    setEditInput(v);
    if (v.trim().length > 4) {
      const stages = estimateEditStages(currentContentRef.current, v);
      setEditCost({ docs: 0, questions: stages * 5 });
    } else {
      setEditCost(null);
    }
  };

  const handleEditRequest = () => {
    if (!editInput.trim() || !analysisDone || !accessChecked) return;
    const stages = estimateEditStages(currentContentRef.current, editInput);
    if (stages > 1) {
      // Многоэтапная — показываем предупреждение
      setPendingMultiStage({ stages, totalQ: stages * 5, instruction: editInput });
    } else {
      setPendingConfirm(true);
    }
  };

  // ─── Выполнение одного этапа редактирования ──────────────────────────────
  const doEditStage = useCallback(async (
    instruction: string,
    stageIndex: number,
    totalStages: number,
    contentAtStageStart: string,
  ): Promise<{ newContent: string; changesSummary: string; partialNote: string } | null> => {
    const token = getToken();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({
        mode: "doc_edit",
        doc_name: doc.name,
        doc_content: contentAtStageStart,
        edit_instruction: instruction,
        edit_stage: stageIndex,
        edit_total_stages: totalStages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка редактирования");
    return {
      newContent: data.answer || "",
      changesSummary: data.changes_summary || "",
      partialNote: data.partial_note || "",
    };
  }, [doc.name]);

  // ─── Полный цикл редактирования ──────────────────────────────────────────
  const doEdit = useCallback(async (instruction: string, stages: number, isResume = false) => {
    setEditLoading(true);
    setEditErr("");
    setPendingPartial(null);
    setPendingMultiStage(null);

    if (!isResume) {
      // Списываем 5 вопросов за каждый этап
      for (let s = 0; s < stages; s++) {
        const result = await checkAndConsumeEditResources(0);
        if (!result.ok) { setEditLoading(false); onPaymentRequired(); return; }
      }
    }

    const thisEditNum = editCountRef.current + 1;
    if (!isResume) {
      setMessages(prev => [...prev, { role: "user", text: instruction }]);
      setEditInput("");
      setEditCost(null);
    }

    let stageContent = currentContentRef.current;
    let finalChangesSummary = "";
    let finalPartialNote = "";

    try {
      for (let s = 0; s < stages; s++) {
        if (stages > 1) {
          setEditStageInfo({ current: s + 1, total: stages });
          setMessages(prev => {
            // Удаляем предыдущий статус-этап если есть
            const filtered = prev.filter(m => !m.isStageStatus);
            return [...filtered, {
              role: "ai",
              text: `⚙️ Этап ${s + 1} из ${stages}: вношу изменения...`,
              isStageStatus: true,
            }];
          });
        }

        const result = await doEditStage(instruction, s, stages, stageContent);
        if (!result || !result.newContent) {
          throw new Error(`Этап ${s + 1} не вернул результат`);
        }

        stageContent = result.newContent;
        if (result.changesSummary) finalChangesSummary = result.changesSummary;
        if (result.partialNote) finalPartialNote = result.partialNote;
      }

      // Убираем статус-сообщения этапов
      setMessages(prev => prev.filter(m => !m.isStageStatus));
      setEditStageInfo(null);

      if (stageContent) {
        const prevContent = currentContentRef.current;
        currentContentRef.current = stageContent;
        setCurrentContent(stageContent);
        editCountRef.current = thisEditNum;
        setEditCount(thisEditNum);
        if (onDocUpdated) onDocUpdated(stageContent, prevContent);

        // Сохраняем в localStorage
        const newEntry: EditHistoryEntry = {
          editNum: thisEditNum,
          instruction,
          content: stageContent,
          date: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
          changesSummary: finalChangesSummary,
        };
        const newHistory = [...historyRef.current, newEntry];
        historyRef.current = newHistory;
        setHistory(newHistory);
        saveHistory(docId, newHistory);

        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 4000);

        // Автоскролл
        setTimeout(() => { if (onScrollToChanges) onScrollToChanges(); }, 300);

        // Мобильные — не сворачиваем сразу, кнопка "посмотреть изменения" в сообщении
      }

      if (finalPartialNote) {
        setPendingPartial({ note: finalPartialNote, instruction });
        setMessages(prev => [...prev, {
          role: "ai",
          text: `Правка #${thisEditNum} частично внесена.`,
          isEdited: true,
          editNum: thisEditNum,
          partialNote: finalPartialNote,
          changesSummary: finalChangesSummary,
          stages,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "ai",
          text: stages > 1
            ? `Правка #${thisEditNum} внесена в ${stages} этапа. Изменения подсвечены в документе.`
            : `Правка #${thisEditNum} внесена.`,
          isEdited: true,
          editNum: thisEditNum,
          changesSummary: finalChangesSummary,
          stages,
        }]);
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => !m.isStageStatus));
      setEditStageInfo(null);
      const msg = e instanceof Error ? e.message : "Ошибка редактирования.";
      setEditErr(msg);
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${msg}` }]);
    } finally {
      setEditLoading(false);
    }
  }, [docId, doc.name, onDocUpdated, onPaymentRequired, onScrollToChanges, doEditStage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmEdit = async () => {
    setPendingConfirm(false);
    await doEdit(editInput, 1);
  };

  const handleConfirmMultiStage = async () => {
    if (!pendingMultiStage) return;
    await doEdit(pendingMultiStage.instruction, pendingMultiStage.stages);
  };

  const handleCancelMultiStage = () => { setPendingMultiStage(null); };

  const handleContinuePartial = async () => {
    if (!pendingPartial) return;
    setMessages(prev => [...prev, { role: "user", text: "Внести оставшуюся часть" }]);
    await doEdit(`Продолжи невнесённую часть: ${pendingPartial.note}`, 1, true);
  };

  const handleDeclinePartial = () => {
    setPendingPartial(null);
    setMessages(prev => [...prev, { role: "ai", text: "Хорошо, можете ввести следующую правку." }]);
  };

  // ─── Откат к версии ──────────────────────────────────────────────────────
  const handleRollback = useCallback((entry: EditHistoryEntry) => {
    const prevContent = currentContentRef.current;
    currentContentRef.current = entry.content;
    setCurrentContent(entry.content);
    if (onDocUpdated) onDocUpdated(entry.content, prevContent);
    // Обрезаем историю до этой точки
    const idx = historyRef.current.findIndex(h => h.editNum === entry.editNum);
    if (idx !== -1) {
      const truncated = historyRef.current.slice(0, idx + 1);
      historyRef.current = truncated;
      setHistory(truncated);
      saveHistory(docId, truncated);
      editCountRef.current = entry.editNum;
      setEditCount(entry.editNum);
    }
    setShowHistory(false);
    setMessages(prev => [...prev, {
      role: "ai",
      text: `Документ откатан до правки #${entry.editNum} (${entry.date}). Более поздние правки удалены.`,
    }]);
  }, [docId, onDocUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !pendingConfirm && editInput.trim() && analysisDone) {
      e.preventDefault(); handleEditRequest();
    }
  };

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
  const handleMinimize = () => setPanelState("minimized");
  const handleExpand = () => setPanelState("full");

  // ─── Свёрнутое состояние ─────────────────────────────────────────────────
  if (panelState === "minimized") {
    return (
      <button
        onClick={handleExpand}
        className={`fixed bottom-24 right-3 sm:bottom-5 sm:right-5 z-[70] flex items-center gap-2 px-3 py-2.5 rounded-2xl shadow-2xl border border-navy-300/30 bg-navy-800 text-white text-xs font-bold active:scale-95 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </span>
        <span>AI-редактор</span>
        {editCountRef.current > 0 && (
          <span className="w-5 h-5 rounded-full bg-gold-400 text-navy-800 text-[10px] font-bold flex items-center justify-center">{editCountRef.current}</span>
        )}
      </button>
    );
  }

  // ─── Полное состояние ─────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-[69] sm:hidden bg-black/40" onClick={handleMinimize} />

      <div
        className={`fixed z-[70] flex flex-col overflow-hidden transition-all duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl
          sm:bottom-5 sm:right-5 sm:left-auto sm:w-[480px] sm:rounded-2xl sm:shadow-2xl
          border border-slate-200 bg-white
          ${visible && panelState === "full" ? "opacity-100 translate-y-0 sm:scale-100" : "opacity-0 translate-y-full sm:translate-y-4 sm:scale-95"}`}
        style={{ height: "88dvh", maxHeight: "88dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@media(min-width:640px){.aichat-r{height:min(720px,90dvh)!important;max-height:min(720px,90dvh)!important}}`}</style>
        <div className="aichat-r flex flex-col h-full w-full">

          <DocAiChatHeader
            docName={doc.name}
            currentContent={currentContentRef.current}
            justUpdated={justUpdated}
            analyzing={false}
            editLoading={editLoading}
            editCount={editCountRef.current}
            historyCount={history.length}
            editStageInfo={editStageInfo}
            onClose={handleClose}
            onMinimize={handleMinimize}
            onToggleHistory={() => setShowHistory(v => !v)}
            showHistory={showHistory}
          />

          {/* Панель истории версий */}
          {showHistory && (
            <div className="border-b border-slate-200 bg-slate-50 max-h-[200px] overflow-y-auto shrink-0">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Правок ещё нет</p>
              ) : (
                <div className="p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-2 mb-1">История версий</p>
                  {[...history].reverse().map((entry) => (
                    <div key={entry.editNum} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 group transition-all">
                      <div className="w-6 h-6 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-navy-700">#{entry.editNum}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-navy-800 truncate">{entry.instruction}</p>
                        <p className="text-[9px] text-slate-400">{entry.date}</p>
                      </div>
                      <button
                        onClick={() => handleRollback(entry)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg transition-all active:scale-95 shrink-0"
                      >
                        Откат
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DocAiChatMessages
            messages={messages}
            analyzing={false}
            editLoading={editLoading}
            editStageInfo={editStageInfo}
            pendingPartial={pendingPartial}
            pendingConfirm={pendingConfirm}
            pendingMultiStage={pendingMultiStage}
            docName={doc.name}
            currentContent={currentContentRef.current}
            onContinuePartial={handleContinuePartial}
            onDeclinePartial={handleDeclinePartial}
            onConfirmEdit={handleConfirmEdit}
            onCancelConfirm={() => setPendingConfirm(false)}
            onConfirmMultiStage={handleConfirmMultiStage}
            onCancelMultiStage={handleCancelMultiStage}
            onScrollToChanges={onScrollToChanges}
            onShowChangesInDoc={() => {
              handleMinimize();
              setTimeout(() => { if (onScrollToChanges) onScrollToChanges(); }, 200);
            }}
          />

          <DocAiChatInput
            editInput={editInput}
            editCost={editCost}
            editErr={editErr}
            editLoading={editLoading}
            analyzing={false}
            analysisDone={analysisDone && accessChecked}
            pendingConfirm={false}
            pendingPartial={pendingPartial}
            editCount={editCountRef.current}
            onInputChange={handleEditInputChange}
            onEditRequest={handleEditRequest}
            onConfirmEdit={handleConfirmEdit}
            onCancelConfirm={() => setPendingConfirm(false)}
            onKeyDown={handleKeyDown}
          />

        </div>
      </div>
    </>
  );
}
