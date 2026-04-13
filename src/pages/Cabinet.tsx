import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { getUser, logout, type User, getToken } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import { DOC_TYPES } from "@/pages/cabinet/DocsTab";
import func2url from "../../backend/func2url.json";
const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];
import ChatTab from "@/pages/cabinet/ChatTab";
import DocsTab from "@/pages/cabinet/DocsTab";
import HistoryTab from "@/pages/cabinet/HistoryTab";
import ProfileTab from "@/pages/cabinet/ProfileTab";
import ExpertTab from "@/pages/cabinet/ExpertTab";
import BusinessTab from "@/pages/cabinet/BusinessTab";
import CabinetHeader from "@/pages/cabinet/CabinetHeader";
import ViewDocModal from "@/pages/cabinet/ViewDocModal";
import { useChatLogic } from "@/pages/cabinet/useChatLogic";
import { useDocsLogic } from "@/pages/cabinet/useDocsLogic";
import { type GenDoc } from "@/pages/cabinet/DocsTab";

// Описание что начисляется по каждому типу оплаты
const GRANT_LABELS: Partial<Record<ServiceType, string>> = {
  consultation:          "+3 вопроса к AI-юристу",
  document:              "+1 документ",
  expert:                "Экспертная проверка активирована",
  business:              "Бизнес-пакет активирован",
  subscription_consult:  "Подписка на консультации активирована",
  subscription_docs:     "Подписка на документы активирована",
  plan_starter:          "+30 вопросов и +5 документов",
  plan_pro:              "+100 вопросов и +20 документов",
  plan_max:              "+300 вопросов и +50 документов",
  business_subscription: "+150 бизнес-действий и подписка",
  business_actions_10:   "+10 бизнес-действий",
  business_actions_30:   "+30 бизнес-действий",
  business_actions_50:   "+50 бизнес-действий",
  business_actions_60:   "+60 бизнес-действий",
  business_actions_150:  "+150 бизнес-действий",
};

export default function Cabinet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"chat" | "docs" | "expert" | "business" | "history" | "profile">("chat");

  // Payment
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [pendingDocType, setPendingDocType] = useState<typeof DOC_TYPES[0] | null>(null);

  // Контекст действия ДО оплаты: откуда пришли и что делали
  const [pendingAction, setPendingAction] = useState<{
    tab: typeof tab;
    chatInput?: string;          // текст в поле чата
    docDetails?: string;         // текст в поле документа
    docTypeId?: string;          // тип документа
  } | null>(null);

  // Тост-уведомление после успешной оплаты
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // ViewDoc modal
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);

  const refreshUser = async () => { const u = await getUser(); if (u) setUser(u); };

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("ref_code", ref);

    getUser().then((u) => {
      if (!u) { navigate("/"); return; }
      setUser(u);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Обработка возврата после оплаты ЮКасса (авторизованный пользователь)
  useEffect(() => {
    const isSuccess = searchParams.get("payment") === "success";
    const invId = searchParams.get("inv_id");
    if (!isSuccess || !invId) return;

    setSearchParams({});

    const CHECK_URL = "https://functions.poehali.dev/88ec8c1a-44da-48dd-a412-0b5d62f67591";
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`${CHECK_URL}?inv_id=${invId}`);
        const data = await res.json();
        if (data.paid || data.status === "paid") {
          await refreshUser();
          return;
        }
      } catch { /* продолжаем */ }
      if (attempts < 10) setTimeout(poll, 3000);
      else await refreshUser();
    };
    setTimeout(poll, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pending doc-from-chat: хранит промт и тип документа до перехода во вкладку
  const [pendingDocFromChat, setPendingDocFromChat] = useState<{ details: string; docTypeId: string } | null>(null);
  const [creatingDocFromChat, setCreatingDocFromChat] = useState(false);
  // Ожидаем ответа пользователя на уточняющий вопрос о документе
  const [docClarifyContext, setDocClarifyContext] = useState<{ aiText: string; userText: string } | null>(null);

  const docClarifyReplyRef = useRef<((text: string) => void) | undefined>(undefined);

  const chat = useChatLogic({
    refreshUser,
    onPaymentRequired: (type, name) => setPayment({ type, name }),
    onDocClarifyReply: docClarifyContext ? (text) => docClarifyReplyRef.current?.(text) : undefined,
  });

  const docs = useDocsLogic({
    refreshUser,
    onPaymentRequired: (type, name, pendingDt) => {
      // Запоминаем контекст: вкладка docs + детали + тип документа
      setPendingAction({
        tab: "docs",
        docDetails: docs.docDetails,
        docTypeId: pendingDt?.id,
      });
      setPayment({ type, name });
      setPendingDocType(pendingDt);
    },
    onDocGenerated: (doc) => {
      setViewDoc(doc);
    },
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handlePaySuccess = async (svcType: ServiceType) => {
    // Ждём webhook — небольшая задержка
    await new Promise(r => setTimeout(r, 1500));
    await refreshUser();
    setPayment(null);

    // Показываем тост с тем что начислено
    const label = GRANT_LABELS[svcType];
    if (label) showToast(label);

    const action = pendingAction;
    setPendingAction(null);

    // Если было действие с документом
    if (pendingDocType && (svcType === "document" || svcType === "business")) {
      setPendingDocType(null);
      setTab("docs");
      setTimeout(() => docs.generateDoc(), 400);
      return;
    }
    setPendingDocType(null);

    // Возвращаемся на вкладку откуда пришли и выполняем действие
    if (action) {
      setTab(action.tab);

      if (action.tab === "chat" && action.chatInput?.trim()) {
        // Автоматически отправляем сохранённый вопрос
        setTimeout(() => {
          chat.sendMessage(action.chatInput!);
        }, 400);
      } else if (action.tab === "docs" && action.docTypeId) {
        // Восстанавливаем документ и генерируем
        const dt = DOC_TYPES.find(d => d.id === action.docTypeId);
        if (dt && action.docDetails) {
          docs.setDocType(dt);
          docs.setDocDetails(action.docDetails);
          setTimeout(() => docs.generateDocWith(dt, action.docDetails!), 400);
        }
      }
    }
  };

  // Применяем pendingDocFromChat когда переключились на вкладку docs
  useEffect(() => {
    if (!pendingDocFromChat || tab !== "docs") return;
    const dt = DOC_TYPES.find(d => d.id === pendingDocFromChat.docTypeId) || DOC_TYPES[0];
    const details = pendingDocFromChat.details;
    setPendingDocFromChat(null);
    docs.setDocType(dt);
    docs.setDocDetails(details);
    docs.setDocPhase("form");
    docs.setDocErr("");
    setTimeout(() => {
      docs.generateDocWith(dt, details);
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocFromChat, tab]);

  // Шаг 1: пользователь нажал «Создать документ» — добавляем в чат уточняющий вопрос AI
  const createDocFromChat = (aiText: string, userText: string) => {
    if (creatingDocFromChat) return;
    setDocClarifyContext({ aiText, userText });
    const docList = DOC_TYPES.map(d => d.label).join(", ");
    const clarifyMsg = `Хорошо, подготовлю документ на основе нашего разговора.\n\nКакой именно документ вам нужен? (${docList})\n\nТакже укажите:\n— Стороны (кто истец/ответчик или отправитель/получатель)\n— Ключевые суммы, даты, адреса (если известны)`;
    chat.injectAiMessage(clarifyMsg);
  };

  // Шаг 2: пользователь ответил — запускаем генерацию
  const handleDocClarifyReply = async (userReply: string) => {
    docClarifyReplyRef.current = undefined;
    if (!docClarifyContext) return;
    const { aiText, userText } = docClarifyContext;
    setDocClarifyContext(null);

    const canDoc = user!.isAdmin || (user!.paidDocs ?? 0) > 0 ||
      (user!.subscriptionDocsUntil ? new Date(user!.subscriptionDocsUntil) > new Date() : false);
    if (!canDoc) {
      setPayment({ type: "document", name: "Генерация документа" });
      return;
    }

    setCreatingDocFromChat(true);
    chat.injectAiMessage("Отлично! Генерирую документ, сейчас переведу вас в раздел «Документы»...");

    try {
      const docTypesList = DOC_TYPES.map(d => `"${d.id}" — ${d.label}`).join(", ");
      const systemPrompt = `Ты — помощник юриста. На основе переписки определи тип документа и сформулируй детальное описание для его генерации.
Список типов: ${docTypesList}
Ответь строго в JSON: {"doc_type": "id_типа", "details": "подробное описание"}`;
      const userPrompt = `Исходный вопрос: ${userText}\nОтвет AI: ${aiText.slice(0, 800)}\nУточнение пользователя: ${userReply}`;
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      });
      const data = await res.json();
      const match = (data.answer || "").match(/\{[\s\S]*\}/);
      let docTypeId = "claim";
      let details = `${userText} ${userReply}`.trim();
      if (match) {
        try {
          const p = JSON.parse(match[0]);
          docTypeId = p.doc_type || docTypeId;
          details = p.details || details;
        } catch { /* дефолты */ }
      }
      setPendingDocFromChat({ details, docTypeId });
      setTab("docs");
    } catch {
      setPendingDocFromChat({ details: `${userText} ${userReply}`.trim(), docTypeId: "claim" });
      setTab("docs");
    } finally {
      setCreatingDocFromChat(false);
    }
  };

  // Привязываем handleDocClarifyReply к ref чтобы useChatLogic мог его вызвать
  docClarifyReplyRef.current = docClarifyContext ? handleDocClarifyReply : undefined;

  if (!user) return null;

  const totalLeft = user.isAdmin ? 999 : (user.paidQuestions ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 font-golos">
      <CabinetHeader
        user={user}
        tab={tab}
        totalLeft={totalLeft}
        onTabChange={setTab}
      />

      <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-24 md:pb-8">

        {tab === "chat" && (
          <ChatTab
            user={user}
            messages={chat.messages}
            input={chat.input}
            typing={chat.typing}
            typingStatus={chat.typingStatus}
            chatErr={chat.chatErr}
            attachedFile={chat.attachedFile}
            fileUploading={chat.fileUploading}
            totalLeft={totalLeft}
            onInputChange={chat.setInput}
            onSend={chat.sendMessage}
            onSendFile={chat.sendFileAnalysis}
            onContinueChat={chat.continueChat}
            onFileSelect={chat.handleFileSelect}
            onAttachClick={() => chat.fileInputRef.current?.click()}
            onClearFile={() => chat.setAttachedFile(null)}
            onPayClick={() => {
              // Сохраняем текущий input чтобы после оплаты автоматически отправить
              setPendingAction({ tab: "chat", chatInput: chat.input });
              setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" });
            }}
            onGoToDocs={() => setTab("docs")}
            onCreateDocFromMsg={createDocFromChat}
            creatingDocFromChat={creatingDocFromChat}
            chatEndRef={chat.chatEndRef}
            fileInputRef={chat.fileInputRef}
          />
        )}

        {tab === "docs" && (
          <DocsTab
            user={user}
            docType={docs.docType}
            docPhase={docs.docPhase}
            docDetails={docs.docDetails}
            docGenerating={docs.docGenerating}
            docErr={docs.docErr}
            currentDoc={docs.currentDoc}
            fillValues={docs.fillValues}
            genDocs={docs.genDocs}
            onDocTypeChange={(dt) => { docs.setDocType(dt); docs.setDocErr(""); }}
            onDocDetailsChange={docs.setDocDetails}
            onGenerate={docs.generateDoc}
            onContinue={docs.continueDoc}
            onApplyFill={docs.applyFillValues}
            onFillChange={(key, val) => docs.setFillValues((p) => ({ ...p, [key]: val }))}
            onSetPhase={docs.setDocPhase}
            onSetCurrentDoc={docs.setCurrentDoc}
            onSetFillValues={docs.setFillValues}
            onResetForm={() => { docs.setDocPhase("form"); docs.setDocDetails(""); docs.setCurrentDoc(null); }}
            onGoToChat={() => setTab("chat")}
            onDownload={downloadDoc}
            onOpenDoc={setViewDoc}
            onPayForDoc={(dt) => {
              // Запоминаем контекст: тип документа и детали
              setPendingAction({ tab: "docs", docTypeId: dt.id, docDetails: docs.docDetails });
              setPayment({ type: dt.serviceType, name: dt.label });
              setPendingDocType(dt);
            }}
            onAnalyzeDoc={(doc) => {
              const canAsk = user.isAdmin || (user.paidQuestions ?? 0) > 0 ||
                (user.subscriptionConsultUntil ? new Date(user.subscriptionConsultUntil) > new Date() : false);
              if (!canAsk) {
                setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" });
                return;
              }
              const prompt = `Проанализируй подготовленный документ:\n\n${doc.name}\n\n${doc.filled || doc.content}`;
              setTab("chat");
              setTimeout(() => chat.sendMessage(prompt), 200);
            }}
          />
        )}

        {tab === "expert" && (
          <ExpertTab
            user={user}
            messages={chat.messages}
            genDocs={docs.genDocs}
            onPayClick={() => setPayment({ type: "expert", name: "Проверка юристом" })}
          />
        )}

        {tab === "business" && (
          <BusinessTab
            user={user}
            onPayClick={(type, name) => setPayment({ type, name })}
            onRefreshUser={refreshUser}
          />
        )}

        {tab === "history" && (
          <HistoryTab
            user={user}
            messages={chat.messages}
            onGoToChat={() => setTab("chat")}
            onAskAI={(prompt) => {
              setTab("chat");
              setTimeout(() => chat.sendMessage(prompt), 200);
            }}
          />
        )}

        {tab === "profile" && (
          <ProfileTab
            user={user}
            genDocs={docs.genDocs}
            onPay={(type, name) => setPayment({ type, name })}
            onLogout={async () => { await logout(); navigate("/"); }}
          />
        )}

      </main>

      {payment && (
        <PaymentModal
          serviceType={payment.type}
          serviceName={payment.name}
          onClose={() => { setPayment(null); setPendingDocType(null); setPendingAction(null); }}
          onSuccess={handlePaySuccess}
        />
      )}

      {viewDoc && (
        <ViewDocModal
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
        />
      )}

      {/* Тост-уведомление об успешном начислении */}
      {successToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-900/20 font-golos">
            <div className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold opacity-80">Оплата прошла успешно</p>
              <p className="text-sm font-bold">{successToast}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}