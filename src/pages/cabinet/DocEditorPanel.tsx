import { useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { parseDocBlocks } from "./ViewDocUtils";

interface DocEditorPanelProps {
  content: string;
  onApply: (newContent: string) => void;
  onClose: () => void;
}

// Собрать HTML обратно в plain-text с тегами секций
function collectContent(container: HTMLElement): string {
  const sections = container.querySelectorAll("[data-section-type]");
  if (!sections.length) return container.innerText;
  const parts: string[] = [];
  sections.forEach(el => {
    const type = el.getAttribute("data-section-type");
    const text = (el as HTMLElement).innerText.trim();
    if (type && type !== "RAW") parts.push(`[${type}]\n${text}`);
    else parts.push(text);
  });
  return parts.join("\n\n");
}

// Построить редактируемый HTML из plain-text
function buildHtml(content: string): string {
  const blocks = parseDocBlocks(content);
  const hasTags = blocks.some(b => b.type !== "ТЕЛО");

  if (!hasTags) {
    return content.split("\n").map(line => {
      if (!line.trim()) return `<p><br></p>`;
      return `<p style="text-indent:2em;margin:0.35em 0">${esc(line)}</p>`;
    }).join("");
  }

  return blocks.map(block => {
    const type = block.type;
    const lines = block.lines.filter(l => l.trim());
    if (!lines.length) return "";
    const attr = `data-section-type="${type}"`;

    switch (type) {
      case "ШАПКА":
        return `<div ${attr} style="text-align:right;margin-bottom:1.5em;padding-right:0.75em;border-right:2.5px solid #c7d2e7">
${lines.map(l => `<p style="margin:0;line-height:1.6;font-size:13px;color:#374151">${esc(l)}</p>`).join("\n")}
</div>`;

      case "ЗАГОЛОВОК":
        return `<div ${attr} style="text-align:center;margin:2em 0">
<h2 style="font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:0.05em;color:#0f1f3c;font-family:inherit;margin:0">${esc(lines.join(" "))}</h2>
<div style="margin-top:0.5em;height:2px;background:linear-gradient(90deg,transparent,#374e8a,transparent)"></div>
</div>`;

      case "ТЕЛО":
        return `<div ${attr} style="margin:1em 0">
${lines.map(l => `<p style="text-indent:2em;margin:0.4em 0;color:#1e2d4a">${esc(l)}</p>`).join("\n")}
</div>`;

      case "ТРЕБОВАНИЯ":
        return `<div ${attr} style="margin:1.25em 0">
${lines.map(l => {
  const isHdr = /^(ПРОШУ|НА ОСНОВАНИИ|ТРЕБУЮ)/i.test(l.trim());
  if (isHdr) return `<p style="font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#0f1f3c;margin:0 0 0.5em">${esc(l)}</p>`;
  const nm = l.trim().match(/^(\d+)\.\s+(.+)/);
  if (nm) return `<div style="display:flex;gap:0.75em;margin:0.35em 0;padding-left:0.5em;align-items:flex-start">
<span style="min-width:1.4em;height:1.4em;border-radius:50%;background:#1e2d4a;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.15em">${nm[1]}</span>
<p style="margin:0;color:#374151">${esc(nm[2])}</p>
</div>`;
  return `<p style="margin:0.2em 0;padding-left:0.5em;color:#374151">${esc(l)}</p>`;
}).join("\n")}
</div>`;

      case "ПРИЛОЖЕНИЯ":
        return `<div ${attr} style="margin:1.25em 0;padding:1em;background:#f8fafc;border-radius:0.75em;border:1px solid #e2e8f0">
<p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#4a5568;margin:0 0 0.5em">Приложения:</p>
${lines.map(l => `<p style="margin:0.2em 0;color:#374151">${esc(l)}</p>`).join("\n")}
</div>`;

      case "ПОДПИСЬ":
        return `<div ${attr} style="margin-top:2.5em;padding-top:1.25em;border-top:1px solid #e2e8f0;text-align:right">
${lines.map(l => `<p style="margin:0.2em 0;color:#374151">${esc(l)}</p>`).join("\n")}
</div>`;

      case "ОБОСНОВАНИЕ":
        return `<div ${attr} style="margin:1.25em 0;padding:1em;background:#eff6ff;border-radius:0.75em;border:1px solid #dbeafe">
<p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#3b5bdb;margin:0 0 0.5em">Правовое обоснование</p>
${lines.map(l => `<p style="margin:0.2em 0;font-size:12px;color:#374151">${esc(l)}</p>`).join("\n")}
</div>`;

      case "ПРИМЕЧАНИЯ":
        return `<div ${attr} style="margin:1em 0;padding:1em;background:#fffbeb;border-radius:0.75em;border:1px solid #fde68a">
<p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#92400e;margin:0 0 0.5em">Примечания</p>
${lines.map(l => `<p style="margin:0.2em 0;font-size:12px;color:#78350f;font-style:italic">${esc(l)}</p>`).join("\n")}
</div>`;

      default:
        return `<div ${attr} style="margin:1em 0">
${lines.map(l => `<p style="text-indent:2em;margin:0.4em 0;color:#1e2d4a">${esc(l)}</p>`).join("\n")}
</div>`;
    }
  }).filter(Boolean).join("\n");
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Вспомогательные компоненты ─────────────────────────────────────────────

function ToolBtn({ children, onClick, title, className = "" }: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors text-navy-700 text-sm shrink-0 ${className}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;
}

// ── Основной компонент ─────────────────────────────────────────────────────

export default function DocEditorPanel({ content, onApply, onClose }: DocEditorPanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = buildHtml(content);
    editorRef.current.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = useCallback(() => {
    if (!editorRef.current) return;
    onApply(collectContent(editorRef.current));
  }, [onApply]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Тулбар */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-1 flex-wrap">
        <ToolBtn title="Жирный (Ctrl+B)" onClick={() => exec("bold")} className="font-bold">B</ToolBtn>
        <ToolBtn title="Курсив (Ctrl+I)" onClick={() => exec("italic")} className="italic">I</ToolBtn>
        <ToolBtn title="Подчёркивание (Ctrl+U)" onClick={() => exec("underline")} className="underline">U</ToolBtn>

        <Sep />

        <ToolBtn title="По левому краю" onClick={() => exec("justifyLeft")}>
          <Icon name="AlignLeft" size={12} />
        </ToolBtn>
        <ToolBtn title="По центру" onClick={() => exec("justifyCenter")}>
          <Icon name="AlignCenter" size={12} />
        </ToolBtn>
        <ToolBtn title="По ширине" onClick={() => exec("justifyFull")}>
          <Icon name="AlignJustify" size={12} />
        </ToolBtn>
        <ToolBtn title="По правому краю" onClick={() => exec("justifyRight")}>
          <Icon name="AlignRight" size={12} />
        </ToolBtn>

        <Sep />

        <ToolBtn title="Маркированный список" onClick={() => exec("insertUnorderedList")}>
          <Icon name="List" size={12} />
        </ToolBtn>
        <ToolBtn title="Нумерованный список" onClick={() => exec("insertOrderedList")}>
          <Icon name="ListOrdered" size={12} />
        </ToolBtn>

        <Sep />

        <select
          className="h-7 px-1.5 rounded-lg border border-slate-200 text-xs text-navy-700 bg-white outline-none cursor-pointer"
          defaultValue=""
          onChange={e => { exec("fontSize", e.target.value); e.target.value = ""; }}
          title="Размер шрифта"
        >
          <option value="" disabled>Размер</option>
          <option value="1">10</option>
          <option value="2">12</option>
          <option value="3">14</option>
          <option value="4">16</option>
          <option value="5">18</option>
          <option value="6">20</option>
        </select>

        <select
          className="h-7 px-1.5 rounded-lg border border-slate-200 text-xs text-navy-700 bg-white outline-none cursor-pointer max-w-[110px]"
          defaultValue=""
          onChange={e => { exec("fontName", e.target.value); e.target.value = ""; }}
          title="Шрифт"
        >
          <option value="" disabled>Шрифт</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Calibri">Calibri</option>
        </select>
      </div>

      {/* Редактируемая область */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          className="outline-none px-6 sm:px-10 py-6 min-h-full"
          style={{
            fontFamily: "'Times New Roman', Georgia, serif",
            fontSize: "14px",
            lineHeight: "1.8",
            color: "#1e2d4a",
          }}
        />
      </div>

      {/* Нижняя панель */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
        <button
          onClick={handleApply}
          className="flex-1 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)", color: "#f0c060", border: "1px solid rgba(232,168,32,0.3)" }}
        >
          <Icon name="Check" size={14} color="#f0c060" />
          Применить изменения
        </button>
        <button
          onClick={onClose}
          className="py-2.5 px-4 rounded-2xl text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-white transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
