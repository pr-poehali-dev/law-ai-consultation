import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

interface DocEditorPanelProps {
  content: string;
  onApply: (newContent: string) => void;
  onClose: () => void;
}

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px"];
const FONT_FAMILIES = [
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
];

export default function DocEditorPanel({ content, onApply, onClose }: DocEditorPanelProps) {
  const [text, setText] = useState(content);
  const [fontSize, setFontSize] = useState("14px");
  const [fontFamily, setFontFamily] = useState("'Times New Roman', serif");
  const [lineHeight, setLineHeight] = useState("1.8");
  const [showFontMenu, setShowFontMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAt = useCallback((before: string, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + before + selected + after + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }, [text]);

  const wrapLines = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const lines = selected.split("\n").map(l => prefix + l).join("\n");
    const newText = text.slice(0, start) + lines + text.slice(end);
    setText(newText);
  }, [text]);

  const insertBlankLine = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const newText = text.slice(0, pos) + "\n\n" + text.slice(pos);
    setText(newText);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos + 2, pos + 2); });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Тулбар */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-100 bg-white">
        {/* Строка 1: форматирование */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Жирный */}
          <button
            onClick={() => insertAt("**", "**")}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors font-bold text-navy-800 text-sm"
            title="Жирный"
          >B</button>
          {/* Курсив */}
          <button
            onClick={() => insertAt("_", "_")}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors italic text-navy-800 text-sm"
            title="Курсив"
          >I</button>
          {/* Подчёркивание */}
          <button
            onClick={() => insertAt("<u>", "</u>")}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors underline text-navy-800 text-sm"
            title="Подчёркивание"
          >U</button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Абзац */}
          <button
            onClick={insertBlankLine}
            className="h-7 px-2 rounded-lg flex items-center gap-1 hover:bg-slate-100 transition-colors text-navy-700 text-xs"
            title="Новый абзац"
          >
            <Icon name="WrapText" size={12} />
            <span>Абзац</span>
          </button>

          {/* Список */}
          <button
            onClick={() => wrapLines("• ")}
            className="h-7 px-2 rounded-lg flex items-center gap-1 hover:bg-slate-100 transition-colors text-navy-700 text-xs"
            title="Маркированный список"
          >
            <Icon name="List" size={12} />
          </button>
          {/* Нумерованный */}
          <button
            onClick={() => wrapLines("1. ")}
            className="h-7 px-2 rounded-lg flex items-center gap-1 hover:bg-slate-100 transition-colors text-navy-700 text-xs"
            title="Нумерованный список"
          >
            <Icon name="ListOrdered" size={12} />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Размер шрифта */}
          <select
            value={fontSize}
            onChange={e => setFontSize(e.target.value)}
            className="h-7 px-1.5 rounded-lg border border-slate-200 text-xs text-navy-700 bg-white outline-none cursor-pointer"
          >
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Шрифт */}
          <div className="relative">
            <button
              onClick={() => setShowFontMenu(v => !v)}
              className="h-7 px-2 rounded-lg border border-slate-200 flex items-center gap-1 text-xs text-navy-700 hover:bg-slate-50 transition-colors"
            >
              <span style={{ fontFamily }} className="max-w-[80px] truncate">Aa</span>
              <Icon name="ChevronDown" size={10} />
            </button>
            {showFontMenu && (
              <div className="absolute top-8 left-0 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[160px]">
                {FONT_FAMILIES.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setFontFamily(f.value); setShowFontMenu(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 transition-colors ${fontFamily === f.value ? "text-navy-700 font-semibold" : "text-slate-600"}`}
                    style={{ fontFamily: f.value }}
                  >{f.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Межстрочный интервал */}
          <select
            value={lineHeight}
            onChange={e => setLineHeight(e.target.value)}
            className="h-7 px-1.5 rounded-lg border border-slate-200 text-xs text-navy-700 bg-white outline-none cursor-pointer"
            title="Межстрочный интервал"
          >
            <option value="1.4">1.4</option>
            <option value="1.6">1.6</option>
            <option value="1.8">1.8</option>
            <option value="2">2.0</option>
          </select>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        className="flex-1 resize-none outline-none px-6 py-5 text-navy-800 bg-white w-full"
        style={{
          fontFamily,
          fontSize,
          lineHeight,
          minHeight: 0,
          borderBottom: "none",
        }}
        spellCheck
        placeholder="Текст документа..."
      />

      {/* Нижняя панель */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
        <button
          onClick={() => onApply(text)}
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
