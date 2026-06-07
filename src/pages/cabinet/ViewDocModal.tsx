import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import type { DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";
import { sendReport, getUser, lawyerSend, getToken, consumeQuestion, hasActiveSubscription } from "@/lib/auth";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocRecsPanel from "@/components/DocRecsPanel";
import DocAiChatPanel from "@/components/DocAiChatPanel";
import UpgradeNoticeModal from "@/components/UpgradeNoticeModal";
import ViewDocContent from "./ViewDocContent";
import ViewDocFooter from "./ViewDocFooter";
import DocEditorPanel from "./DocEditorPanel";
import type { ViewDocModalProps } from "./ViewDocUtils";
import func2url from "../../../backend/func2url.json";

const AI_DOCS_URL = (func2url as Record<string, string>)["ai-docs"];
const AI_CHAT_URL = (func2url as Record<string, string>)["ai-chat"];

interface AiFillMsg { role: "user" | "ai"; text: string; }

export default function ViewDocModal({ doc, onClose, onOpenPlanModal, fillValues, onFillChange, onApplyFill, paidQuestions = 0, onPayForQuestions }: ViewDocModalProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [showExpertOffer, setShowExpertOffer] = useState(false);
  const [sendingToLawyer, setSendingToLawyer] = useState(false);
  const [sentToLawyer, setSentToLawyer] = useState(false);
  const [showLawyerSuccess, setShowLawyerSuccess] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  const [liveRecs, setLiveRecs] = useState<DocRecommendationItem[]>(doc.recommendations || []);
  const [recsAnalyzing, setRecsAnalyzing] = useState(false);
  const hasRecs = liveRecs.length > 0;
  const [showRecs, setShowRecs] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showFillPanel, setShowFillPanel] = useState(false);
  const [showAiFillChat, setShowAiFillChat] = useState(false);
  const [aiFillMsgs, setAiFillMsgs] = useState<AiFillMsg[]>([]);
  const [aiFillInput, setAiFillInput] = useState("");
  const [aiFillTyping, setAiFillTyping] = useState(false);
  const aiFillEndRef = useRef<HTMLDivElement>(null);
  const aiFillInputRef = useRef<HTMLInputElement>(null);
  const [currentDocContent, setCurrentDocContent] = useState(doc.content);
  const [prevDocContent, setPrevDocContent] = useState<string | null>(null);
  const [docFlash, setDocFlash] = useState(false);
  const docScrollRef = useRef<HTMLDivElement | null>(null);

  // Фоновый анализ рекомендаций — запускается после показа документа
  useEffect(() => {
    if (doc.recommendations && doc.recommendations.length > 0) {
      setLiveRecs(doc.recommendations);
      const t = setTimeout(() => setShowRecs(true), 800);
      return () => clearTimeout(t);
    }
    const runRecsAnalysis = async () => {
      setRecsAnalyzing(true);
      try {
        const token = getToken();
        const res = await fetch(AI_DOCS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
          body: JSON.stringify({
            mode: "doc_recommendations",
            doc_name: doc.name,
            doc_content: doc.content.slice(0, 2000),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const recs: DocRecommendationItem[] = data.recommendations || [];
          if (recs.length > 0) {
            setLiveRecs(recs);
            setShowRecs(true);
          }
        }
      } catch {
        // Тихо — анализ рекомендаций не критичен
      } finally {
        setRecsAnalyzing(false);
      }
    };
    const t = setTimeout(runRecsAnalysis, 1500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleOpenAiFillChat = async () => {
    const user = await getUser();
    const hasAccess = user?.isAdmin
      || (user?.paidQuestions ?? 0) >= 100
      || hasActiveSubscription(user!, "consult");
    if (!hasAccess) {
      setUpgradeFeature("ai_fill_chat");
      return;
    }
    if (aiFillMsgs.length === 0) {
      setAiFillMsgs([{ role: "ai", text: `Привет! Я изучил документ «${doc.name}» и готов помочь. Могу объяснить что писать в полях, разъяснить правовые нормы, оценить риски или ответить на любой вопрос по этому документу.` }]);
    }
    setShowAiFillChat(true);
    setTimeout(() => aiFillInputRef.current?.focus(), 200);
  };

  const handleAiFillSend = async () => {
    const text = aiFillInput.trim();
    if (!text || aiFillTyping) return;
    if ((paidQuestions ?? 0) <= 0) { onPayForQuestions?.(); return; }
    setAiFillMsgs(prev => [...prev, { role: "user", text }]);
    setAiFillInput("");
    setAiFillTyping(true);
    try {
      const token = getToken();
      // Берём актуальный текст с уже заполненными реквизитами (если есть), иначе шаблон
      const sourceText = currentDocContent || doc.content;
      const docTextClean = sourceText
        .replace(/\{\{[^}]+\}\}/g, "[не заполнено]")
        .replace(/^\[([А-ЯA-Z_]+)\]$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 6000);
      const systemPrompt = `Ты опытный AI-юрист с глубоким знанием российского законодательства. Пользователь работает с документом «${doc.name}».

Полный текст документа:
---
${docTextClean}
---

Ты можешь:
- Консультировать по содержанию и юридической силе этого документа
- Объяснять, что писать в незаполненных полях ([не заполнено])
- Разъяснять правовые нормы, на которых основан документ
- Оценивать риски и перспективы по данной ситуации
- Давать рекомендации по улучшению документа

Отвечай чётко, по-русски, со ссылками на законы где уместно. Не уходи от темы этого документа.`;
      const history = [
        { role: "system", content: systemPrompt },
        ...aiFillMsgs.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
        { role: "user", content: text },
      ];
      const res = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "chat", messages: history }),
      });
      const data = res.ok ? await res.json() : {};
      setAiFillMsgs(prev => [...prev, { role: "ai", text: data.answer || "Не удалось получить ответ. Попробуйте ещё раз." }]);
      // Списываем вопрос после успешного ответа
      if (res.ok) await consumeQuestion();
    } catch { setAiFillMsgs(prev => [...prev, { role: "ai", text: "Нет соединения. Попробуйте ещё раз." }]); }
    finally { setAiFillTyping(false); }
  };

  useEffect(() => {
    setTimeout(() => aiFillEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [aiFillMsgs]);

  const handleCloseReport = () => { setReportOpen(false); setReportSent(false); setReportText(""); };

  const handleSendReport = async () => {
    if (!reportText.trim()) return;
    setReportLoading(true);
    await sendReport(reportText.trim());
    setReportLoading(false);
    setReportSent(true);
    setReportText("");
  };

  const handleSendToLawyer = async (comment: string) => {
    const user = await getUser();
    if (!user || !user.paidExpert) {
      setUpgradeFeature("lawyer");
      return;
    }
    setSendingToLawyer(true);
    const body = comment.trim()
      ? `Прошу проверить документ: ${doc.name}\n\nКомментарий клиента: ${comment.trim()}`
      : `Прошу проверить документ: ${doc.name}`;
    await lawyerSend({ body, attachment_type: "document", attachment_name: doc.name, attachment_content: doc.content });
    setSendingToLawyer(false);
    setSentToLawyer(true);
    setShowLawyerSuccess(true);
  };

  const handleAiEditorClick = async () => {
    const user = await getUser();
    const hasAccess = user?.isAdmin || (user?.paidQuestions ?? 0) >= 100 || user?.subscriptionConsultUntil;
    if (!hasAccess) {
      setUpgradeFeature("ai_editor");
      return;
    }
    // Открываем редактор + AI-чат одновременно
    setShowEditor(true);
    setShowRecs(false);
    // Открываем AI-чат если ещё не открыт
    if (!showAiFillChat) {
      if (aiFillMsgs.length === 0) {
        setAiFillMsgs([{ role: "ai", text: `Привет! Я изучил документ «${doc.name}» и готов помочь. Могу объяснить что писать в полях, разъяснить правовые нормы, оценить риски или ответить на любой вопрос по этому документу.` }]);
      }
      setShowAiFillChat(true);
    }
  };

  const handleExpertOfferSuccess = async () => { setShowExpertOffer(false); await handleSendToLawyer(""); };
  const handleCopy = async () => { await navigator.clipboard.writeText(currentDocContent); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const hasPlaceholders = fillValues && onFillChange && onApplyFill && doc.placeholders.length > 0;

  const handleApplyFill = () => {
    // Вычисляем filled локально для мгновенного обновления предпросмотра
    if (fillValues) {
      let filled = doc.content;
      Object.entries(fillValues).forEach(([key, val]) => {
        filled = filled.replaceAll(`{{${key}}}`, val.trim() || `{{${key}}}`);
      });
      setCurrentDocContent(filled);
    }
    onApplyFill?.();
    setShowFillPanel(false);
  };

  return (
    <>
      {/* ── Оверлей + сама модалка ─────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
        onClick={handleClose}
      >
        <div
          className={`bg-white w-full sm:rounded-3xl flex shadow-2xl transition-all duration-250 ease-out
            ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-[0.97]"}
            max-h-[95dvh] sm:max-h-[90vh] rounded-t-3xl
            ${(showAiFillChat || showEditor) ? "sm:max-w-5xl" : hasPlaceholders ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Левая/основная часть: документ ── */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Шапка */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
                <Icon name="FileText" size={16} className="text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy-800 text-sm truncate">{doc.name}</p>
                <p className="text-[11px] text-muted-foreground">{doc.date} · Предпросмотр</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasPlaceholders && (
                  <button
                    onClick={() => setShowFillPanel(v => !v)}
                    className={`h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors sm:hidden ${showFillPanel ? "bg-navy-100 text-navy-700" : "text-navy-600 hover:bg-slate-100"}`}
                  >
                    <Icon name="PenLine" size={13} />Заполнить
                  </button>
                )}
                <button onClick={handleCopy} className="h-8 px-3 rounded-xl text-xs font-medium text-navy-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                  <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-emerald-500" : ""} />
                  <span className="hidden sm:inline">{copied ? "Скопировано" : "Копировать"}</span>
                </button>
                <button onClick={() => downloadDoc(doc.name, currentDocContent)} className="h-8 px-3 rounded-xl text-xs font-medium bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center gap-1.5">
                  <Icon name="Download" size={13} />
                  <span className="hidden sm:inline">Скачать .docx</span>
                </button>
                <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground hover:text-navy-700 transition-colors">
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>

            {/* Мобильная панель реквизитов (под шапкой) */}
            {hasPlaceholders && showFillPanel && (
              <div className="sm:hidden shrink-0 border-b border-slate-100 bg-slate-50">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold text-navy-700 mb-3 flex items-center gap-1.5">
                    <Icon name="PenLine" size={12} />Реквизиты документа
                  </p>
                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {doc.placeholders.map(key => (
                      <div key={key}>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">{key.replace(/_/g, " ")}</label>
                        <input
                          type="text"
                          value={fillValues?.[key] || ""}
                          onChange={e => onFillChange?.(key, e.target.value)}
                          placeholder={`Введите ${key.replace(/_/g, " ").toLowerCase()}`}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleApplyFill}
                    className="btn-gold w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 mt-3 text-sm"
                  >
                    <Icon name="CheckCircle" size={14} />Применить реквизиты
                  </button>
                </div>
              </div>
            )}

            {/* Контент документа / Редактор */}
            {showEditor ? (
              <DocEditorPanel
                content={currentDocContent}
                onApply={(newContent) => {
                  setPrevDocContent(currentDocContent);
                  setCurrentDocContent(newContent);
                  setDocFlash(true);
                  setTimeout(() => setDocFlash(false), 3000);
                  setShowEditor(false);
                }}
                onClose={() => setShowEditor(false)}
              />
            ) : (
              <ViewDocContent
                docDate={doc.date}
                docFlash={docFlash}
                currentDocContent={currentDocContent}
                prevDocContent={prevDocContent}
                contentRef={contentRef}
                docScrollRef={docScrollRef}
              />
            )}

            {/* Нижняя панель + модалка отчёта */}
            <ViewDocFooter
              docName={doc.name}
              currentDocContent={currentDocContent}
              sentToLawyer={sentToLawyer}
              sendingToLawyer={sendingToLawyer}
              showLawyerSuccess={showLawyerSuccess}
              onCloseLawyerSuccess={() => setShowLawyerSuccess(false)}
              recsAnalyzing={recsAnalyzing}
              hasRecs={hasRecs}
              liveRecs={liveRecs}
              showRecs={showRecs}
              reportOpen={reportOpen}
              reportText={reportText}
              reportLoading={reportLoading}
              reportSent={reportSent}
              showEditor={showEditor}
              onSendToLawyer={handleSendToLawyer}
              onAiEditorClick={showEditor ? () => setShowEditor(false) : handleAiEditorClick}
              onAiFillChatClick={handleOpenAiFillChat}
              onToggleRecs={() => setShowRecs(v => !v)}
              onClose={handleClose}
              onOpenReport={() => setReportOpen(true)}
              onCloseReport={handleCloseReport}
              onReportTextChange={setReportText}
              onSendReport={handleSendReport}
            />
          </div>

          {/* Разделитель */}
          {(showAiFillChat || hasPlaceholders || showEditor) && (
            <div className="hidden sm:block w-px shrink-0 self-stretch" style={{ background: "linear-gradient(to bottom, transparent 0%, #cbd5e1 20%, #cbd5e1 80%, transparent 100%)" }} />
          )}

          {/* ── AI-чат по заполнению (десктоп, колонка) ── */}
          {showAiFillChat && (
            <div className={`hidden sm:flex flex-col w-72 shrink-0 overflow-hidden ${!hasPlaceholders ? "rounded-r-3xl" : ""}`} style={{ background: "#f8fafc" }}>
              {/* Шапка */}
              <div className="flex items-center gap-2.5 px-4 py-3.5 shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="Bot" size={14} color="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">AI-юрист</p>
                  <p className="text-[10px] text-white/55 truncate">по заполнению реквизитов</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/15">
                    <Icon name="MessageCircle" size={9} color="white" />
                    <span className="text-[10px] font-semibold text-white">{paidQuestions ?? 0}</span>
                  </div>
                  <button onClick={() => setShowAiFillChat(false)} className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                    <Icon name="X" size={12} color="white" />
                  </button>
                </div>
              </div>
              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5" style={{ minHeight: 0 }}>
                {aiFillMsgs.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-1.5`}>
                    {msg.role === "ai" && (
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                        <Icon name="Bot" size={10} color="white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-navy-800 bg-white border border-slate-200"}`}
                      style={msg.role === "user" ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" } : {}}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiFillTyping && (
                  <div className="flex justify-start gap-1.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                      <Icon name="Bot" size={10} color="white" />
                    </div>
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl rounded-tl-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                {(paidQuestions ?? 0) <= 0 && (
                  <div className="rounded-xl p-3 border" style={{ background: "#fff7ed", borderColor: "#fbbf24" }}>
                    <p className="text-[11px] font-bold text-amber-800 mb-1">Вопросы закончились</p>
                    <button onClick={() => onPayForQuestions?.()} className="w-full py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#0a1628" }}>
                      +3 вопроса · 199 ₽
                    </button>
                  </div>
                )}
                <div ref={aiFillEndRef} />
              </div>
              {/* Ввод */}
              <div className="shrink-0 px-3 py-2.5 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={aiFillInputRef}
                    type="text"
                    value={aiFillInput}
                    onChange={e => setAiFillInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAiFillSend()}
                    placeholder="Спросить по заполнению..."
                    disabled={(paidQuestions ?? 0) <= 0 || aiFillTyping}
                    className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-xs outline-none disabled:opacity-50 transition-colors"
                    style={{ border: "1.5px solid transparent" }}
                    onFocus={e => { e.target.style.borderColor = "#1a6bb5"; e.target.style.background = "white"; }}
                    onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "#f1f5f9"; }}
                  />
                  <button onClick={handleAiFillSend} disabled={!aiFillInput.trim() || aiFillTyping || (paidQuestions ?? 0) <= 0}
                    className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0 transition-all active:scale-95"
                    style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                    {aiFillTyping
                      ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <Icon name="Send" size={12} color="white" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Разделитель между AI-чатом и реквизитами */}
          {showAiFillChat && hasPlaceholders && (
            <div className="hidden sm:block w-px shrink-0 self-stretch" style={{ background: "linear-gradient(to bottom, transparent 0%, #cbd5e1 20%, #cbd5e1 80%, transparent 100%)" }} />
          )}

          {/* ── Правая панель реквизитов (только десктоп) ── */}
          {hasPlaceholders && (
            <div className={`hidden sm:flex flex-col w-72 shrink-0 overflow-hidden rounded-r-3xl`} style={{ background: "#f8fafc" }}>
              <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                    <Icon name="PenLine" size={13} className="text-gold-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-800">Реквизиты</p>
                    <p className="text-[10px] text-slate-400">{doc.placeholders.length} полей</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                <div className="bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Введите данные — документ обновится автоматически после нажатия «Применить».
                  </p>
                </div>
                {doc.placeholders.map(key => (
                  <div key={key}>
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">{key.replace(/_/g, " ")}</label>
                    <input
                      type="text"
                      value={fillValues?.[key] || ""}
                      onChange={e => onFillChange?.(key, e.target.value)}
                      placeholder={key.replace(/_/g, " ").toLowerCase()}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-navy-400 transition-colors placeholder:text-slate-300"
                    />
                  </div>
                ))}
              </div>

              <div className="shrink-0 px-4 py-4 border-t border-slate-100">
                <button
                  onClick={handleApplyFill}
                  className="btn-gold w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
                >
                  <Icon name="CheckCircle" size={15} />Применить реквизиты
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Мобильный AI-чат по заполнению (шторка снизу) ── */}
      {showAiFillChat && (
        <div className="sm:hidden fixed inset-0 z-[85] flex items-end" onClick={() => setShowAiFillChat(false)}>
          <div className="relative w-full rounded-t-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "78dvh", background: "#f8fafc" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Icon name="Bot" size={16} color="white" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">AI-юрист</p>
                <p className="text-[10px] text-white/60 truncate">По заполнению: {doc.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15">
                  <Icon name="MessageCircle" size={10} color="white" />
                  <span className="text-[10px] font-semibold text-white">{paidQuestions ?? 0} вопр.</span>
                </div>
                <button onClick={() => setShowAiFillChat(false)} className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center"><Icon name="X" size={14} color="white" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
              {aiFillMsgs.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                  {msg.role === "ai" && <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}><Icon name="Bot" size={12} color="white" /></div>}
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-navy-800 bg-white border border-slate-200"}`} style={msg.role === "user" ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" } : {}}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {aiFillTyping && (
                <div className="flex justify-start gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}><Icon name="Bot" size={12} color="white" /></div>
                  <div className="px-3.5 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              {(paidQuestions ?? 0) <= 0 && (
                <div className="rounded-2xl p-4 border" style={{ background: "#fff7ed", borderColor: "#fbbf24" }}>
                  <p className="text-xs font-bold text-amber-800 mb-2">Вопросы закончились</p>
                  <button onClick={() => onPayForQuestions?.()} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#0a1628" }}>+3 вопроса · 199 ₽</button>
                </div>
              )}
              <div ref={aiFillEndRef} />
            </div>
            <div className="shrink-0 px-3 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <input ref={aiFillInputRef} type="text" value={aiFillInput} onChange={e => setAiFillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAiFillSend()}
                  placeholder="Что писать в поле «ФИО»?" disabled={(paidQuestions ?? 0) <= 0 || aiFillTyping}
                  className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5 text-sm outline-none disabled:opacity-50"
                  style={{ border: "1.5px solid transparent" }}
                  onFocus={e => { e.target.style.borderColor = "#1a6bb5"; e.target.style.background = "white"; }}
                  onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "#f1f5f9"; }}
                />
                <button onClick={handleAiFillSend} disabled={!aiFillInput.trim() || aiFillTyping || (paidQuestions ?? 0) <= 0}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center disabled:opacity-40 shrink-0 active:scale-95" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                  {aiFillTyping ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Icon name="Send" size={14} color="white" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Панель рекомендаций (снаружи оверлея!) ──────────── */}
      {showRecs && (
        <DocRecsPanel
          recommendations={liveRecs}
          docContent={currentDocContent}
          docId={doc.id}
          onClose={() => setShowRecs(false)}
          onPaymentRequired={() => {}}
        />
      )}

      {/* ── AI-чат помощник (снаружи оверлея!) ──────────────── */}
      {showAiChat && (
        <DocAiChatPanel
          doc={{ id: doc.id, name: doc.name, content: doc.content, recommendations: doc.recommendations }}
          onClose={() => setShowAiChat(false)}
          onPaymentRequired={() => {}}
          onDocUpdated={(newContent, prevContent) => {
            setPrevDocContent(prevContent);
            setCurrentDocContent(newContent);
            setDocFlash(true);
            setTimeout(() => setDocFlash(false), 5000);
          }}
          onScrollToChanges={() => {
            setTimeout(() => {
              const scrollContainer = contentRef.current;
              if (!scrollContainer) return;
              const el = scrollContainer.querySelector("[data-changed='1']");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              } else {
                const greenEl = scrollContainer.querySelector(".border-emerald-500");
                if (greenEl) {
                  greenEl.scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
                }
              }
            }, 350);
          }}
        />
      )}

      {/* ExpertMaxOfferModal (для случаев с pending action) */}
      {showExpertOffer && (
        <ExpertMaxOfferModal context="doc" onClose={() => setShowExpertOffer(false)} onSuccess={handleExpertOfferSuccess} />
      )}

      {/* Мягкое уведомление о необходимости повышения тарифа */}
      {upgradeFeature && (
        <UpgradeNoticeModal
          feature={upgradeFeature}
          onClose={() => setUpgradeFeature(null)}
          onViewPlans={(minPlanId) => {
            setUpgradeFeature(null);
            if (onOpenPlanModal) onOpenPlanModal(minPlanId);
            else setShowExpertOffer(true);
          }}
        />
      )}
    </>
  );
}