import { useState } from "react";
import { ServiceType } from "@/components/PaymentModal";
import { getUser, type User, fetchSafe, invalidateUserCache } from "@/lib/auth";
import { DOC_TYPES } from "@/pages/cabinet/DocsTab";

const PENDING_ACTION_KEY = "cabinet_pending_action";
const CHECK_URL = "https://functions.poehali.dev/88ec8c1a-44da-48dd-a412-0b5d62f67591";

export type PendingAction = {
  tab: "chat" | "docs" | "expert" | "business" | "history" | "profile";
  chatInput?: string;
  docDetails?: string;
  docTypeId?: string;
};

export function savePendingAction(action: PendingAction) {
  localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
}

export function loadPendingAction(): PendingAction | null {
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearPendingAction() {
  localStorage.removeItem(PENDING_ACTION_KEY);
}

export const GRANT_LABELS: Partial<Record<ServiceType, string>> = {
  consultation:          "Консультация живого юриста активирована",
  document:              "+1 документ активирован",
  expert:                "Консультация юриста активирована",
  business:              "Бизнес-пакет активирован",
  subscription_consult:  "Подписка на консультации активирована",
  subscription_docs:     "Подписка на документы активирована",
  plan_starter:          "Тариф «Старт» активирован — +30 вопросов и +5 документов",
  plan_starter_discount: "Тариф «Старт» активирован — +30 вопросов и +5 документов",
  plan_pro:              "Тариф «Профи» активирован — +100 вопросов, +20 документов, анализ файлов",
  plan_max:              "Тариф «Максимум» активирован — +300 вопросов, +50 документов, юрист",
  plan_max_expert:       "Тариф «Максимум» активирован — +300 вопросов, +50 документов, юрист",
  business_subscription: "+150 бизнес-действий и подписка активированы",
  business_actions_10:   "+10 бизнес-действий добавлено",
  business_actions_30:   "+30 бизнес-действий добавлено",
  business_actions_50:   "+50 бизнес-действий добавлено",
  business_actions_60:   "+60 бизнес-действий добавлено",
  business_actions_150:  "+150 бизнес-действий добавлено",
};

interface UseCabinetPaymentParams {
  setUser: (u: User) => void;
  setTab: (tab: "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin") => void;
  tab: "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";
  chatSendMessage: (text: string) => void;
  chatRemoveUpsell: () => void;
  chatRevealFunnel: () => void;
  docsGenerateRef: React.MutableRefObject<((dt: typeof DOC_TYPES[0], details: string) => void) | null>;
  docsGenerateDoc: () => void;
  docsSetDocType: (dt: typeof DOC_TYPES[0]) => void;
  docsSetDocDetails: (v: string) => void;
  docsGenerateDocWith: (dt: typeof DOC_TYPES[0], details: string) => void;
}

export function useCabinetPayment({
  setUser, setTab, tab,
  chatSendMessage, chatRemoveUpsell, chatRevealFunnel, docsGenerateRef,
  docsGenerateDoc, docsSetDocType, docsSetDocDetails, docsGenerateDocWith,
}: UseCabinetPaymentParams) {
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingDocType, setPendingDocType] = useState<typeof DOC_TYPES[0] | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const refreshUser = async () => {
    invalidateUserCache();
    const u = await getUser();
    if (u) setUser(u);
  };

  const pollPaymentStatus = (invId: string, action: PendingAction | null) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetchSafe(`${CHECK_URL}?inv_id=${invId}`, { method: "GET" }, 15_000, 0);
        const data = await res.json();
        if (data.paid || data.status === "paid") {
          // Инвалидируем кэш — получаем свежие данные с новым тарифом
          await refreshUser();
          chatRemoveUpsell();
          chatRevealFunnel();
          const label = data.service_type ? GRANT_LABELS[data.service_type as ServiceType] : null;
          if (label) {
            setSuccessToast(label);
            setTimeout(() => setSuccessToast(null), 5500);
          }
          if (action) {
            setTab(action.tab);
            if (action.tab === "chat" && action.chatInput?.trim()) {
              setTimeout(() => chatSendMessage(action.chatInput!), 600);
            } else if (action.tab === "docs" && action.docTypeId) {
              const dt = DOC_TYPES.find(d => d.id === action.docTypeId);
              if (dt) {
                setTimeout(() => docsGenerateRef.current?.(dt, action.docDetails || ""), 600);
              }
            }
          }
          return;
        }
      } catch { /* продолжаем */ }
      // 20 попыток × 3 сек = 60 сек (ЮКасса webhook может прийти позже)
      if (attempts < 20) setTimeout(poll, 3000);
      else {
        await refreshUser();
        setErrorToast("Оплата не прошла или была отменена. Обновите страницу.");
        setTimeout(() => setErrorToast(null), 6000);
      }
    };
    setTimeout(poll, 800);
  };

  const handlePaySuccess = async (svcType: ServiceType) => {
    // Пауза сокращена: вебхук ЮКассы обычно приходит быстро
    await new Promise(r => setTimeout(r, 800));
    await refreshUser();
    chatRemoveUpsell();
    chatRevealFunnel();
    setPayment(null);

    const label = GRANT_LABELS[svcType];
    if (label) {
      setSuccessToast(label);
      setTimeout(() => setSuccessToast(null), 4500);
    }

    const action = loadPendingAction();
    clearPendingAction();

    if (pendingDocType && (svcType === "document" || svcType === "business")) {
      setPendingDocType(null);
      setTab("docs");
      setTimeout(() => docsGenerateDoc(), 400);
      return;
    }
    setPendingDocType(null);

    if (action) {
      setTab(action.tab);
      if (action.tab === "chat" && action.chatInput?.trim()) {
        setTimeout(() => chatSendMessage(action.chatInput!), 500);
      } else if (action.tab === "docs" && action.docTypeId) {
        const dt = DOC_TYPES.find(d => d.id === action.docTypeId);
        if (dt) {
          docsSetDocType(dt);
          if (action.docDetails) docsSetDocDetails(action.docDetails);
          setTimeout(() => docsGenerateDocWith(dt, action.docDetails || ""), 500);
        }
      }
    }
  };

  const openPlanModal = () => setShowPlanModal(true);
  const closePlanModal = () => setShowPlanModal(false);

  const handleSelectPlan = (name: string, id: ServiceType) => {
    setShowPlanModal(false);
    const safeTab = (["chat","docs","expert","business","history","profile"].includes(tab) ? tab : "chat") as PendingAction["tab"];
    savePendingAction({ tab: safeTab });
    setPayment({ type: id, name });
  };

  const closePayment = () => {
    setPayment(null);
    setPendingDocType(null);
    clearPendingAction();
  };

  return {
    payment, setPayment,
    showPlanModal, openPlanModal, closePlanModal,
    pendingDocType, setPendingDocType,
    successToast, errorToast,
    refreshUser,
    pollPaymentStatus,
    handlePaySuccess,
    handleSelectPlan,
    closePayment,
  };
}