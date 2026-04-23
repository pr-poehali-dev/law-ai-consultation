import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUserWithStatus, type User, getToken, startKeepAlive, invalidateUserCache } from "@/lib/auth";
import { DOC_TYPES } from "@/pages/cabinet/DocsTab";
import { type GenDoc } from "@/pages/cabinet/DocsTab";
import func2url from "../../backend/func2url.json";
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
import ExitIntentPopup, { useExitIntent } from "@/pages/cabinet/ExitIntentPopup";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";

export default function Cabinet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);
  const [showExitIntent, setShowExitIntent] = useState(false);
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
    chatRemoveUpsell: chat.removeUpsell,
    chatRevealFunnel: chat.revealLastFunnelAnswer,
    docsGenerateRef,
    docsGenerateDoc: docs.generateDoc,
    docsSetDocType: docs.setDocType,
    docsSetDocDetails: docs.setDocDetails,
    docsGenerateDocWith: docs.generateDocWith,
  });

  const hasNoPurchase = user
    ? (!user.isAdmin &&
       (user.paidQuestions ?? 0) === 0 &&
       (user.paidDocs ?? 0) === 0 &&
       !user.subscriptionConsultUntil &&
       !user.subscriptionDocsUntil)
    : false;

  useExitIntent({
    enabled: hasNoPurchase,
    onShow: () => setShowExitIntent(true),
  });

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("ref_code", ref);
    const tabParam = searchParams.get("tab") as Tab | null;
    if (tabParam && ["chat", "docs", "expert", "business", "history", "profile"].includes(tabParam)) {
      setTab(tabParam);
    }
    // Таймаут 20 сек — iOS PWA после сна может долго стартовать (cold start + retry)
    const timeoutId = setTimeout(() => setAuthTimeout(true), 20000);

    getUserWithStatus().then(({ user: u, unauthorized }) => {
      clearTimeout(timeoutId);
      setAuthChecked(true);
      if (!u) {
        // Редиректим ТОЛЬКО при явном 401 (нет токена / токен невалиден)
        // При сетевых ошибках или 500 — показываем экран "нет соединения", не разлогиниваем
        if (unauthorized) {
          window.location.href = "/?login=1";
        } else {
          setAuthTimeout(true);
        }
        return;
      }
      setUser(u);

      // Подхватываем контекст диалога с лендинга для генерации документа
      const pendingDocType = localStorage.getItem("landing_pending_doc");
      const rawHist = localStorage.getItem("landing_chat_history");
      if (pendingDocType && rawHist) {
        localStorage.removeItem("landing_pending_doc");
        localStorage.removeItem("landing_chat_history");
        try {
          const hist: { role: string; content: string }[] = JSON.parse(rawHist);
          const dt = DOC_TYPES.find(d => d.id === pendingDocType);
          if (dt) {
            // Строим детали из последних сообщений пользователя
            const userMsgs = hist.filter(m => m.role === "user").map(m => m.content).join("\n");
            const details = userMsgs.slice(0, 2000);
            setTab("docs");
            setTimeout(() => {
              savePendingAction({ tab: "docs", docTypeId: dt.id, docDetails: details });
              docsGenerateRef.current?.(dt, details);
            }, 800);
          }
        } catch { /* ignore */ }
      }
    });

    // visibilitychange: при возврате в PWA после долгого сна — обновляем данные пользователя
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      invalidateUserCache();
      getUserWithStatus().then(({ user: u, unauthorized }) => {
        if (!u && unauthorized) {
          // Только настоящий 401 — разлогиниваем
          window.location.href = "/?login=1";
        } else if (u) {
          setUser(u);
        }
        // При сетевой ошибке — оставляем пользователя на месте
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const stopKeepAlive = startKeepAlive();
    return () => {
      stopKeepAlive();
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

  if (!authChecked || !user) {
    // Таймаут — нет связи с сервером
    if (authTimeout) return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex flex-col items-center gap-5 px-8 text-center max-w-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shadow-sm">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          </div>
          <div>
            <p className="font-semibold text-navy-800 mb-1">Нет соединения</p>
            <p className="text-sm text-muted-foreground">Проверьте интернет и попробуйте снова</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-navy-800 text-white text-sm font-semibold rounded-xl"
          >
            Повторить
          </button>
        </div>
      </div>
    );
    // Обычная загрузка
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 gradient-navy rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8a820" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 bg-navy-400 rounded-full animate-bounce" style={{animationDelay:"0ms"}}/>
            <span className="w-1.5 h-1.5 bg-navy-400 rounded-full animate-bounce" style={{animationDelay:"150ms"}}/>
            <span className="w-1.5 h-1.5 bg-navy-400 rounded-full animate-bounce" style={{animationDelay:"300ms"}}/>
          </div>
        </div>
      </div>
    );
  }

  const totalLeft = user.isAdmin ? 999 : (user.paidQuestions ?? 0);

  return (
    <div className="pwa-page flex flex-col bg-slate-50 font-golos">
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

      {showExitIntent && (
        <ExitIntentPopup
          onAccept={() => {
            setShowExitIntent(false);
            savePendingAction({ tab: "chat" });
            pay.setPayment({ type: "plan_starter", name: "Пакет «Старт»" });
          }}
          onClose={() => setShowExitIntent(false)}
        />
      )}
    </div>
  );
}