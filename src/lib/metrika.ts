const YM_ID = 108545025;

export function ymGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof (window as Record<string, unknown>).ym === "function") {
    (window as Record<string, (...a: unknown[]) => void>).ym(YM_ID, "reachGoal", goal, params);
  }
}

/**
 * Защита от двойной отправки цели «покупка» за один и тот же платёж.
 * Один платёж (inv_id) может детектироваться параллельно в двух вкладках:
 * исходной (модалка оплаты) и новой (редирект с ЮКассы → регистрация → кабинет).
 * localStorage общий для вкладок одного origin, поэтому первый, кто дойдёт
 * до этой проверки — «занимает» inv_id, остальные пропускают отправку.
 * Возвращает true, если это первый вызов для данного inv_id (нужно отправлять метрику).
 */
export function claimPurchaseMetric(invId: string | number | null | undefined): boolean {
  if (!invId || typeof window === "undefined") return true;
  const key = `ym_purchase_done_${invId}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}