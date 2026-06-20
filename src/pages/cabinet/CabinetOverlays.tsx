import { type ServiceType } from "@/components/PaymentModal";
import { DOC_TYPES, type DocType } from "@/pages/cabinet/docBlocks";
import { savePendingAction } from "@/pages/cabinet/useCabinetPayment";
import ExitIntentPopup from "@/pages/cabinet/ExitIntentPopup";
import DocSavedToast from "@/components/DocSavedToast";
import DocChoiceModal from "@/components/DocChoiceModal";
import WelcomeTutorialsModal from "@/components/WelcomeTutorialsModal";

interface CabinetOverlaysProps {
  showExitIntent: boolean;
  docSavedToast: string | null;
  showDocChoice: { docTypeId: string; docLabel: string } | null;
  showWelcomeTutorials: boolean;
  docDetails: string;
  userId?: number;
  onCloseExitIntent: () => void;
  onAcceptExitIntent: () => void;
  onCloseDocSavedToast: () => void;
  onCloseDocChoice: () => void;
  onCloseWelcomeTutorials: () => void;
  setPayment: (p: { type: ServiceType; name: string }) => void;
  setPendingDocType: (dt: DocType | null) => void;
}

export default function CabinetOverlays({
  showExitIntent,
  docSavedToast,
  showDocChoice,
  showWelcomeTutorials,
  docDetails,
  userId,
  onCloseExitIntent,
  onAcceptExitIntent,
  onCloseDocSavedToast,
  onCloseDocChoice,
  onCloseWelcomeTutorials,
  setPayment,
  setPendingDocType,
}: CabinetOverlaysProps) {
  return (
    <>
      {showExitIntent && (
        <ExitIntentPopup
          onAccept={onAcceptExitIntent}
          onClose={onCloseExitIntent}
        />
      )}

      {docSavedToast && (
        <DocSavedToast
          docName={docSavedToast}
          onClose={onCloseDocSavedToast}
        />
      )}

      {showDocChoice && (
        <DocChoiceModal
          docLabel={showDocChoice.docLabel}
          onChooseDoc={() => {
            const dt = DOC_TYPES.find(d => d.id === showDocChoice.docTypeId) || DOC_TYPES[0];
            onCloseDocChoice();
            savePendingAction({ tab: "docs", docTypeId: dt.id, docDetails });
            setPayment({ type: "document", name: dt.label });
            setPendingDocType(dt);
          }}
          onChoosePlan={(planId) => {
            const dt = DOC_TYPES.find(d => d.id === showDocChoice.docTypeId) || DOC_TYPES[0];
            onCloseDocChoice();
            savePendingAction({ tab: "docs", docTypeId: dt.id, docDetails });
            const id = (planId || "plan_starter") as ServiceType;
            const nameMap: Record<string, string> = {
              plan_starter: "Тариф «Старт»",
              plan_pro: "Тариф «Профи»",
              plan_max: "Тариф «Максимум»",
            };
            setPayment({ type: id, name: nameMap[id] || "Тариф" });
            setPendingDocType(dt);
          }}
          onClose={onCloseDocChoice}
        />
      )}

      {showWelcomeTutorials && (
        <WelcomeTutorialsModal onClose={onCloseWelcomeTutorials} userId={userId} />
      )}
    </>
  );
}