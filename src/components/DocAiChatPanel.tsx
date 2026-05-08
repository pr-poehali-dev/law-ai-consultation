import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import {
  getToken, getUser, hasActiveSubscription,
  consumeQuestion,
  checkAndConsumeEditResources,
  getDailyFreeLeft,
} from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import { type DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

interface DocAiChatPanelProps {
  doc: { name: string; content: string; recommendations?: DocRecommendationItem[] };
  onClose: () => void;
  onPaymentRequired: () => void;
  onDocUpdated?: (newContent: string) => void;
}

type AiMsg = {
  role: "ai" | "user";
  text: string;
  isEdited?: boolean;
  editNum?: number;
  partialNote?: string;
};

// 1 правка = 1 вопрос + 1 документ / 2500 символов
function calcEditCost(docContent: string, instruction: string) {
  const docs = Math.max(1, Math.ceil((docContent.length + instruction.length) / 2500));
  return { docs, questions: 1 };
}

// Парсим текст анализа AI на секции по двойному переносу
function renderAnalysisText(text: string) {
  const sections = text.split("\n\n").filter(Boolean);
  if (sections.length <= 1) {
    return <p className="text-[12.5px] text-navy-200 leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  return (
    <div className="space-y-2.5">
      {sections.map((sec, i) => {
        const lines = sec.trim().split("\n");
        const head = lines[0];
        const body = lines.slice(1).join("\n").trim();
        const cp = head.codePointAt(0) ?? 0;
        const isEmoji = (cp >= 0x2600 && cp <= 0x27FF) || (cp >= 0x1F300 && cp <= 0x1FAFF);
        return (
          <div key={i} className={isEmoji ? "rounded-xl bg-navy-700/60 border border-navy-600/40 px-3 py-2" : ""}>
            {isEmoji && <p className="text-[11px] font-bold text-gold-400 mb-1">{head}</p>}
            {body
              ? <p className="text-[12px] text-navy-200 leading-relaxed whitespace-pre-wrap">{body}</p>
              : !isEmoji && <p className="text-[12.5px] text-navy-200 leading-relaxed">{head}</p>
            }
          </div>
        );
      })}
    </div>
  );
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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, analyzing, editLoading]);

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
  const cost = editCost;

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

          {/* ── Шапка ── */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-navy-700/60"
            style={{ background: justUpdated ? "linear-gradient(135deg,#0f4028,#0a2820)" : "linear-gradient(135deg,#0a1628,#162d5a)" }}>
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.35)" }}>
                {justUpdated
                  ? <Icon name="CheckCircle" size={18} className="text-gold-400" />
                  : <Icon name="Scale" size={18} className="text-gold-400" />
                }
              </div>
              {(analyzing || editLoading) && (
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-navy-800 ${editLoading ? "bg-gold-400 animate-ping" : "bg-gold-500 animate-pulse"}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white leading-tight">
                  {justUpdated ? "Документ обновлён!" : "AI-помощник"}
                </p>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}>
                  Профи+
                </span>
              </div>
              <p className="text-[10px] text-navy-300 truncate">
                {justUpdated ? `Правка #${editCount} — изменения подсвечены в документе` : doc.name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {editCount > 0 && (
                <button onClick={() => downloadDoc(doc.name, currentContent)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors active:scale-95"
                  style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}>
                  <Icon name="Download" size={12} />
                  <span className="hidden sm:inline">Скачать</span>
                </button>
              )}
              <button onClick={handleClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-navy-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <Icon name="X" size={15} />
              </button>
            </div>
          </div>

          {/* Полоска цены */}
          <div className="flex items-center justify-between px-4 py-1.5 shrink-0 border-b border-navy-700/40"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] text-navy-400">
              1 правка = 1 вопрос + 1 документ / 2500 символов
            </p>
            {editCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(240,192,96,0.15)", color: "#f0c060" }}>
                Правок: {editCount}
              </span>
            )}
          </div>

          {/* ── Чат ── */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                    style={{ background: msg.isEdited ? "linear-gradient(135deg,#0f4028,#0a3020)" : "linear-gradient(135deg,#162d5a,#0f2040)", border: `1px solid ${msg.isEdited ? "rgba(52,211,153,0.3)" : "rgba(240,192,96,0.25)"}` }}>
                    <Icon name={msg.isEdited ? "CheckCircle" : "Scale"} size={12} className={msg.isEdited ? "text-emerald-400" : "text-gold-400"} />
                  </div>
                )}
                <div className={`max-w-[90%] rounded-2xl px-3 py-2.5 shadow-sm text-[12px] leading-relaxed ${
                  msg.role === "ai"
                    ? msg.isEdited
                      ? "rounded-tl-sm border border-emerald-500/30"
                      : "rounded-tl-sm border border-navy-600/50"
                    : "rounded-tr-sm"
                }`}
                style={{
                  background: msg.role === "user"
                    ? "linear-gradient(135deg,#1e3a6e,#162d5a)"
                    : msg.isEdited
                      ? "rgba(16,60,40,0.8)"
                      : "rgba(22,45,90,0.6)",
                }}>
                  {msg.isEdited && (
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5" style={{ borderBottom: "1px solid rgba(52,211,153,0.2)" }}>
                      <Icon name="Pencil" size={10} className="text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Правка #{msg.editNum}</span>
                    </div>
                  )}
                  {msg.role === "ai" && !msg.isEdited
                    ? renderAnalysisText(msg.text)
                    : <p className="whitespace-pre-wrap text-navy-100">{msg.text}</p>
                  }
                  {msg.partialNote && (
                    <div className="mt-2 p-2 rounded-lg" style={{ background: "rgba(240,192,96,0.1)", border: "1px solid rgba(240,192,96,0.2)" }}>
                      <p className="text-[10px] font-bold text-gold-400 mb-0.5">Не было внесено:</p>
                      <p className="text-[10px] text-navy-300 leading-relaxed">{msg.partialNote}</p>
                    </div>
                  )}
                  {msg.isEdited && (
                    <button onClick={() => downloadDoc(doc.name, currentContent)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95"
                      style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}>
                      <Icon name="Download" size={12} />Скачать .docx
                    </button>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold"
                    style={{ background: "linear-gradient(135deg,#1e3a6e,#162d5a)", border: "1px solid rgba(240,192,96,0.2)", color: "#f0c060" }}>
                    Я
                  </div>
                )}
              </div>
            ))}

            {/* Предложение продолжить partial */}
            {pendingPartial && !editLoading && (
              <div className="rounded-2xl p-3 space-y-2 border border-gold-500/30"
                style={{ background: "rgba(240,192,96,0.08)" }}>
                <p className="text-[11px] font-semibold text-gold-400">Внести оставшуюся часть правки?</p>
                <p className="text-[10px] text-navy-300 leading-relaxed">{pendingPartial.note}</p>
                <div className="flex gap-2">
                  <button onClick={handleDeclinePartial}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-navy-600 text-navy-300 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    Нет
                  </button>
                  <button onClick={handleContinuePartial}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95"
                    style={{ background: "rgba(240,192,96,0.15)", border: "1px solid rgba(240,192,96,0.3)", color: "#f0c060" }}>
                    Да, внести
                  </button>
                </div>
              </div>
            )}

            {/* Анализ */}
            {analyzing && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.25)" }}>
                  <Icon name="Scale" size={12} className="text-gold-400 animate-pulse" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 border border-navy-600/50"
                  style={{ background: "rgba(22,45,90,0.6)" }}>
                  <div className="flex items-center gap-2">
                    {[0,1,2].map(j => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: `${j*160}ms` }} />
                    ))}
                    <span className="text-[11px] text-navy-300">Анализирую документ...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Редактирование */}
            {editLoading && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg,#0f4028,#0a3020)", border: "1px solid rgba(52,211,153,0.3)" }}>
                  <Icon name="PenLine" size={12} className="text-emerald-400" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 border border-emerald-500/20"
                  style={{ background: "rgba(16,60,40,0.7)" }}>
                  <div className="flex items-center gap-2">
                    {[0,1,2].map(j => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${j*160}ms` }} />
                    ))}
                    <span className="text-[11px] text-emerald-400 font-medium">Вношу правку в документ...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ── Подтверждение стоимости ── */}
          {pendingConfirm && cost && (
            <div className="px-3 sm:px-4 py-3 border-t shrink-0"
              style={{ borderColor: "rgba(240,192,96,0.2)", background: "rgba(240,192,96,0.06)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name="AlertCircle" size={14} className="text-gold-400 shrink-0" />
                <p className="text-[11px] font-bold text-gold-400">Подтвердите редактирование</p>
              </div>
              <p className="text-[10px] text-navy-300 mb-2.5 leading-relaxed line-clamp-2">«{editInput}»</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 rounded-xl p-2 text-center border border-navy-600">
                  <p className="text-lg font-bold text-white">{cost.docs}</p>
                  <p className="text-[9px] text-navy-400">{cost.docs === 1 ? "документ" : "документа"}</p>
                </div>
                <Icon name="Plus" size={14} className="text-navy-500 shrink-0" />
                <div className="flex-1 rounded-xl p-2 text-center border border-navy-600">
                  <p className="text-lg font-bold text-white">1</p>
                  <p className="text-[9px] text-navy-400">вопрос</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPendingConfirm(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-navy-300 border border-navy-600 transition-colors hover:text-white"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  Отмена
                </button>
                <button onClick={handleConfirmEdit}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors active:scale-95"
                  style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.4)", color: "#f0c060" }}>
                  Подтвердить
                </button>
              </div>
            </div>
          )}

          {/* ── Поле ввода ── */}
          {!pendingConfirm && (
            <div className="px-3 sm:px-4 py-3 border-t shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(10,22,40,0.8)" }}>
              {editErr && (
                <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mb-2 border border-red-500/30"
                  style={{ background: "rgba(239,68,68,0.1)" }}>
                  <Icon name="AlertCircle" size={11} className="text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-400">{editErr}</span>
                </div>
              )}
              {cost && (
                <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mb-2 border border-gold-500/20"
                  style={{ background: "rgba(240,192,96,0.06)" }}>
                  <Icon name="Banknote" size={11} className="text-gold-500 shrink-0" />
                  <span className="text-[10px] text-gold-400">
                    Стоимость: <b>{cost.docs} {cost.docs === 1 ? "документ" : "документа"}</b> + <b>1 вопрос</b>
                  </span>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={editInput}
                  onChange={e => handleEditInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={editLoading || analyzing || !!pendingPartial}
                  placeholder={
                    !analysisDone ? "Дождитесь анализа..." :
                    pendingPartial ? "Ответьте выше..." :
                    "Опишите правку... (Ctrl+Enter)"
                  }
                  rows={2}
                  className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none resize-none leading-relaxed disabled:opacity-40 placeholder:text-navy-500 transition-colors text-white"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    maxHeight: "80px",
                  }}
                  onFocus={e => { e.target.style.borderColor = "rgba(240,192,96,0.4)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
                <button
                  onClick={handleEditRequest}
                  disabled={!editInput.trim() || editLoading || analyzing || !analysisDone || !!pendingPartial}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 shrink-0"
                  style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.35)" }}>
                  {editLoading
                    ? <Icon name="Loader" size={15} className="text-gold-400 animate-spin" />
                    : <Icon name="Send" size={15} className="text-gold-400" />
                  }
                </button>
              </div>
              <p className="text-[9px] text-navy-500 mt-1 text-center">
                {editCount > 0 ? `Правок: ${editCount} · изменения подсвечены в документе` : "Опишите что изменить — AI внесёт точечную правку"}
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
