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

// Ключ для localStorage истории правок
function getStorageKey(docId: number | string) {
  return `doc_ai_history_${docId}`;
}

interface EditHistoryEntry {
  editNum: number;
  instruction: string;
  content: string;
  date: string;
}

function loadHistory(docId: number | string): EditHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(docId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(docId: number | string, entries: EditHistoryEntry[]) {
  try {
    localStorage.setItem(getStorageKey(docId), JSON.stringify(entries.slice(-20)));
  } catch { /* ignore */ }
}

interface DocAiChatPanelProps {
  doc: { id?: number; name: string; content: string; recommendations?: DocRecommendationItem[] };
  onClose: () => void;
  onPaymentRequired: () => void;
  onDocUpdated?: (newContent: string) => void;
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
  const [editInput, setEditInput] = useState("");
  const [editCost, setEditCost] = useState<{ docs: number; questions: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editCount, setEditCount] = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);
  const [pendingPartial, setPendingPartial] = useState<{ note: string; instruction: string } | null>(null);
  const [history, setHistory] = useState<EditHistoryEntry[]>(() => loadHistory(docId));

  // Загружаем историю и восстанавливаем последний контент
  useEffect(() => {
    const h = loadHistory(docId);
    setHistory(h);
    if (h.length > 0) {
      const last = h[h.length - 1];
      setCurrentContent(last.content);
      setEditCount(last.editNum);
      if (onDocUpdated) onDocUpdated(last.content);
      // Показываем историю в чате
      const histMsgs: AiMsg[] = [];
      h.forEach(e => {
        histMsgs.push({ role: "user", text: e.instruction });
        histMsgs.push({ role: "ai", text: `Правка #${e.editNum} внесена ${e.date}. Документ обновлён.`, isEdited: true, editNum: e.editNum });
      });
      setMessages(histMsgs);
      setAnalysisDone(true);
    }
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Проверяем доступ (без списания вопросов)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const check = async () => {
      const result = await checkProAccess();
      if (!result.ok) {
        onPaymentRequired();
        return;
      }
      setAccessChecked(true);
      // Если нет истории — показываем приветствие
      const h = loadHistory(docId);
      if (h.length === 0) {
        setMessages([{
          role: "ai",
          text: "Готов редактировать документ. Опишите что нужно изменить — внесу точечную правку без изменения структуры и смысла остального текста.",
        }]);
        setAnalysisDone(true);
      }
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditInputChange = (v: string) => {
    setEditInput(v);
    setEditCost(v.trim().length > 4 ? calcEditCost(currentContent, v) : null);
  };

  const handleEditRequest = () => {
    if (!editInput.trim() || !analysisDone || !accessChecked) return;
    setPendingConfirm(true);
  };

  const doEdit = useCallback(async (instruction: string, isResume = false) => {
    setEditLoading(true);
    setEditErr("");
    setPendingPartial(null);

    if (!isResume) {
      const result = await checkAndConsumeEditResources(1);
      if (!result.ok) { setEditLoading(false); onPaymentRequired(); return; }
    }

    const thisEditNum = editCount + 1;
    if (!isResume) {
      setMessages(prev => [...prev, { role: "user", text: instruction }]);
      setEditInput("");
      setEditCost(null);
    }

    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "doc_edit", doc_name: doc.name, doc_content: currentContent, edit_instruction: instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка редактирования");
      const newContent: string = data.answer || "";
      const partialNote: string = data.partial_note || "";

      if (newContent) {
        setCurrentContent(newContent);
        setEditCount(thisEditNum);
        if (onDocUpdated) onDocUpdated(newContent);

        // Сохраняем в localStorage
        const newEntry: EditHistoryEntry = {
          editNum: thisEditNum,
          instruction,
          content: newContent,
          date: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        };
        const newHistory = [...history, newEntry];
        setHistory(newHistory);
        saveHistory(docId, newHistory);

        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 3000);

        // Автоскролл к изменениям в документе
        setTimeout(() => {
          if (onScrollToChanges) onScrollToChanges();
        }, 300);

        // На мобильных — сворачиваем панель после правки чтобы показать предпросмотр
        if (window.innerWidth < 640) {
          setTimeout(() => {
            setPanelState("minimized");
          }, 1500);
        }
      }

      if (partialNote) {
        setPendingPartial({ note: partialNote, instruction });
        setMessages(prev => [...prev, { role: "ai", text: `Правка #${thisEditNum} частично внесена. Документ обновлён.`, isEdited: true, editNum: thisEditNum, partialNote }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", text: `Правка #${thisEditNum} внесена. Изменения подсвечены зелёным в документе.`, isEdited: true, editNum: thisEditNum }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка редактирования.";
      setEditErr(msg);
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${msg}` }]);
    } finally {
      setEditLoading(false);
    }
  }, [currentContent, editCount, history, docId, doc.name, onDocUpdated, onPaymentRequired, onScrollToChanges]);  

  const handleConfirmEdit = async () => { setPendingConfirm(false); await doEdit(editInput); };

  const handleContinuePartial = async () => {
    if (!pendingPartial) return;
    setMessages(prev => [...prev, { role: "user", text: "Да, внести оставшуюся часть" }]);
    await doEdit(`Продолжи невнесённую часть: ${pendingPartial.note}`, true);
  };

  const handleDeclinePartial = () => {
    setPendingPartial(null);
    setMessages(prev => [...prev, { role: "ai", text: "Хорошо, можете ввести следующую правку." }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !pendingConfirm && editInput.trim() && analysisDone) {
      e.preventDefault(); handleEditRequest();
    }
  };

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
  const handleMinimize = () => setPanelState("minimized");
  const handleExpand = () => setPanelState("full");

  // ── Свёрнутое состояние ──────────────────────────────────────────────────
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
        {editCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-gold-400 text-navy-800 text-[10px] font-bold flex items-center justify-center">{editCount}</span>
        )}
      </button>
    );
  }

  // ── Полное состояние ─────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop mobile */}
      <div className="fixed inset-0 z-[69] sm:hidden bg-black/40" onClick={handleMinimize} />

      <div
        className={`fixed z-[70] flex flex-col overflow-hidden transition-all duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl
          sm:bottom-5 sm:right-5 sm:left-auto sm:w-[460px] sm:rounded-2xl sm:shadow-2xl
          border border-slate-200
          ${visible && panelState === "full" ? "opacity-100 translate-y-0 sm:scale-100" : "opacity-0 translate-y-full sm:translate-y-4 sm:scale-95"}`}
        style={{ height: "88dvh", maxHeight: "88dvh", background: "#fff" }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@media(min-width:640px){.aichat-r{height:min(700px,90dvh)!important;max-height:min(700px,90dvh)!important}}`}</style>
        <div className="aichat-r flex flex-col h-full w-full">

          <DocAiChatHeader
            docName={doc.name}
            currentContent={currentContent}
            justUpdated={justUpdated}
            analyzing={false}
            editLoading={editLoading}
            editCount={editCount}
            historyCount={history.length}
            onClose={handleClose}
            onMinimize={handleMinimize}
          />

          <DocAiChatMessages
            messages={messages}
            analyzing={false}
            editLoading={editLoading}
            pendingPartial={pendingPartial}
            docName={doc.name}
            currentContent={currentContent}
            onContinuePartial={handleContinuePartial}
            onDeclinePartial={handleDeclinePartial}
          />

          <DocAiChatInput
            editInput={editInput}
            editCost={editCost}
            editErr={editErr}
            editLoading={editLoading}
            analyzing={false}
            analysisDone={analysisDone && accessChecked}
            pendingConfirm={pendingConfirm}
            pendingPartial={pendingPartial}
            editCount={editCount}
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
