import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const LEGAL_DOCS_URL = (func2url as Record<string, string>)["legal-docs"];
const PAGE_SIZE = 20;

interface DocMeta {
  id: number;
  category: string;
  title: string;
  filename: string;
  description: string;
  doc_year: number | null;
  court_name: string;
  case_number: string;
  created_at: string;
}

interface ChunkItem {
  chunk_index: number;
  content: string;
}

interface TocItem {
  chunk_index: number;
  type: "chapter" | "article";
  label: string;
}

interface Props {
  docId: number;
  docTitle: string;
  /** Если открываем документ сразу с поисковым запросом — сразу перейти к нужному фрагменту */
  initialQuery?: string;
  onClose: () => void;
}

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

/** Извлекает заголовки статей/глав из чанка для визуального форматирования документа */
function formatChunkContent(content: string, query: string, fontScale: number): React.ReactNode {
  const lines = content.split(/\n+/).filter(l => l.trim());
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const isArticleHeader = /^статья\s+[\d.]/i.test(trimmed);
    const isChapterHeader = /^(глава|раздел)\s+[ivxlc\d]/i.test(trimmed);
    const isAmendmentNote = /^(информация об изменениях|гарант|см\.\s|см\s|федеральным законом)/i.test(trimmed);

    if (isChapterHeader) {
      return (
        <p key={i} className="font-bold uppercase tracking-wide"
          style={{ color: "#0f4c81", fontSize: `${15 * fontScale}px`, marginTop: "28px", marginBottom: "14px", paddingBottom: "8px", borderBottom: "2px solid #e2e8f0" }}>
          {highlight(trimmed, query)}
        </p>
      );
    }
    if (isArticleHeader) {
      return (
        <p key={i} className="font-bold" style={{ color: "#1e293b", fontSize: `${16 * fontScale}px`, marginTop: "22px", marginBottom: "10px" }}>
          {highlight(trimmed, query)}
        </p>
      );
    }
    if (isAmendmentNote) {
      return (
        <p key={i} className="italic" style={{ color: "#94a3b8", fontSize: `${12.5 * fontScale}px`, marginBottom: "6px", lineHeight: 1.5 }}>
          {highlight(trimmed, query)}
        </p>
      );
    }
    return (
      <p key={i} style={{ color: "#334155", fontSize: `${14.5 * fontScale}px`, lineHeight: 1.75, marginBottom: "10px" }}>
        {highlight(trimmed, query)}
      </p>
    );
  });
}

export default function LegalDocViewer({ docId, docTitle, initialQuery, onClose }: Props) {
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(initialQuery || "");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchNoResults, setSearchNoResults] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocFilter, setTocFilter] = useState("");
  const [fontScale, setFontScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const loadPage = useCallback(async (offset: number) => {
    const token = getToken();
    const res = await fetch(LEGAL_DOCS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({ sub: "get_document", doc_id: docId, offset, page_size: PAGE_SIZE }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка загрузки документа");
    return data;
  }, [docId]);

  // Первая загрузка документа + оглавление параллельно
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      loadPage(0),
      (async () => {
        try {
          const token = getToken();
          const res = await fetch(LEGAL_DOCS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
            body: JSON.stringify({ sub: "get_toc", doc_id: docId }),
          });
          const data = await res.json();
          return res.ok ? (data.toc || []) : [];
        } catch { return []; }
      })(),
    ])
      .then(([docData, tocData]) => {
        if (cancelled) return;
        setMeta(docData.document);
        setChunks(docData.chunks || []);
        setTotalChunks(docData.total_chunks || 0);
        setToc(tocData);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [loadPage, docId]);

  // Блокируем скролл фона под модалкой
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Закрытие по Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadMore = useCallback(async () => {
    setLoadingMore(prevLoading => {
      if (prevLoading) return prevLoading;
      return true;
    });
  }, []);

  useEffect(() => {
    if (!loadingMore) return;
    if (chunks.length >= totalChunks) { setLoadingMore(false); return; }
    loadPage(chunks.length)
      .then(data => setChunks(prev => [...prev, ...(data.chunks || [])]))
      .catch(() => { /* тихо — повторится при следующем скролле */ })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, chunks.length, totalChunks, loadPage]);

  // Бесконечная подгрузка при скролле вниз
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
      loadMore();
    }
  };

  // Поиск/переход к нужному chunk_index — догружаем чанки, пока не дойдём до цели
  const jumpToChunk = useCallback(async (targetIndex: number) => {
    let currentChunks = chunks;
    while (currentChunks.length <= targetIndex) {
      try {
        const data = await loadPage(currentChunks.length);
        const newChunks: ChunkItem[] = data.chunks || [];
        if (newChunks.length === 0) break;
        currentChunks = [...currentChunks, ...newChunks];
        setChunks(currentChunks);
      } catch { break; }
    }
    setJumpTarget(targetIndex);
    setTocOpen(false);
  }, [chunks, loadPage]);

  useEffect(() => {
    if (jumpTarget === null) return;
    const el = chunkRefs.current.get(jumpTarget);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.style.transition = "background-color 0.3s";
      el.style.backgroundColor = "rgba(59,130,246,0.08)";
      setTimeout(() => { el.style.backgroundColor = "transparent"; }, 1800);
      setJumpTarget(null);
    }
  }, [jumpTarget, chunks]);

  const searchInDoc = async () => {
    const q = query.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchNoResults(false);
    try {
      const token = getToken();
      const res = await fetch(LEGAL_DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ sub: "search_in_document", doc_id: docId, query: q }),
      });
      const data = await res.json();
      if (res.ok && data.matches && data.matches.length > 0) {
        await jumpToChunk(data.matches[0].chunk_index);
      } else {
        setSearchNoResults(true);
      }
    } catch { setSearchNoResults(true); }
    finally { setSearchLoading(false); }
  };

  // При открытии с начальным запросом — сразу искать после первой загрузки
  useEffect(() => {
    if (initialQuery && !loading && meta) {
      searchInDoc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, meta]);

  const filteredToc = useMemo(() => {
    if (!tocFilter.trim()) return toc;
    const f = tocFilter.trim().toLowerCase();
    return toc.filter(t => t.label.toLowerCase().includes(f));
  }, [toc, tocFilter]);

  const copyDocLink = async () => {
    try {
      const text = `${meta?.title || docTitle}\n\n${meta?.description || ""}`;
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const progressPct = totalChunks > 0 ? Math.min(100, Math.round((chunks.length / totalChunks) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка на весь экран */}
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-slate-100 shrink-0 shadow-sm"
        style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.05),rgba(26,107,181,0.02))" }}>
        <button
          onClick={() => setTocOpen(o => !o)}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
          style={tocOpen ? { background: "#0f4c81" } : { background: "#eef2f7" }}
          title="Оглавление"
        >
          <Icon name="List" size={16} color={tocOpen ? "#fff" : "#475569"} />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 hidden sm:flex"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          <Icon name="FileText" size={15} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-navy-800 truncate">{meta?.title || docTitle}</p>
          {meta && (
            <p className="text-[10px] text-slate-400">
              {meta.doc_year ? `${meta.doc_year} г. · ` : ""}{totalChunks} фрагментов{toc.length > 0 ? ` · ${toc.filter(t => t.type === "article").length} статей` : ""}
            </p>
          )}
        </div>

        {/* Управление шрифтом */}
        <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
          <button onClick={() => setFontScale(s => Math.max(0.85, s - 0.1))} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-white transition-colors">
            <Icon name="Minus" size={13} />
          </button>
          <span className="text-[10px] text-slate-400 w-8 text-center">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => setFontScale(s => Math.min(1.4, s + 0.1))} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-white transition-colors">
            <Icon name="Plus" size={13} />
          </button>
        </div>

        <button onClick={copyDocLink} className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0" title="Скопировать название и описание">
          <Icon name={copied ? "CheckCheck" : "Copy"} size={15} color={copied ? "#059669" : undefined} />
        </button>

        <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0" title="Закрыть (Esc)">
          <Icon name="X" size={17} />
        </button>
      </div>

      {/* Поиск внутри документа */}
      <div className="flex gap-2 px-3 sm:px-5 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex-1 relative">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-blue-400 focus:bg-white transition-all"
            placeholder="Поиск статьи или фразы в документе..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchNoResults(false); }}
            onKeyDown={e => e.key === "Enter" && searchInDoc()}
          />
        </div>
        <button
          onClick={searchInDoc}
          disabled={searchLoading || !query.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
        >
          {searchLoading
            ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : "Найти"}
        </button>
      </div>
      {searchNoResults && (
        <div className="px-3 sm:px-5 py-1.5 bg-amber-50 border-b border-amber-100">
          <p className="text-[11px] text-amber-700">Ничего не найдено по запросу «{query}»</p>
        </div>
      )}

      {/* Прогресс загрузки документа */}
      {!loading && totalChunks > 0 && chunks.length < totalChunks && (
        <div className="h-0.5 bg-slate-100 shrink-0">
          <div className="h-full transition-all" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#0f4c81,#1a6bb5)" }} />
        </div>
      )}

      {/* Тело: оглавление + текст */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Оглавление (боковая панель / оверлей на мобильных) */}
        {tocOpen && (
          <>
            <div className="hidden md:flex flex-col w-72 border-r border-slate-100 shrink-0 bg-slate-50/50">
              <div className="p-3 border-b border-slate-100">
                <input
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                  placeholder="Фильтр по оглавлению..."
                  value={tocFilter}
                  onChange={e => setTocFilter(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {filteredToc.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-4 px-3">Оглавление недоступно для этого документа</p>
                )}
                {filteredToc.map((t, i) => (
                  <button
                    key={`${t.chunk_index}-${i}`}
                    onClick={() => jumpToChunk(t.chunk_index)}
                    className={`w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-blue-50 transition-colors ${t.type === "chapter" ? "font-bold text-navy-800 mt-1.5" : "text-slate-600 pl-5"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Мобильная версия — полноэкранный оверлей оглавления */}
            <div className="md:hidden absolute inset-0 z-10 bg-white flex flex-col">
              <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                  placeholder="Фильтр по оглавлению..."
                  value={tocFilter}
                  onChange={e => setTocFilter(e.target.value)}
                />
                <button onClick={() => setTocOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                  <Icon name="X" size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {filteredToc.map((t, i) => (
                  <button
                    key={`${t.chunk_index}-${i}`}
                    onClick={() => jumpToChunk(t.chunk_index)}
                    className={`w-full text-left px-4 py-2 text-[13px] hover:bg-blue-50 transition-colors ${t.type === "chapter" ? "font-bold text-navy-800 mt-1.5" : "text-slate-600 pl-6"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Текст документа */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-8 py-5">
          <div className="max-w-2xl mx-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <span className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Загружаю документ...</p>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center gap-2 text-center py-24 px-6">
                <Icon name="AlertCircle" size={28} className="text-red-400" />
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            {!loading && !error && meta && (
              <>
                {meta.description && (
                  <p className="text-xs text-slate-500 mb-5 pb-4 border-b border-slate-100 italic">{meta.description}</p>
                )}
                {chunks.map(c => (
                  <div
                    key={c.chunk_index}
                    ref={el => { if (el) chunkRefs.current.set(c.chunk_index, el); }}
                    className="rounded-lg -mx-2 px-2"
                  >
                    {formatChunkContent(c.content, query, fontScale)}
                  </div>
                ))}

                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Загружаю ещё...</p>
                  </div>
                )}

                {!loadingMore && chunks.length < totalChunks && (
                  <button
                    onClick={loadMore}
                    className="w-full py-3 rounded-xl text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors mt-3 mb-8"
                  >
                    Показать ещё ({chunks.length}/{totalChunks})
                  </button>
                )}

                {chunks.length >= totalChunks && totalChunks > 0 && (
                  <div className="text-center py-8">
                    <p className="text-[11px] text-slate-300">— конец документа —</p>
                    <button
                      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                      className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <Icon name="ArrowUp" size={11} />
                      Наверх
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
