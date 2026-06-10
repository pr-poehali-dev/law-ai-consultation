import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const LEGAL_DOCS_URL = (func2url as Record<string, string>)["legal-docs"];

interface SearchResult {
  title: string;
  filename: string;
  doc_year: number | null;
  court_name: string;
  case_number: string;
  description: string;
  snippet: string;
  rank: number;
}

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return text;
  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((p, i) =>
    regex.test(p) ? <mark key={i} style={{ background: "#fef08a", borderRadius: "2px", padding: "0 1px" }}>{p}</mark> : p
  );
}

export default function CaseLawSearchPanel({ onClose, onSendToChat }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) { setError("Введите поисковый запрос"); return; }
    setError("");
    setLoading(true);
    setResults(null);
    try {
      const token = getToken();
      const res = await fetch(LEGAL_DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ sub: "search", query: q, category: "case_law", limit: 8 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка поиска"); setResults([]); }
      else setResults(data.results || []);
    } catch {
      setError("Нет соединения. Попробуйте ещё раз.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const copySnippet = async (idx: number, text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else { const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); }
      setCopied(idx); setTimeout(() => setCopied(null), 2000);
    } catch (_e) { /* clipboard недоступен */ }
  };

  const sendToChat = (r: SearchResult) => {
    const parts: string[] = ["🔍 Судебная практика из базы документов:"];
    if (r.case_number) parts.push(`• Дело: ${r.case_number}`);
    if (r.court_name) parts.push(`• Суд: ${r.court_name}`);
    if (r.doc_year) parts.push(`• Год: ${r.doc_year}`);
    parts.push(`• Источник: ${r.filename}`);
    if (r.snippet) parts.push(`\nФрагмент:\n«${r.snippet.slice(0, 400)}»`);
    parts.push(`\nПроанализируй этот судебный акт применительно к моему вопросу: ${query}`);
    onSendToChat(parts.join("\n"));
    onClose();
  };

  const encodedQuery = encodeURIComponent(query || "судебная практика");
  const externalLinks = [
    { label: "sudact.ru", url: `https://sudact.ru/search/?search_text=${encodedQuery}`, color: "#1e40af", bg: "#dbeafe" },
    { label: "kad.arbitr.ru", url: `https://kad.arbitr.ru/?find=${encodedQuery}`, color: "#166534", bg: "#dcfce7" },
    { label: "sudrf.ru", url: `https://sudrf.ru/index.php?id=300&act=go_search&searchtype=fs&court_subj=0&vv_case_number=&fs_text=${encodedQuery}`, color: "#991b1b", bg: "#fee2e2" },
  ];

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="BookOpen" size={12} color="#fff" />
          </div>
          <p className="text-xs font-bold text-slate-800">Поиск судебной практики</p>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>
            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />база документов
          </span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Тело */}
      <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "calc(68dvh - 44px)" }}>

        {/* Строка поиска */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all placeholder:text-slate-400"
            placeholder="Неустойка 1/300, договор поставки, банкротство..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            autoFocus
          />
          <button
            onClick={search}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-60 shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
          >
            {loading
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Icon name="Search" size={13} color="#fff" />}
            {loading ? "Поиск..." : "Найти"}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] text-red-700"
            style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
            <Icon name="AlertCircle" size={12} color="#ef4444" />{error}
          </div>
        )}

        {/* Результаты из базы */}
        {results && results.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              <Icon name="CheckCircle" size={11} color="#059669" />
              Найдено {results.length} результатов в базе документов
            </p>
            {results.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-200 overflow-hidden bg-white"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                {/* Шапка карточки */}
                <div className="px-3 py-2.5 flex items-start justify-between gap-2"
                  style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.04),rgba(26,107,181,0.02))", borderBottom: "1px solid #f1f5f9" }}>
                  <div className="flex-1 min-w-0">
                    {r.case_number && (
                      <p className="text-[12px] font-bold text-navy-800 leading-tight">Дело № {r.case_number}</p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-700 leading-snug mt-0.5">{r.title}</p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: "#dbeafe", color: "#1e40af" }}>
                    📁 Загружен
                  </span>
                </div>

                {/* Мета */}
                <div className="px-3 py-2 space-y-1">
                  {r.court_name && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Icon name="Landmark" size={10} color="#64748b" />
                      {r.court_name}{r.doc_year ? ` · ${r.doc_year}` : ""}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Icon name="FileText" size={10} color="#94a3b8" />
                    {r.filename}
                  </p>
                  {/* Фрагмент */}
                  {r.snippet && (
                    <div className="mt-1.5 px-2.5 py-2 rounded-lg text-[11px] text-slate-600 leading-snug"
                      style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <span className="font-semibold text-slate-500 text-[10px]">Фрагмент: </span>
                      {highlight(r.snippet.slice(0, 300) + (r.snippet.length > 300 ? "..." : ""), query)}
                    </div>
                  )}
                </div>

                {/* Кнопки */}
                <div className="px-3 py-2 flex gap-1.5 border-t border-slate-50">
                  <button
                    onClick={() => copySnippet(i, `Дело ${r.case_number ? "№ " + r.case_number : ""}\n${r.court_name}${r.doc_year ? ", " + r.doc_year : ""}\nИсточник: ${r.filename}\n\n${r.snippet}`)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all active:scale-95"
                    style={copied === i
                      ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                      : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                    <Icon name={copied === i ? "CheckCheck" : "Copy"} size={10} color={copied === i ? "#059669" : "#64748b"} />
                    {copied === i ? "Скопировано" : "Копировать"}
                  </button>
                  <button
                    onClick={() => sendToChat(r)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-white transition-all active:scale-95"
                    style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                    <Icon name="Send" size={10} color="#fff" />
                    В чат AI-юристу
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ничего не найдено → ссылки на внешние сайты */}
        {results && results.length === 0 && !loading && (
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <div className="px-3 py-3 text-center" style={{ background: "#f8fafc" }}>
              <Icon name="SearchX" size={22} className="mx-auto mb-2 text-slate-300" />
              <p className="text-[12px] font-semibold text-slate-700 mb-1">В базе документов ничего не найдено</p>
              <p className="text-[10px] text-slate-400 mb-3">Попробуйте другую формулировку или поищите на официальных сайтах:</p>
              <div className="flex flex-col gap-1.5">
                {externalLinks.map(({ label, url, color, bg }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80"
                    style={{ background: bg, color }}>
                    <Icon name="ExternalLink" size={11} color={color} />
                    Поиск на {label}
                  </a>
                ))}
              </div>
            </div>
            <div className="px-3 py-2 flex items-start gap-1.5"
              style={{ background: "rgba(245,158,11,0.05)", borderTop: "1px solid rgba(245,158,11,0.15)" }}>
              <Icon name="Info" size={11} color="#d97706" className="shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 leading-snug">
                AI не выдумывает судебные решения. Все результаты только из загруженных документов или официальных сайтов.
              </p>
            </div>
          </div>
        )}

        {/* Подсказка до поиска */}
        {results === null && !loading && !error && (
          <div className="text-center py-4">
            <Icon name="BookOpen" size={28} className="mx-auto mb-2 text-slate-200" />
            <p className="text-[11px] text-slate-400">Введите ключевые слова: категория спора, статья закона, тип документа</p>
            <p className="text-[10px] text-slate-300 mt-1">Например: «неустойка 1/300», «расторжение договора», «банкротство»</p>
          </div>
        )}

        {/* Дисклеймер */}
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <Icon name="AlertTriangle" size={11} color="#b45309" className="shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 leading-snug">
            Поиск ведётся только по документам, загруженным администратором. Результаты носят справочный характер.
          </p>
        </div>
      </div>
    </div>
  );
}