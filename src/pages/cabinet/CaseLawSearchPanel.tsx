import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const WEB_SEARCH_URL  = (func2url as Record<string, string>)["web-search"];


interface WebResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
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
  const [webResults, setWebResults] = useState<WebResult[] | null>(null);
  const [webSite, setWebSite]       = useState("");
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError]     = useState("");
  const [webCopied, setWebCopied]   = useState<number | null>(null);
  const [searched, setSearched]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const catLabel = CATEGORIES.find(c => c.id === category)?.label ?? category;

  const search = async () => {
    const q = query.trim();
    if (!q) { setWebError("Введите поисковый запрос"); return; }
    setWebError("");
    setWebResults(null); setWebSite("");
    setSearched(true);

    // Поиск в интернете через Yandex Search API
    setWebLoading(true);
    const token = getToken();
    fetch(WEB_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({ query: q, limit: 8 }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setWebError(data.error); setWebResults([]); }
        else { setWebResults(data.results ?? []); setWebSite(data.target_site ?? ""); }
      })
      .catch(() => { setWebError("Ошибка интернет-поиска"); setWebResults([]); })
      .finally(() => setWebLoading(false));
  };

  const copyWeb = async (idx: number, text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const t = document.createElement("textarea");
        t.value = text; t.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(t); t.select();
        document.execCommand("copy"); document.body.removeChild(t);
      }
      setWebCopied(idx); setTimeout(() => setWebCopied(null), 2000);
    } catch (_e) { /* ignore */ }
  };



  const eq = encodeURIComponent(query || "судебная практика");
  const catInfo = CATEGORIES.find(c => c.id === category)!;
  const isLoading = webLoading;

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
              onClick={() => { setCategory(c.id); setWebResults(null); setWebSite(""); setWebError(""); setSearched(false); }}
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



        {/* ═══ СЕКЦИЯ 2: ИНТЕРНЕТ-ПОИСК ═══ */}
        {searched && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2"
              style={{ background: "linear-gradient(135deg,rgba(22,101,52,0.06),rgba(21,128,61,0.03))", borderBottom: "1px solid #e2e8f0" }}>
              <Icon name="Globe" size={11} color="#166534" />
              <p className="text-[10px] font-bold text-slate-700 flex-1">Интернет-поиск</p>
              {webLoading && <span className="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />}
              {!webLoading && webResults && webResults.length > 0 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#dcfce7", color: "#166534" }}>
                  {webResults.length} найдено · {webSite}
                </span>
              )}
            </div>

            {webLoading && (
              <div className="px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin shrink-0" />
                  <p className="text-[11px] text-slate-400">Ищу в интернете через Яндекс...</p>
                </div>
                {[80, 60, 75].map((w, i) => (
                  <div key={i} className="h-2 rounded-full animate-pulse" style={{ width: `${w}%`, background: "#f1f5f9" }} />
                ))}
              </div>
            )}

            {!webLoading && webError && (
              <div className="px-3 py-2.5 flex items-start gap-1.5">
                <Icon name="AlertCircle" size={11} color="#f59e0b" />
                <p className="text-[11px] text-amber-700 leading-snug">{webError}</p>
              </div>
            )}

            {!webLoading && webResults && webResults.length === 0 && !webError && (
              <div className="px-3 py-2.5 text-center">
                <p className="text-[11px] text-slate-400">В интернете ничего не найдено по данному запросу</p>
              </div>
            )}

            {!webLoading && webResults && webResults.length > 0 && (
              <div className="divide-y divide-slate-50">
                {webResults.map((r, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[11px] font-semibold text-slate-800 leading-snug flex-1">{r.title}</p>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                        style={{ background: "#dcfce7", color: "#166534" }}>
                        {r.source || "интернет"}
                      </span>
                    </div>
                    {r.snippet && (
                      <p className="text-[10px] text-slate-500 leading-snug mb-2">
                        {highlight(r.snippet.slice(0, 200) + (r.snippet.length > 200 ? "..." : ""), query)}
                      </p>
                    )}
                    <p className="text-[9px] text-blue-500 truncate mb-2">{r.url}</p>
                    <div className="flex gap-1.5">
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                        style={{ background: "#dcfce7", color: "#166534" }}>
                        <Icon name="ExternalLink" size={9} color="#166534" />
                        Открыть
                      </a>
                      <button
                        onClick={() => copyWeb(i, `${r.title}\n${r.url}\n\n${r.snippet}`)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={webCopied === i
                          ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                          : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                        <Icon name={webCopied === i ? "CheckCheck" : "Copy"} size={9} color={webCopied === i ? "#059669" : "#64748b"} />
                        {webCopied === i ? "Скопировано" : "Копировать"}
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Кнопки ручного поиска на сайтах */}
            <div className="px-3 pb-2.5 pt-1.5 border-t border-slate-50">
              <p className="text-[9px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wide">Искать вручную:</p>
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
                  style={{ background: "rgba(22,101,52,0.08)" }}>
                  <Icon name="Globe" size={14} color="#166534" />
                </div>
                <p className="text-[9px] text-slate-400">Интернет</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Поиск одновременно по базе документов и в интернете (Яндекс)</p>
            <p className="text-[10px] text-slate-300 mt-1">Например: «неустойка 1/300», «расторжение договора», «банкротство»</p>
          </div>
        )}

        {/* Дисклеймер */}
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <Icon name="AlertTriangle" size={11} color="#b45309" className="shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 leading-snug">
            Результаты носят справочный характер. Интернет-поиск ведётся через Яндекс по официальным сайтам судов.
          </p>
        </div>
      </div>
    </div>
  );
}