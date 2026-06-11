import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken, consumeQuestion } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const WEB_SEARCH_URL  = (func2url as Record<string, string>)["web-search"];
const LEGAL_DOCS_URL  = (func2url as Record<string, string>)["legal-docs"];

interface WebResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
}

interface DbResult {
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
  article_match?: boolean;
}

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

const CATEGORIES = [
  { id: "case_law",           label: "Судебная практика", icon: "Scale" },
  { id: "codex",              label: "Кодексы и законы",  icon: "BookMarked" },
  { id: "court_definitions",  label: "Обзоры", icon: "Gavel" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];



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
  const [dbResults, setDbResults]   = useState<DbResult[] | null>(null);
  const [webSite, setWebSite]       = useState("");
  const [webLoading, setWebLoading] = useState(false);
  const [dbLoading, setDbLoading]   = useState(false);
  const [webError, setWebError]     = useState("");
  const [dbError, setDbError]       = useState("");
  const [webCopied, setWebCopied]   = useState<number | null>(null);
  const [dbCopied, setDbCopied]     = useState<number | null>(null);
  const [searched, setSearched]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCodex = category === "codex" || category === "court_definitions";
  const catLabel = CATEGORIES.find(c => c.id === category)?.label ?? category;

  const search = async () => {
    const q = query.trim();
    if (!q) { setWebError("Введите поисковый запрос"); return; }
    setWebError(""); setDbError("");
    setWebResults(null); setDbResults(null); setWebSite("");
    setSearched(true);
    // Списываем 1 вопрос за каждый поиск
    consumeQuestion();
    const token = getToken();

    if (isCodex) {
      // Кодексы — только по базе документов
      setDbLoading(true);
      fetch(LEGAL_DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ sub: "search", query: q, category, limit: 10 }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) { setDbError(data.error); setDbResults([]); }
          else setDbResults(data.results ?? []);
        })
        .catch(() => { setDbError("Ошибка поиска по базе"); setDbResults([]); })
        .finally(() => setDbLoading(false));
    } else {
      // Судебная практика / определения — интернет-поиск
      setWebLoading(true);
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
    }
  };

  const copyText = async (idx: number, text: string, mode: "web" | "db") => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const t = document.createElement("textarea");
        t.value = text; t.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(t); t.select();
        document.execCommand("copy"); document.body.removeChild(t);
      }
      if (mode === "web") { setWebCopied(idx); setTimeout(() => setWebCopied(null), 2000); }
      else                { setDbCopied(idx);  setTimeout(() => setDbCopied(null),  2000); }
    } catch (_e) { /* ignore */ }
  };



  const catInfo = CATEGORIES.find(c => c.id === category)!;
  const isLoading = webLoading || dbLoading;

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
            style={{ background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>тестовый режим</span>
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
              onClick={() => { setCategory(c.id); setWebResults(null); setDbResults(null); setWebSite(""); setWebError(""); setDbError(""); setSearched(false); }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all"
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
            className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition-all placeholder:text-slate-400"
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



        {/* ═══ СЕКЦИЯ: БАЗА КОДЕКСОВ ═══ */}
        {searched && isCodex && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2"
              style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.06),rgba(26,107,181,0.03))", borderBottom: "1px solid #e2e8f0" }}>
              <Icon name="BookMarked" size={11} color="#0f4c81" />
              <p className="text-[11px] font-bold text-slate-700 flex-1">
                {category === "codex" ? "База кодексов и законов" : "База обзоров и определений ВС РФ"}
              </p>
              {dbLoading && <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
              {!dbLoading && dbResults !== null && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={dbResults.length > 0 ? { background: "#dcfce7", color: "#166534" } : { background: "#f1f5f9", color: "#64748b" }}>
                  {dbResults.length > 0 ? `${dbResults.length} найдено` : "Не найдено"}
                </span>
              )}
            </div>

            {dbLoading && (
              <div className="px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin shrink-0" />
                  <p className="text-[11px] text-slate-400">{category === "codex" ? "Ищу статьи в базе законодательства..." : "Ищу в базе определений и обзоров ВС РФ..."}</p>
                </div>
                {[70, 90, 55].map((w, i) => (
                  <div key={i} className="h-2 rounded-full animate-pulse" style={{ width: `${w}%`, background: "#f1f5f9" }} />
                ))}
              </div>
            )}

            {!dbLoading && dbError && (
              <div className="px-3 py-2.5 flex items-center gap-1.5">
                <Icon name="AlertCircle" size={11} color="#ef4444" />
                <p className="text-[11px] text-red-500">{dbError}</p>
              </div>
            )}

            {!dbLoading && dbResults && dbResults.length === 0 && !dbError && (
              <div className="px-3 py-3 text-center">
                <p className="text-[11px] text-slate-400">В базе ничего не найдено</p>
                <p className="text-[11px] text-slate-300 mt-1">
                  {category === "codex"
                    ? "Попробуйте: «ст. 333 ГК РФ», «ст. 14 ТК РФ»"
                    : "Попробуйте: «неустойка», «расторжение договора», «защита прав потребителей»"}
                </p>
              </div>
            )}

            {!dbLoading && dbResults && dbResults.length > 0 && (
              <div className="divide-y divide-slate-50">
                {dbResults.map((r, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[11px] font-bold text-slate-800 leading-snug flex-1">{r.title}</p>
                      <div className="flex gap-1 shrink-0">
                        {r.article_match && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                            style={{ background: "#dbeafe", color: "#1e40af" }}>📌 Статья</span>
                        )}
                        {r.exact_match && !r.article_match && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                            style={{ background: "#dcfce7", color: "#166534" }}>точное</span>
                        )}
                      </div>
                    </div>
                    {r.snippet && (
                      <div className="px-2.5 py-2 rounded-lg text-[11px] text-slate-600 leading-relaxed mb-2"
                        style={{ background: "#f8fafc", border: "1px solid #f1f5f9", maxHeight: "180px", overflowY: "auto" }}>
                        {highlight(r.snippet, query)}
                      </div>
                    )}
                    <button
                      onClick={() => copyText(i, `${r.title}\n\n${r.snippet}`, "db")}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={dbCopied === i
                        ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                        : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                      <Icon name={dbCopied === i ? "CheckCheck" : "Copy"} size={9} color={dbCopied === i ? "#059669" : "#64748b"} />
                      {dbCopied === i ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ СЕКЦИЯ: ИНТЕРНЕТ-ПОИСК ═══ */}
        {searched && !isCodex && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2"
              style={{ background: "linear-gradient(135deg,rgba(22,101,52,0.06),rgba(21,128,61,0.03))", borderBottom: "1px solid #e2e8f0" }}>
              <Icon name="Globe" size={11} color="#166534" />
              <p className="text-[11px] font-bold text-slate-700 flex-1">Поиск судебной практики</p>
              {webLoading && <span className="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />}
              {!webLoading && webResults && webResults.length > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
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
                      <p className="text-[11px] text-slate-500 leading-snug mb-2">
                        {highlight(r.snippet.slice(0, 200) + (r.snippet.length > 200 ? "..." : ""), query)}
                      </p>
                    )}
                    <p className="text-xs text-blue-500 truncate mb-2">{r.url}</p>
                    <div className="flex gap-1.5">
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                        style={{ background: "#dcfce7", color: "#166534" }}>
                        <Icon name="ExternalLink" size={9} color="#166534" />
                        Открыть
                      </a>
                      <button
                        onClick={() => copyText(i, `${r.title}\n${r.url}\n\n${r.snippet}`, "web")}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all"
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


          </div>
        )}

        {/* Подсказка до первого поиска */}
        {!searched && (
          <div className="text-center py-5">
            {isCodex ? (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(15,76,129,0.08)" }}>
                  <Icon name={category === "codex" ? "BookMarked" : "Gavel"} size={18} color="#0f4c81" />
                </div>
                {category === "codex" ? (
                  <>
                    <p className="text-[11px] text-slate-400">Поиск по загруженным кодексам и законам</p>
                    <p className="text-[11px] text-slate-300 mt-1">Например: «ст. 333 ГК РФ», «статья 14 ТК РФ», «неустойка»</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400">Поиск по обзорам судебной практики ВС РФ</p>
                    <p className="text-[11px] text-slate-300 mt-1">Например: «неустойка», «расторжение договора», «защита прав потребителей»</p>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(22,101,52,0.08)" }}>
                  <Icon name="Globe" size={18} color="#166534" />
                </div>
                <p className="text-[11px] text-slate-400">Поиск в интернете через Яндекс по официальным сайтам судов</p>
                <p className="text-[11px] text-slate-300 mt-1">Например: «неустойка 1/300», «расторжение договора», «банкротство»</p>
              </>
            )}
          </div>
        )}

        {/* Дисклеймер */}
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <Icon name="AlertTriangle" size={11} color="#b45309" className="shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-snug">
            {category === "codex"
              ? "Поиск ведётся по документам из базы. Для точного результата указывайте номер статьи: «ст. 333 ГК РФ»."
              : category === "court_definitions"
              ? "Поиск по обзорам и правовым позициям ВС РФ из базы. Результаты носят справочный характер."
              : "Результаты носят справочный характер. Поиск ведётся через Яндекс по официальным сайтам судов."}
          </p>
        </div>
      </div>
    </div>
  );
}