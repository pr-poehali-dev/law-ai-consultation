import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import {
  getToken, getUser, hasActiveSubscription,
  canUseDoc, consumeDoc, canAskQuestion, consumeQuestion,
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

type AiMsg = { role: "ai" | "user"; text: string; isEdited?: boolean; editNum?: number };

function estimateTokens(docContent: string, instruction: string): number {
  return Math.ceil((docContent.length + instruction.length) / 4) + 1000;
}
function tokensToResources(tokens: number) {
  return { docs: Math.max(1, Math.ceil(tokens / 1000)), questions: 1 };
}

async function checkProAccess(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")) return true;
  return user.paidQuestions >= 30 || user.paidDocs >= 10;
}

export default function DocAiChatPanel({ doc, onClose, onPaymentRequired, onDocUpdated }: DocAiChatPanelProps) {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);

  const [currentContent, setCurrentContent] = useState(doc.content);
  const [editInput, setEditInput] = useState("");
  const [editTokenEst, setEditTokenEst] = useState<{ tokens: number; docs: number; questions: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editCount, setEditCount] = useState(0);
  // Флаг "документ только что обновлён" — показываем flash-эффект в шапке
  const [justUpdated, setJustUpdated] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, analyzing, editLoading]);

  // Автозапуск анализа при открытии
  useEffect(() => { runAnalysis(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = async () => {
    const hasPro = await checkProAccess();
    if (!hasPro) { onPaymentRequired(); return; }
    setAnalyzing(true);
    setMessages([{
      role: "ai",
      text: "Добрый день! Я AI-помощник. Изучаю документ — проверяю юридическую корректность, оцениваю перспективу и анализирую судебную практику...",
    }]);
    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "doc_ai_review", doc_name: doc.name, doc_content: currentContent.slice(0, 3500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      setMessages(prev => [...prev, { role: "ai", text: data.answer || "Анализ завершён." }]);
      setAnalysisDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка анализа.";
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${msg}` }]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleEditInputChange = (v: string) => {
    setEditInput(v);
    if (v.trim().length > 8) {
      const tokens = estimateTokens(currentContent, v);
      setEditTokenEst({ tokens, ...tokensToResources(tokens) });
    } else {
      setEditTokenEst(null);
    }
  };

  const handleEditRequest = () => {
    if (!editInput.trim() || !analysisDone) return;
    setPendingConfirm(true);
  };

  const handleConfirmEdit = async () => {
    if (!editTokenEst) return;
    setPendingConfirm(false);
    setEditLoading(true);
    setEditErr("");

    const canDoc = await canUseDoc();
    if (!canDoc) { setEditLoading(false); onPaymentRequired(); return; }
    const canAsk = await canAskQuestion();
    if (!canAsk) { setEditLoading(false); onPaymentRequired(); return; }

    let docsLeft = editTokenEst.docs;
    while (docsLeft > 0) {
      const ok = await consumeDoc();
      if (!ok) { setEditLoading(false); onPaymentRequired(); return; }
      docsLeft--;
    }
    await consumeQuestion();

    const userInstruction = editInput;
    const thisEditNum = editCount + 1;
    setMessages(prev => [...prev, { role: "user", text: userInstruction }]);
    setEditInput("");
    setEditTokenEst(null);

    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "doc_edit",
          doc_name: doc.name,
          doc_content: currentContent,
          edit_instruction: userInstruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка редактирования");
      const newContent = data.answer || "";
      setCurrentContent(newContent);
      setEditCount(thisEditNum);
      if (onDocUpdated) onDocUpdated(newContent);
      // Flash-эффект "документ обновлён"
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 2500);

      const docsWord = editTokenEst.docs === 1 ? "документ" : "документа";
      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          text: `Правка №${thisEditNum} внесена. Документ обновлён в предпросмотре.\n\nСписано: ${editTokenEst.docs} ${docsWord} + 1 вопрос.\n\nМожете продолжать вносить правки или скачать готовый документ.`,
          isEdited: true,
          editNum: thisEditNum,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка редактирования.";
      setEditErr(msg);
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${msg}` }]);
    } finally {
      setEditLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !pendingConfirm && editInput.trim()) {
      e.preventDefault();
      handleEditRequest();
    }
  };

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  return (
    <>
      {/* Полупрозрачный backdrop на мобиле */}
      <div
        className="fixed inset-0 z-[69] sm:hidden bg-black/30"
        onClick={handleClose}
      />

      <div
        className={`fixed z-[70] flex flex-col bg-white overflow-hidden transition-all duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl
          sm:bottom-5 sm:right-5 sm:left-auto sm:w-[440px] sm:rounded-2xl sm:shadow-2xl sm:border sm:border-slate-200/80
          ${visible ? "opacity-100 translate-y-0 sm:scale-100" : "opacity-0 translate-y-full sm:translate-y-4 sm:scale-95"}`}
        style={{ height: "88dvh", maxHeight: "88dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@media (min-width: 640px) { .aichat-root { height: min(680px,90dvh) !important; max-height: min(680px,90dvh) !important; } }`}</style>
        <div className="aichat-root flex flex-col h-full w-full">

          {/* ── Шапка ── */}
          <div className={`flex items-center gap-3 px-4 py-3 shrink-0 transition-all duration-500 ${justUpdated ? "bg-gradient-to-r from-emerald-600 to-teal-600" : "bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-700"}`}>
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/25">
                {justUpdated
                  ? <Icon name="CheckCircle" size={18} className="text-white" />
                  : <Icon name="BrainCircuit" size={18} className="text-white" />
                }
              </div>
              {analyzing && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
              )}
              {editLoading && !analyzing && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-400 border-2 border-white animate-ping" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                {justUpdated ? "Документ обновлён!" : "AI-помощник"}
              </p>
              <p className="text-[10px] text-white/60 truncate">
                {justUpdated ? `Правка №${editCount} внесена в предпросмотр` : doc.name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {editCount > 0 && (
                <button
                  onClick={() => downloadDoc(doc.name, currentContent)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition-colors active:scale-95"
                >
                  <Icon name="Download" size={12} />
                  <span className="hidden sm:inline">Скачать</span>
                </button>
              )}
              <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                <Icon name="X" size={15} />
              </button>
            </div>
          </div>

          {/* Бейдж стоимости */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 shrink-0">
            <p className="text-[10px] text-indigo-600">
              1 правка = 1 вопрос + 1 документ / 1000 токенов
            </p>
            {editCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                Правок: {editCount}
              </span>
            )}
          </div>

          {/* ── Чат ── */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${msg.isEdited ? "bg-gradient-to-br from-emerald-500 to-teal-500" : "bg-gradient-to-br from-indigo-600 to-violet-600"}`}>
                    <Icon name={msg.isEdited ? "CheckCircle" : "Sparkles"} size={12} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed shadow-sm ${
                  msg.role === "ai"
                    ? msg.isEdited
                      ? "bg-emerald-50 border border-emerald-200 text-navy-700 rounded-tl-sm"
                      : "bg-slate-50 border border-slate-100 text-navy-700 rounded-tl-sm"
                    : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tr-sm"
                }`}>
                  {msg.isEdited && (
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-emerald-200">
                      <Icon name="Pencil" size={11} className="text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Правка #{msg.editNum} внесена</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.isEdited && (
                    <button
                      onClick={() => downloadDoc(doc.name, currentContent)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-700 hover:bg-navy-800 text-white text-[11px] font-bold transition-colors active:scale-95"
                    >
                      <Icon name="Download" size={12} />Скачать обновлённый .docx
                    </button>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-indigo-700">
                    Вы
                  </div>
                )}
              </div>
            ))}

            {/* Индикатор анализа */}
            {analyzing && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0">
                  <Icon name="Sparkles" size={12} className="text-white animate-pulse" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(j => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">Анализирую документ...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Индикатор редактирования */}
            {editLoading && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shrink-0">
                  <Icon name="PenLine" size={12} className="text-white" />
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(j => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
                      ))}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">Вношу правки в документ...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Подтверждение стоимости ── */}
          {pendingConfirm && editTokenEst && (
            <div className="px-3 sm:px-4 py-3 border-t border-slate-100 bg-amber-50 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="AlertCircle" size={14} className="text-amber-600 shrink-0" />
                <p className="text-[11px] font-bold text-amber-800">Подтвердите редактирование</p>
              </div>
              <p className="text-[10px] text-amber-700 mb-2.5 leading-relaxed line-clamp-2">«{editInput}»</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-white rounded-xl p-2 border border-amber-200 text-center">
                  <p className="text-lg font-bold text-navy-800">{editTokenEst.docs}</p>
                  <p className="text-[9px] text-slate-500">{editTokenEst.docs === 1 ? "документ" : "документа"}</p>
                </div>
                <Icon name="Plus" size={14} className="text-amber-400 shrink-0" />
                <div className="flex-1 bg-white rounded-xl p-2 border border-amber-200 text-center">
                  <p className="text-lg font-bold text-navy-800">1</p>
                  <p className="text-[9px] text-slate-500">вопрос</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPendingConfirm(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                  Отмена
                </button>
                <button onClick={handleConfirmEdit} className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors active:scale-95">
                  Подтвердить
                </button>
              </div>
            </div>
          )}

          {/* ── Поле ввода ── */}
          {!pendingConfirm && (
            <div className="px-3 sm:px-4 py-3 border-t border-slate-100 bg-white shrink-0">
              {editErr && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-2.5 py-1.5 mb-2">
                  <Icon name="AlertCircle" size={11} className="text-red-500 shrink-0" />
                  <span className="text-[10px] text-red-600">{editErr}</span>
                </div>
              )}
              {editTokenEst && !pendingConfirm && (
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-xl px-2.5 py-1.5 mb-2">
                  <Icon name="Banknote" size={11} className="text-indigo-500 shrink-0" />
                  <span className="text-[10px] text-indigo-700">
                    Стоимость: <b>{editTokenEst.docs} {editTokenEst.docs === 1 ? "документ" : "документа"}</b> + <b>1 вопрос</b>
                  </span>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={editInput}
                  onChange={e => handleEditInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={editLoading || analyzing}
                  placeholder={
                    !analysisDone ? "Дождитесь анализа..." :
                    "Опишите правку (Ctrl+Enter = отправить)"
                  }
                  rows={2}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none leading-relaxed disabled:opacity-40 placeholder:text-slate-300 transition-colors"
                  style={{ maxHeight: "80px" }}
                />
                <button
                  onClick={handleEditRequest}
                  disabled={!editInput.trim() || editLoading || analyzing || !analysisDone}
                  className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-all active:scale-95 shrink-0"
                >
                  {editLoading
                    ? <Icon name="Loader" size={15} className="text-white animate-spin" />
                    : <Icon name="Send" size={15} className="text-white" />
                  }
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-1 text-center">
                {editCount > 0
                  ? `Внесено правок: ${editCount} · документ обновлён в предпросмотре`
                  : "Укажите что изменить — AI внесёт точечную правку в документ"
                }
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}