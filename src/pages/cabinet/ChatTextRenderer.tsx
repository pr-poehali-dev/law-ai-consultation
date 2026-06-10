import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ─── renderInline ────────────────────────────────────────────────────
export function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|ст\.\s*\d+[\w.-]*(?:\s*ГК|ТК|СК|НК|КоАП|АПК|ГПК|КАС|УК)?(?:\s*РФ)?|статьи?\s+\d+[\w.-]*)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-navy-800">{part.slice(2, -2)}</strong>;
    if (/^(ст\.|статьи?)\s*\d+/i.test(part))
      return <strong key={i} style={{ fontWeight: 700, color: "#0f4c81" }}>{part}</strong>;
    return part;
  });
}

// ─── LegalText ───────────────────────────────────────────────────────
export function LegalText({ text }: { text: string }) {
  const safeText = typeof text === "string" ? text : String(text ?? "");

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "15px", lineHeight: "1.9", color: "#1e293b" }}>
      {safeText.split(/\n{2,}/).map((para, pi) => {
        const lines = para.split("\n").filter(Boolean);
        if (!lines.length) return null;

        // Секция с номером и заголовком (1. ЗАГОЛОВОК)
        const sec = lines[0].match(/^(\d+)\.\s+([А-ЯA-ZЁ][А-ЯA-ZЁ\s/]{3,})(.*)/);
        if (sec) return (
          <div key={pi} style={{ marginTop: pi === 0 ? 0 : "1em" }}>
            <p style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.05em", color: "#0f4c81", textTransform: "uppercase", marginBottom: "0.35em", fontFamily: "inherit" }}>
              {sec[1]}. {sec[2]}{sec[3]}
            </p>
            {lines.slice(1).map((l, li) => (
              <p key={li} style={{ margin: "0.2em 0" }}>{renderInline(l)}</p>
            ))}
          </div>
        );

        // Маркированный список (* - • · –)
        if (lines.every(l => /^[*\-•·–]\s/.test(l))) return (
          <ul key={pi} style={{ margin: "0.5em 0", padding: 0, listStyle: "none" }}>
            {lines.map((l, li) => (
              <li key={li} style={{ display: "flex", alignItems: "baseline", gap: "0.7em", margin: "0.3em 0", paddingLeft: "0.8em" }}>
                <span style={{ color: "#0f4c81", fontWeight: 700, flexShrink: 0 }}>—</span>
                <span>{renderInline(l.replace(/^[*\-•·–]\s/, ""))}</span>
              </li>
            ))}
          </ul>
        );

        // Нумерованный список
        if (lines.every(l => /^\d+\.\s/.test(l))) return (
          <ol key={pi} style={{ margin: "0.5em 0", padding: 0, listStyle: "none" }}>
            {lines.map((l, li) => {
              const match = l.match(/^(\d+)\.\s+(.*)/);
              if (!match) return <p key={li}>{renderInline(l)}</p>;
              return (
                <li key={li} style={{ display: "flex", alignItems: "baseline", gap: "0.5em", margin: "0.3em 0", paddingLeft: "0.8em" }}>
                  <span style={{ color: "#0f4c81", fontWeight: 700, minWidth: "1.5em", flexShrink: 0 }}>{match[1]}.</span>
                  <span>{renderInline(match[2])}</span>
                </li>
              );
            })}
          </ol>
        );

        // Обычный абзац с красной строкой
        return (
          <div key={pi} style={{ marginTop: pi === 0 ? 0 : "0.7em" }}>
            {lines.map((l, li) => (
              <p key={li} style={{ margin: "0.1em 0" }}>{renderInline(l)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── AnimatedMessage ─────────────────────────────────────────────────
export function AnimatedMessage({ text, animate }: { text: string; animate: boolean }) {
  const safeInput = typeof text === "string" ? text : String(text ?? "");
  const [shown, setShown] = useState(animate ? "" : safeInput);
  const [done, setDone] = useState(!animate);

  useEffect(() => {
    if (!animate) { setShown(safeInput); setDone(true); return; }
    setShown(""); setDone(false);
    let i = 0;
    const len = safeInput.length;
    const chunkSize = len > 1200 ? 22 : len > 600 ? 12 : 6;
    const tickMs = len > 1200 ? 10 : len > 600 ? 12 : 14;
    const go = () => {
      if (i >= safeInput.length) { setDone(true); return; }
      i += Math.min(chunkSize, safeInput.length - i);
      setShown(safeInput.slice(0, i));
      setTimeout(go, tickMs);
    };
    const t = setTimeout(go, 40);
    return () => clearTimeout(t);
  }, [text, animate]);

  if (done) return <LegalText text={safeInput} />;
  return (
    <p style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "15px", lineHeight: "1.9", color: "#1e293b", whiteSpace: "pre-wrap" }}>
      {shown}
      <span className="inline-block w-0.5 h-[15px] ml-0.5 align-middle rounded-full animate-pulse"
        style={{ background: "linear-gradient(#3b82f6,#1d4ed8)" }} />
    </p>
  );
}

// ─── TypingIndicator ─────────────────────────────────────────────────
export function TypingIndicator({ status }: { status: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-8 h-8 gradient-navy rounded-2xl flex items-center justify-center shrink-0 shadow-md">
        <Icon name="Scale" size={13} className="text-gold-400" />
      </div>
      <div className="px-4 py-3 bg-white shadow-sm"
        style={{ borderRadius: "4px 18px 18px 18px", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#94a3b8" }} />
            <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#64748b" }} />
            <span className="typing-dot w-2 h-2 rounded-full" style={{ background: "#94a3b8" }} />
          </div>
          <span className="text-[11px] text-slate-400 italic">{status || "анализирует..."}</span>
        </div>
      </div>
    </div>
  );
}