import type { GenDoc } from "@/pages/cabinet/DocsTab";

export interface ViewDocModalProps {
  doc: GenDoc;
  onClose: () => void;
  onOpenPlanModal?: () => void;
  fillValues?: Record<string, string>;
  onFillChange?: (key: string, value: string) => void;
  onApplyFill?: () => void;
  paidQuestions?: number;
  onPayForQuestions?: () => void;
}

export function parseDocBlocks(content: string): { type: string; lines: string[] }[] {
  const result: { type: string; lines: string[] }[] = [];
  let current: { type: string; lines: string[] } = { type: "ТЕЛО", lines: [] };
  for (const raw of content.split("\n")) {
    const match = raw.match(/^\[([А-ЯA-Z_]+)\]$/);
    if (match) {
      if (current.lines.some(l => l.trim())) result.push(current);
      current = { type: match[1], lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  if (current.lines.some(l => l.trim())) result.push(current);
  return result;
}