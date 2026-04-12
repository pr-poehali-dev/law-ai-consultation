import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { getUser, logout, addPaidService, type User } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import { DOC_TYPES } from "@/pages/cabinet/DocsTab";
import ChatTab from "@/pages/cabinet/ChatTab";
import DocsTab from "@/pages/cabinet/DocsTab";
import HistoryTab from "@/pages/cabinet/HistoryTab";
import ProfileTab from "@/pages/cabinet/ProfileTab";
import ExpertTab from "@/pages/cabinet/ExpertTab";
import CabinetHeader from "@/pages/cabinet/CabinetHeader";
import ViewDocModal from "@/pages/cabinet/ViewDocModal";
import { useChatLogic } from "@/pages/cabinet/useChatLogic";
import { useDocsLogic } from "@/pages/cabinet/useDocsLogic";
import { type GenDoc } from "@/pages/cabinet/DocsTab";

export default function Cabinet() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"chat" | "docs" | "expert" | "history" | "profile">("chat");

  // Payment
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [pendingDocType, setPendingDocType] = useState<typeof DOC_TYPES[0] | null>(null);

  // ViewDoc modal
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);

  useEffect(() => {
    getUser().then((u) => {
      if (!u) { navigate("/"); return; }
      setUser(u);
    });
  }, [navigate]);

  const refreshUser = async () => { const u = await getUser(); if (u) setUser(u); };

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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

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

        {tab === "history" && (
          <HistoryTab
            user={user}
            messages={chat.messages}
            onGoToChat={() => setTab("chat")}
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