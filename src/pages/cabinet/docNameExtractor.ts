// ─── Извлечение точного названия документа из текста рекомендации AI ───────
//
// Проблема: AI в чате (backend/ai-chat) даёт рекомендацию текстом по одному
// из устойчивых шаблонов («Рекомендую подготовить: …», «Могу помочь
// составить: …», «Будем готовить …»), но НЕ возвращает структурированный
// doc_type. Раньше при клике «Создать документ» тип заново «угадывался»
// отдельным AI-запросом по всей истории чата — и мог разойтись с тем, что
// AI только что явно назвал в своём ответе.
//
// Решение: сначала пытаемся распарсить точное название документа прямо из
// текста последнего ответа AI (без обращения к AI повторно — это надёжнее
// и быстрее). Если у названия есть совпадение в каталоге DOC_TYPES — берём
// его id (тогда система будет использовать готовый экспертный промт для
// этого типа). Если совпадения нет — всё равно используем ИЗВЛЕЧЁННОЕ
// название как custom_label и отправляем на генерацию универсальным
// промтом (SYSTEM_DOC_GENERATE), не привязываясь к жёсткому списку типов.

import { DOC_TYPES } from "@/pages/cabinet/docBlocks";

// Фразы-маркеры рекомендации документа — используются во всех системных
// промтах backend (ai-chat/prompts.py, ai-docs/prompts.py, gigachat-proxy/prompts.py).
// Если промты поменяются — обновить и здесь.
const RECOMMEND_PATTERNS: RegExp[] = [
  /Рекомендую подготовить:\s*([^—\n]+?)(?:\s*—|\.|$)/i,
  /Могу помочь составить:\s*([^—\n]+?)(?:\s*—|\.|$)/i,
  /Будем готовить\s+([^.\n]+?)(?:\.|$)/i,
  /Для вашей ситуации подойдёт\s+([^—\n]+?)(?:\s*—|\.|$)/i,
  /составление используйте кнопку[^:]*:\s*([^—\n]+?)(?:\s*—|\.|$)/i,
];

/** Убирает эмодзи, кавычки и обрамляющий мусор из извлечённого названия */
function cleanLabel(raw: string): string {
  return raw
    .replace(/^[📄📎⚠️\s]+/, "")
    .replace(/^["«]|["»]$/g, "")
    .replace(/\*\*/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export interface ExtractedDocName {
  /** Точное название документа, как его назвал AI (для показа пользователю) */
  label: string;
  /** id из каталога DOC_TYPES, если удалось сопоставить — иначе null */
  matchedTypeId: string | null;
}

/**
 * Пытается извлечь точное название документа из текста ответа AI.
 * Возвращает null, если ни один из известных паттернов рекомендации не найден —
 * тогда вызывающий код должен использовать текущий fallback (AI-подбор по истории).
 */
export function extractDocNameFromAiText(aiText: string): ExtractedDocName | null {
  for (const pattern of RECOMMEND_PATTERNS) {
    const match = aiText.match(pattern);
    if (match && match[1]) {
      const label = cleanLabel(match[1]);
      if (label.length < 3) continue;

      // Пытаемся найти точное или частичное совпадение в каталоге —
      // чтобы использовать готовый экспертный промт для этого типа документа.
      const lowerLabel = label.toLowerCase();
      const exact = DOC_TYPES.find(d => d.label.toLowerCase() === lowerLabel);
      if (exact) return { label: exact.label, matchedTypeId: exact.id };

      // Частичное совпадение — название рекомендации содержит label из каталога
      // или наоборот (например, «заявление о взыскании алиментов» ~ «О взыскании алиментов»)
      const partial = DOC_TYPES.find(d => {
        const dl = d.label.toLowerCase();
        return lowerLabel.includes(dl) || dl.includes(lowerLabel);
      });
      if (partial) return { label: partial.label, matchedTypeId: partial.id };

      // Совпадения в каталоге нет — документ такого типа отсутствует в перечне,
      // но мы всё равно возвращаем ИМЕННО то название, что назвал AI.
      return { label, matchedTypeId: null };
    }
  }
  return null;
}
