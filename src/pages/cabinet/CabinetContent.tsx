import { downloadDoc } from "@/lib/docUtils";
import { logout } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import ChatTab, { type DocHint } from "@/pages/cabinet/ChatTab";
import DocsTab, { type GenDoc } from "@/pages/cabinet/DocsTab";
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
  chat: ChatLogic;
  docs: DocsLogic;
  creatingDocFromChat: boolean;
  refreshUser: () => Promise<void>;
  setTab: (tab: Tab) => void;
  setPayment: (p: { type: ServiceType; name: string } | null) => void;
  setViewDoc: (doc: GenDoc | null) => void;
  setPendingDocType: (dt: DocsLogic["docType"] | null) => void;
  openPlanModal: () => void;
  createDocFromChat: (aiText: string, userText: string, docHint?: DocHint) => void;
  navigate: (path: string) => void;
}

export default function CabinetContent({
  tab, user, totalLeft,
  chat, docs,
  creatingDocFromChat,
  refreshUser,
  setTab, setPayment, setViewDoc, setPendingDocType,
  openPlanModal, createDocFromChat, navigate,
}: CabinetContentProps) {
  const isFlex = tab === "chat" || tab === "business";

  return (
    <main className={
      isFlex
        ? "flex-1 flex flex-col min-h-0 overflow-hidden px-3 sm:px-4 md:px-6 pt-3 sm:pt-4"
        : "flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 pb-tab-bar md:pb-8"
    }>
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
            onInputChange={chat.setInput}
            onSend={chat.sendMessage}
            onSendFile={chat.sendFileAnalysis}
            onContinueChat={chat.continueChat}
            onFileSelect={chat.handleFileSelect}
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
                setPayment({ type: "expert", name: "Консультация живого юриста" });
              }
            }}
            onGoToDocs={() => setTab("docs")}
            onSelectPlan={openPlanModal}
            onCreateDocFromMsg={createDocFromChat}
            creatingDocFromChat={creatingDocFromChat}
            onRevealAnswer={chat.revealAnswer}
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
              savePendingAction({ tab: "docs", docTypeId: dt.id, docDetails: docs.docDetails });
              setPayment({ type: dt.serviceType, name: dt.label });
              setPendingDocType(dt);
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
            onPayClick={() => setPayment({ type: "expert", name: "Консультация живого юриста" })}
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
