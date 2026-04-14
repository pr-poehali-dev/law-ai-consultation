const YM_ID = 108545025;

export function ymGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof (window as Record<string, unknown>).ym === "function") {
    (window as Record<string, (...a: unknown[]) => void>).ym(YM_ID, "reachGoal", goal, params);
  }
}
