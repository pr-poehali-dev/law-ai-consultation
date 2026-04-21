import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ─── renderInline ────────────────────────────────────────────────────
export function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|ст\.\s*\d+[\w.-]*(?:\s*ГК|ТК|СК|НК|КоАП|АПК|ГПК|КАС|УК)?(?:\s*РФ)?|статьи?\s+\d+[\w.-]*)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-navy-800">{part.slice(2, -2)}</strong>;
    if (/^(ст\.|статьи?)\s*\d+/i.test(part))
      return <span key={i} className="font-semibold text-navy-700 bg-gold-400/20 px-1 rounded text-[12.5px]">{part}</span>;
    return part;
  });
}

// ─── LegalText ───────────────────────────────────────────────────────
export function LegalText({ text }: { text: string }) {
  const safeText = typeof text === "string" ? text : String(text ?? "");
  return (
    <div className="space-y-2 font-golos text-[13.5px] text-navy-700 leading-[1.8]">
      {safeText.split(/\n{2,}/).map((para, pi) => {
        const lines = para.split("\n").filter(Boolean);
        if (!lines.length) return null;
        const sec = lines[0].match(/^(\d+)\.\s+([А-ЯA-ZЁ][А-ЯA-ZЁ\s/]{3,})(.*)/);
        if (sec) return (
          <div key={pi} className="mt-3 first:mt-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-md bg-navy-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{sec[1]}</span>
              <span className="text-[12px] font-bold text-navy-700 uppercase tracking-wider">{sec[2]}{sec[3]}</span>
            </div>
            {lines.slice(1).map((l, li) => <p key={li} className="pl-7">{renderInline(l)}</p>)}
          </div>
        );
        if (lines.every(l => /^[-•·–]\s/.test(l))) return (
          <ul key={pi} className="space-y-1 pl-1">
            {lines.map((l, li) => (
              <li key={li} className="flex items-start gap-2">
                <span className="text-gold-500 font-bold shrink-0 leading-[1.8]">·</span>
                <span>{renderInline(l.replace(/^[-•·–]\s/, ""))}</span>
              </li>
            ))}
          </ul>
        );
        return <div key={pi}>{lines.map((l, li) => <p key={li}>{renderInline(l)}</p>)}</div>;
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
    // Для длинных ответов (deepseek) — быстрее: больше символов за тик, меньше задержка
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
    <p className="text-[13.5px] text-navy-700 leading-[1.8] whitespace-pre-wrap font-golos">
      {shown}<span className="inline-block w-0.5 h-4 bg-gold-500 ml-0.5 animate-pulse align-middle rounded-full" />
    </p>
  );
}

// ─── TypingIndicator ─────────────────────────────────────────────────
export function TypingIndicator({ status }: { status: string }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Icon name="Scale" size={13} className="text-gold-400" />
      </div>
      <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            <span className="typing-dot w-1.5 h-1.5 bg-navy-300 rounded-full" />
            <span className="typing-dot w-1.5 h-1.5 bg-navy-400 rounded-full" />
            <span className="typing-dot w-1.5 h-1.5 bg-navy-300 rounded-full" />
          </div>
          <span className="text-[11px] text-muted-foreground italic">{status || "анализирует..."}</span>
        </div>
      </div>
    </div>
  );
}