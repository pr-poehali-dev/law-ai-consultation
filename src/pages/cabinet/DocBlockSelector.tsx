import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { DOC_BLOCKS, type DocType, type DocBlock } from "@/pages/cabinet/docBlocks";

interface DocBlockSelectorProps {
  selectedId: string;
  onSelect: (dt: DocType) => void;
}

export default function DocBlockSelector({ selectedId, onSelect }: DocBlockSelectorProps) {
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(() => {
    // По умолчанию открыт блок с выбранным документом
    const block = DOC_BLOCKS.find(b => b.types.some(t => t.id === selectedId));
    return new Set(block ? [block.id] : ["b1"]);
  });
  const [search, setSearch] = useState("");

  const toggleBlock = useCallback((id: string) => {
    setOpenBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = search.trim().length > 1
    ? DOC_BLOCKS.map(b => ({
        ...b,
        types: b.types.filter(t => t.label.toLowerCase().includes(search.toLowerCase())),
      })).filter(b => b.types.length > 0)
    : DOC_BLOCKS;

  // При поиске — раскрыть все найденные блоки
  useEffect(() => {
    if (search.trim().length > 1) {
      setOpenBlocks(new Set(filtered.map(b => b.id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-1.5" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Поиск */}
      <div className="relative mb-1">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск документа..."
          className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:bg-white transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={12} />
          </button>
        )}
      </div>

      {/* Блоки */}
      {filtered.map(block => (
        <BlockAccordion
          key={block.id}
          block={block}
          isOpen={openBlocks.has(block.id)}
          onToggle={() => toggleBlock(block.id)}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Icon name="SearchX" size={28} className="opacity-40" />
          <span className="text-sm">Ничего не найдено</span>
        </div>
      )}
    </div>
  );
}

function BlockAccordion({
  block,
  isOpen,
  onToggle,
  selectedId,
  onSelect,
}: {
  block: DocBlock;
  isOpen: boolean;
  onToggle: () => void;
  selectedId: string;
  onSelect: (dt: DocType) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasSelected = block.types.some(t => t.id === selectedId);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isOpen
          ? "border-navy-200 shadow-sm"
          : hasSelected
          ? "border-navy-200"
          : "border-border"
      }`}
    >
      {/* Заголовок блока */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
          isOpen
            ? "bg-navy-50"
            : hasSelected
            ? "bg-navy-50/50"
            : "bg-white hover:bg-slate-50"
        }`}
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${block.color}`}
        >
          <Icon name={block.icon} size={14} />
        </div>
        <span
          className={`text-sm font-semibold flex-1 text-left ${
            isOpen || hasSelected ? "text-navy-800" : "text-navy-700"
          }`}
        >
          {block.label}
        </span>
        <span className="text-xs text-muted-foreground bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0 leading-none">
          {block.types.length}
        </span>
        <Icon
          name="ChevronDown"
          size={14}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Содержимое с анимацией через max-height */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-250 ease-in-out"
        style={{
          maxHeight: isOpen ? `${block.types.length * 44}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-2 pb-2 pt-1 flex flex-col gap-0.5 bg-white">
          {block.types.map(dt => (
            <button
              key={dt.id}
              onClick={() => onSelect(dt)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-150 ${
                selectedId === dt.id
                  ? "bg-navy-600 text-white shadow-sm"
                  : "hover:bg-slate-50 text-navy-700"
              }`}
            >
              <Icon
                name={dt.icon}
                size={13}
                className={selectedId === dt.id ? "text-white/80" : "text-muted-foreground"}
              />
              <span className="text-sm leading-tight">{dt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}