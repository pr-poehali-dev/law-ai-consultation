import Icon from "@/components/ui/icon";

interface Props {
  text?: string;
  loading?: boolean;
  error?: string;
}

function extractLevel(text: string): { level: string; color: string; icon: string } | null {
  const m = text.match(/оценка перспективы:\s*([а-яё]+)/i);
  if (!m) return null;
  const level = m[1].toLowerCase();
  if (level.startsWith("выс")) return { level: "Высокая", color: "#166534", icon: "TrendingUp" };
  if (level.startsWith("сред")) return { level: "Средняя", color: "#b45309", icon: "TrendingUp" };
  if (level.startsWith("низ")) return { level: "Низкая", color: "#b91c1c", icon: "TrendingDown" };
  return null;
}

export default function CaseLawAssessmentCard({ text, loading, error }: Props) {
  const parsed = text ? extractLevel(text) : null;
  const bodyText = text ? text.replace(/\*\*.*?\*\*\n*/, "").trim() : "";

  return (
    <div className="flex gap-2.5 items-start" style={{ animation: "ai-msg-in 0.38s cubic-bezier(0.22,1,0.36,1) both" }}>
      <div className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-md" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
        <Icon name="Gauge" size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ borderRadius: "4px 18px 18px 18px", border: "1px solid rgba(226,232,240,0.8)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.07),rgba(168,85,247,0.03))", borderBottom: "1px solid #e2e8f0" }}>
            <Icon name="Gauge" size={11} color="#7c3aed" />
            <p className="text-[11px] font-bold text-slate-700 flex-1">
              {loading ? "Оцениваю перспективу дела…" : "Оценка перспективы дела"}
            </p>
            {loading && <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />}
          </div>

          {loading && (
            <div className="px-3 py-3 space-y-1.5">
              {[70, 90, 55, 80].map((w, i) => (
                <div key={i} className="h-2 rounded-full animate-pulse" style={{ width: `${w}%`, background: "#f1f5f9" }} />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="px-3 py-3">
              <p className="text-[12px] text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && text && (
            <div className="px-3 py-3">
              {parsed && (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl mb-2.5 font-bold text-[12px]"
                  style={{ background: `${parsed.color}14`, color: parsed.color, border: `1px solid ${parsed.color}33` }}
                >
                  <Icon name={parsed.icon} size={13} color={parsed.color} />
                  Перспектива: {parsed.level}
                </div>
              )}
              <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">
                {bodyText.replace(/\*\*/g, "")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}