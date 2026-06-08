// ── Константы и утилиты для LandingChat ──────────────────────────────────────

export const CHAT_HISTORY_KEY = "landing_chat_history";
export const PENDING_DOC_KEY = "landing_pending_doc";
export const PENDING_SERVICE_KEY = "landing_pending_service";
export const PENDING_TIMESTAMP_KEY = "landing_pending_ts";
export const PENDING_FILE_KEY = "landing_pending_file"; // {name, b64, comment}
export const PENDING_TTL_MS = 30 * 60 * 1000; // 30 минут

export function clearLandingPending() {
  localStorage.removeItem(CHAT_HISTORY_KEY);
  localStorage.removeItem(PENDING_DOC_KEY);
  localStorage.removeItem(PENDING_SERVICE_KEY);
  localStorage.removeItem(PENDING_TIMESTAMP_KEY);
  localStorage.removeItem(PENDING_FILE_KEY);
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
  // Исковые заявления
  if (lower.includes("взыскани") && (lower.includes("долг") || lower.includes("задолженн"))) return "claim_debt";
  if (lower.includes("расторжени") && lower.includes("брак")) return "claim_divorce";
  if (lower.includes("раздел") && lower.includes("имуществ")) return "claim_property";
  if (lower.includes("алимент")) return "claim_alimony";
  if (lower.includes("потребит") && lower.includes("защит")) return "claim_consumer";
  if (lower.includes("выселени")) return "claim_eviction";
  if (lower.includes("ущерб") || lower.includes("возмещени")) return "claim_damage";
  if (lower.includes("отцовств")) return "claim_paternity";
  if (lower.includes("судебн") && lower.includes("приказ")) return "claim_order";
  if (lower.includes("встречн") && lower.includes("иск")) return "claim_counter";
  if (lower.includes("исков")) return "claim";
  // Жалобы судебные
  if (lower.includes("апелляц")) return "appeal";
  if (lower.includes("кассаци") && lower.includes("уголов")) return "criminal_cassation";
  if (lower.includes("кассаци")) return "cassation";
  if (lower.includes("надзорн")) return "supervisory";
  if (lower.includes("частн") && lower.includes("жалоб")) return "partial_appeal";
  // Досудебные
  if (lower.includes("претензи") && lower.includes("потребит")) return "pretension_consumer";
  if (lower.includes("претензи") && lower.includes("договор")) return "pretension_contract";
  if (lower.includes("претензи")) return "pretension";
  if (lower.includes("уведомлени") && lower.includes("расторжени")) return "notification_termination";
  if (lower.includes("уведомлени")) return "notification";
  // Ходатайства
  if (lower.includes("ходатайств")) return "petition_evidence";
  if (lower.includes("возражени") && lower.includes("апелляц")) return "objection_appeal";
  if (lower.includes("возражени")) return "response_to_claim";
  if (lower.includes("отзыв") && lower.includes("иск")) return "response_to_claim";
  // Договоры
  if (lower.includes("трудов") && lower.includes("договор")) return "labor_contract";
  if (lower.includes("договор") && lower.includes("аренд")) return "contract_rent";
  if (lower.includes("договор") && lower.includes("купл")) return "contract_sale";
  if (lower.includes("договор") && lower.includes("займ")) return "contract_loan";
  if (lower.includes("договор") && lower.includes("услуг")) return "contract_services";
  if (lower.includes("договор") && lower.includes("подряд")) return "contract_work";
  if (lower.includes("расписк")) return "contract_receipt";
  if (lower.includes("брачн") && lower.includes("договор")) return "contract_marriage";
  if (lower.includes("договор")) return "contract";
  // Трудовые
  if (lower.includes("увольнени")) return "labor_quit_app";
  if (lower.includes("отпуск")) return "labor_vacation_app";
  if (lower.includes("сокращени")) return "labor_layoff_notice";
  if (lower.includes("приказ") && lower.includes("взыскани")) return "labor_order_discipline";
  // Госорганы
  if (lower.includes("прокуратур")) return "gov_prosecutor";
  if (lower.includes("роспотребнадзор")) return "gov_rospotreb";
  if (lower.includes("полици") || lower.includes("заявление о преступлен")) return "gov_police";
  if (lower.includes("мошенничеств")) return "gov_fraud";
  if (lower.includes("трудов") && lower.includes("инспекц")) return "gov_labor_insp";
  if (lower.includes("жилищн") && lower.includes("инспекц")) return "gov_housing";
  if (lower.includes("жалоб")) return "complaint";
  // Судебная речь
  if (lower.includes("речь") && lower.includes("суд")) return "court_speech";
  // Общий fallback
  if (lower.includes("заявлени")) return "application";
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

export function formatMessage(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:4px;font-size:0.9em;font-family:monospace">$1</code>');

    const trimmed = raw.trim();

    // Горизонтальная линия
    if (/^---+$/.test(trimmed)) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:10px 0"/>');
      continue;
    }

    // Заголовок ## или ###
    if (/^#{1,3}\s+/.test(trimmed)) {
      if (inList) { result.push('</ul>'); inList = false; }
      const headText = line.replace(/^#+\s+/, '');
      result.push(`<p style="font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.5);margin:10px 0 4px">${headText}</p>`);
      continue;
    }

    // Пункт списка — • / - / *
    if (/^[-*•]\s+/.test(trimmed)) {
      if (!inList) { result.push('<ul style="margin:6px 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px">'); inList = true; }
      const itemText = line.replace(/^[-*•]\s+/, '');
      result.push(`<li style="display:flex;gap:8px;align-items:flex-start"><span style="color:#f0c060;font-size:0.65rem;margin-top:0.35em;flex-shrink:0">▸</span><span>${itemText}</span></li>`);
      continue;
    }

    // Нумерованный пункт 1. / 2.
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList) { result.push('<ul style="margin:6px 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px">'); inList = true; }
      const num = trimmed.match(/^(\d+)\./)?.[1] ?? '';
      const itemText = line.replace(/^\d+\.\s+/, '');
      result.push(`<li style="display:flex;gap:8px;align-items:flex-start"><span style="color:#f0c060;font-size:0.7rem;font-weight:700;min-width:16px;flex-shrink:0">${num}.</span><span>${itemText}</span></li>`);
      continue;
    }

    // Пустая строка
    if (!trimmed) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<br/>');
      continue;
    }

    // Обычный абзац
    if (inList) { result.push('</ul>'); inList = false; }
    result.push(`<span>${line}</span><br/>`);
  }

  if (inList) result.push('</ul>');

  return result.join('');
}