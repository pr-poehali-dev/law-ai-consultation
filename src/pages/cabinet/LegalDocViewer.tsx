import { useState, useEffect, useRef, useCallback } from "react";
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

/** Извлекает заголовки статей/глав из чанка для лёгкого визуального форматирования */
function formatChunkContent(content: string, query: string): React.ReactNode {
  const lines = content.split(/\n+/).filter(l => l.trim());
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const isArticleHeader = /^статья\s+\d/i.test(trimmed);
    const isChapterHeader = /^(глава|раздел|часть)\s+[iv\d]/i.test(trimmed);
    if (isChapterHeader) {
      return (
        <p key={i} className="font-bold text-navy-800 text-[13px] mt-3 mb-1.5 uppercase tracking-wide">
          {highlight(trimmed, query)}
        </p>
      );
    }
    if (isArticleHeader) {
      return (
        <p key={i} className="font-bold text-navy-700 text-[13px] mt-2.5 mb-1">
          {highlight(trimmed, query)}
        </p>
      );
    }
    return (
      <p key={i} className="text-[13px] text-slate-700 leading-relaxed mb-1.5" style={{ paddingLeft: "4px" }}>
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
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
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

  // Первая загрузка
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadPage(0)
      .then(data => {
        if (cancelled) return;
        setMeta(data.document);
        setChunks(data.chunks || []);
        setTotalChunks(data.total_chunks || 0);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [loadPage]);

  const loadMore = async () => {
    if (loadingMore || chunks.length >= totalChunks) return;
    setLoadingMore(true);
    try {
      const data = await loadPage(chunks.length);
      setChunks(prev => [...prev, ...(data.chunks || [])]);
    } catch { /* тихо — можно повторить прокруткой */ }
    finally { setLoadingMore(false); }
  };

  // Бесконечная подгрузка при скролле вниз
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      loadMore();
    }
  };

  // Поиск фрагмента внутри документа — прыжок к нужному chunk_index
  const jumpToChunk = useCallback(async (targetIndex: number) => {
    // Догружаем чанки, пока не дойдём до targetIndex
    let currentLen = chunks.length;
    while (currentLen <= targetIndex) {
      try {
        const data = await loadPage(currentLen);
        const newChunks = data.chunks || [];
        if (newChunks.length === 0) break;
        setChunks(prev => [...prev, ...newChunks]);
        currentLen += newChunks.length;
      } catch { break; }
    }
    setJumpTarget(targetIndex);
  }, [chunks.length, loadPage]);

  useEffect(() => {
    if (jumpTarget === null) return;
    const el = chunkRefs.current.get(jumpTarget);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setJumpTarget(null);
    }
  }, [jumpTarget, chunks]);

  const searchInDoc = async () => {
    const q = query.trim();
    if (!q) return;
    setSearchLoading(true);
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
      }
    } catch { /* тихо */ }
    finally { setSearchLoading(false); }
  };

  // При открытии с начальным запросом — сразу искать после первой загрузки
  useEffect(() => {
    if (initialQuery && !loading && meta) {
      searchInDoc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, meta]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm px-2 sm:px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden w-full max-w-3xl flex flex-col"
        style={{ height: "min(90dvh, 820px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0"
          style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.06),rgba(26,107,181,0.03))" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="FileText" size={15} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-navy-800 truncate">{meta?.title || docTitle}</p>
            {meta && (
              <p className="text-[10px] text-slate-400">
                {meta.doc_year ? `${meta.doc_year} г. · ` : ""}{totalChunks} фрагментов
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0">
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Поиск внутри документа */}
        <div className="flex gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
          <input
            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all"
            placeholder="Поиск статьи или фразы в документе..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchInDoc()}
          />
          <button
            onClick={searchInDoc}
            disabled={searchLoading || !query.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
          >
            {searchLoading
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Icon name="Search" size={13} color="#fff" />}
          </button>
        </div>

        {/* Тело документа */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Загружаю документ...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
              <Icon name="AlertCircle" size={24} className="text-red-400" />
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && meta && (
            <>
              {meta.description && (
                <p className="text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">{meta.description}</p>
              )}
              {chunks.map(c => (
                <div
                  key={c.chunk_index}
                  ref={el => { if (el) chunkRefs.current.set(c.chunk_index, el); }}
                  className="mb-2"
                >
                  {formatChunkContent(c.content, query)}
                </div>
              ))}

              {loadingMore && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Загружаю ещё...</p>
                </div>
              )}

              {!loadingMore && chunks.length < totalChunks && (
                <button
                  onClick={loadMore}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors mt-2"
                >
                  Показать ещё ({chunks.length}/{totalChunks})
                </button>
              )}

              {chunks.length >= totalChunks && totalChunks > 0 && (
                <p className="text-center text-[11px] text-slate-300 py-3">— конец документа —</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
