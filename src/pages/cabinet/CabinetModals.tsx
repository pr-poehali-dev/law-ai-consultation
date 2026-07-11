import { useState } from "react";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import ViewDocModal from "@/pages/cabinet/ViewDocModal";
import PlanModal from "@/pages/cabinet/PlanModal";
import type { User } from "@/lib/auth";
import type { GenDoc } from "@/pages/cabinet/DocsTab";


interface CabinetModalsProps {
  user: User;
  payment: { type: ServiceType; name: string } | null;
  viewDoc: GenDoc | null;
  showPlanModal: boolean;
  successToast: string | null;
  errorToast: string | null;
  tab: "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";
  fillValues?: Record<string, string>;
  onFillChange?: (key: string, value: string) => void;
  onApplyFill?: () => void;
  paidQuestions?: number;
  onPayForQuestions?: () => void;
  onClosePayment: () => void;
  onPaySuccess: (type: ServiceType) => void;
  onCloseViewDoc: () => void;
  onSaveEdit?: (docId: number, newContent: string) => void;
  onSaveRecommendations?: (docId: number, recommendations: GenDoc["recommendations"]) => void;
  onOpenChatTool?: (tool: "case_law" | "duty") => void;
  onOpenPlanModal: (minPlanId?: string) => void;
  onClosePlanModal: () => void;
  onSelectPlan: (name: string, id: ServiceType) => void;
}

export default function CabinetModals({
  user, payment, viewDoc, showPlanModal,
  successToast, errorToast,
  fillValues, onFillChange, onApplyFill,
  paidQuestions, onPayForQuestions,
  onClosePayment, onPaySuccess,
  onCloseViewDoc, onSaveEdit, onSaveRecommendations, onOpenChatTool, onOpenPlanModal, onClosePlanModal, onSelectPlan,
}: CabinetModalsProps) {
  const [showExpertOffer, setShowExpertOffer] = useState(false);
  const [planMinId, setPlanMinId] = useState<string | undefined>(undefined);

  return (
    <>
      {payment && (
        <PaymentModal
          serviceType={payment.type}
          serviceName={payment.name}
          onClose={onClosePayment}
          onSuccess={onPaySuccess}
        />
      )}

      {viewDoc && (
        <ViewDocModal
          doc={viewDoc}
          onClose={onCloseViewDoc}
          onOpenPlanModal={(minPlanId) => { setPlanMinId(minPlanId); onOpenPlanModal(minPlanId); }}
          fillValues={fillValues}
          onFillChange={onFillChange}
          onApplyFill={onApplyFill}
          paidQuestions={paidQuestions}
          onPayForQuestions={onPayForQuestions}
          onSaveEdit={(newContent) => onSaveEdit?.(viewDoc.id, newContent)}
          onSaveRecommendations={(recs) => onSaveRecommendations?.(viewDoc.id, recs)}
          onOpenChatTool={onOpenChatTool}
        />
      )}

      {showPlanModal && !showExpertOffer && (
        <PlanModal
          user={user}
          minPlanId={planMinId}
          onClose={() => { setPlanMinId(undefined); onClosePlanModal(); }}
          onSelectPlan={(name, _price, id) => {
            if (id === "plan_max") {
              onClosePlanModal();
              setShowExpertOffer(true);
            } else {
              onSelectPlan(name, id as ServiceType);
            }
          }}
        />
      )}

      {showExpertOffer && (
        <ExpertOfferModal
          onClose={() => setShowExpertOffer(false)}
          onSelectOffer={(type, name) => {
            setShowExpertOffer(false);
            onSelectPlan(name, type);
          }}
        />
      )}

      {successToast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 animate-fade-in md:bottom-6" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}>
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

      {errorToast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 animate-fade-in md:bottom-6" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}>
          <div className="flex items-center gap-3 px-5 py-3.5 bg-white border border-red-200 text-navy-800 rounded-2xl shadow-xl font-golos">
            <div className="w-7 h-7 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-500">Оплата не выполнена</p>
              <p className="text-sm font-bold">{errorToast}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}