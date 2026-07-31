import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";

interface DocFromChatPopoverProps {
  /** Кнопка-триггер «Создать документ» — попап позиционируется относительно неё */
  anchorEl: HTMLElement | null;
  initialLabel: string;
  loadingLabel?: boolean;
  generating: boolean;
  onConfirm: (label: string, addition: string) => void;
  onClose: () => void;
}

interface Geometry {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
  /** Смещение стрелки-указателя от левого края попапа — чтобы она указывала точно на кнопку */
  arrowLeft: number;
}

const MOBILE_BREAKPOINT = 640;
const MARGIN = 12;
const GAP = 10;

/**
 * Всплывающая карточка подтверждения документа — раскрывается прямо НАД кнопкой
 * «Создать документ» (или под ней, если сверху не хватает места), с анимацией
 * масштабирования от точки кнопки. Рендерится через Portal, чтобы не обрезаться
 * скроллируемым контейнером чата, и пересчитывает позицию при скролле/ресайзе.
 */
export default function DocFromChatPopover({
  anchorEl, initialLabel, loadingLabel, generating, onConfirm, onClose,
}: DocFromChatPopoverProps) {
  const [label, setLabel] = useState(initialLabel);
  const [addition, setAddition] = useState("");
  const [visible, setVisible] = useState(false);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLabel(initialLabel); }, [initialLabel]);

  useLayoutEffect(() => {
    const update = () => {
      const popEl = popoverRef.current;
      if (!popEl) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < MOBILE_BREAKPOINT;
      const width = isMobile ? Math.min(vw - MARGIN * 2, 420) : Math.min(400, vw - MARGIN * 2);

      const anchorRect = anchorEl && document.contains(anchorEl)
        ? anchorEl.getBoundingClientRect()
        : null;

      // Кнопка недоступна (редкий edge-case) — центрируем попап на экране
      if (!anchorRect) {
        const height = Math.min(popEl.scrollHeight || 420, vh - MARGIN * 2);
        setGeometry({
          left: Math.max(MARGIN, (vw - width) / 2),
          top: Math.max(MARGIN, (vh - height) / 2),
          width, maxHeight: vh - MARGIN * 2, openUpward: true, arrowLeft: width / 2,
        });
        return;
      }

      let left = anchorRect.left + anchorRect.width / 2 - width / 2;
      left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

      const spaceAbove = anchorRect.top - MARGIN - GAP;
      const spaceBelow = vh - anchorRect.bottom - MARGIN - GAP;
      // Раскрываем вверх (как запрошено) — если места сверху достаточно или его больше, чем снизу
      const openUpward = spaceAbove >= 220 || spaceAbove >= spaceBelow;

      const maxHeight = Math.max(200, openUpward ? spaceAbove : spaceBelow);
      const popHeight = Math.min(popEl.scrollHeight, maxHeight);
      const top = openUpward ? anchorRect.top - GAP - popHeight : anchorRect.bottom + GAP;

      const arrowLeft = Math.max(20, Math.min(anchorRect.left + anchorRect.width / 2 - left, width - 20));

      setGeometry({ left, top, width, maxHeight, openUpward, arrowLeft });
    };

    update();
    requestAnimationFrame(() => setVisible(true));

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // visualViewport ловит появление мобильной клавиатуры надёжнее, чем resize
    // (особенно в iOS Safari, где window.innerHeight не всегда меняется вовремя)
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
    // Пересчитываем и при переходе loadingLabel→готово (текст в textarea появляется
    // и меняет высоту попапа) — иначе позиция «залипает» на размере плейсхолдера.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl, loadingLabel]);

  const handleClose = () => {
    if (generating) return;
    setVisible(false);
    setTimeout(onClose, 160);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  useEffect(() => {
    if (!loadingLabel) { const t = setTimeout(() => labelRef.current?.focus(), 260); return () => clearTimeout(t); }
  }, [loadingLabel]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  };

  const canConfirm = label.trim().length > 2 && !generating && !loadingLabel;

  return createPortal(
    <>
      {/* Прозрачный кликер вне попапа — закрывает по клику снаружи, без затемнения фона */}
      <div className="fixed inset-0 z-[149]" onClick={handleClose} />

      <div
        ref={popoverRef}
        className="fixed z-[150] flex flex-col rounded-3xl overflow-hidden"
        style={{
          left: geometry?.left ?? -9999,
          top: geometry?.top ?? -9999,
          width: geometry?.width ?? 380,
          maxHeight: geometry?.maxHeight ?? 480,
          visibility: geometry ? "visible" : "hidden",
          background: "#0a1628",
          boxShadow: "0 20px 60px rgba(5,12,30,0.45), 0 4px 20px rgba(5,12,30,0.3), 0 0 0 1px rgba(255,255,255,0.07)",
          opacity: visible ? 1 : 0,
          transform: visible
            ? "scale(1) translateY(0)"
            : `scale(0.92) translateY(${geometry?.openUpward === false ? "-10px" : "10px"})`,
          transformOrigin: geometry?.openUpward === false ? "top center" : "bottom center",
          transition: "opacity 0.22s cubic-bezier(0.22,1,0.36,1), transform 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0" style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f5d060 50%, #e8a820 70%, transparent)" }} />

        {/* Заголовок */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.22)" }}>
              <Icon name="FilePlus" size={15} color="#e8a820" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-[13.5px] leading-tight">Подготовка документа</p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>Проверьте тип перед генерацией</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={generating}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <Icon name="X" size={13} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Контент — скроллится если не влезает по высоте */}
        <div className="overflow-y-auto flex-1 px-4 space-y-3 pb-3">
          {/* Какой документ создаём */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="FileText" size={10} color="rgba(255,255,255,0.35)" />
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Какой документ создаём?</p>
            </div>
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.05)", border: label ? "1.5px solid rgba(232,168,32,0.4)" : "1.5px solid rgba(255,255,255,0.1)" }}
            >
              {loadingLabel ? (
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-400 rounded-full animate-spin shrink-0" />
                  <span className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.4)" }}>Определяю тип документа...</span>
                </div>
              ) : (
                <textarea
                  ref={labelRef}
                  value={label}
                  onChange={e => { setLabel(e.target.value); autoResize(e.target); }}
                  rows={2}
                  placeholder="Например: заявление о внесении изменений..."
                  className="w-full bg-transparent outline-none resize-none px-3.5 py-3 text-[13px] leading-relaxed font-semibold placeholder:opacity-30 placeholder:font-normal"
                  style={{ color: "#f5d060", minHeight: "50px", maxHeight: "110px" }}
                />
              )}
            </div>
          </div>

          {/* Что необходимо дополнить */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="PenLine" size={10} color="rgba(255,255,255,0.35)" />
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Что дополнить?</p>
              <span className="text-[9.5px]" style={{ color: "rgba(255,255,255,0.2)" }}>необязательно</span>
            </div>
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.05)", border: addition ? "1.5px solid rgba(232,168,32,0.4)" : "1.5px solid rgba(255,255,255,0.1)" }}
            >
              <textarea
                value={addition}
                onChange={e => { setAddition(e.target.value); autoResize(e.target); }}
                placeholder="Детали, реквизиты, суммы, даты..."
                rows={2}
                className="w-full bg-transparent outline-none resize-none px-3.5 py-2.5 text-[12.5px] leading-relaxed placeholder:opacity-30"
                style={{ color: "rgba(255,255,255,0.9)", minHeight: "58px", maxHeight: "100px" }}
              />
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="shrink-0 px-4 pt-2.5 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => canConfirm && onConfirm(label.trim(), addition.trim())}
            disabled={!canConfirm}
            className="w-full py-3 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: canConfirm ? "linear-gradient(135deg, #c97d10, #e8a820, #f5d060)" : "rgba(255,255,255,0.07)",
              color: canConfirm ? "#0a1628" : "rgba(255,255,255,0.2)",
              boxShadow: canConfirm ? "0 4px 20px rgba(232,168,32,0.35)" : "none",
            }}
          >
            {generating
              ? <><span className="w-4 h-4 border-2 border-navy-800/30 border-t-navy-800 rounded-full animate-spin" />Готовлю документ...</>
              : <><Icon name="FilePlus" size={15} color={canConfirm ? "#0a1628" : "rgba(255,255,255,0.2)"} />Создать документ</>}
          </button>
        </div>

        {/* Стрелка-указатель на кнопку-триггер */}
        {geometry && (
          <div
            className="absolute w-3 h-3 rotate-45"
            style={{
              left: geometry.arrowLeft - 6,
              ...(geometry.openUpward ? { bottom: -6 } : { top: -6 }),
              background: "#0a1628",
              ...(geometry.openUpward
                ? { borderRight: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }
                : { borderLeft: "1px solid rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.07)" }),
            }}
          />
        )}
      </div>
    </>,
    document.body
  );
}