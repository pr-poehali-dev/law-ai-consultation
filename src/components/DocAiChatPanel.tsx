import { useState, useEffect, useRef } from "react";
import {
  getToken, getUser, hasActiveSubscription,
  consumeQuestion,
  checkAndConsumeEditResources,
  getDailyFreeLeft,
} from "@/lib/auth";
import { type DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import func2url from "../../backend/func2url.json";
import { type AiMsg, calcEditCost } from "./DocAiChatTypes";
import DocAiChatHeader from "./DocAiChatHeader";
import DocAiChatMessages from "./DocAiChatMessages";
import DocAiChatInput from "./DocAiChatInput";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

interface DocAiChatPanelProps {
  doc: { name: string; content: string; recommendations?: DocRecommendationItem[] };
  onClose: () => void;
  onPaymentRequired: () => void;
  onDocUpdated?: (newContent: string) => void;
}

export default function DocAiChatPanel({ doc, onClose, onPaymentRequired, onDocUpdated }: DocAiChatPanelProps) {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const analysisStartedRef = useRef(false);

  const [currentContent, setCurrentContent] = useState(doc.content);
  const [editInput, setEditInput] = useState("");
  const [editCost, setEditCost] = useState<{ docs: number; questions: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editCount, setEditCount] = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);
  const [pendingPartial, setPendingPartial] = useState<{ note: string; instruction: string } | null>(null);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (!analysisStartedRef.current) { analysisStartedRef.current = true; runAnalysis(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = async () => {
    const user = await getUser();
    if (!user) { onPaymentRequired(); return; }
    const isPro = user.isAdmin || hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs") || user.paidQuestions >= 30 || user.paidDocs >= 10;
    if (!isPro) { onPaymentRequired(); return; }
    const hasQ = user.isAdmin || hasActiveSubscription(user, "consult") || getDailyFreeLeft() > 0 || user.paidQuestions > 0;
    if (!hasQ) { onPaymentRequired(); return; }
    await consumeQuestion();

    setAnalyzing(true);
    setMessages([{ role: "ai", text: "Изучаю документ — проверяю юридическую корректность, перспективу и применимую практику..." }]);
    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "doc_ai_review", doc_name: doc.name, doc_content: currentContent.slice(0, 2500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      setMessages(prev => [...prev, { role: "ai", text: data.answer || "Анализ завершён." }]);
      setAnalysisDone(true);
    } catch (e) {
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${e instanceof Error ? e.message : "Ошибка анализа."}` }]);
      setAnalysisDone(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleEditInputChange = (v: string) => {
    setEditInput(v);
    setEditCost(v.trim().length > 4 ? calcEditCost(currentContent, v) : null);
  };

  const handleEditRequest = () => {
    if (!editInput.trim() || !analysisDone) return;
    setPendingConfirm(true);
  };

  const doEdit = async (instruction: string, isResume = false) => {
    setEditLoading(true);
    setEditErr("");
    setPendingPartial(null);

    if (!isResume) {
      const cost = calcEditCost(currentContent, instruction);
      const result = await checkAndConsumeEditResources(cost.docs);
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
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 3000);
      }

      if (partialNote) {
        setPendingPartial({ note: partialNote, instruction });
        setMessages(prev => [...prev, { role: "ai", text: `Правка #${thisEditNum} частично внесена. Документ обновлён.`, isEdited: true, editNum: thisEditNum, partialNote }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", text: `Правка #${thisEditNum} внесена. Документ обновлён в предпросмотре — изменения подсвечены зелёным.`, isEdited: true, editNum: thisEditNum }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка редактирования.";
      setEditErr(msg);
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${msg}` }]);
    } finally {
      setEditLoading(false);
    }
  };

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

  return (
    <>
      {/* Backdrop мобиль */}
      <div className="fixed inset-0 z-[69] sm:hidden bg-black/50" onClick={handleClose} />

      <div
        className={`fixed z-[70] flex flex-col overflow-hidden transition-all duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl
          sm:bottom-5 sm:right-5 sm:left-auto sm:w-[460px] sm:rounded-2xl sm:shadow-2xl
          border border-navy-600/50
          ${visible ? "opacity-100 translate-y-0 sm:scale-100" : "opacity-0 translate-y-full sm:translate-y-4 sm:scale-95"}`}
        style={{
          height: "88dvh", maxHeight: "88dvh",
          background: "linear-gradient(180deg, #0a1628 0%, #0f2040 100%)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@media(min-width:640px){.aichat-r{height:min(700px,90dvh)!important;max-height:min(700px,90dvh)!important}}`}</style>
        <div className="aichat-r flex flex-col h-full w-full">

          <DocAiChatHeader
            docName={doc.name}
            currentContent={currentContent}
            justUpdated={justUpdated}
            analyzing={analyzing}
            editLoading={editLoading}
            editCount={editCount}
            onClose={handleClose}
          />

          <DocAiChatMessages
            messages={messages}
            analyzing={analyzing}
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
            analyzing={analyzing}
            analysisDone={analysisDone}
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
