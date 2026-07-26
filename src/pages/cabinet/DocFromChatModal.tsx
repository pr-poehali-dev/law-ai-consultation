import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface DocFromChatModalProps {
  /** Название документа, извлечённое из рекомендации AI (или fallback) — редактируемое пользователем */
  initialLabel: string;
  loadingLabel?: boolean;
  generating: boolean;
  onConfirm: (label: string, addition: string) => void;
  onClose: () => void;
}

/**
 * Модалка подтверждения перед генерацией документа из чата AI.
 * Показывает ТОЧНО то название документа, которое AI назвал в рекомендации
 * (редактируемое), плюс необязательное поле для дополнений — и передаёт
 * оба значения на генерацию, чтобы итоговый документ гарантированно совпадал
 * с тем, что было рекомендовано в чате.
 */
export default function DocFromChatModal({
  initialLabel, loadingLabel, generating, onConfirm, onClose,
}: DocFromChatModalProps) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState(initialLabel);
  const [addition, setAddition] = useState("");
  const labelRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    setLabel(initialLabel);
  }, [initialLabel]);

  const handleClose = () => {
    if (generating) return;
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const canConfirm = label.trim().length > 2 && !generating && !loadingLabel;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{ background: "rgba(5,12,30,0.65)", backdropFilter: "blur(3px)", opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl flex flex-col"
        style={{
          background: "#0a1628",
          maxHeight: "92dvh",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <div className="shrink-0 rounded-t-3xl overflow-hidden" style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f5d060 50%, #e8a820 70%, transparent)" }} />

        <div className="flex justify-center pt-2 pb-0.5 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Заголовок */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 pt-2 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.22)" }}
            >
              <Icon name="FilePlus" size={15} color="#e8a820" />
            </div>
            <div>
              <p className="font-bold text-white text-[14px] leading-tight">Подготовка документа</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Проверьте тип документа перед генерацией</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={generating}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <Icon name="X" size={14} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Скролл-зона */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-5 space-y-3.5 pb-3">

          {/* Какой документ создаём */}
          <div className="animate-scale-in" style={{ animationDelay: "40ms", opacity: 0 }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="FileText" size={11} color="rgba(255,255,255,0.35)" />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Какой документ создаём?</p>
            </div>
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200 relative"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: label ? "1.5px solid rgba(232,168,32,0.4)" : "1.5px solid rgba(255,255,255,0.1)",
              }}
            >
              {loadingLabel ? (
                <div className="flex items-center gap-2.5 px-4 py-3.5">
                  <span className="w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-400 rounded-full animate-spin shrink-0" />
                  <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>Определяю тип документа из ответа AI...</span>
                </div>
              ) : (
                <textarea
                  ref={labelRef}
                  value={label}
                  onChange={e => { setLabel(e.target.value); autoResize(e.target); }}
                  rows={2}
                  placeholder="Например: заявление о внесении изменений в запись акта гражданского состояния"
                  className="w-full bg-transparent outline-none resize-none px-4 py-3.5 text-[13.5px] leading-relaxed font-semibold placeholder:opacity-30 placeholder:font-normal"
                  style={{ color: "#f5d060", minHeight: "56px", maxHeight: "140px" }}
                />
              )}
            </div>
            <p className="text-[10.5px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              Название подставлено из рекомендации AI-юриста — при необходимости можно поправить
            </p>
          </div>

          {/* Что необходимо дополнить */}
          <div className="animate-scale-in" style={{ animationDelay: "110ms", opacity: 0 }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="PenLine" size={11} color="rgba(255,255,255,0.35)" />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Что необходимо дополнить?</p>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>необязательно</span>
            </div>
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: addition ? "1.5px solid rgba(232,168,32,0.4)" : "1.5px solid rgba(255,255,255,0.1)",
              }}
            >
              <textarea
                value={addition}
                onChange={e => { setAddition(e.target.value); autoResize(e.target); }}
                placeholder="Дополнительные детали, реквизиты, суммы, даты — если нужно уточнить ситуацию из диалога"
                rows={3}
                className="w-full bg-transparent outline-none resize-none px-4 py-3.5 text-[13px] leading-relaxed placeholder:opacity-30"
                style={{ color: "rgba(255,255,255,0.9)", minHeight: "76px", maxHeight: "140px" }}
              />
            </div>
          </div>

          {/* Пояснение — используется весь диалог */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl animate-scale-in"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", animationDelay: "180ms", opacity: 0 }}
          >
            <Icon name="Sparkles" size={12} color="#60a5fa" className="shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed" style={{ color: "#93c5fd" }}>
              AI учтёт всю историю вашего диалога и сгенерирует именно этот документ — с учётом ваших дополнений
            </span>
          </div>
        </div>

        {/* Футер */}
        <div
          className="shrink-0 px-4 sm:px-5 pt-3"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: `max(16px, env(safe-area-inset-bottom, 16px))`,
            background: "#0a1628",
          }}
        >
          <button
            onClick={() => canConfirm && onConfirm(label.trim(), addition.trim())}
            disabled={!canConfirm}
            className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: canConfirm ? "linear-gradient(135deg, #c97d10, #e8a820, #f5d060)" : "rgba(255,255,255,0.07)",
              color: canConfirm ? "#0a1628" : "rgba(255,255,255,0.2)",
              boxShadow: canConfirm ? "0 4px 20px rgba(232,168,32,0.35)" : "none",
              transition: "all 0.2s",
            }}
          >
            {generating
              ? <><span className="w-4 h-4 border-2 border-navy-800/30 border-t-navy-800 rounded-full animate-spin" />Готовлю документ...</>
              : <><Icon name="FilePlus" size={16} color={canConfirm ? "#0a1628" : "rgba(255,255,255,0.2)"} />Создать документ</>}
          </button>
        </div>
      </div>
    </div>
  );
}
