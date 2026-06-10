import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const LEGAL_DOCS_URL = (func2url as Record<string, string>)["legal-docs"];
const AI_CHAT_URL    = (func2url as Record<string, string>)["ai-chat"];

interface SearchResult {
  title: string;
  filename: string;
  doc_year: number | null;
  court_name: string;
  case_number: string;
  description: string;
  snippet: string;
  rank: number;
  exact_match?: boolean;
  all_terms?: boolean;
}

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

const CATEGORIES = [
  { id: "case_law",           label: "Судебная практика", icon: "Scale" },
  { id: "codex",              label: "Кодексы и законы",  icon: "BookMarked" },
  { id: "court_definitions",  label: "Определения судов", icon: "Gavel" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

const EXTERNAL_LINKS = [
  { label: "sudact.ru",      hint: "Решения судов РФ",           color: "#1e40af", bg: "#dbeafe",  url: (q: string) => `https://sudact.ru/search/?search_text=${q}` },
  { label: "kad.arbitr.ru",  hint: "Арбитражные дела",           color: "#166534", bg: "#dcfce7",  url: (q: string) => `https://kad.arbitr.ru/?find=${q}` },
  { label: "sudrf.ru",       hint: "Суды общей юрисдикции",      color: "#7c3aed", bg: "#ede9fe",  url: (q: string) => `https://sudrf.ru/index.php?id=300&act=go_search&searchtype=fs&fs_text=${q}` },
  { label: "consultant.ru",  hint: "КонсультантПлюс",            color: "#b45309", bg: "#fef3c7",  url: (q: string) => `https://www.consultant.ru/search/?q=${q}` },
  { label: "garant.ru",      hint: "Гарант",                     color: "#991b1b", bg: "#fee2e2",  url: (q: string) => `https://www.garant.ru/search/#q=${q}` },
];

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return text;
  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((p, i) =>
    regex.test(p)
      ? <mark key={i} style={{ background: "#fef08a", borderRadius: "2px", padding: "0 1px" }}>{p}</mark>
      : p
  );
}

export default function CaseLawSearchPanel({ onClose, onSendToChat }: Props) {
  const [query, setQuery]           = useState("");
  const [category, setCategory]     = useState<CategoryId>("case_law");
  const [dbResults, setDbResults]   = useState<SearchResult[] | null>(null);
  const [aiAnswer, setAiAnswer]     = useState<string | null>(null);
  const [dbLoading, setDbLoading]   = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [dbError, setDbError]       = useState("");
  const [aiError, setAiError]       = useState("");
  const [copied, setCopied]         = useState<number | null>(null);
  const [aiCopied, setAiCopied]     = useState(false);
  const [searched, setSearched]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const catLabel = CATEGORIES.find(c => c.id === category)?.label ?? category;

  const search = async () => {
    const q = query.trim();
    if (!q) { setDbError("Введите поисковый запрос"); return; }
    setDbError(""); setAiError("");
    setDbResults(null); setAiAnswer(null);
    setSearched(true);

    // ── 1. Поиск по базе документов ──────────────────────────────
    setDbLoading(true);
    const token = getToken();
    fetch(LEGAL_DOCS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({ sub: "search", query: q, category, limit: 8 }),
    })
      .then(r => r.json())
      .then(data => setDbResults(data.results ?? []))
      .catch(() => { setDbError("Ошибка поиска по базе"); setDbResults([]); })
      .finally(() => setDbLoading(false));

    // ── 2. AI-поиск в интернете ───────────────────────────────────
    setAiLoading(true);
    const systemPrompt = `Ты — юридический ассистент с доступом к web search (поиску в интернете). Твоя задача — находить реальные судебные решения, постановления, определения и другие судебные акты, соответствующие запросу пользователя. Категория запроса: «${catLabel}».

ИСТОЧНИКИ ДЛЯ ПОИСКА (строго определённые):
- sudact.ru — агрегатор судебных решений (все суды)
- kad.arbitr.ru — картотека арбитражных дел (арбитражные суды)
- sudrf.ru — ГАС «Правосудие» (суды общей юрисдикции)
- ras.arbitr.ru — банк решений арбитражных судов
- vsrf.ru — Верховный Суд РФ
- ipc.arbitr.ru — Суд по интеллектуальным правам

АЛГОРИТМ (строгая последовательность):
1. Определи тип запроса:
   - Номер арбитражного дела (А40-...) → ищи на kad.arbitr.ru: site:kad.arbitr.ru [номер]
   - Номер дела общей юрисдикции (2-..., 33-...) → ищи на sudrf.ru: site:sudrf.ru [номер]
   - Ключевые слова по арбитражному спору → site:kad.arbitr.ru [ключевые слова]
   - Ключевые слова по спору в общих судах → site:sudact.ru [ключевые слова]
   - ВС РФ, КС РФ → site:vsrf.ru [запрос]
   - Интеллектуальная собственность → site:ipc.arbitr.ru [запрос]
2. Выполни поиск через web_search с оператором site: для ограничения источника
3. Если результатов нет — попробуй другой источник или расширь запрос

ФОРМАТ ОТВЕТА (обязательная структура для каждого найденного дела):
## 🔍 РЕЗУЛЬТАТЫ ПОИСКА СУДЕБНОЙ ПРАКТИКИ
### 📊 Статистика поиска
- Найдено дел: [N]
- Источники: [перечень]
---
### 📌 ДЕЛО № [номер]
| Поле | Значение |
|------|----------|
| **Суд** | [наименование] |
| **Дата решения** | [ДД.ММ.ГГГГ] |
| **Суть спора** | [кратко] |
| **Ключевой вывод** | «[цитата или точный пересказ]» |
| **Источник** | [сайт] |
| **Ссылка** | [полный URL] |
---
### ⚠️ ПРИМЕЧАНИЕ
Все найденные акты реальны. Рекомендуется ознакомиться с полным текстом по ссылке.

ЕСЛИ НИЧЕГО НЕ НАЙДЕНО — честно сообщи об этом и предложи поискать на sudact.ru, kad.arbitr.ru, sudrf.ru. ЗАПРЕЩЕНО предлагать «похожие дела», которых нет.

ЖЁСТКИЕ ЗАПРЕТЫ:
- НЕ выдумывай номера дел, даты, судей, цитаты
- НЕ используй «обычно суды считают» без ссылки на конкретное дело
- НЕ давай ответ без источника
- НЕ изменяй смысл найденного судебного акта
- Если дело старше 3-5 лет — укажи, что практика могла измениться`;

    fetch(AI_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: q },
        ],
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.answer) setAiAnswer(data.answer);
        else setAiError(data.error || "AI не ответил");
      })
      .catch(() => setAiError("Ошибка AI-поиска"))
      .finally(() => setAiLoading(false));
  };

  const copySnippet = async (idx: number, text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const t = document.createElement("textarea");
        t.value = text; t.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(t); t.select();
        document.execCommand("copy"); document.body.removeChild(t);
      }
      setCopied(idx); setTimeout(() => setCopied(null), 2000);
    } catch (_e) { /* clipboard недоступен */ }
  };

  const copyAi = async () => {
    if (!aiAnswer) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(aiAnswer);
      setAiCopied(true); setTimeout(() => setAiCopied(false), 2000);
    } catch (_e) { /* ignore */ }
  };

  const sendDocToChat = (r: SearchResult) => {
    const parts: string[] = [`🔍 ${catLabel} из базы документов:`];
    if (r.case_number) parts.push(`• Дело: ${r.case_number}`);
    if (r.court_name)  parts.push(`• Суд: ${r.court_name}`);
    if (r.doc_year)    parts.push(`• Год: ${r.doc_year}`);
    parts.push(`• Источник: ${r.filename}`);
    if (r.snippet) parts.push(`\nФрагмент:\n«${r.snippet.slice(0, 400)}»`);
    parts.push(`\nПроанализируй применительно к моему вопросу: ${query}`);
    onSendToChat(parts.join("\n")); onClose();
  };

  const sendAiToChat = () => {
    if (!aiAnswer) return;
    onSendToChat(`🌐 Результаты поиска по запросу «${query}»:\n\n${aiAnswer}\n\nПрокомментируй это применительно к моей ситуации.`);
    onClose();
  };

  const eq = encodeURIComponent(query || "судебная практика");
  const catInfo = CATEGORIES.find(c => c.id === category)!;
  const isLoading = dbLoading || aiLoading;

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="BookOpen" size={12} color="#fff" />
          </div>
          <p className="text-xs font-bold text-slate-800">Поиск по правовой базе</p>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>
            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />база + AI
          </span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Тело */}
      <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "calc(68dvh - 44px)" }}>

        {/* Выбор категории */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => { setCategory(c.id); setDbResults(null); setAiAnswer(null); setDbError(""); setAiError(""); setSearched(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
              style={category === c.id
                ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff" }
                : { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}
            >
              <Icon name={c.icon as Parameters<typeof Icon>[0]["name"]} size={10}
                color={category === c.id ? "#fff" : "#64748b"} />
              {c.label}
            </button>
          ))}
        </div>

        {/* Строка поиска */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all placeholder:text-slate-400"
            placeholder={`Поиск в «${catInfo.label}»...`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            autoFocus
          />
          <button
            onClick={search}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-60 shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
          >
            {isLoading
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Icon name="Search" size={13} color="#fff" />}
            {isLoading ? "Поиск..." : "Найти"}
          </button>
        </div>

        {dbError && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] text-red-700"
            style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
            <Icon name="AlertCircle" size={12} color="#ef4444" />{dbError}
          </div>
        )}

        {/* ═══ СЕКЦИЯ 1: БАЗА ДОКУМЕНТОВ ═══ */}
        {searched && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {/* Заголовок секции */}
            <div className="flex items-center gap-2 px-3 py-2"
              style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.06),rgba(26,107,181,0.03))", borderBottom: "1px solid #e2e8f0" }}>
              <Icon name="Database" size={11} color="#0f4c81" />
              <p className="text-[10px] font-bold text-slate-700 flex-1">База загруженных документов</p>
              {dbLoading && <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
              {!dbLoading && dbResults !== null && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={dbResults.length > 0
                    ? { background: "#dcfce7", color: "#166534" }
                    : { background: "#f1f5f9", color: "#64748b" }}>
                  {dbResults.length > 0 ? `${dbResults.length} найдено` : "Не найдено"}
                </span>
              )}
            </div>

            {dbLoading && (
              <div className="px-3 py-3 flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin shrink-0" />
                <p className="text-[11px] text-slate-400">Ищу в загруженных документах...</p>
              </div>
            )}

            {!dbLoading && dbResults && dbResults.length === 0 && (
              <div className="px-3 py-3 text-center">
                <p className="text-[11px] text-slate-400">В загруженных документах ничего не найдено</p>
              </div>
            )}

            {!dbLoading && dbResults && dbResults.length > 0 && (
              <div className="divide-y divide-slate-50">
                {dbResults.map((r, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        {r.case_number && (
                          <p className="text-[11px] font-bold text-slate-800 leading-tight">Дело № {r.case_number}</p>
                        )}
                        <p className="text-[11px] font-semibold text-slate-600 leading-snug">{r.title}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {r.exact_match && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                            style={{ background: "#dcfce7", color: "#166534" }}>точное</span>
                        )}
                      </div>
                    </div>
                    {r.court_name && (
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-1">
                        <Icon name="Landmark" size={9} color="#94a3b8" />
                        {r.court_name}{r.doc_year ? ` · ${r.doc_year}` : ""}
                      </p>
                    )}
                    {r.snippet && (
                      <div className="px-2 py-1.5 rounded-lg text-[10px] text-slate-500 leading-snug mb-2"
                        style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                        {highlight(r.snippet.slice(0, 250) + (r.snippet.length > 250 ? "..." : ""), query)}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => copySnippet(i, `${r.case_number ? "Дело № " + r.case_number + "\n" : ""}${r.court_name}${r.doc_year ? ", " + r.doc_year : ""}\nИсточник: ${r.filename}\n\n${r.snippet}`)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={copied === i
                          ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                          : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                        <Icon name={copied === i ? "CheckCheck" : "Copy"} size={9} color={copied === i ? "#059669" : "#64748b"} />
                        {copied === i ? "Скопировано" : "Копировать"}
                      </button>
                      <button
                        onClick={() => sendDocToChat(r)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white transition-all"
                        style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                        <Icon name="Send" size={9} color="#fff" />
                        В чат
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ СЕКЦИЯ 2: AI-ПОИСК ═══ */}
        {searched && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {/* Заголовок секции */}
            <div className="flex items-center gap-2 px-3 py-2"
              style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.06),rgba(109,40,217,0.03))", borderBottom: "1px solid #e2e8f0" }}>
              <Icon name="Sparkles" size={11} color="#7c3aed" />
              <p className="text-[10px] font-bold text-slate-700 flex-1">AI-поиск</p>
              {aiLoading && <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />}
              {!aiLoading && aiAnswer && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#ede9fe", color: "#7c3aed" }}>готово</span>
              )}
            </div>

            {aiLoading && (
              <div className="px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin shrink-0" />
                  <p className="text-[11px] text-slate-400">AI анализирует запрос...</p>
                </div>
                {[70, 90, 55].map((w, i) => (
                  <div key={i} className="h-2.5 rounded-full animate-pulse" style={{ width: `${w}%`, background: "#f1f5f9" }} />
                ))}
              </div>
            )}

            {!aiLoading && aiError && (
              <div className="px-3 py-3 flex items-center gap-1.5">
                <Icon name="AlertCircle" size={11} color="#ef4444" />
                <p className="text-[11px] text-red-500">{aiError}</p>
              </div>
            )}

            {!aiLoading && aiAnswer && (
              <div className="px-3 py-3">
                <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-2.5"
                  style={{ maxHeight: "200px", overflowY: "auto" }}>
                  {aiAnswer}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={copyAi}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={aiCopied
                      ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                      : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                    <Icon name={aiCopied ? "CheckCheck" : "Copy"} size={9} color={aiCopied ? "#059669" : "#64748b"} />
                    {aiCopied ? "Скопировано" : "Копировать"}
                  </button>
                  <button onClick={sendAiToChat}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white transition-all"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
                    <Icon name="Send" size={9} color="#fff" />
                    В чат AI-юристу
                  </button>
                </div>
                <p className="text-[9px] text-slate-300 mt-2">
                  ⚠ AI не выдумывает дела — при отсутствии точных данных указывает нормы закона
                </p>
              </div>
            )}

            {/* Кнопки внешнего поиска */}
            <div className="px-3 pb-2.5 pt-1.5 border-t border-slate-50">
              <p className="text-[9px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wide">Также поискать на сайтах:</p>
              <div className="grid grid-cols-3 gap-1">
                {EXTERNAL_LINKS.map(({ label, hint, color, bg, url }) => (
                  <a key={label} href={url(eq)} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-start px-2 py-1.5 rounded-lg text-[9px] font-semibold transition-all hover:opacity-80 active:scale-95"
                    style={{ background: bg, color }}>
                    <span className="flex items-center gap-0.5">
                      <Icon name="ExternalLink" size={8} color={color} />
                      {label}
                    </span>
                    <span className="opacity-60 mt-0.5" style={{ fontSize: "8px" }}>{hint}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Подсказка до первого поиска */}
        {!searched && (
          <div className="text-center py-5">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(15,76,129,0.08)" }}>
                  <Icon name="Database" size={14} color="#0f4c81" />
                </div>
                <p className="text-[9px] text-slate-400">База</p>
              </div>
              <Icon name="Plus" size={12} color="#cbd5e1" />
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.08)" }}>
                  <Icon name="Sparkles" size={14} color="#7c3aed" />
                </div>
                <p className="text-[9px] text-slate-400">AI</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Поиск ведётся одновременно по базе документов и через AI</p>
            <p className="text-[10px] text-slate-300 mt-1">Например: «неустойка 1/300», «расторжение договора», «банкротство»</p>
          </div>
        )}

        {/* Дисклеймер */}
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <Icon name="AlertTriangle" size={11} color="#b45309" className="shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 leading-snug">
            Результаты носят справочный характер. AI не выдумывает судебные решения.
          </p>
        </div>
      </div>
    </div>
  );
}