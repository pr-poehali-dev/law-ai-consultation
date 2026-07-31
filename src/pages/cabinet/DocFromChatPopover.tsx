import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import AnimatedRobot from "@/components/AnimatedRobot";
import func2url from "../../../backend/func2url.json";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-chat"];

interface DocFromChatPopoverProps {
  initialLabel: string;
  loadingLabel?: boolean;
  generating: boolean;
  onConfirm: (label: string, addition: string) => void;
  onClose: () => void;
  /** Контекст для короткой AI-рекомендации в облачке-мыслях робота */
  aiText?: string;
  userText?: string;
}

/**
 * Всплывающая карточка подтверждения документа — открывается по центру экрана
 * (не привязана к кнопке-триггеру) и её можно перетаскивать мышью/пальцем за
 * шапку в любое удобное место. Слева от карточки — анимированный робот-помощник
 * (переиспользуемый AnimatedRobot), от которого будто идут «мысли» — облачко
 * с короткой AI-рекомендацией по документу.
 */
export default function DocFromChatPopover({
  initialLabel, loadingLabel, generating, onConfirm, onClose, aiText, userText,
}: DocFromChatPopoverProps) {
  const [label, setLabel] = useState(initialLabel);
  const [addition, setAddition] = useState("");
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLTextAreaElement>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => { setLabel(initialLabel); }, [initialLabel]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Короткая AI-рекомендация (до 500 токенов, backend гарантирует завершённость фразы)
  useEffect(() => {
    if (!aiText && !userText) return;
    let cancelled = false;
    setHintLoading(true);
    const token = getToken();
    fetch(GIGACHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({ mode: "doc_hint_suggest", ai_answer: aiText || "", user_text: userText || "" }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setHint(data.hint || ""); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHintLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Перетаскивание карточки за шапку (мышь и тач через Pointer Events) ────
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, baseX: dragOffset.x, baseY: dragOffset.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    // Мягкое ограничение — не даём утащить карточку полностью за пределы экрана
    const maxX = window.innerWidth / 2 - 60;
    const maxY = window.innerHeight / 2 - 60;
    setDragOffset({
      x: Math.max(-maxX, Math.min(maxX, dragStateRef.current.baseX + dx)),
      y: Math.max(-maxY, Math.min(maxY, dragStateRef.current.baseY + dy)),
    });
  };
  const onDragEnd = () => {
    dragStateRef.current = null;
    setDragging(false);
  };

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
        className="fixed z-[150] flex flex-col rounded-3xl overflow-visible bg-white"
        style={{
          left: "50%",
          top: "50%",
          width: "min(420px, calc(100vw - 24px))",
          maxHeight: "calc(100vh - 24px)",
          border: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 20px 60px rgba(15,23,42,0.16), 0 4px 20px rgba(15,23,42,0.08)",
          opacity: visible ? 1 : 0,
          transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px)) scale(${visible ? 1 : 0.92})`,
          transition: dragging ? "none" : "opacity 0.22s cubic-bezier(0.22,1,0.36,1), transform 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Робот — крупный, без фона, выступает за левый верхний край карточки, «машет» рукой */}
        <AnimatedRobot
          size={124}
          className="absolute pointer-events-none select-none"
          style={{ left: -58, top: -50, filter: "drop-shadow(0 8px 16px rgba(15,23,42,0.2))" }}
        />

        {/* Облачко-мысли, идущее от робота — две убывающие точки как классический «thought bubble» */}
        {(hintLoading || hint) && (
          <>
            <div className="absolute rounded-full bg-white" style={{ width: 10, height: 10, left: 34, top: 18, border: "1px solid rgba(15,76,129,0.18)" }} />
            <div className="absolute rounded-full bg-white" style={{ width: 6, height: 6, left: 44, top: 10, border: "1px solid rgba(15,76,129,0.18)" }} />
          </>
        )}

        <div className="rounded-3xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="shrink-0" style={{ height: 3, background: "linear-gradient(90deg,#0f4c81,#1a6bb5,#e8a820)" }} />

          {/* Шапка — драг-хэндл для перетаскивания карточки мышью/пальцем */}
          <div
            className="shrink-0 flex items-center justify-between pl-16 pr-4 pt-3.5 pb-2.5"
            style={{ background: "linear-gradient(180deg,#f8fafc,#ffffff)", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="min-w-0">
              <p className="font-bold text-navy-800 text-[14px] leading-tight">Подготовка документа</p>
              <p className="text-[10.5px] mt-0.5 truncate text-slate-400">AI-юрист поможет с деталями</p>
            </div>
            <button
              onClick={handleClose}
              disabled={generating}
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-slate-100 disabled:opacity-40"
            >
              <Icon name="X" size={13} className="text-slate-400" />
            </button>
          </div>

          {/* Контент — скроллится если не влезает по высоте */}
          <div className="overflow-y-auto flex-1 px-4 space-y-3 pb-3.5" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>

            {/* Облачко мыслей робота с короткой AI-рекомендацией */}
            {(hintLoading || hint) && (
              <div className="relative rounded-2xl px-3.5 py-2.5 mt-0.5" style={{ background: "rgba(15,76,129,0.06)", border: "1px solid rgba(15,76,129,0.12)" }}>
                <div
                  className="absolute -top-1.5 left-6 w-3 h-3 rotate-45"
                  style={{ background: "rgba(15,76,129,0.06)", borderLeft: "1px solid rgba(15,76,129,0.12)", borderTop: "1px solid rgba(15,76,129,0.12)" }}
                />
                {hintLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: "#0f4c81" }} />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: "#1a6bb5" }} />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: "#0f4c81" }} />
                    </div>
                    <span className="text-[11px] text-slate-400 italic">думаю над рекомендацией...</span>
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-navy-700">{hint}</p>
                )}
              </div>
            )}

            {/* Какой документ создаём */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="FileText" size={10} className="text-slate-400" />
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Какой документ создаём?</p>
              </div>
              <div
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{ background: "#f8fafc", border: label ? "1.5px solid rgba(15,76,129,0.35)" : "1.5px solid #e2e8f0" }}
              >
                {loadingLabel ? (
                  <div className="flex items-center gap-2.5 px-3.5 py-3">
                    <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin shrink-0" style={{ borderColor: "rgba(15,76,129,0.2)", borderTopColor: "#0f4c81" }} />
                    <span className="text-[12.5px] text-slate-400">Определяю тип документа...</span>
                  </div>
                ) : (
                  <textarea
                    ref={labelRef}
                    value={label}
                    onChange={e => { setLabel(e.target.value); autoResize(e.target); }}
                    rows={2}
                    placeholder="Например: заявление о внесении изменений..."
                    className="w-full bg-transparent outline-none resize-none px-3.5 py-3 text-[13px] leading-relaxed font-semibold placeholder:opacity-40 placeholder:font-normal text-navy-800"
                    style={{ minHeight: "50px", maxHeight: "110px" }}
                  />
                )}
              </div>
            </div>

            {/* Что необходимо дополнить */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="PenLine" size={10} className="text-slate-400" />
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Что дополнить?</p>
                <span className="text-[9.5px] text-slate-300">необязательно</span>
              </div>
              <div
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{ background: "#f8fafc", border: addition ? "1.5px solid rgba(15,76,129,0.35)" : "1.5px solid #e2e8f0" }}
              >
                <textarea
                  value={addition}
                  onChange={e => { setAddition(e.target.value); autoResize(e.target); }}
                  placeholder="Детали, реквизиты, суммы, даты..."
                  rows={2}
                  className="w-full bg-transparent outline-none resize-none px-3.5 py-2.5 text-[12.5px] leading-relaxed placeholder:opacity-40 text-navy-700"
                  style={{ minHeight: "58px", maxHeight: "100px" }}
                />
              </div>
            </div>
          </div>

          {/* Футер */}
          <div className="shrink-0 px-4 pt-2.5 pb-3.5 bg-white" style={{ borderTop: "1px solid #f1f5f9" }}>
            <button
              onClick={() => canConfirm && onConfirm(label.trim(), addition.trim())}
              disabled={!canConfirm}
              className="w-full py-3 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-white"
              style={{
                background: canConfirm ? "linear-gradient(135deg,#0f4c81,#1a6bb5)" : "#e2e8f0",
                color: canConfirm ? "#ffffff" : "#94a3b8",
                boxShadow: canConfirm ? "0 4px 20px rgba(15,76,129,0.3)" : "none",
              }}
            >
              {generating
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Готовлю документ...</>
                : <><Icon name="FilePlus" size={15} /> Создать документ</>}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
