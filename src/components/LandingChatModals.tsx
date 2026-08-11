import { useNavigate } from "react-router-dom";
import LoginModal from "@/components/LoginModal";
import PaymentModal, { type ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import DocAnalysisPaywall from "@/components/DocAnalysisPaywall";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocChoiceModal from "@/components/DocChoiceModal";
import DocDetailsModal, { type DocAttachedFile } from "@/components/DocDetailsModal";
import {
  PENDING_DOC_KEY, PENDING_SERVICE_KEY,
  saveHistoryToStorage,
} from "@/components/landingChatUtils";

interface LandingChatModalsProps {
  showLogin: boolean;
  showProOffer: boolean;
  showPayment: boolean;
  showDocDetails: { docTypeId: string; docLabel: string; query: string } | null;
  showDocChoice: { docTypeId: string; docLabel: string } | null;
  showExpertMaxOffer: boolean;
  showDocAnalysisPaywall: boolean;
  paymentService: { type: ServiceType; name: string };
  docDetailsData: { query: string; comment: string; files: DocAttachedFile[] } | null;
  pendingDocType: string | null;
  historyRef: React.MutableRefObject<{ role: string; content: string }[]>;
  onCloseLogin: () => void;
  onLoginSuccess: () => void;
  onCloseProOffer: () => void;
  onSelectProOffer: (type: ServiceType, name: string) => void;
  onClosePayment: () => void;
  onPaymentSuccess: () => void;
  onDocDetailsProceed: (query: string, comment: string, files: DocAttachedFile[], docTypeId: string, docLabel: string) => void;
  onCloseDocDetails: () => void;
  onDocChooseDoc: () => void;
  onDocChoosePlan: (planId: string) => void;
  onCloseDocChoice: () => void;
  onLoginClickFromDocChoice: () => void;
  onCloseExpertMaxOffer: () => void;
  onExpertMaxSuccess: () => void;
  onChooseProDocAnalysis: () => void;
  onChooseMaxDocAnalysis: () => void;
  onCloseDocAnalysisPaywall: () => void;
}

export default function LandingChatModals({
  showLogin, showProOffer, showPayment, showDocDetails, showDocChoice,
  showExpertMaxOffer, showDocAnalysisPaywall,
  paymentService, docDetailsData, pendingDocType,
  historyRef,
  onCloseLogin, onLoginSuccess,
  onCloseProOffer, onSelectProOffer,
  onClosePayment, onPaymentSuccess,
  onDocDetailsProceed, onCloseDocDetails,
  onDocChooseDoc, onDocChoosePlan, onCloseDocChoice, onLoginClickFromDocChoice,
  onCloseExpertMaxOffer, onExpertMaxSuccess,
  onChooseProDocAnalysis, onChooseMaxDocAnalysis, onCloseDocAnalysisPaywall,
}: LandingChatModalsProps) {
  return (
    <>
      {showLogin && (
        <LoginModal
          onClose={onCloseLogin}
          onSuccess={onLoginSuccess}
          freeTrial={false}
        />
      )}

      {showProOffer && (
        <ExpertOfferModal
          onClose={onCloseProOffer}
          onSelectOffer={onSelectProOffer}
          mode="pro"
        />
      )}

      {showPayment && (
        <PaymentModal
          serviceType={paymentService.type}
          serviceName={paymentService.name}
          onClose={onClosePayment}
          onSuccess={onPaymentSuccess}
        />
      )}

      {showDocDetails && (
        <DocDetailsModal
          docTypeId={showDocDetails.docTypeId}
          docLabel={showDocDetails.docLabel}
          initialQuery={showDocDetails.query}
          onProceed={onDocDetailsProceed}
          onClose={onCloseDocDetails}
        />
      )}

      {showDocChoice && (
        <DocChoiceModal
          docLabel={showDocChoice.docLabel}
          onChoosePlan={(planId) => {
            const dtId = showDocChoice.docTypeId;
            saveHistoryToStorage(historyRef.current);
            localStorage.setItem(PENDING_DOC_KEY, dtId);
            localStorage.setItem(PENDING_SERVICE_KEY, "plan");
            if (docDetailsData) {
              const combined = docDetailsData.comment
                ? `${docDetailsData.query}\n\n[Дополнения от пользователя]:\n${docDetailsData.comment}`
                : docDetailsData.query;
              localStorage.setItem("landing_pending_doc_details", combined);
              if (docDetailsData.files?.length) {
                try {
                  localStorage.setItem("landing_pending_doc_files", JSON.stringify(
                    docDetailsData.files.map(f => ({ name: f.name, b64: f.b64 }))
                  ));
                } catch { /* quota */ }
              } else {
                localStorage.removeItem("landing_pending_doc_files");
              }
            }
            localStorage.setItem("landing_pending_ts", String(Date.now()));
            onDocChoosePlan(planId);
          }}
          onClose={onCloseDocChoice}
          onLoginClick={onLoginClickFromDocChoice}
        />
      )}

      {showExpertMaxOffer && (
        <ExpertMaxOfferModal
          context="chat"
          onClose={onCloseExpertMaxOffer}
          onSuccess={onExpertMaxSuccess}
        />
      )}

      {showDocAnalysisPaywall && (
        <DocAnalysisPaywall
          onChoosePro={onChooseProDocAnalysis}
          onChooseMax={onChooseMaxDocAnalysis}
          onClose={onCloseDocAnalysisPaywall}
        />
      )}
    </>
  );
}