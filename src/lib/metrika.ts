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