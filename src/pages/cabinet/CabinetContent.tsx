import { useState, useCallback } from "react";
import { downloadDoc } from "@/lib/docUtils";
import { logout, lawyerSend, isPlanExhausted } from "@/lib/auth";
import type { User } from "@/lib/auth";
import Icon from "@/components/ui/icon";
import { ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import ChatTab, { type DocHint } from "@/pages/cabinet/ChatTab";
import DocsTab, { type GenDoc } from "@/pages/cabinet/DocsTab";
import { type DocType } from "@/pages/cabinet/docBlocks";
import HistoryTab from "@/pages/cabinet/HistoryTab";
import ProfileTab from "@/pages/cabinet/ProfileTab";
import ExpertTab from "@/pages/cabinet/ExpertTab";
import BusinessTab from "@/pages/cabinet/BusinessTab";
import AdminTab from "@/pages/cabinet/AdminTab";
import type { useChatLogic } from "@/pages/cabinet/useChatLogic";
import type { useDocsLogic } from "@/pages/cabinet/useDocsLogic";
import { savePendingAction } from "@/pages/cabinet/useCabinetPayment";

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";
type ChatLogic = ReturnType<typeof useChatLogic>;
type DocsLogic = ReturnType<typeof useDocsLogic>;

interface CabinetContentProps {
  tab: Tab;
  user: User;
  totalLeft: number;
  canUploadFiles: boolean;
  chat: ChatLogic;
  docs: DocsLogic;
  creatingDocFromChat: boolean;
  refreshUser: () => Promise<void>;
  setTab: (tab: Tab) => void;
  setPayment: (p: { type: ServiceType; name: string } | null) => void;
  setViewDoc: (doc: GenDoc | null) => void;
  setPendingDocType: (dt: DocType | null) => void;
  openPlanModal: () => void;
  openDocChoice: (docTypeId: string, docLabel: string) => void;
  createDocFromChat: (aiText: string, userText: string, docHint?: DocHint) => void;
  navigate: (path: string) => void;
}

export default function CabinetContent({
  tab, user, totalLeft, canUploadFiles,
  chat, docs,
  creatingDocFromChat,
  refreshUser,
  setTab, setPayment, setViewDoc, setPendingDocType,
  openPlanModal, openDocChoice, createDocFromChat, navigate,
}: CabinetContentProps) {
  const [showExpertOffer, setShowExpertOffer] = useState(false);
  const [showProOffer, setShowProOffer] = useState(false);
  const [showExpertMaxOffer, setShowExpertMaxOffer] = useState(false);
  const [pendingLawyerMsg, setPendingLawyerMsg] = useState<{ text: string; userText?: string } | null>(null);
  const isFlex = tab === "chat" || tab === "business";

  const handleSendToLawyer = useCallback(async (msgText: string, prevUserText?: string) => {
    if (!user.paidExpert && !user.isAdmin) {
      setPendingLawyerMsg({ text: msgText, userText: prevUserText });
      setShowExpertMaxOffer(true);
      return;
    }
    const chatSummary = prevUserText
      ? `Вопрос: ${prevUserText}\n\nОтвет AI: ${msgText}`
      : msgText;
    await lawyerSend({
      body: "Прошу проверить ответ AI на мой вопрос.",
      attachment_type: "chat_answer",
      attachment_name: (prevUserText || msgText).slice(0, 80) + ((prevUserText || msgText).length > 80 ? "…" : ""),
      attachment_content: chatSummary,
    });
    setTab("expert");
  }, [user, setTab]);

  const handleExpertMaxSuccess = useCallback(async () => {
    setShowExpertMaxOffer(false);
    if (pendingLawyerMsg) {
      const chatSummary = pendingLawyerMsg.userText
        ? `Вопрос: ${pendingLawyerMsg.userText}\n\nОтвет AI: ${pendingLawyerMsg.text}`
        : pendingLawyerMsg.text;
      await lawyerSend({
        body: "Прошу проверить ответ AI на мой вопрос.",
        attachment_type: "chat_answer",
        attachment_name: (pendingLawyerMsg.userText || pendingLawyerMsg.text).slice(0, 80) + "…",
        attachment_content: chatSummary,
      });
      setPendingLawyerMsg(null);
    }
    setTab("expert");
  }, [pendingLawyerMsg, setTab]);

  const planExhausted = isPlanExhausted(user) && !!user.purchasedPlan;

  return (
    <main className={
      isFlex
        ? "flex-1 flex flex-col min-h-0 overflow-hidden px-3 sm:px-4 md:px-6 pt-3 sm:pt-4"
        : "flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 pb-tab-bar md:pb-8"
    }>
      {/* Баннер исчерпанного тарифа */}
      {planExhausted && (
        <div className="w-full max-w-4xl mx-auto mb-3 mt-1">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#fff1f1,#fff8f8)", borderColor: "#fca5a5" }}
            onClick={openPlanModal}
          >
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <Icon name="AlertCircle" size={16} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-700 leading-tight">Ресурсы тарифа исчерпаны</p>
              <p className="text-xs text-red-500 mt-0.5">Вопросы и документы закончились — обновите тариф, остатки прибавятся</p>
            </div>
            <button
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}
            >
              Продлить
            </button>
          </div>
        </div>
      )}

      <div className={
        isFlex
          ? "flex-1 flex flex-col min-h-0 w-full max-w-4xl mx-auto"
          : "w-full max-w-4xl mx-auto"
      }>

        {tab === "chat" && (
          <ChatTab
            user={user}
            messages={chat.messages}
            input={chat.input}
            typing={chat.typing}
            typingStatus={chat.typingStatus}
            chatErr={chat.chatErr}
            attachedFiles={chat.attachedFiles}
            fileUploading={chat.fileUploading}
            totalLeft={totalLeft}
            canUploadFiles={canUploadFiles}
            onUpgradeClick={() => openPlanModal()}
            onInputChange={chat.setInput}
            onSend={chat.sendMessage}
            onSendFile={chat.sendFileAnalysis}
            onContinueChat={chat.continueChat}
            onFileSelect={chat.handleFileSelect}
            onFileDrop={chat.handleFileDrop}
            onAttachClick={() => chat.fileInputRef.current?.click()}
            onRemoveFile={(idx) => chat.setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
            onPayClick={() => {
              savePendingAction({ tab: "chat", chatInput: chat.input });
              setPayment({ type: "plan_starter", name: "Пакет «Старт»" });
            }}
            onExpertClick={() => {
              if (user.paidExpert || user.isAdmin) {
                setTab("expert");
              } else {
                savePendingAction({ tab: "expert" });
                setShowExpertOffer(true);
              }
            }}
            onGoToDocs={() => setTab("docs")}
            onSelectPlan={openPlanModal}
            onCreateDocFromMsg={createDocFromChat}
            creatingDocFromChat={creatingDocFromChat}
            onRevealAnswer={chat.revealAnswer}
            onSendToLawyer={handleSendToLawyer}
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
            docRetrying={docs.docRetrying}
            docErr={docs.docErr}
            currentDoc={docs.currentDoc}
            fillValues={docs.fillValues}
            genDocs={docs.genDocs}
            attachedFiles={docs.docAttachedFiles}
            onAttachedFilesChange={docs.setDocAttachedFiles}
            onDocTypeChange={(dt) => { docs.setDocType(dt); docs.setDocErr(""); }}
            onDocDetailsChange={docs.setDocDetails}
            onGenerate={docs.generateDoc}
            onContinue={docs.continueDoc}
            onApplyFill={docs.applyFillValues}
            onFillChange={(key, val) => docs.setFillValues((p) => ({ ...p, [key]: val }))}
            onSetPhase={docs.setDocPhase}
            onSetCurrentDoc={docs.setCurrentDoc}
            onSetFillValues={docs.setFillValues}
            onResetForm={() => { docs.setDocPhase("form"); docs.setDocDetails(""); docs.setCurrentDoc(null); docs.setDocAttachedFiles([]); }}
            onGoToChat={() => setTab("chat")}
            onDownload={downloadDoc}
            onOpenDoc={(doc) => {
              docs.setCurrentDoc(doc);
              docs.setFillValues(Object.fromEntries(doc.placeholders.map(p => [p, ""])));
              setViewDoc(doc);
            }}
            onPayForDoc={(dt) => {
              savePendingAction({ tab: "docs", docTypeId: dt.id, docDetails: docs.docDetails });
              openDocChoice(dt.id, dt.label);
            }}
            onAnalyzeDoc={(doc) => {
              const canAsk = user.isAdmin || (user.paidQuestions ?? 0) > 0 ||
                (user.subscriptionConsultUntil ? new Date(user.subscriptionConsultUntil) > new Date() : false);
              if (!canAsk) {
                setPayment({ type: "plan_starter", name: "Пакет «Старт»" });
                return;
              }
              setTab("chat");
              setTimeout(() => chat.sendDocAnalysis(doc.name, doc.filled || doc.content), 200);
            }}
            onSelectPlan={openPlanModal}
          />
        )}

        {tab === "expert" && (
          <ExpertTab
            user={user}
            messages={chat.messages}
            genDocs={docs.genDocs}
            onPayClick={openPlanModal}
            onBuyLawyerQuestions={() => setPayment({ type: "lawyer_questions", name: "+5 вопросов юристу" })}
          />
        )}

        {showExpertOffer && (
          <ExpertOfferModal
            onClose={() => setShowExpertOffer(false)}
            onSelectOffer={(type, name) => {
              setShowExpertOffer(false);
              setPayment({ type, name });
            }}
          />
        )}

        {showExpertMaxOffer && (
          <ExpertMaxOfferModal
            context="chat"
            onClose={() => { setShowExpertMaxOffer(false); setPendingLawyerMsg(null); }}
            onSuccess={handleExpertMaxSuccess}
          />
        )}

        {showProOffer && (
          <ExpertOfferModal
            mode="pro"
            onClose={() => setShowProOffer(false)}
            onSelectOffer={(type, name) => {
              setShowProOffer(false);
              setPayment({ type, name });
            }}
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

        {tab === "admin" && user.isAdmin && (
          <AdminTab />
        )}

      </div>
    </main>
  );
}