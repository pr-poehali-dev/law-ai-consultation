import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { CaseLawResult } from "@/pages/cabinet/ChatTab";

interface Props {
  query?: string;
  loading?: boolean;
  error?: string;
  results?: CaseLawResult[];
}

function ResultCard({ r, index }: { r: CaseLawResult; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 220);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="px-3 py-2.5 border-b border-slate-100 last:border-b-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[12px] font-semibold text-slate-800 leading-snug flex-1">{r.title}</p>
        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ background: "#dcfce7", color: "#166534" }}>
          {r.source || "интернет"}
        </span>
      </div>
      {r.snippet && (
        <p className="text-[12px] text-slate-500 leading-snug mb-2">
          {r.snippet.slice(0, 220)}{r.snippet.length > 220 ? "…" : ""}
        </p>
      )}
      <a
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
        style={{ background: "#dcfce7", color: "#166534" }}
      >
        <Icon name="ExternalLink" size={9} color="#166534" />
        Открыть дело
      </a>
    </div>
  );
}

export default function CaseLawResultsCard({ query, loading, error, results }: Props) {
  return (
    <div className="flex gap-2.5 items-start" style={{ animation: "ai-msg-in 0.38s cubic-bezier(0.22,1,0.36,1) both" }}>
      <div className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-md" style={{ background: "linear-gradient(135deg,#166534,#22c55e)" }}>
        <Icon name="Scale" size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ borderRadius: "4px 18px 18px 18px", border: "1px solid rgba(226,232,240,0.8)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "linear-gradient(135deg,rgba(22,101,52,0.06),rgba(21,128,61,0.03))", borderBottom: "1px solid #e2e8f0" }}>
            <Icon name="Globe" size={11} color="#166534" />
            <p className="text-[11px] font-bold text-slate-700 flex-1">
              {loading ? "Ищу судебную практику…" : "Судебная практика по ситуации"}
            </p>
            {loading && <span className="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />}
            {!loading && results && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>
                {results.length} найдено
              </span>
            )}
          </div>

          {query && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-[11px] text-slate-400">Запрос: <span className="text-slate-500 font-medium">{query}</span></p>
            </div>
          )}

          {loading && (
            <div className="px-3 py-3 space-y-1.5">
              {[80, 60, 75].map((w, i) => (
                <div key={i} className="h-2 rounded-full animate-pulse" style={{ width: `${w}%`, background: "#f1f5f9" }} />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="px-3 py-3">
              <p className="text-[12px] text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && results && results.length === 0 && (
            <div className="px-3 py-3">
              <p className="text-[12px] text-slate-400">Судебная практика по этой ситуации не найдена.</p>
            </div>
          )}

          {!loading && !error && results && results.length > 0 && (
            <div>
              {results.map((r, i) => <ResultCard key={i} r={r} index={i} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
