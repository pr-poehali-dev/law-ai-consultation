import { useState } from "react";
import { ServiceType } from "@/components/PaymentModal";
import { getUser, type User, fetchSafe, invalidateUserCache } from "@/lib/auth";
import { ymGoal, claimPurchaseMetric } from "@/lib/metrika";
import { findDocType, type DocType } from "@/pages/cabinet/docBlocks";

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
  plan_pro:              "Тариф «Профи» активирован — +70 вопросов, +20 документов, +20 вопросов юристу",
  plan_max:              "Тариф «Максимум» активирован — +150 вопросов, +50 документов, +50 вопросов юристу",
  plan_max_expert:       "Тариф «Максимум» активирован — +150 вопросов, +50 документов, +50 вопросов юристу",
  plan_corporate:        "Корпоративный тариф активирован — +300 вопросов, +100 документов, +50 вопросов юристу",
  business_subscription: "+150 бизнес-действий и подписка активированы",
  business_actions_10:   "+10 бизнес-действий добавлено",
  business_actions_30:   "+30 бизнес-действий добавлено",
  business_actions_50:   "+50 бизнес-действий добавлено",
  business_actions_60:   "+60 бизнес-действий добавлено",
  business_actions_150:  "+150 бизнес-действий добавлено",
  lawyer_questions:      "+1 консультация юриста активирована",
};

interface UseCabinetPaymentParams {
  setUser: (u: User) => void;
  setTab: (tab: "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin") => void;
  tab: "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";
  chatSendMessage: (text: string) => void;
  chatRemoveUpsell: () => void;
  chatRevealFunnel: () => void;
  docsGenerateRef: React.MutableRefObject<((dt: DocType, details: string, files?: { name: string; b64: string }[]) => void) | null>;
  docsGenerateDoc: () => void;
  docsSetDocType: (dt: DocType) => void;
  docsSetDocDetails: (v: string) => void;
  docsGenerateDocWith: (dt: DocType, details: string, files?: { name: string; b64: string }[]) => void;
}

export function useCabinetPayment({
  setUser, setTab, tab,
  chatSendMessage, chatRemoveUpsell, chatRevealFunnel, docsGenerateRef,
  docsGenerateDoc, docsSetDocType, docsSetDocDetails, docsGenerateDocWith,
}: UseCabinetPaymentParams) {
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingDocType, setPendingDocType] = useState<DocType | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const refreshUser = async () => {
    invalidateUserCache();
    const u = await getUser();
    if (u) setUser(u);
  };

  const pollPaymentStatus = (invId: string, action: PendingAction | null) => {
    let attempts = 0;
    // Экспоненциальный backoff: 3s → 5s → 8s → 12s → 20s → 20s…
    // Итого ~20 попыток за ~3 минуты вместо частых запросов каждые 3s
    const getDelay = (attempt: number) =>
      Math.min(3000 * Math.pow(1.5, attempt - 1), 20_000);
    const maxAttempts = 20;

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
          const svcType = data.service_type as ServiceType | undefined;
          const revenue = typeof data.amount === "number" ? data.amount : undefined;
          // Отправляем метрику покупки только один раз на inv_id — защита от дублей
          // при параллельной обработке в нескольких вкладках
          if (claimPurchaseMetric(invId)) {
            ymGoal("payment_success", { service: svcType, order_price: revenue, currency: "RUB" });
            if (svcType === "plan_starter" || svcType === "plan_starter_discount") {
              ymGoal("purchase_plan_starter", { order_price: revenue, currency: "RUB" });
            } else if (svcType === "plan_pro") {
              ymGoal("purchase_plan_pro", { order_price: revenue, currency: "RUB" });
            } else if (svcType === "plan_max" || svcType === "plan_max_expert") {
              ymGoal("purchase_plan_max", { order_price: revenue, currency: "RUB" });
            } else if (svcType === "document") {
              ymGoal("purchase_document", { order_price: revenue, currency: "RUB" });
            }
          }
          const label = svcType ? GRANT_LABELS[svcType] : null;
          if (label) {
            setSuccessToast(label);
            setTimeout(() => setSuccessToast(null), 5500);
          }
          if (action) {
            setTab(action.tab);
            if (action.tab === "chat" && action.chatInput?.trim()) {
              setTimeout(() => chatSendMessage(action.chatInput!), 600);
            } else if (action.tab === "docs" && action.docTypeId) {
              const dt = findDocType(action.docTypeId);
              setTimeout(() => docsGenerateRef.current?.(dt, action.docDetails || ""), 600);
            }
          }
          return;
        }
      } catch { /* продолжаем */ }
      if (attempts < maxAttempts) {
        setTimeout(poll, getDelay(attempts));
      } else {
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

    // Цели Метрики для каждого пакета (залогиненный пользователь через PaymentModal)
    ymGoal("payment_success", { service: svcType });
    if (svcType === "plan_starter" || svcType === "plan_starter_discount") {
      ymGoal("purchase_plan_starter");
    } else if (svcType === "plan_pro") {
      ymGoal("purchase_plan_pro");
    } else if (svcType === "plan_max" || svcType === "plan_max_expert") {
      ymGoal("purchase_plan_max");
    } else if (svcType === "document") {
      ymGoal("purchase_document");
    }

    const label = GRANT_LABELS[svcType];
    if (label) {
      setSuccessToast(label);
      setTimeout(() => setSuccessToast(null), 4500);
    }

    const action = loadPendingAction();
    clearPendingAction();

    if (pendingDocType && (["document", "business", "plan_starter", "plan_starter_discount", "plan_pro", "plan_max", "plan_max_expert", "subscription_docs"].includes(svcType))) {
      setPendingDocType(null);
      setTab("docs");
      if (action?.docTypeId) {
        const dt = findDocType(action.docTypeId);
        docsSetDocType(dt);
        if (action.docDetails) docsSetDocDetails(action.docDetails);
        setTimeout(() => docsGenerateDocWith(dt, action.docDetails || ""), 500);
      } else {
        setTimeout(() => docsGenerateDoc(), 400);
      }
      return;
    }
    setPendingDocType(null);

    if (action) {
      setTab(action.tab);
      if (action.tab === "chat" && action.chatInput?.trim()) {
        setTimeout(() => chatSendMessage(action.chatInput!), 500);
      } else if (action.tab === "docs" && action.docTypeId) {
        const dt = findDocType(action.docTypeId);
        docsSetDocType(dt);
        if (action.docDetails) docsSetDocDetails(action.docDetails);
        setTimeout(() => docsGenerateDocWith(dt, action.docDetails || ""), 500);
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