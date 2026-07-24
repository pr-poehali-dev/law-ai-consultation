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

// service_type -> именованная цель для основных 4 тарифов в VK Рекламе.
// Названия и суммы заданы напрямую (как настроено в кабинете VK Рекламы),
// а не берутся из фактической цены платежа.
const VK_TARIFF_GOALS: Record<string, { goal: string; value?: number }> = {
  document:               { goal: "Probnii", value: 290 },
  plan_starter:           { goal: "Start", value: 990 },
  plan_starter_discount:  { goal: "Start", value: 990 },
  plan_pro:               { goal: "Profi", value: 3990 },
  plan_max:               { goal: "Max" },
  plan_max_expert:        { goal: "Max" },
};

/**
 * Отправляет цели «покупка» в пиксель VK Рекламы (Top.Mail.Ru):
 * 1) общую цель "purchase" (для всех тарифов и услуг, с фактической суммой оплаты);
 * 2) для 4 основных тарифов — ещё именованную цель (Probnii/Start/Profi/Max)
 *    с фиксированной суммой, как настроено в кабинете VK Рекламы.
 */
export function vkPurchaseGoal(serviceType: string, amount: number) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { _tmr?: unknown[] };
  w._tmr = w._tmr || [];
  w._tmr.push({
    type: "reachGoal",
    id: VK_PIXEL_ID,
    value: amount,
    goal: "purchase",
    params: { product_id: serviceType },
  });

  const tariffGoal = VK_TARIFF_GOALS[serviceType];
  if (tariffGoal) {
    w._tmr.push({
      type: "reachGoal",
      id: VK_PIXEL_ID,
      goal: tariffGoal.goal,
      ...(tariffGoal.value !== undefined ? { value: tariffGoal.value } : {}),
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