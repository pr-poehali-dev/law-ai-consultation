export function loadSeenIds(key: string): number[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

export function saveSeenIds(key: string, ids: number[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function fmtDt(s: string) {
  return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const SERVICE_ICONS: Record<string, string> = {
  consultation: "MessageCircle",
  document: "FileText",
  expert: "Shield",
  business: "Briefcase",
  subscription_consult: "Repeat",
  subscription_docs: "Repeat",
  plan_starter: "Zap",
  plan_pro: "Star",
  plan_max: "Crown",
  business_subscription: "Building2",
  business_actions_10: "Plus",
  business_actions_30: "Plus",
  business_actions_50: "Plus",
  business_actions_60: "Plus",
  business_actions_150: "Plus",
};

export const SERVICE_COLORS: Record<string, string> = {
  consultation: "bg-blue-50 text-blue-600",
  document: "bg-amber-50 text-amber-600",
  expert: "bg-purple-50 text-purple-600",
  business: "bg-navy-50 text-navy-600",
  subscription_consult: "bg-emerald-50 text-emerald-600",
  subscription_docs: "bg-emerald-50 text-emerald-600",
  plan_starter: "bg-gold-50 text-gold-600",
  plan_pro: "bg-gold-50 text-gold-600",
  plan_max: "bg-gold-50 text-gold-700",
  business_subscription: "bg-navy-50 text-navy-700",
};
