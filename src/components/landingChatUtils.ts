// ── Константы и утилиты для LandingChat ──────────────────────────────────────

export const CHAT_HISTORY_KEY = "landing_chat_history";
export const PENDING_DOC_KEY = "landing_pending_doc";
export const PENDING_SERVICE_KEY = "landing_pending_service";
export const PENDING_TIMESTAMP_KEY = "landing_pending_ts";
export const PENDING_TTL_MS = 30 * 60 * 1000; // 30 минут

export function clearLandingPending() {
  localStorage.removeItem(CHAT_HISTORY_KEY);
  localStorage.removeItem(PENDING_DOC_KEY);
  localStorage.removeItem(PENDING_SERVICE_KEY);
  localStorage.removeItem(PENDING_TIMESTAMP_KEY);
}

export function checkAndClearExpiredPending() {
  const ts = localStorage.getItem(PENDING_TIMESTAMP_KEY);
  if (!ts) return;
  if (Date.now() - parseInt(ts, 10) > PENDING_TTL_MS) {
    clearLandingPending();
  }
}

export function saveHistoryToStorage(hist: { role: string; content: string }[]) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(hist));
    localStorage.setItem(PENDING_TIMESTAMP_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

export function detectDocSuggestion(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("исков")) return "claim";
  if (lower.includes("претензи")) return "pretension";
  if (lower.includes("апелляц")) return "appeal";
  if (lower.includes("кассаци")) return "cassation";
  if (lower.includes("жалоб")) return "complaint";
  if (lower.includes("договор")) return "contract";
  if (lower.includes("ходатайств") || lower.includes("заявлени")) return "application";
  if (lower.includes("уведомлени")) return "notification";
  const docKeywords = ["иск", "претензи", "жалоб", "заявлени", "договор", "апелляц", "кассаци", "ходатайств", "взыскани", "возражени"];
  if (docKeywords.some(k => lower.includes(k))) return "claim";
  return null;
}

export const DOC_LABELS: Record<string, string> = {
  claim: "Исковое заявление",
  pretension: "Претензию",
  complaint: "Жалобу",
  appeal: "Апелляционную жалобу",
  cassation: "Кассационную жалобу",
  contract: "Договор ГПХ",
  application: "Заявление / Ходатайство",
  notification: "Уведомление",
};

export const DOC_LABELS_MAP: Record<string, string> = {
  claim: "Исковое заявление",
  pretension: "Претензию",
  complaint: "Жалобу",
  appeal: "Апелляционную жалобу",
  cassation: "Кассационную жалобу",
  contract: "Договор ГПХ",
  application: "Заявление / Ходатайство",
  notification: "Уведомление",
};

export const DOC_TYPES = [
  { id: "claim", label: "Исковое заявление" },
  { id: "pretension", label: "Претензия" },
  { id: "complaint", label: "Жалоба" },
  { id: "appeal", label: "Апелляционная жалоба" },
  { id: "contract", label: "Договор ГПХ" },
  { id: "application", label: "Заявление / Ходатайство" },
];

export interface Message {
  role: "user" | "ai";
  text: string;
  typing?: boolean;
  suggestDocType?: string;
}

export function formatMessage(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}
