import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, type User, getDailyFreeLeft, hasActiveSubscription, markServiceUsed } from "@/lib/auth";

import { type GenDoc } from "@/pages/cabinet/DocsTab";
import { type DocType } from "@/pages/cabinet/docBlocks";
import CabinetHeader from "@/pages/cabinet/CabinetHeader";
import { useChatLogic } from "@/pages/cabinet/useChatLogic";
import { useDocsLogic } from "@/pages/cabinet/useDocsLogic";
import { useCabinetPayment } from "@/pages/cabinet/useCabinetPayment";
import CabinetModals from "@/pages/cabinet/CabinetModals";
import CabinetContent from "@/pages/cabinet/CabinetContent";

import { shouldShowWelcomeTutorials } from "@/components/WelcomeTutorialsModal";

import { useCabinetInit } from "@/pages/cabinet/useCabinetInit";
import { useCabinetDocFromChat } from "@/pages/cabinet/useCabinetDocFromChat";
import CabinetLoadingScreen from "@/pages/cabinet/CabinetLoadingScreen";
import CabinetOverlays from "@/pages/cabinet/CabinetOverlays";
import { useLawyerNotifications } from "@/hooks/useLawyerNotifications";

import PushPromptBanner from "@/components/PushPromptBanner";

type Tab = "chat" | "docs" | "expert" | "history" | "profile" | "admin";

export default function Cabinet() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const hasToken = useRef(!!localStorage.getItem("yurist_ai_token")).current;
  const [authChecked, setAuthChecked] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  // Отмечаем какими сервисами пользовались — keep-alive будет греть только их
  const handleSetTab = (t: Tab) => {
    if (t === "docs") markServiceUsed("docs");
    setTab(t);
  };
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);

  const [docSavedToast, setDocSavedToast] = useState<string | null>(null);
  const [showDocChoice, setShowDocChoice] = useState<{ docTypeId: string; docLabel: string } | null>(null);
  const [showWelcomeTutorials, setShowWelcomeTutorials] = useState(false);

  const docsGenerateRef = useRef<((dt: DocType, details: string) => void) | null>(null);

  const refreshUser = async () => { const u = await getUser(); if (u) setUser(u); };

  const chat = useChatLogic({
    refreshUser,
    onPaymentRequired: (type, name) => pay.setPayment({ type, name }),
  });

  const docs = useDocsLogic({
    refreshUser,
    onPaymentRequired: (type, name, pendingDt) => {
      if (pendingDt) {
        setShowDocChoice({ docTypeId: pendingDt.id, docLabel: pendingDt.label });
      } else {
        pay.setPayment({ type, name });
        pay.setPendingDocType(pendingDt);
      }
    },
    onDocGenerated: (doc) => {
      handleSetTab("docs");
      setViewDoc(doc);
    },
    onDocSaved: (docName) => setDocSavedToast(docName),
    getChatHistory: () => chat.history,
  });

  docsGenerateRef.current = (dt, details, files) => {
    docs.setDocType(dt);
    docs.setDocDetails(details);
    docs.setDocPhase("form");
    docs.setDocErr("");
    if (files?.length) docs.setDocAttachedFiles(files);
    setTimeout(() => docs.generateDocWith(dt, details, files), 200);
  };

  const pay = useCabinetPayment({
    setUser: (u) => setUser(u),
    setTab: handleSetTab,
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

  const { creatingDocFromChat, createDocFromChat } = useCabinetDocFromChat({
    user,
    tab,
    setTab: handleSetTab,
    docs,
    chat,
    openDocChoice: (docTypeId, docLabel) => setShowDocChoice({ docTypeId, docLabel }),
  });

  useCabinetInit({
    hasToken,
    setUser,
    setAuthChecked,
    setAuthTimeout,
    setTab: handleSetTab,
    analyzeFileDirectly: chat.analyzeFileDirectly,
    setDocDetails: docs.setDocDetails,
    setDocPhase: docs.setDocPhase,
    docsGenerateRef,
    pollPaymentStatus: pay.pollPaymentStatus,
  });

  const {
    unreadCount: lawyerUnread,
    lawyerMessages: lawyerMsgs,
    lawyerDialogs,
    lawyerLoading,
    refreshLawyer,
    refreshDialog: refreshLawyerDialog,
    addOptimisticMsg: addLawyerOptimisticMsg,
    pausePing,
    resumePing,
    selectAdminDialog,
    selectedAdminUserId,
  } = useLawyerNotifications(user, tab);

  useEffect(() => {
    if (!user || !shouldShowWelcomeTutorials()) return;
    const params = new URLSearchParams(window.location.search);
    const isPostPayment = params.has("payment") || params.has("inv_id");
    const isPendingDoc = params.get("tab") === "docs";
    if (isPostPayment || isPendingDoc) {
      localStorage.setItem("tutorials_welcome_seen", "1");
      return;
    }
    const t = setTimeout(() => setShowWelcomeTutorials(true), 3000);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  if (!authChecked || !user) {
    return <CabinetLoadingScreen timeout={authTimeout} />;
  }

  const isPremium = hasActiveSubscription(user, "consult");
  const isProOrAbove = isPremium || hasActiveSubscription(user, "docs");
  const totalLeft = user.isAdmin || isPremium
    ? 999
    : getDailyFreeLeft() + (user.paidQuestions ?? 0);
  // Купленный тариф Старт+ или активные счётчики
  const hasPaidStarterPlan = !!user.purchasedPlan || (user.paidQuestions ?? 0) >= 30 || (user.paidDocs ?? 0) >= 5;
  const canUploadFiles = user.isAdmin || isProOrAbove || hasPaidStarterPlan || user.hasFileAnalysis === true;

  return (
    <div className="pwa-page flex flex-col bg-slate-50 font-golos">
      <CabinetHeader
        user={user}
        tab={tab}
        totalLeft={totalLeft}
        unreadLawyerCount={lawyerUnread}
        onTabChange={handleSetTab}
        onSelectPlan={pay.openPlanModal}
      />

      <CabinetContent
        tab={tab}
        user={user}
        totalLeft={totalLeft}
        canUploadFiles={canUploadFiles}
        chat={chat}
        docs={docs}
        creatingDocFromChat={creatingDocFromChat}
        refreshUser={refreshUser}
        setTab={handleSetTab}
        setPayment={pay.setPayment}
        setViewDoc={setViewDoc}
        setPendingDocType={pay.setPendingDocType}
        openPlanModal={pay.openPlanModal}
        openDocChoice={(docTypeId, docLabel) => setShowDocChoice({ docTypeId, docLabel })}
        createDocFromChat={createDocFromChat}
        navigate={navigate}
        lawyerMsgs={lawyerMsgs}
        lawyerDialogs={lawyerDialogs}
        lawyerLoading={lawyerLoading}
        selectedAdminUserId={selectedAdminUserId}
        onSelectAdminDialog={selectAdminDialog}
        onRefreshLawyer={refreshLawyer}
        onRefreshDialog={refreshLawyerDialog}
        onAddOptimisticMsg={addLawyerOptimisticMsg}
        onPausePing={pausePing}
        onResumePing={resumePing}
        onGoToChat={() => handleSetTab("chat")}
      />

      <CabinetModals
        user={user}
        payment={pay.payment}
        viewDoc={viewDoc}
        showPlanModal={pay.showPlanModal}
        successToast={pay.successToast}
        errorToast={pay.errorToast}
        tab={tab}
        fillValues={docs.fillValues}
        onFillChange={(key, val) => docs.setFillValues((p) => ({ ...p, [key]: val }))}
        onApplyFill={docs.applyFillValues}
        paidQuestions={user.paidQuestions ?? 0}
        onPayForQuestions={() => pay.setPayment({ type: "quick_questions", name: "+3 вопроса AI-юристу" })}
        onClosePayment={pay.closePayment}
        onPaySuccess={pay.handlePaySuccess}
        onCloseViewDoc={() => setViewDoc(null)}
        onOpenPlanModal={(_minPlanId) => pay.openPlanModal()}
        onClosePlanModal={pay.closePlanModal}
        onSelectPlan={pay.handleSelectPlan}
      />

      <CabinetOverlays
        showExitIntent={false}
        docSavedToast={docSavedToast}
        showDocChoice={showDocChoice}
        showWelcomeTutorials={showWelcomeTutorials}
        docDetails={docs.docDetails}
        onCloseExitIntent={() => {}}
        onAcceptExitIntent={() => {}}
        onCloseDocSavedToast={() => setDocSavedToast(null)}
        onCloseDocChoice={() => setShowDocChoice(null)}
        onCloseWelcomeTutorials={() => setShowWelcomeTutorials(false)}
        setPayment={pay.setPayment}
        setPendingDocType={pay.setPendingDocType}
      />

      <PushPromptBanner />


    </div>
  );
}