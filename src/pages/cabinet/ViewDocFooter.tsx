import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];

interface AiChatMsg {
  role: "user" | "ai";
  text: string;
}

interface ViewDocFooterProps {
  docName: string;
  currentDocContent: string;
  sentToLawyer: boolean;
  sendingToLawyer: boolean;
  showLawyerSuccess: boolean;
  onCloseLawyerSuccess: () => void;
  recsAnalyzing: boolean;
  hasRecs: boolean;
  liveRecs: DocRecommendationItem[];
  showRecs: boolean;
  reportOpen: boolean;
  reportText: string;
  reportLoading: boolean;
  reportSent: boolean;
  paidQuestions: number;
  onSendToLawyer: (comment: string) => void;
  onAiEditorClick: () => void;
  onToggleRecs: () => void;
  onClose: () => void;
  onOpenReport: () => void;
  onCloseReport: () => void;
  onReportTextChange: (v: string) => void;
  onSendReport: () => void;
  onPayForQuestions: () => void;
}

export default function ViewDocFooter({
  docName,
  currentDocContent,
  sentToLawyer,
  sendingToLawyer,
  showLawyerSuccess,
  onCloseLawyerSuccess,
  recsAnalyzing,
  hasRecs,
  liveRecs,
  showRecs,
  reportOpen,
  reportText,
  reportLoading,
  reportSent,
  paidQuestions,
  onSendToLawyer,
  onAiEditorClick,
  onToggleRecs,
  onClose,
  onOpenReport,
  onCloseReport,
  onReportTextChange,
  onSendReport,
  onPayForQuestions,
}: ViewDocFooterProps) {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [lawyerComment, setLawyerComment] = useState("");

  // AI-чат по заполнению
  const [showAiFillChat, setShowAiFillChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiChatMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAiFillChat && aiMessages.length === 0) {
      setAiMessages([{
        role: "ai",
        text: `Привет! Я помогу разобраться с заполнением документа «${docName}». Задайте любой вопрос — например, что именно писать в то или иное поле.`,
      }]);
    }
  }, [showAiFillChat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showAiFillChat) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [aiMessages, showAiFillChat]);

  const handleOpenAiChat = () => {
    setShowAiFillChat(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleAiSend = async () => {
    const text = aiInput.trim();
    if (!text || aiTyping) return;

    if (paidQuestions <= 0) {
      onPayForQuestions();
      return;
    }

    const userMsg: AiChatMsg = { role: "user", text };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput("");
    setAiTyping(true);

    try {
      const token = getToken();
      const systemPrompt = `Ты AI-юрист-помощник. Пользователь работает с документом: "${docName}". Помогай только по вопросам заполнения реквизитов этого документа. Отвечай кратко, по делу, на русском языке. Не предлагай другие услуги.`;
      const history = [
        { role: "system", content: systemPrompt },
        ...aiMessages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
        { role: "user", content: text },
      ];
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "chat", messages: history }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiMessages(prev => [...prev, { role: "ai", text: data.answer || "Не удалось получить ответ" }]);
      } else {
        setAiMessages(prev => [...prev, { role: "ai", text: "Произошла ошибка. Попробуйте ещё раз." }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: "ai", text: "Нет соединения. Попробуйте ещё раз." }]);
    } finally {
      setAiTyping(false);
    }
  };

  const handleOpenComment = () => {
    setLawyerComment("");
    setShowCommentModal(true);
  };

  const handleSubmitComment = () => {
    setShowCommentModal(false);
    onSendToLawyer(lawyerComment);
  };

  return (
    <>
      {/* Нижняя панель */}
      <div className="border-t border-slate-100 px-4 sm:px-5 py-3 shrink-0 bg-slate-50/80 rounded-b-3xl space-y-2">
        {sentToLawyer ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200">
            <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
            <p className="text-xs font-medium text-emerald-700">Отправлен юристу</p>
          </div>
        ) : (
          <button onClick={handleOpenComment} disabled={sendingToLawyer}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)", border: "1px solid rgba(232,168,32,0.3)", color: "#f0c060" }}>
            {sendingToLawyer
              ? <><span className="w-3.5 h-3.5 border-2 border-gold-400/40 border-t-gold-400 rounded-full animate-spin" />Отправляю...</>
              : <><Icon name="UserCheck" size={13} color="#f0c060" />Отправить на проверку юристу</>}
          </button>
        )}

        {/* Кнопка AI-консультанта по заполнению */}
        <button
          onClick={handleOpenAiChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 shadow-sm"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <Icon name="MessagesSquare" size={13} />
          Уточнить у AI-юриста по заполнению
        </button>

        {/* Кнопка AI-помощника */}
        <button
          onClick={onAiEditorClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white transition-all active:scale-95 shadow-sm"
        >
          <Icon name="BrainCircuit" size={13} />
          Редактировать документ с помощью AI
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold">Профи+</span>
        </button>
        <p className="text-[10px] text-slate-400 text-center leading-snug">
          Анализ · Перспектива · Судебная практика · Редактирование
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button onClick={onOpenReport} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <Icon name="AlertTriangle" size={10} />Проблема
          </button>
          <div className="flex gap-2 items-center">
            {recsAnalyzing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] text-slate-400 bg-slate-100">
                <Icon name="Loader" size={10} className="animate-spin" />
                Анализ...
              </div>
            )}
            {hasRecs && !recsAnalyzing && (
              <button
                onClick={onToggleRecs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
              >
                <Icon name="Sparkles" size={11} />
                Рекомендации ({liveRecs.length})
              </button>
            )}
            <button onClick={onClose} className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-navy-200 hover:bg-white transition-colors font-medium">
              Закрыть
            </button>
            <button onClick={() => downloadDoc(docName, currentDocContent)} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold">
              <Icon name="Download" size={12} />Скачать
            </button>
          </div>
        </div>
      </div>

      {/* ── AI-чат по заполнению документа ── */}
      {showAiFillChat && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:px-4" onClick={() => setShowAiFillChat(false)}>
          <div
            className="relative w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "85dvh", background: "#f8fafc" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Шапка */}
            <div className="flex items-center gap-3 px-4 py-3.5 shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon name="Bot" size={16} color="white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">AI-юрист</p>
                <p className="text-[10px] text-white/60 truncate">По заполнению: {docName}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15">
                  <Icon name="MessageCircle" size={10} color="white" />
                  <span className="text-[10px] font-semibold text-white">{paidQuestions} вопр.</span>
                </div>
                <button onClick={() => setShowAiFillChat(false)} className="w-7 h-7 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                  <Icon name="X" size={14} color="white" />
                </button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                  {msg.role === "ai" && (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                      <Icon name="Bot" size={12} color="white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-tr-sm text-white"
                        : "rounded-tl-sm text-navy-800 border border-slate-200"
                    }`}
                    style={msg.role === "user"
                      ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }
                      : { background: "white" }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {aiTyping && (
                <div className="flex justify-start gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                    <Icon name="Bot" size={12} color="white" />
                  </div>
                  <div className="px-3.5 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              {/* Баннер докупки вопросов */}
              {paidQuestions <= 0 && (
                <div className="rounded-2xl p-4 border" style={{ background: "linear-gradient(135deg,#fff7ed,#fef3c7)", borderColor: "#fbbf24" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Zap" size={14} className="text-amber-600 shrink-0" />
                    <p className="text-xs font-bold text-amber-800">Вопросы закончились</p>
                  </div>
                  <p className="text-[11px] text-amber-700 mb-3 leading-relaxed">
                    Докупите пакет вопросов, чтобы продолжить общение с AI-юристом
                  </p>
                  <button
                    onClick={onPayForQuestions}
                    className="w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#0a1628" }}
                  >
                    +3 вопроса · 199 ₽
                  </button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Ввод */}
            <div className="shrink-0 px-3 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAiSend()}
                  placeholder={paidQuestions > 0 ? "Что писать в поле «ФИО»?" : "Нет доступных вопросов..."}
                  disabled={paidQuestions <= 0 || aiTyping}
                  className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 disabled:opacity-50"
                  style={{ border: "1.5px solid transparent" }}
                  onFocus={e => { e.target.style.borderColor = "#1a6bb5"; e.target.style.background = "white"; }}
                  onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "#f1f5f9"; }}
                />
                <button
                  onClick={handleAiSend}
                  disabled={!aiInput.trim() || aiTyping || paidQuestions <= 0}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 shrink-0"
                  style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
                >
                  {aiTyping
                    ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Icon name="Send" size={14} color="white" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1.5">
                Вопросы по заполнению реквизитов документа
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Комментарий для юриста */}
      {showCommentModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCommentModal(false)}>
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "linear-gradient(160deg,#0a1628 0%,#162d5a 60%,#0d2040 100%)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(232,168,32,0.12) 0%, transparent 70%)", transform: "translate(20%,-20%)" }} />

            <div className="relative px-6 pt-7 pb-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.25)" }}>
                    <Icon name="MessageSquare" size={18} color="#f0c060" />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#f0c060" }}>Юрист-эксперт</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Проверка документа</p>
                  </div>
                </div>
                <button onClick={() => setShowCommentModal(false)} className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10">
                  <Icon name="X" size={15} color="rgba(255,255,255,0.4)" />
                </button>
              </div>

              <p className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                Укажите комментарии для юриста-эксперта по ситуации:
              </p>

              <textarea
                value={lawyerComment}
                onChange={e => setLawyerComment(e.target.value)}
                placeholder="Например: хочу понять, насколько документ защищает мои интересы, или есть ли риски при подписании..."
                rows={5}
                autoFocus
                className="w-full text-sm outline-none resize-none rounded-2xl px-4 py-3 transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", caretColor: "#f0c060" }}
                onFocus={e => { e.target.style.borderColor = "rgba(232,168,32,0.4)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
              <p className="text-[10px] mt-1.5 mb-5" style={{ color: "rgba(255,255,255,0.3)" }}>
                Комментарий необязателен — можно оставить пустым
              </p>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowCommentModal(false)}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmitComment}
                  className="flex-[2] py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}
                >
                  <Icon name="Send" size={14} color="#0a1628" />
                  Отправить юристу
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Документ успешно отправлен юристу */}
      {showLawyerSuccess && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={onCloseLawyerSuccess}>
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "linear-gradient(160deg,#0a1628 0%,#162d5a 60%,#0d2040 100%)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #e8a820 0%, transparent 70%)", transform: "translate(30%,-30%)" }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #e8a820 0%, transparent 70%)", transform: "translate(-40%,40%)" }} />

            <div className="relative px-6 pt-8 pb-6">
              <div className="flex justify-center mb-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.3)" }}>
                    <Icon name="Send" size={36} color="#f0c060" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    <Icon name="Check" size={14} color="white" />
                  </div>
                </div>
              </div>

              <h3 className="text-center font-bold text-xl mb-1.5" style={{ color: "#f0c060" }}>Документ отправлен!</h3>
              <p className="text-center text-sm mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>
                Юрист получил ваш документ на проверку
              </p>

              <div className="rounded-2xl mb-5 p-4 space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)" }}>
                    <Icon name="Clock" size={15} color="#f0c060" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Среднее время ответа</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>от 1 до 6 часов</p>
                  </div>
                </div>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Icon name="AlertCircle" size={15} color="rgba(255,255,255,0.4)" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>При высокой загруженности</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>задержка до 12 часов</p>
                  </div>
                </div>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.12)" }}>
                    <Icon name="MessageSquare" size={15} color="#f0c060" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Результат проверки</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>юрист ответит в чате по документу</p>
                  </div>
                </div>
              </div>

              <button
                onClick={onCloseLawyerSuccess}
                className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Сообщить о проблеме */}
      {reportOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onCloseReport}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-navy-800 text-lg mb-2">Сообщение получено</h3>
                <p className="text-sm text-muted-foreground mb-6">Мы разберёмся и ответим в течение 24 часов.</p>
                <button onClick={onCloseReport} className="btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">Закрыть</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                      <Icon name="AlertTriangle" size={17} className="text-red-500" />
                    </div>
                    <h3 className="font-semibold text-navy-800">Сообщить о проблеме</h3>
                  </div>
                  <button onClick={onCloseReport} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </button>
                </div>
                <textarea
                  value={reportText}
                  onChange={e => onReportTextChange(e.target.value)}
                  placeholder="Опишите что не так с документом..."
                  rows={4}
                  className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
                />
                <div className="flex gap-2">
                  <button onClick={onCloseReport} className="flex-1 py-2.5 rounded-xl text-sm text-navy-600 border border-border hover:bg-slate-50 transition-colors">Отмена</button>
                  <button onClick={onSendReport} disabled={!reportText.trim() || reportLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-navy-800 text-white hover:bg-navy-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {reportLoading ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
                    {reportLoading ? "Отправка..." : "Отправить"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
