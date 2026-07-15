import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { DOC_BLOCKS } from "@/pages/cabinet/docBlocks";

interface DocPickerSheetProps {
  onSelect: (docTypeId: string) => void;
  onClose: () => void;
}

const BLOCK_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  b1: { bg: "rgba(59,130,246,0.1)",  text: "#3b82f6", border: "rgba(59,130,246,0.2)",  dot: "#3b82f6" },
  b2: { bg: "rgba(139,92,246,0.1)", text: "#8b5cf6", border: "rgba(139,92,246,0.2)", dot: "#8b5cf6" },
  b3: { bg: "rgba(249,115,22,0.1)", text: "#f97316", border: "rgba(249,115,22,0.2)", dot: "#f97316" },
  b4: { bg: "rgba(239,68,68,0.1)",  text: "#ef4444", border: "rgba(239,68,68,0.2)",  dot: "#ef4444" },
  b5: { bg: "rgba(234,179,8,0.1)",  text: "#ca8a04", border: "rgba(234,179,8,0.2)",  dot: "#eab308" },
  b6: { bg: "rgba(34,197,94,0.1)",  text: "#16a34a", border: "rgba(34,197,94,0.2)",  dot: "#22c55e" },
};

export default function DocPickerSheet({ onSelect, onClose }: DocPickerSheetProps) {
  const [openBlock, setOpenBlock] = useState<string | null>("b1");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  const handleSelect = (id: string) => {
    handleClose();
    setTimeout(() => onSelect(id), 80);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? DOC_BLOCKS.map(b => ({
        ...b,
        types: b.types.filter(t => t.label.toLowerCase().includes(q)),
      })).filter(b => b.types.length > 0)
    : DOC_BLOCKS;

  const isSearching = q.length > 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{ background: "rgba(5,12,30,0.65)", backdropFilter: "blur(3px)", opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl flex flex-col"
        style={{
          background: "#0a1628",
          maxHeight: "88dvh",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.26s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Золотая линия */}
        <div className="shrink-0 rounded-t-3xl overflow-hidden" style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f5d060 50%, #e8a820 70%, transparent)" }} />

        {/* Свайп-индикатор (мобайл) */}
        <div className="flex justify-center pt-2 pb-0.5 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Заголовок */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 pt-2 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.22)" }}>
              <Icon name="FileText" size={15} color="#e8a820" />
            </div>
            <div>
              <p className="font-bold text-white text-[14px] leading-tight">Создать документ</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {DOC_BLOCKS.reduce((s, b) => s + b.types.length, 0)} шаблонов · от 590 ₽
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <Icon name="X" size={14} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Поиск */}
        <div className="shrink-0 px-4 sm:px-5 pb-3">
          <div
            className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Icon name="Search" size={13} color="rgba(255,255,255,0.3)" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск документа…"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "rgba(255,255,255,0.85)", caretColor: "#e8a820" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="shrink-0">
                <Icon name="X" size={12} color="rgba(255,255,255,0.35)" />
              </button>
            )}
          </div>
        </div>

        {/* Список */}
        <div className="overflow-y-auto flex-1 px-3 sm:px-4 pb-5 space-y-1.5">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>Ничего не найдено</p>
            </div>
          )}

          {filtered.map(block => {
            const color = BLOCK_COLORS[block.id] || BLOCK_COLORS.b1;
            const isOpen = isSearching || openBlock === block.id;

            return (
              <div
                key={block.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${isOpen ? color.border : "rgba(255,255,255,0.07)"}`, transition: "border-color 0.2s" }}
              >
                {/* Заголовок блока */}
                {!isSearching && (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{ background: isOpen ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)" }}
                    onClick={() => setOpenBlock(isOpen ? null : block.id)}
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: color.bg, border: `1px solid ${color.border}` }}
                    >
                      <Icon name={block.icon} size={13} color={color.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: isOpen ? "#fff" : "rgba(255,255,255,0.75)" }}>
                        {block.label}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {block.types.length} {block.types.length === 1 ? "шаблон" : block.types.length < 5 ? "шаблона" : "шаблонов"}
                      </p>
                    </div>
                    <Icon
                      name="ChevronDown"
                      size={14}
                      color="rgba(255,255,255,0.3)"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                    />
                  </button>
                )}

                {/* Типы документов */}
                {isOpen && (
                  <div
                    className="grid grid-cols-1 gap-px"
                    style={{ background: "rgba(255,255,255,0.04)", borderTop: isSearching ? "none" : "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {/* Заголовок блока при поиске */}
                    {isSearching && (
                      <div className="px-4 pt-2.5 pb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color.dot }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {block.label}
                          </p>
                        </div>
                      </div>
                    )}

                    {block.types.map((dt, idx) => (
                      <button
                        key={dt.id}
                        onClick={() => handleSelect(dt.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group"
                        style={{
                          background: "transparent",
                          borderBottom: idx < block.types.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: color.bg }}
                        >
                          <Icon name={dt.icon} size={11} color={color.text} />
                        </div>
                        <span className="flex-1 text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.78)" }}>
                          {dt.label}
                        </span>
                        <Icon name="ChevronRight" size={12} color="rgba(255,255,255,0.18)" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}