import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUser, type User, getToken, startKeepAlive } from "@/lib/auth";
import { DOC_TYPES } from "@/pages/cabinet/DocsTab";
import { type GenDoc } from "@/pages/cabinet/DocsTab";
import func2url from "../../backend/func2url.json";
const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];
import CabinetHeader from "@/pages/cabinet/CabinetHeader";
import { useChatLogic } from "@/pages/cabinet/useChatLogic";
import { useDocsLogic } from "@/pages/cabinet/useDocsLogic";
import { ServiceType } from "@/components/PaymentModal";
import { type DocHint } from "@/pages/cabinet/ChatTab";
import {
  useCabinetPayment,
  savePendingAction, loadPendingAction, clearPendingAction,
} from "@/pages/cabinet/useCabinetPayment";
import CabinetModals from "@/pages/cabinet/CabinetModals";
import CabinetContent from "@/pages/cabinet/CabinetContent";

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";

export default function Cabinet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);
  const [pendingDocFromChat, setPendingDocFromChat] = useState<{ details: string; docTypeId: string } | null>(null);
  const [creatingDocFromChat, setCreatingDocFromChat] = useState(false);

  const chatSendRef = useRef<((text: string) => void) | null>(null);
  const docsGenerateRef = useRef<((dt: typeof DOC_TYPES[0], details: string) => void) | null>(null);

  const refreshUser = async () => { const u = await getUser(); if (u) setUser(u); };

  const chat = useChatLogic({
    refreshUser,
    onPaymentRequired: (type, name) => pay.setPayment({ type, name }),
  });

  chatSendRef.current = chat.sendMessage;

  const docs = useDocsLogic({
    refreshUser,
    onPaymentRequired: (type, name, pendingDt) => {
      if (pendingDt) {
        savePendingAction({ tab: "docs", docTypeId: pendingDt.id, docDetails: docs.docDetails });
      }
      pay.setPayment({ type, name });
      pay.setPendingDocType(pendingDt);
    },
    onDocGenerated: (doc) => setViewDoc(doc),
    getChatHistory: () => chat.history,
  });

  docsGenerateRef.current = (dt, details) => {
    docs.setDocType(dt);
    docs.setDocDetails(details);
    docs.setDocPhase("form");
    docs.setDocErr("");
    setTimeout(() => docs.generateDocWith(dt, details), 200);
  };

  const pay = useCabinetPayment({
    setUser: (u) => setUser(u),
    setTab,
    tab,
    chatSendMessage: chat.sendMessage,
    docsGenerateRef,
    docsGenerateDoc: docs.generateDoc,
    docsSetDocType: docs.setDocType,
    docsSetDocDetails: docs.setDocDetails,
    docsGenerateDocWith: docs.generateDocWith,
  });

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("ref_code", ref);
    const tabParam = searchParams.get("tab") as Tab | null;
    if (tabParam && ["chat", "docs", "expert", "business", "history", "profile"].includes(tabParam)) {
      setTab(tabParam);
    }
    getUser().then((u) => {
      if (!u) { navigate("/"); return; }
      setUser(u);
    });
    const stopKeepAlive = startKeepAlive();
    return stopKeepAlive;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    const isSuccess = searchParams.get("payment") === "success";
    const invId = searchParams.get("inv_id");
    if (!isSuccess || !invId) return;
    setSearchParams({});
    const action = loadPendingAction();
    clearPendingAction();
    pay.pollPaymentStatus(invId, action);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingDocFromChat || tab !== "docs") return;
    const dt = DOC_TYPES.find(d => d.id === pendingDocFromChat.docTypeId) || DOC_TYPES[0];
    const details = pendingDocFromChat.details;
    setPendingDocFromChat(null);
    docs.setDocType(dt);
    docs.setDocDetails(details);
    docs.setDocPhase("form");
    docs.setDocErr("");
    setTimeout(() => docs.generateDocWith(dt, details), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocFromChat, tab]);

  const createDocFromChat = async (aiText: string, userText: string, docHint?: DocHint) => {
    if (creatingDocFromChat) return;

    const canDoc = user!.isAdmin || (user!.paidDocs ?? 0) > 0 ||
      (user!.subscriptionDocsUntil ? new Date(user!.subscriptionDocsUntil) > new Date() : false);
    if (!canDoc) {
      pay.setPayment({ type: "document", name: "Генерация документа" });
      return;
    }

    if (docHint?.doc_type && docHint?.details) {
      const details = docHint.extracted_text
        ? `${docHint.details}\n\n[Текст из документа пользователя]:\n${docHint.extracted_text.slice(0, 4000)}`
        : docHint.details;
      setPendingDocFromChat({ details, docTypeId: docHint.doc_type });
      setTab("docs");
      return;
    }

    setCreatingDocFromChat(true);

    const recentMessages = chat.messages.slice(-10);
    const dialogContext = recentMessages
      .filter(m => m.text && m.text.length > 5)
      .map(m => `${m.role === "user" ? "Пользователь" : "Юрист"}: ${m.text.slice(0, 600)}`)
      .join("\n\n");

    try {
      const docTypesList = DOC_TYPES.map(d => `"${d.id}" — ${d.label}`).join(", ");
      const systemPrompt = `Ты — помощник юриста. На основе переписки определи нужный тип документа и сформулируй максимально подробное техническое задание для его генерации.
Список доступных типов: ${docTypesList}
Извлеки из переписки: стороны (ФИО/организации), суммы, даты, адреса, предмет спора или договора, нарушенные права — всё что поможет составить документ.
Ответь строго в JSON без лишнего текста: {"doc_type": "id_типа", "details": "подробное описание ситуации и всех известных фактов для составления документа"}`;
      const userPrompt = `Переписка пользователя с юристом:\n\n${dialogContext}\n\nПоследний ответ юриста (на основе которого нажата кнопка):\n${aiText.slice(0, 1000)}`;
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      });
      const data = await res.json();
      const match = (data.answer || "").match(/\{[\s\S]*\}/);
      let docTypeId = "claim";
      let details = `${userText}\n\n${aiText.slice(0, 500)}`;
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
      setPendingDocFromChat({ details: `${userText}\n\n${aiText.slice(0, 500)}`, docTypeId: "claim" });
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
        onSelectPlan={pay.openPlanModal}
      />

      <CabinetContent
        tab={tab}
        user={user}
        totalLeft={totalLeft}
        chat={chat}
        docs={docs}
        creatingDocFromChat={creatingDocFromChat}
        refreshUser={refreshUser}
        setTab={setTab}
        setPayment={pay.setPayment}
        setViewDoc={setViewDoc}
        setPendingDocType={pay.setPendingDocType}
        openPlanModal={pay.openPlanModal}
        createDocFromChat={createDocFromChat}
        navigate={navigate}
      />

      <CabinetModals
        user={user}
        payment={pay.payment}
        viewDoc={viewDoc}
        showPlanModal={pay.showPlanModal}
        successToast={pay.successToast}
        errorToast={pay.errorToast}
        tab={tab}
        onClosePayment={pay.closePayment}
        onPaySuccess={pay.handlePaySuccess}
        onCloseViewDoc={() => setViewDoc(null)}
        onClosePlanModal={pay.closePlanModal}
        onSelectPlan={pay.handleSelectPlan}
      />
    </div>
  );
}
