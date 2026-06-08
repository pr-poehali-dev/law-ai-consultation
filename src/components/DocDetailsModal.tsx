import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface DocDetailsModalProps {
  docTypeId: string;
  docLabel: string;
  initialQuery: string;
  onProceed: (query: string, comment: string) => void;
  onClose: () => void;
}

export default function DocDetailsModal({
  docTypeId: _docTypeId,
  docLabel,
  initialQuery,
  onProceed,
  onClose,
}: DocDetailsModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [comment, setComment] = useState("");
  const [editingQuery, setEditingQuery] = useState(false);
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingQuery && queryRef.current) {
      queryRef.current.focus();
      const len = queryRef.current.value.length;
      queryRef.current.setSelectionRange(len, len);
    }
  }, [editingQuery]);

  useEffect(() => {
    if (commentRef.current) {
      setTimeout(() => commentRef.current?.focus(), 300);
    }
  }, []);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleProceed = () => {
    const q = query.trim();
    if (!q) return;
    onProceed(q, comment.trim());
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgba(5,12,30,0.7)" }}
        onClick={onClose}
      />

      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl flex flex-col"
        style={{
          background: "#0a1628",
          maxHeight: "92dvh",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Золотая линия */}
        <div
          className="shrink-0 rounded-t-3xl overflow-hidden"
          style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f5d060 50%, #e8a820 70%, transparent)" }}
        />

        {/* Свайп */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Кнопка закрыть */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-opacity hover:opacity-70"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <Icon name="X" size={14} color="rgba(255,255,255,0.6)" />
        </button>

        {/* Заголовок */}
        <div className="flex items-center gap-3 px-5 pt-1 pb-4 shrink-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.25)" }}
          >
            <Icon name="FileText" size={18} color="#e8a820" />
          </div>
          <div>
            <h3 className="font-bold text-white text-[15px] leading-tight">
              {docLabel}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Уточните детали для точной генерации
            </p>
          </div>
        </div>

        {/* Скролл-зона */}
        <div className="overflow-y-auto flex-1 px-5 space-y-4 pb-4">

          {/* Блок запроса */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ваш запрос
              </span>
              {!editingQuery && (
                <button
                  onClick={() => setEditingQuery(true)}
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#e8a820" }}
                >
                  <Icon name="Pencil" size={10} color="#e8a820" />
                  Изменить
                </button>
              )}
              {editingQuery && (
                <button
                  onClick={() => setEditingQuery(false)}
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#4ade80" }}
                >
                  <Icon name="Check" size={10} color="#4ade80" />
                  Готово
                </button>
              )}
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: editingQuery ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                border: editingQuery
                  ? "1.5px solid rgba(232,168,32,0.35)"
                  : "1px solid rgba(255,255,255,0.08)",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              {editingQuery ? (
                <textarea
                  ref={queryRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); autoResize(e.target); }}
                  rows={3}
                  className="w-full bg-transparent outline-none resize-none px-4 py-3 text-[13px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.9)", minHeight: "72px", maxHeight: "160px" }}
                />
              ) : (
                <p
                  className="px-4 py-3 text-[13px] leading-relaxed"
                  style={{
                    color: query ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {query || "Запрос не указан"}
                </p>
              )}
            </div>
          </div>

          {/* Блок дополнений */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                Дополнения
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                необязательно
              </span>
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "border-color 0.2s",
              }}
              onFocus={() => {}}
            >
              <textarea
                ref={commentRef}
                value={comment}
                onChange={e => { setComment(e.target.value); autoResize(e.target); }}
                placeholder="Если требуются дополнения — укажите детали: ФИО сторон, суммы, даты, адреса, нарушенные права..."
                rows={3}
                className="w-full bg-transparent outline-none resize-none px-4 py-3 text-[13px] leading-relaxed placeholder:text-[rgba(255,255,255,0.22)]"
                style={{ color: "rgba(255,255,255,0.85)", minHeight: "80px", maxHeight: "160px" }}
                onFocus={e => {
                  (e.target.closest("div") as HTMLElement).style.borderColor = "rgba(232,168,32,0.35)";
                  (e.target.closest("div") as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onBlur={e => {
                  (e.target.closest("div") as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.target.closest("div") as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
              />
            </div>

            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.25)" }}>
              Чем подробнее — тем точнее документ. AI использует эти данные при генерации.
            </p>
          </div>
        </div>

        {/* Липкий футер */}
        <div
          className="shrink-0 px-5 pt-3 pb-5"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: `max(20px, env(safe-area-inset-bottom, 20px))`,
            background: "#0a1628",
          }}
        >
          <button
            onClick={handleProceed}
            disabled={!query.trim()}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
            style={{
              background: query.trim()
                ? "linear-gradient(135deg, #c97d10, #e8a820, #f5d060)"
                : "rgba(255,255,255,0.07)",
              color: query.trim() ? "#0a1628" : "rgba(255,255,255,0.2)",
              boxShadow: query.trim() ? "0 4px 20px rgba(232,168,32,0.35)" : "none",
              transition: "all 0.2s",
            }}
          >
            <Icon name="CreditCard" size={16} color={query.trim() ? "#0a1628" : "rgba(255,255,255,0.2)"} />
            Оплатить и создать · 990 ₽
          </button>
        </div>
      </div>
    </div>
  );
}
