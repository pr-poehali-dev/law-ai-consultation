// Кэш ответов чата по хэшу запроса — 5 минут TTL
// Предотвращает повторные запросы к AI для одинаковых вопросов

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  answer: string;
  truncated?: boolean;
  needs_expert?: boolean;
  ts: number;
}

const _cache = new Map<string, CacheEntry>();

function hashMessages(messages: { role: string; content: string }[]): string {
  const last3 = messages.slice(-3);
  return last3.map(m => `${m.role}:${m.content.slice(0, 200)}`).join("|");
}

export function getCachedAnswer(messages: { role: string; content: string }[]): CacheEntry | null {
  const key = hashMessages(messages);
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedAnswer(
  messages: { role: string; content: string }[],
  answer: string,
  truncated?: boolean,
  needs_expert?: boolean,
): void {
  // Не кэшируем обрезанные ответы и ответы с рекомендацией эксперта
  if (truncated || needs_expert) return;
  const key = hashMessages(messages);
  _cache.set(key, { answer, truncated, needs_expert, ts: Date.now() });
  // Периодическая очистка старых записей
  if (_cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of _cache) {
      if (now - v.ts > CACHE_TTL_MS) _cache.delete(k);
    }
  }
}
