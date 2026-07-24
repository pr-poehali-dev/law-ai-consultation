const YM_ID = 108545025;

export function ymGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof (window as Record<string, unknown>).ym === "function") {
    (window as Record<string, (...a: unknown[]) => void>).ym(YM_ID, "reachGoal", goal, params);
  }
}

/**
 * Получает ClientID Яндекс.Метрики текущего посетителя (для привязки покупки
 * к визиту при серверной отправке цели через Measurement Protocol).
 * Резолвится с таймаутом 1.5с, чтобы не блокировать оформление платежа
 * если счётчик ещё не успел проинициализироваться.
 */
export function getYmClientId(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof (window as Record<string, unknown>).ym !== "function") {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (id: string | null) => {
      if (done) return;
      done = true;
      resolve(id);
    };
    try {
      (window as Record<string, (...a: unknown[]) => void>).ym(YM_ID, "getClientID", (id: string) => finish(id || null));
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), 1500);
  });
}

// ─────────────────────────────────────────────
// VK Реклама (Top.Mail.Ru pixel) — id счётчика 3769879
// ─────────────────────────────────────────────

const VK_PIXEL_ID = 3769879;

// service_type -> название именованной цели в VK Рекламе — по одной цели на каждый
// тариф, чтобы в кабинете VK Рекламы можно было считать конверсии и настраивать
// оптимизацию отдельно по каждому тарифу (зеркалирует YM_GOALS в backend/payment-result).
const VK_GOALS: Record<string, string> = {
  document:               "purchase_document",
  plan_starter:           "purchase_plan_starter",
  plan_starter_discount:  "purchase_plan_starter",
  plan_pro:               "purchase_plan_pro",
  plan_max:                "purchase_plan_max",
  plan_max_expert:         "purchase_plan_max",
  plan_corporate:          "purchase_plan_corporate",
  consultation:            "purchase_consultation",
  expert:                  "purchase_expert",
  lawyer_questions:        "purchase_lawyer_questions",
  business:                "purchase_business",
  business_subscription:   "purchase_business_subscription",
  subscription_consult:    "purchase_subscription_consult",
  subscription_docs:       "purchase_subscription_docs",
};

/**
 * Отправляет цели «покупка» в пиксель VK Рекламы (Top.Mail.Ru) — 2 события:
 * общую "purchase" (для всех тарифов, с product_id = service_type) и, если
 * для тарифа заведена именованная цель (VK_GOALS), ещё и её.
 */
export function vkPurchaseGoal(serviceType: string, amount: number) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { _tmr?: unknown[] };
  w._tmr = w._tmr || [];
  const goals = ["purchase", VK_GOALS[serviceType]].filter(Boolean) as string[];
  for (const goal of goals) {
    w._tmr.push({
      type: "reachGoal",
      id: VK_PIXEL_ID,
      value: amount,
      goal,
      params: { product_id: serviceType },
    });
  }
}

/**
 * Защита от повторной отправки цели «покупка» в VK за один и тот же платёж.
 * Один платёж (inv_id) может детектироваться в двух разных местах кода
 * (поллинг в модалке оплаты и поллинг при возврате в кабинет по URL) —
 * первый, кто дойдёт до проверки, «занимает» inv_id, остальные пропускают отправку.
 * Возвращает true, если это первый вызов для данного inv_id (нужно отправлять).
 */
export function claimVkPurchase(invId: string | number | null | undefined): boolean {
  if (!invId || typeof window === "undefined") return true;
  const key = `vk_purchase_done_${invId}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}