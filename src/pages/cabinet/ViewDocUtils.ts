import type { GenDoc } from "@/pages/cabinet/DocsTab";
import type { useChatLogic } from "@/pages/cabinet/useChatLogic";

export interface ViewDocModalProps {
  doc: GenDoc;
  onClose: () => void;
  onOpenPlanModal?: (minPlanId?: string) => void;
  fillValues?: Record<string, string>;
  onFillChange?: (key: string, value: string) => void;
  onApplyFill?: () => void;
  paidQuestions?: number;
  onPayForQuestions?: () => void;
  onSaveEdit?: (newContent: string) => void;
  onSaveRecommendations?: (recommendations: GenDoc["recommendations"]) => void;
  onOpenChatTool?: (tool: "case_law" | "duty") => void;
  /** Единый чат пользователя (тот же, что в разделе «Чат с AI») — используется
   * панелью AI-редактора справа, чтобы история переписки была общей везде. */
  chat: ReturnType<typeof useChatLogic>;
  /** true — документ только что сгенерирован, сразу открыть редактор + чат без клика */
  autoOpenEditor?: boolean;
}

// Все возможные блоки из промтов (с пробелами, ё, цифрами)
const BLOCK_ALIASES: Record<string, string> = {
  "ПРОСИТЕЛЬНАЯ ЧАСТЬ": "ТРЕБОВАНИЯ",
  "ПРАВОВОЕ ОБОСНОВАНИЕ": "ТЕЛО",
  "ОПИСАТЕЛЬНАЯ ЧАСТЬ": "ТЕЛО",
  "ДОВОДЫ": "ТЕЛО",
  "ДОКАЗАТЕЛЬСТВА": "ТЕЛО",
};

function normalizeBlockType(raw: string): string {
  const up = raw.trim().toUpperCase();
  return BLOCK_ALIASES[up] ?? up;
}

export function parseDocBlocks(content: string): { type: string; lines: string[] }[] {
  const result: { type: string; lines: string[] }[] = [];
  let current: { type: string; lines: string[] } = { type: "ТЕЛО", lines: [] };
  for (const raw of content.split("\n")) {
    // Матчим [ЛЮБОЙ ТЕКСТ] — с пробелами, ё, цифрами
    const match = raw.trim().match(/^\[([А-ЯЁA-Z][А-ЯЁA-Za-zа-яё0-9\s_]*)\]$/);
    if (match) {
      if (current.lines.some(l => l.trim())) result.push(current);
      current = { type: normalizeBlockType(match[1]), lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  if (current.lines.some(l => l.trim())) result.push(current);
  return result;
}