import { useState, useEffect } from "react";

// ─── parseInline: жирный + статьи закона ─────────────────────────────
function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|ст\.\s*\d+[\w.-]*(?:\s*(?:ГК|ТК|СК|НК|КоАП|АПК|ГПК|КАС|УК|ЖК|ЗК|УПК)\s*РФ)?|статьи?\s+\d+[\w.-]*)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold" style={{ color: "#0f2d54" }}>{part.slice(2, -2)}</strong>;
    if (/^(ст\.|статьи?)\s*\d+/i.test(part))
      return <strong key={i} style={{ fontWeight: 600, color: "#1a56b0" }}>{part}</strong>;
    return part;
  });
}

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-]{3,}$/, "")
    .replace(/^[*]\s+/, "")
    .trim();
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line.trim());
}
function isHr(line: string): boolean {
  return /^[-]{3,}$/.test(line.trim());
}
function isBullet(line: string): boolean {
  return /^[*\u2022\u00B7]\s/.test(line.trim()) || /^[-]\s/.test(line.trim());
}
function isNumbered(line: string): boolean {
  return /^\d+\.\s/.test(line.trim());
}
// Структурные метки из промта — скрываем от пользователя
function isStructuralLabel(line: string): boolean {
  return /^\*?\*?\d+\.\s+(Прямой|Правовое|Практическ|Судебная практика|Что делать|Резюме|Вывод)\b/i.test(line.trim());
}
function isSubLabel(line: string): boolean {
  return /^[А-ЯЁA-Z]\.\s|^[А-ЯЁA-Z]\)\s/.test(line.trim());
}
function isDash(line: string): boolean {
  return /^[—–]\s/.test(line.trim());
}

// Рендерит содержимое пункта (массив строк → React-ноды)
function renderItem(lines: string[]): React.ReactNode {
  return (
    <span>
      {lines.map((l, idx) => {
        if (!l) return <br key={idx} />;
        if (isBullet(l)) return <span key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "2px" }}>
          <span style={{ marginTop: "7px", width: 4, height: 4, borderRadius: "50%", background: "#1a56b0", flexShrink: 0, display: "inline-block" }} />
          <span>{parseInline(l.replace(/^[-*\u2022\u00B7]\s/, ""))}</span>
        </span>;
        return <span key={idx} style={{ display: idx === 0 ? "inline" : "block", marginTop: idx > 0 ? "2px" : 0 }}>{parseInline(l)}</span>;
      })}
    </span>
  );
}

// ─── LegalText ────────────────────────────────────────────────────────
export function LegalText({ text }: { text: string }) {
  const safeText = typeof text === "string" ? text : String(text ?? "");
  const lines = safeText.split("\n");

  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { i++; continue; }

    // Скрываем "1. Прямой краткий ответ", остальные заголовки перенумеровываем с 1
    if (/^\*{0,2}1\.\s+Прямой краткий ответ\*{0,2}$/i.test(trimmed)) { i++; continue; }
    {
      const renum = trimmed
        .replace(/^\*{0,2}2\.\s+(Правовое обоснование)\*{0,2}$/i, "**1. Правовое обоснование**")
        .replace(/^\*{0,2}3\.\s+(Практическая рекомендация)\*{0,2}$/i, "**2. Практическая рекомендация**")
        .replace(/^\*{0,2}4\.\s+(Судебная практика)\*{0,2}$/i, "**3. Судебная практика**");
      if (renum !== trimmed) {
        const inner = renum.replace(/^\*\*/, "").replace(/\*\*$/, "");
        blocks.push(
          <div key={i} style={{ marginTop: blocks.length === 0 ? 0 : "20px", marginBottom: "6px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg,rgba(15,76,129,0.07),rgba(15,76,129,0.03))", border: "1px solid rgba(15,76,129,0.12)", borderRadius: "10px", padding: "6px 12px" }}>
              <span style={{ width: 3, height: 16, background: "#1a56b0", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f2d54", letterSpacing: "0.01em" }}>{inner}</span>
            </div>
          </div>
        );
        i++; continue;
      }
    }

    // --- горизонтальная черта
    if (isHr(trimmed)) {
      blocks.push(<div key={i} style={{ height: 1, background: "rgba(15,76,129,0.1)", margin: "12px 0" }} />);
      i++; continue;
    }

    // ## Заголовок
    if (isHeading(trimmed)) {
      const level = (trimmed.match(/^(#{1,6})\s/) || ["", "#"])[1].length;
      const title = cleanLine(trimmed);
      const isH2 = level <= 2;
      blocks.push(
        <div key={i} style={{ marginTop: blocks.length === 0 ? 0 : isH2 ? "20px" : "14px", marginBottom: "6px" }}>
          {isH2 ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "linear-gradient(135deg,rgba(15,76,129,0.07),rgba(15,76,129,0.03))",
              border: "1px solid rgba(15,76,129,0.12)",
              borderRadius: "10px", padding: "6px 12px",
            }}>
              <span style={{ width: 3, height: 16, background: "#1a56b0", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f2d54", letterSpacing: "0.01em" }}>
                {parseInline(title)}
              </span>
            </div>
          ) : (
            <p style={{ fontWeight: 600, fontSize: "13px", color: "#1a56b0", margin: 0 }}>
              {parseInline(title)}
            </p>
          )}
        </div>
      );
      i++; continue;
    }

    // А. / Б. подзаголовок
    if (isSubLabel(trimmed)) {
      blocks.push(
        <p key={i} style={{ fontWeight: 600, fontSize: "13px", color: "#334155", marginTop: "10px", marginBottom: "2px", fontStyle: "italic", margin: "8px 0 2px 0" }}>
          {parseInline(trimmed)}
        </p>
      );
      i++; continue;
    }

    // — риск / факт (тире в начале)
    if (isDash(trimmed)) {
      const content = trimmed.replace(/^[—–]\s/, "");
      const isWarn = /уголовн|опасност|риск|ответственност/i.test(content);
      blocks.push(
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: "8px",
          background: isWarn ? "rgba(239,68,68,0.05)" : "rgba(15,76,129,0.04)",
          border: `1px solid ${isWarn ? "rgba(239,68,68,0.15)" : "rgba(15,76,129,0.1)"}`,
          borderRadius: "8px", padding: "8px 10px", marginTop: "4px",
        }}>
          <span style={{ color: isWarn ? "#dc2626" : "#1a56b0", fontWeight: 700, fontSize: "14px", flexShrink: 0, marginTop: 1 }}>›</span>
          <span style={{ fontSize: "13.5px", color: isWarn ? "#7f1d1d" : "#334155", lineHeight: "1.7", fontFamily: "Georgia,'Times New Roman',serif" }}>
            {parseInline(content)}
          </span>
        </div>
      );
      i++; continue;
    }

    // 📎 📄 ⚠️ спец-строки
    if (trimmed.startsWith("📎") || trimmed.startsWith("📄") || trimmed.startsWith("⚠️")) {
      const isWarn = trimmed.startsWith("⚠️");
      const emoji = trimmed.slice(0, 2);
      const content = trimmed.slice(2).trim().replace(/^[:-]\s*/, "");
      blocks.push(
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: "8px",
          background: isWarn ? "rgba(239,68,68,0.05)" : "rgba(15,76,129,0.04)",
          border: `1px solid ${isWarn ? "rgba(239,68,68,0.15)" : "rgba(15,76,129,0.1)"}`,
          borderRadius: "8px", padding: "8px 10px", marginTop: "6px",
        }}>
          <span style={{ fontSize: "14px", flexShrink: 0 }}>{emoji}</span>
          <span style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.7", fontFamily: "Georgia,'Times New Roman',serif" }}>{parseInline(content)}</span>
        </div>
      );
      i++; continue;
    }

    // Маркированный список (пропускаем пустые строки между пунктами)
    if (isBullet(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (!l) { i++; continue; }
        if (!isBullet(l)) break;
        items.push(l.replace(/^[-*\u2022\u00B7]\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} style={{ margin: "4px 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "3px" }}>
          {items.map((item, li) => (
            <li key={li} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <span style={{ marginTop: "7px", width: 5, height: 5, borderRadius: "50%", background: "#1a56b0", flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.75", fontFamily: "Georgia,'Times New Roman',serif" }}>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Нумерованный список — каждый пункт может занимать несколько строк
    if (isNumbered(trimmed)) {
      // Собираем все строки до следующего заголовка/разделителя
      const rawLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        // Стоп: заголовок ## или горизонтальная черта
        if (isHeading(lines[i]) || isHr(l)) break;
        rawLines.push(lines[i]);
        i++;
      }

      // Склеиваем строки в пункты: новый пункт начинается с \d+\.
      const items: React.ReactNode[] = [];
      let current: string[] = [];
      for (const rl of rawLines) {
        const t = rl.trim();
        if (!t) {
          // пустая строка — разделитель внутри пункта, добавляем перенос
          if (current.length) current.push("");
          continue;
        }
        if (isNumbered(t)) {
          if (current.length) items.push(renderItem(current));
          const m = t.match(/^\d+\.\s+(.*)/);
          current = [m ? m[1] : t];
        } else {
          current.push(t);
        }
      }
      if (current.length) items.push(renderItem(current));

      if (items.length === 0) continue;

      blocks.push(
        <ol key={`ol-${i}`} style={{ margin: "4px 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((content, li) => (
            <li key={li} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{
                marginTop: "2px", minWidth: "22px", height: "22px", borderRadius: "50%",
                background: "rgba(26,86,176,0.1)", color: "#1a56b0",
                fontSize: "11px", fontWeight: 700, flexShrink: 0, fontFamily: "system-ui,sans-serif",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>{li + 1}</span>
              <span style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.75", fontFamily: "Georgia,'Times New Roman',serif" }}>{content}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Обычный абзац
    blocks.push(
      <p key={i} style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.8", margin: "0 0 2px 0", fontFamily: "Georgia,'Times New Roman',serif" }}>
        {parseInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div style={{ fontFamily: "Georgia,'Times New Roman',serif", display: "flex", flexDirection: "column", gap: "2px" }}>
      {blocks}
    </div>
  );
}

// ─── AnimatedMessage ──────────────────────────────────────────────────
export function AnimatedMessage({ text, animate }: { text: string; animate: boolean }) {
  const safeInput = typeof text === "string" ? text : String(text ?? "");
  const [shown, setShown] = useState(animate ? "" : safeInput);
  const [done, setDone] = useState(!animate);

  useEffect(() => {
    if (!animate) { setShown(safeInput); setDone(true); return; }
    setShown(""); setDone(false);
    let idx = 0;
    const len = safeInput.length;
    const chunkSize = len > 1200 ? 22 : len > 600 ? 12 : 6;
    const tickMs = len > 1200 ? 10 : len > 600 ? 12 : 14;
    const go = () => {
      if (idx >= safeInput.length) { setDone(true); return; }
      idx += Math.min(chunkSize, safeInput.length - idx);
      setShown(safeInput.slice(0, idx));
      setTimeout(go, tickMs);
    };
    const t = setTimeout(go, 40);
    return () => clearTimeout(t);
  }, [text]);

  if (done) return <LegalText text={safeInput} />;
  return <LegalText text={shown} />;
}

// ─── renderInline (экспорт для совместимости) ─────────────────────────
export { parseInline as renderInline };

// ─── TypingIndicator ──────────────────────────────────────────────────
const AI_ROBOT_VIDEO = "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/644befaa-a371-48bd-ab13-7a140960c04f.webm";

export function TypingIndicator({ status }: { status: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden p-1"
        style={{ background: "linear-gradient(145deg,#f8fafc,#eef2f7)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
        <video
          src={AI_ROBOT_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain"
        />
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