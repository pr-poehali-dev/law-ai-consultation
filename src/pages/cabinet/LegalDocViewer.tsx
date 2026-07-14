import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const LEGAL_DOCS_URL = (func2url as Record<string, string>)["legal-docs"];
const PAGE_SIZE = 20;
const THEME_KEY = "legal_doc_viewer_theme";

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

type Theme = "light" | "dark";

const PALETTE = {
  light: {
    bg: "#f8fafc",
    headerBg: "rgba(255,255,255,0.85)",
    headerBorder: "rgba(226,232,240,0.8)",
    searchBg: "rgba(255,255,255,0.6)",
    searchBorder: "rgba(226,232,240,0.6)",
    inputBg: "#fff",
    inputBorder: "#e2e8f0",
    cardBg: "#fff",
    cardBorder: "#f1f5f9",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textTitle: "#1e293b",
    textMuted: "#94a3b8",
    textFaint: "#cbd5e1",
    tocBg: "#fff",
    tocBorder: "#e2e8f0",
    tocHover: "#eff6ff",
    tocText: "#475569",
    chipBg: "#f1f5f9",
    chipHover: "#fff",
    mark: "#fde68a",
    markText: "#1e293b",
    accentText: "#0f4c81",
  },
  dark: {
    bg: "#0b1220",
    headerBg: "rgba(15,23,42,0.85)",
    headerBorder: "rgba(51,65,85,0.7)",
    searchBg: "rgba(15,23,42,0.6)",
    searchBorder: "rgba(51,65,85,0.5)",
    inputBg: "#1e293b",
    inputBorder: "#334155",
    cardBg: "#111c31",
    cardBorder: "#1e293b",
    textPrimary: "#f1f5f9",
    textSecondary: "#cbd5e1",
    textTitle: "#f8fafc",
    textMuted: "#64748b",
    textFaint: "#475569",
    tocBg: "#0f172a",
    tocBorder: "#1e293b",
    tocHover: "rgba(59,130,246,0.15)",
    tocText: "#94a3b8",
    chipBg: "#1e293b",
    chipHover: "#243044",
    mark: "#a16207",
    markText: "#fef3c7",
    accentText: "#7cb0e8",
  },
} as const;

function highlight(text: string, query: string, pal: typeof PALETTE.light): React.ReactNode {
  if (!query.trim()) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return text;
  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((p, i) =>
    regex.test(p)
      ? <mark key={i} style={{ background: pal.mark, color: pal.markText, borderRadius: "3px", padding: "1px 2px" }}>{p}</mark>
      : p
  );
}

/** Извлекает заголовки статей/глав из чанка для визуального форматирования документа */
function formatChunkContent(content: string, query: string, fontScale: number, pal: typeof PALETTE.light): React.ReactNode {
  const lines = content.split(/\n+/).filter(l => l.trim());
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const isArticleHeader = /^статья\s+[\d.]/i.test(trimmed);
    const isChapterHeader = /^(глава|раздел)\s+[ivxlc\d]/i.test(trimmed);
    const isAmendmentNote = /^(информация об изменениях|гарант|см\.\s|см\s|федеральным законом)/i.test(trimmed);

    if (isChapterHeader) {
      return (
        <div key={i} className="flex items-center gap-2.5" style={{ marginTop: "32px", marginBottom: "16px" }}>
          <div className="w-1 h-5 rounded-full shrink-0" style={{ background: "linear-gradient(180deg,#0f4c81,#1a6bb5)" }} />
          <p className="font-bold uppercase tracking-wide" style={{ color: pal.accentText, fontSize: `${14 * fontScale}px` }}>
            {highlight(trimmed, query, pal)}
          </p>
        </div>
      );
    }
    if (isArticleHeader) {
      return (
        <p key={i} className="font-bold" style={{ color: pal.textTitle, fontSize: `${16.5 * fontScale}px`, marginTop: "24px", marginBottom: "12px", letterSpacing: "-0.01em" }}>
          {highlight(trimmed, query, pal)}
        </p>
      );
    }
    if (isAmendmentNote) {
      return (
        <p key={i} className="italic flex items-start gap-1.5" style={{ color: pal.textMuted, fontSize: `${12 * fontScale}px`, marginBottom: "8px", lineHeight: 1.5 }}>
          <Icon name="Info" size={11} className="mt-0.5 shrink-0 opacity-60" />
          <span>{highlight(trimmed, query, pal)}</span>
        </p>
      );
    }
    return (
      <p key={i} style={{ color: pal.textSecondary, fontSize: `${14.5 * fontScale}px`, lineHeight: 1.8, marginBottom: "12px" }}>
        {highlight(trimmed, query, pal)}
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
  // Оглавление теперь открыто по умолчанию — не нужно нажимать кнопку, чтобы его увидеть.
  const [tocOpen, setTocOpen] = useState(true);
  const [tocFilter, setTocFilter] = useState("");
  const [fontScale, setFontScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch { return "light"; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pal = PALETTE[theme];

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

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

  const loadMore = useCallback(() => {
    setLoadingMore(prev => prev || true);
  }, []);

  useEffect(() => {
    if (!loadingMore) return;
    if (chunks.length >= totalChunks) { setLoadingMore(false); return; }
    loadPage(chunks.length)
      .then(data => setChunks(prev => [...prev, ...(data.chunks || [])]))
      .catch(() => { /* тихо — повторится при следующем скролле */ })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, chunks.length, totalChunks, loadPage]);

  // Бесконечная подгрузка + фон шапки при скролле
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrolled(el.scrollTop > 8);
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
  }, [chunks, loadPage]);

  useEffect(() => {
    if (jumpTarget === null) return;
    const el = chunkRefs.current.get(jumpTarget);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.style.transition = "background-color 0.4s ease";
      el.style.backgroundColor = theme === "dark" ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.1)";
      setTimeout(() => { el.style.backgroundColor = "transparent"; }, 2000);
      setJumpTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleClose = () => {
    setMounted(false);
    setTimeout(onClose, 180);
  };

  const progressPct = totalChunks > 0 ? Math.min(100, Math.round((chunks.length / totalChunks) * 100)) : 0;
  const articlesCount = toc.filter(t => t.type === "article").length;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col transition-all duration-200 ease-out"
      style={{
        background: pal.bg,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1)" : "scale(0.98)",
      }}
    >
      {/* Шапка со стеклянным эффектом */}
      <div
        className={`flex items-center gap-2 px-3 sm:px-6 py-3 shrink-0 z-20 transition-shadow ${scrolled ? "shadow-md" : ""}`}
        style={{
          background: pal.headerBg,
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          borderBottom: `1px solid ${pal.headerBorder}`,
        }}
      >
        <button
          onClick={() => setTocOpen(o => !o)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90"
          style={tocOpen
            ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", boxShadow: "0 4px 12px rgba(15,76,129,0.3)" }
            : { background: pal.chipBg }}
          title="Оглавление"
        >
          <Icon name="AlignLeft" size={17} color={tocOpen ? "#fff" : pal.tocText} />
        </button>

        <div className="w-9 h-9 rounded-2xl items-center justify-center shrink-0 hidden sm:flex"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", boxShadow: "0 4px 10px rgba(15,76,129,0.25)" }}>
          <Icon name="Scale" size={16} color="#fff" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold truncate leading-tight" style={{ color: pal.textTitle }}>{meta?.title || docTitle}</p>
          {meta && (
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: pal.textMuted }}>
              {meta.doc_year && <span>{meta.doc_year} г.</span>}
              {meta.doc_year && <span className="w-0.5 h-0.5 rounded-full" style={{ background: pal.textFaint }} />}
              <span>{totalChunks} фрагментов</span>
              {articlesCount > 0 && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full" style={{ background: pal.textFaint }} />
                  <span>{articlesCount} статей</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Переключатель светлой/тёмной темы */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90"
          style={{ background: pal.chipBg }}
          title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
        >
          <Icon name={theme === "light" ? "Moon" : "Sun"} size={16} color={pal.tocText} />
        </button>

        {/* Управление шрифтом */}
        <div className="hidden sm:flex items-center gap-0.5 rounded-2xl p-1 shrink-0" style={{ background: pal.chipBg }}>
          <button onClick={() => setFontScale(s => Math.max(0.85, +(s - 0.1).toFixed(2)))} className="w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90" style={{ color: pal.tocText }}>
            <Icon name="Minus" size={13} />
          </button>
          <span className="text-[10px] font-semibold w-9 text-center" style={{ color: pal.textMuted }}>{Math.round(fontScale * 100)}%</span>
          <button onClick={() => setFontScale(s => Math.min(1.4, +(s + 0.1).toFixed(2)))} className="w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90" style={{ color: pal.tocText }}>
            <Icon name="Plus" size={13} />
          </button>
        </div>

        <button onClick={copyDocLink} className="hidden sm:flex w-10 h-10 rounded-2xl items-center justify-center transition-all active:scale-90 shrink-0" style={{ color: copied ? "#059669" : pal.textMuted }} title="Скопировать название и описание">
          <Icon name={copied ? "CheckCheck" : "Copy"} size={16} />
        </button>

        <button onClick={handleClose} className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 hover:bg-red-50 hover:text-red-500" style={{ color: pal.tocText }} title="Закрыть (Esc)">
          <Icon name="X" size={19} />
        </button>
      </div>

      {/* Поиск внутри документа */}
      <div className="flex gap-2 px-3 sm:px-6 py-3 shrink-0 z-10" style={{ background: pal.searchBg, borderBottom: `1px solid ${pal.searchBorder}` }}>
        <div className="flex-1 relative">
          <Icon name="Search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: pal.textMuted }} />
          <input
            className="w-full text-[13px] rounded-2xl pl-10 pr-3 py-2.5 outline-none focus:ring-4 transition-all shadow-sm"
            style={{ background: pal.inputBg, border: `1px solid ${pal.inputBorder}`, color: pal.textPrimary }}
            placeholder="Поиск статьи или фразы в документе..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchNoResults(false); }}
            onKeyDown={e => e.key === "Enter" && searchInDoc()}
          />
        </div>
        <button
          onClick={searchInDoc}
          disabled={searchLoading || !query.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all active:scale-95 disabled:opacity-40 shrink-0"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", boxShadow: "0 4px 12px rgba(15,76,129,0.25)" }}
        >
          {searchLoading
            ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : "Найти"}
        </button>
      </div>
      {searchNoResults && (
        <div className="px-3 sm:px-6 py-2 shrink-0" style={{ background: theme === "dark" ? "#3f2d0a" : "#fffbeb", borderBottom: `1px solid ${theme === "dark" ? "#78530f" : "#fde68a"}` }}>
          <p className="text-[12px] flex items-center gap-1.5" style={{ color: theme === "dark" ? "#fbbf24" : "#b45309" }}>
            <Icon name="SearchX" size={13} />
            Ничего не найдено по запросу «{query}»
          </p>
        </div>
      )}

      {/* Прогресс загрузки документа */}
      {!loading && totalChunks > 0 && chunks.length < totalChunks && (
        <div className="h-[3px] shrink-0 overflow-hidden" style={{ background: pal.chipBg }}>
          <div className="h-full transition-all duration-500 rounded-r-full" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#0f4c81,#1a6bb5)" }} />
        </div>
      )}

      {/* Тело: оглавление + текст */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Оглавление — desktop сайдбар, открыт по умолчанию */}
        <div
          className="hidden md:flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-out"
          style={{
            width: tocOpen ? "300px" : "0px",
            borderRight: tocOpen ? `1px solid ${pal.tocBorder}` : "none",
            background: pal.tocBg,
          }}
        >
          <div className="p-3 shrink-0" style={{ width: "300px", borderBottom: `1px solid ${pal.tocBorder}` }}>
            <div className="relative">
              <Icon name="Filter" size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: pal.textMuted }} />
              <input
                className="w-full text-[12px] rounded-xl pl-8 pr-3 py-2 outline-none transition-all"
                style={{ background: pal.inputBg, border: `1px solid ${pal.inputBorder}`, color: pal.textPrimary }}
                placeholder="Фильтр по оглавлению..."
                value={tocFilter}
                onChange={e => setTocFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2" style={{ width: "300px" }}>
            {filteredToc.length === 0 && (
              <p className="text-[11px] text-center py-6 px-4" style={{ color: pal.textMuted }}>Оглавление недоступно для этого документа</p>
            )}
            {filteredToc.map((t, i) => (
              <button
                key={`${t.chunk_index}-${i}`}
                onClick={() => jumpToChunk(t.chunk_index)}
                onMouseEnter={e => { e.currentTarget.style.background = pal.tocHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                className={`w-full text-left px-4 py-2 text-[12.5px] rounded-lg mx-1 transition-colors ${t.type === "chapter" ? "font-bold mt-2" : ""}`}
                style={{
                  width: "calc(300px - 8px)",
                  paddingLeft: t.type === "article" ? "24px" : "16px",
                  color: t.type === "chapter" ? pal.accentText : pal.tocText,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Мобильная версия — полноэкранный оверлей оглавления */}
        {tocOpen && (
          <div className="md:hidden absolute inset-0 z-30 flex flex-col animate-in fade-in duration-150" style={{ background: pal.tocBg }}>
            <div className="p-3 flex items-center gap-2 shrink-0" style={{ borderBottom: `1px solid ${pal.tocBorder}` }}>
              <div className="flex-1 relative">
                <Icon name="Filter" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: pal.textMuted }} />
                <input
                  autoFocus
                  className="w-full text-[13px] rounded-xl pl-9 pr-3 py-2.5 outline-none"
                  style={{ background: pal.inputBg, border: `1px solid ${pal.inputBorder}`, color: pal.textPrimary }}
                  placeholder="Фильтр по оглавлению..."
                  value={tocFilter}
                  onChange={e => setTocFilter(e.target.value)}
                />
              </div>
              <button onClick={() => setTocOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: pal.chipBg, color: pal.textMuted }}>
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredToc.map((t, i) => (
                <button
                  key={`${t.chunk_index}-${i}`}
                  onClick={() => jumpToChunk(t.chunk_index)}
                  className={`w-full text-left px-4 py-2.5 text-[13.5px] transition-colors ${t.type === "chapter" ? "font-bold mt-1.5" : "pl-6"}`}
                  style={{ color: t.type === "chapter" ? pal.accentText : pal.tocText }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Текст документа */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-10 py-6">
          <div className="max-w-2xl mx-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <span className="w-9 h-9 border-[3px] rounded-full animate-spin" style={{ borderColor: pal.chipBg, borderTopColor: "#2563eb" }} />
                <p className="text-[13px]" style={{ color: pal.textMuted }}>Загружаю документ...</p>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-24 px-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: theme === "dark" ? "#3f1720" : "#fef2f2" }}>
                  <Icon name="AlertCircle" size={26} className="text-red-400" />
                </div>
                <p className="text-[13px] text-red-400">{error}</p>
              </div>
            )}

            {!loading && !error && meta && (
              <div className="rounded-3xl p-5 sm:p-8 shadow-sm" style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}` }}>
                {meta.description && (
                  <p className="text-[13px] mb-6 pb-5 italic leading-relaxed" style={{ color: pal.textMuted, borderBottom: `1px solid ${pal.cardBorder}` }}>{meta.description}</p>
                )}
                {chunks.map(c => (
                  <div
                    key={c.chunk_index}
                    ref={el => { if (el) chunkRefs.current.set(c.chunk_index, el); }}
                    className="rounded-xl -mx-2 px-2"
                  >
                    {formatChunkContent(c.content, query, fontScale, pal)}
                  </div>
                ))}

                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: pal.chipBg, borderTopColor: "#2563eb" }} />
                    <p className="text-[12px]" style={{ color: pal.textMuted }}>Загружаю ещё...</p>
                  </div>
                )}

                {!loadingMore && chunks.length < totalChunks && (
                  <button
                    onClick={loadMore}
                    className="w-full py-3 rounded-2xl text-[12.5px] font-semibold transition-all mt-4"
                    style={{ color: pal.tocText, border: `1px solid ${pal.cardBorder}` }}
                  >
                    Показать ещё ({chunks.length}/{totalChunks})
                  </button>
                )}

                {chunks.length >= totalChunks && totalChunks > 0 && (
                  <div className="text-center pt-8 mt-2" style={{ borderTop: `1px solid ${pal.cardBorder}` }}>
                    <p className="text-[11px] tracking-wide" style={{ color: pal.textFaint }}>— конец документа —</p>
                    <button
                      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[12px] font-semibold transition-all active:scale-95"
                      style={{ color: pal.tocText, border: `1px solid ${pal.cardBorder}` }}
                    >
                      <Icon name="ArrowUp" size={12} />
                      Наверх
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
