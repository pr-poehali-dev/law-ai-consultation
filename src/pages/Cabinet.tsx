import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { getUser, logout, addPaidService, type User, getToken } from "@/lib/auth";
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

export default function Cabinet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"chat" | "docs" | "expert" | "business" | "history" | "profile">("chat");

  // Payment
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [pendingDocType, setPendingDocType] = useState<typeof DOC_TYPES[0] | null>(null);

  // ViewDoc modal
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);

  const refreshUser = async () => { const u = await getUser(); if (u) setUser(u); };

  useEffect(() => {
    // Сохраняем реферальный код из URL если есть
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
          if (data.service_type) {
            await addPaidService(data.service_type as ServiceType).catch(() => {});
          }
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

  const chat = useChatLogic({
    refreshUser,
    onPaymentRequired: (type, name) => setPayment({ type, name }),
  });

  const docs = useDocsLogic({
    refreshUser,
    onPaymentRequired: (type, name, pendingDt) => {
      setPayment({ type, name });
      setPendingDocType(pendingDt);
    },
    onDocGenerated: (doc) => {
      // Если документ пришёл из чата — открываем сразу для просмотра
      setViewDoc(doc);
    },
  });

  const handlePaySuccess = async (svcType: ServiceType) => {
    try {
      await addPaidService(svcType);
      await refreshUser();
    } catch {
      // сервис уже оплачен — продолжаем
    }
    setPayment(null);
    if (pendingDocType && (svcType === "document" || svcType === "business")) {
      setPendingDocType(null);
      setTimeout(() => docs.generateDoc(), 300);
    } else {
      setPendingDocType(null);
    }
  };

  // Применяем pendingDocFromChat когда переключились на вкладку docs
  useEffect(() => {
    if (!pendingDocFromChat || tab !== "docs") return;
    const dt = DOC_TYPES.find(d => d.id === pendingDocFromChat.docTypeId) || DOC_TYPES[0];
    docs.setDocType(dt);
    docs.setDocDetails(pendingDocFromChat.details);
    docs.setDocPhase("form");
    setPendingDocFromChat(null);
    // Автоматически запускаем генерацию после установки данных
    setTimeout(() => docs.generateDoc(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocFromChat, tab]);

  // Функция: создать документ из ответа AI
  const createDocFromChat = async (aiText: string, userText: string) => {
    if (creatingDocFromChat) return;

    // Проверяем оплату документов ДО запроса к AI
    const canDoc = user.isAdmin || (user.paidDocs ?? 0) > 0 ||
      (user.subscriptionDocsUntil ? new Date(user.subscriptionDocsUntil) > new Date() : false);
    if (!canDoc) {
      setPayment({ type: "document", name: "Генерация документа" });
      return;
    }

    setCreatingDocFromChat(true);
    try {
      const docTypesList = DOC_TYPES.map(d => `"${d.id}" — ${d.label}`).join(", ");
      const systemPrompt = `Ты — помощник юриста. На основе ответа AI-юриста и вопроса пользователя определи:
1. Наиболее подходящий тип документа из списка: ${docTypesList}
2. Сформулируй детальное описание ситуации для генерации документа (на основе вопроса пользователя и ответа AI).

Ответь строго в формате JSON без пояснений:
{"doc_type": "id_типа", "details": "подробное описание ситуации для генерации документа"}`;

      const userPrompt = `Вопрос пользователя: ${userText}\n\nОтвет AI-юриста: ${aiText.slice(0, 1500)}`;
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Auth-Token": token } : {}),
        },
        body: JSON.stringify({
          mode: "chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      const data = await res.json();
      const answer: string = data.answer || "";
      const match = answer.match(/\{[\s\S]*\}/);
      let docTypeId = "claim";
      let details = userText || aiText.slice(0, 500);
      if (match) {
        try {
          const parsed: { doc_type: string; details: string } = JSON.parse(match[0]);
          docTypeId = parsed.doc_type || "claim";
          details = parsed.details || details;
        } catch { /* используем дефолты */ }
      }
      setPendingDocFromChat({ details, docTypeId });
      setTab("docs");
    } catch {
      setPendingDocFromChat({ details: userText || aiText.slice(0, 500), docTypeId: "claim" });
      setTab("docs");
    } finally {
      setCreatingDocFromChat(false);
    }
  };

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
            onPayClick={() => setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" })}
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
            onPayForDoc={(dt) => { setPayment({ type: dt.serviceType, name: dt.label }); setPendingDocType(dt); }}
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
          onClose={() => { setPayment(null); setPendingDocType(null); }}
          onSuccess={handlePaySuccess}
        />
      )}

      {viewDoc && (
        <ViewDocModal
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
        />
      )}
    </div>
  );
}