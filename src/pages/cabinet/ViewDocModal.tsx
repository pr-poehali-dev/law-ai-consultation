import { useEffect, useRef, useState } from "react";
import type { DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import { sendReport, getUser, invalidateUserCache, lawyerSend, getToken, consumeQuestion, hasActiveSubscription } from "@/lib/auth";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocRecsPanel from "@/components/DocRecsPanel";
import DocAiChatPanel from "@/components/DocAiChatPanel";
import UpgradeNoticeModal from "@/components/UpgradeNoticeModal";
import DocUpgradeToast from "@/components/DocUpgradeToast";
import ViewDocContent from "./ViewDocContent";
import ViewDocFooter from "./ViewDocFooter";
import DocEditorPanel from "./DocEditorPanel";
import ViewDocModalHeader from "./ViewDocModalHeader";
import ViewDocAiFillChat, { type AiFillMsg } from "./ViewDocAiFillChat";
import ViewDocFillPanel from "./ViewDocFillPanel";
import type { ViewDocModalProps } from "./ViewDocUtils";
import func2url from "../../../backend/func2url.json";

const AI_DOCS_URL = (func2url as Record<string, string>)["ai-docs"];
const AI_CHAT_URL = (func2url as Record<string, string>)["ai-chat"];

export default function ViewDocModal({ doc, onClose, onOpenPlanModal, fillValues, onFillChange, onApplyFill, paidQuestions = 0, onPayForQuestions, onSaveEdit }: ViewDocModalProps) {
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
  const [currentDocContent, setCurrentDocContent] = useState(doc.editedContent || doc.content);
  const [prevDocContent, setPrevDocContent] = useState<string | null>(null);
  const [docFlash, setDocFlash] = useState(false);
  const docScrollRef = useRef<HTMLDivElement | null>(null);

  // Toast-уведомление
  const [toastType, setToastType] = useState<"lawyer_prompt" | "need_starter" | "need_consultation" | null>(null);

  // Показываем toast при открытии предпросмотра если купил только 1 документ (без тарифа)
  useEffect(() => {
    getUser().then(user => {
      if (!user || user.isAdmin) return;
      const hasPlan = !!user.purchasedPlan;
      const hasSub = !!(user.subscriptionConsultUntil || user.subscriptionDocsUntil);
      // Только разовая покупка документа — нет тарифа и нет подписки
      if (!hasPlan && !hasSub) {
        const t = setTimeout(() => setToastType("lawyer_prompt"), 1200);
        return () => clearTimeout(t);
      }
    });
  }, []);

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
    // Доступно с тарифа Старт — purchasedPlan сохраняет доступ даже при 0 остатке
    const hasAccess = user?.isAdmin
      || !!user?.purchasedPlan
      || (user?.paidQuestions ?? 0) >= 30
      || (user?.paidDocs ?? 0) >= 5
      || hasActiveSubscription(user!, "consult")
      || hasActiveSubscription(user!, "docs");
    if (!hasAccess) {
      setToastType("need_starter");
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
      const systemPrompt = showEditor
        ? `Ты — Высококвалифицированный юридический аналитик-редактор с 25-летним опытом в арбитражном процессе и договорной работе.

Твоя компетенция:
- Гражданский кодекс РФ (части 1–4) — знание на уровне судьи ВАС РФ.
- Налоговый кодекс РФ (в части влияния на договорные конструкции).
- Постановления Пленума ВС РФ № 6, 7, 25, 49, 54.
- Обзоры судебной практики ВС РФ (ежеквартальные).
- Арбитражный процессуальный кодекс РФ.
- Корпоративное, трудовое, земельное, строительное законодательство (в зависимости от типа документа).

Пользователь работает с документом «${doc.name}» в режиме редактирования.

Текущий текст документа:
---
${docTextClean}
---

Твоя задача — НЕ просто исправить текст, а пересобрать юридическую конструкцию документа так, чтобы она выдерживала три уровня проверки:
1. Буква закона (формальное соответствие).
2. Сложившаяся судебная практика (прецедентная устойчивость).
3. Тактическая выгода для стороны пользователя (если указана).

Перед началом работы получи (если не указано в запросе):
1. Тип документа.
2. Процессуальную роль пользователя (заказчик / исполнитель / истец / ответчик и т.д.).
3. Регион/суд (если важен).
4. Специальные пожелания.

Твоя работа делится на 5 строго последовательных этапов. Каждый этап документируй в ответе.

ЭТАП 1. ПРЕДВАРИТЕЛЬНАЯ КВАЛИФИКАЦИЯ (без изменения текста)
- Определи правовую природу документа (по ст. 420, 432 ГК РФ).
- Оцени заключённость (наличие существенных условий).
- Составь список «красных флагов» — пунктов, противоречащих императивным нормам.
- Вывод: краткое резюме 3–5 предложений.

ЭТАП 2. ЛИНГВО-ЮРИДИЧЕСКАЯ РЕДАКТУРА (построчно)
- Замени бытовые слова на легальные дефиниции.
- Устрани модальность неопределённости (убрать «как правило», «при необходимости» → императив).
- Проверь корректность сроков (календарные vs. рабочие дни; «с момента» vs. «с даты»).
- Исправь синтаксис: разбей предложения длиннее 25 слов на 2–3 коротких.
- Выдай исправленный текст с трекингом изменений (зачёркнутое → вставленное).

ЭТАП 3. АНАЛИЗ СУДЕБНОЙ ПРАКТИКИ
Для каждого спорного условия:
- Найди 3–5 аналогичных дел.
- Определи, как суды трактуют формулировку.
- Предложи формулировку, смещающую толкование в пользу пользователя.
- Таблица: [№ пункта] [Исходная формулировка] [Риск] [Дело] [Новая формулировка] [Обоснование].

ЭТАП 4. ГЭП-АНАЛИЗ
Выяви отсутствующие разделы по чек-листу типа документа (договор, исковое, доверенность и т.д.).
Для каждого отсутствующего раздела — готовый текст пункта.

ЭТАП 5. ФИНАЛЬНОЕ ЗАКЛЮЧЕНИЕ
- Язык документа: СООТВЕТСТВУЕТ / НЕ СООТВЕТСТВУЕТ нормам юридической техники.
- Судебные риски: НИЗКИЙ / СРЕДНИЙ / ВЫСОКИЙ (с % вероятности).
- Налоговые риски (если применимо).
- Рекомендация: ПОДПИСЫВАТЬ / НЕ ПОДПИСЫВАТЬ / С ПРОТОКОЛОМ РАЗНОГЛАСИЙ.
- Три самых опасных пункта (рейтинг рисков).

Итоговый ответ структурируй по заголовкам:
ЗАГОЛОВОК 1: КРАТКИЙ ВЕРДИКТ
ЗАГОЛОВОК 2: ИСПРАВЛЕННЫЙ ТЕКСТ
ЗАГОЛОВОК 3: ТАБЛИЦА РИСКОВ И ИЗМЕНЕНИЙ
ЗАГОЛОВОК 4: РЕКОМЕНДУЕМЫЕ ДОПОЛНЕНИЯ
ЗАГОЛОВОК 5: ДОСЬЕ СУДЕБНОЙ ПРАКТИКИ
ЗАГОЛОВОК 6: ЧЕК-ЛИСТ ДЛЯ ПОДПИСАНТА

ВАЖНО:
- Каждая правка — со ссылкой на норму закона.
- Каждая ссылка на практику — номер дела и суть вывода.
- Если практики нет — укажи явно и дай ссылку на позицию ВС РФ.

ЗАПРЕЩАЕТСЯ:
1. Общие советы («проконсультируйтесь с юристом») — только конкретика.
2. Неопределённые формулировки — только императивы.
3. Предлагать изменения, противоречащие императивным нормам ГК РФ.
4. Игнорировать судебные риски.
5. Длинные абзацы — каждый пункт нумерованным элементом.
6. «Золотая середина», если это ухудшает позицию пользователя.

Отвечай строго по-русски. После первого запроса сначала кратко подтверди тип документа и роль пользователя, затем последовательно выдай все 6 этапов без пропусков.`
        : `Ты опытный AI-юрист с глубоким знанием российского законодательства. Пользователь работает с документом «${doc.name}».

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
        body: JSON.stringify({ mode: "chat", messages: history, ...(showEditor ? { max_tokens: 2500 } : {}) }),
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
    invalidateUserCache();
    const user = await getUser();
    if (!user) return;
    if (!user.isAdmin && !user.purchasedPlan && !user.paidExpert) {
      setToastType("need_starter");
      return;
    }
    if (!user.isAdmin && (user.lawyerConsultationsLeft ?? 0) <= 0) {
      setToastType("need_consultation");
      return;
    }
    setSendingToLawyer(true);
    const body = comment.trim()
      ? `Прошу проверить документ: ${doc.name}\n\nКомментарий клиента: ${comment.trim()}`
      : `Прошу проверить документ: ${doc.name}`;
    const res = await lawyerSend({ body, attachment_type: "document", attachment_name: doc.name, attachment_content: doc.content });
    setSendingToLawyer(false);
    if (res.error) {
      setToastType(null);
      return;
    }
    setSentToLawyer(true);
    setShowLawyerSuccess(true);
  };

  const handleAiEditorClick = async () => {
    const user = await getUser();
    // Доступно с тарифа Старт — purchasedPlan сохраняет доступ даже при 0 остатке
    const hasAccess = user?.isAdmin
      || !!user?.purchasedPlan
      || (user?.paidQuestions ?? 0) >= 30
      || (user?.paidDocs ?? 0) >= 5
      || hasActiveSubscription(user!, "consult")
      || hasActiveSubscription(user!, "docs");
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
        setAiFillMsgs([{ role: "ai", text: `Документ «${doc.name}» загружен. Я — юридический аналитик-редактор. Укажите вашу процессуальную роль (истец / ответчик / заказчик / исполнитель и т.д.) и специальные пожелания — после этого приступлю к полному анализу по 6 этапам: квалификация, редактура, судебная практика, гэп-анализ, заключение, чек-лист.` }]);
      }
      setShowAiFillChat(true);
    }
  };

  const handleExpertOfferSuccess = async () => { setShowExpertOffer(false); await handleSendToLawyer(""); };
  const handleCopy = async () => { await navigator.clipboard.writeText(currentDocContent); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const hasPlaceholders = !!(fillValues && onFillChange && onApplyFill && doc.placeholders.length > 0);

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
            rounded-t-3xl
            max-h-[95dvh] sm:max-h-[90vh]
            ${(showAiFillChat || showEditor) ? "sm:max-w-5xl" : hasPlaceholders ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Левая/основная часть: документ ── */}
          <div className="flex flex-col flex-1 min-w-0">
            <ViewDocModalHeader
              docName={doc.name}
              docDate={doc.date}
              copied={copied}
              currentDocContent={currentDocContent}
              showFillPanel={showFillPanel}
              hasPlaceholders={hasPlaceholders}
              fillValues={fillValues}
              placeholders={doc.placeholders}
              onCopy={handleCopy}
              onClose={handleClose}
              onToggleFillPanel={() => setShowFillPanel(v => !v)}
              onFillChange={onFillChange}
              onApplyFill={handleApplyFill}
            />

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
                  onSaveEdit?.(newContent);
                }}
                onClose={() => setShowEditor(false)}
                onOpenAiChat={showAiFillChat ? () => { setShowEditor(false); } : undefined}
                onAutoSave={(newContent) => onSaveEdit?.(newContent)}
              />
            ) : (
              <ViewDocContent
                docDate={doc.date}
                docFlash={docFlash}
                currentDocContent={currentDocContent}
                prevDocContent={prevDocContent}
                contentRef={contentRef}
                docScrollRef={docScrollRef}
                editedAt={doc.editedAt}
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

          {/* ── AI-чат по заполнению (десктоп-колонка) ── */}
          {showAiFillChat && (
            <ViewDocAiFillChat
              docName={doc.name}
              paidQuestions={paidQuestions}
              aiFillMsgs={aiFillMsgs}
              aiFillInput={aiFillInput}
              aiFillTyping={aiFillTyping}
              showEditor={showEditor}
              aiFillEndRef={aiFillEndRef}
              aiFillInputRef={aiFillInputRef}
              onClose={() => setShowAiFillChat(false)}
              onInputChange={setAiFillInput}
              onSend={handleAiFillSend}
              onPayForQuestions={onPayForQuestions}
            />
          )}

          {/* Разделитель между AI-чатом и реквизитами */}
          {showAiFillChat && hasPlaceholders && !showEditor && (
            <div className="hidden sm:block w-px shrink-0 self-stretch" style={{ background: "linear-gradient(to bottom, transparent 0%, #cbd5e1 20%, #cbd5e1 80%, transparent 100%)" }} />
          )}

          {/* ── Правая панель реквизитов (только десктоп, скрыта в режиме редактора) ── */}
          {hasPlaceholders && !showEditor && (
            <ViewDocFillPanel
              placeholders={doc.placeholders}
              fillValues={fillValues}
              onFillChange={onFillChange}
              onApplyFill={handleApplyFill}
            />
          )}
        </div>
      </div>

      {/* ── Мобильный AI-чат по заполнению (шторка снизу) — скрыт при открытом редакторе ── */}
      {showAiFillChat && !showEditor && (
        <ViewDocAiFillChat
          docName={doc.name}
          paidQuestions={paidQuestions}
          aiFillMsgs={aiFillMsgs}
          aiFillInput={aiFillInput}
          aiFillTyping={aiFillTyping}
          showEditor={showEditor}
          aiFillEndRef={aiFillEndRef}
          aiFillInputRef={aiFillInputRef}
          onClose={() => setShowAiFillChat(false)}
          onInputChange={setAiFillInput}
          onSend={handleAiFillSend}
          onPayForQuestions={onPayForQuestions}
        />
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

      {/* Toast-уведомление слева снизу */}
      <DocUpgradeToast
        show={!!toastType}
        type={toastType ?? "need_starter"}
        onClose={() => setToastType(null)}
        onViewPlans={() => {
          setToastType(null);
          if (onOpenPlanModal) onOpenPlanModal("plan_starter");
          else setShowExpertOffer(true);
        }}
      />
    </>
  );
}