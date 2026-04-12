import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

export interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; truncated?: boolean; }

interface ChatTabProps {
  user: User;
  messages: ChatMsg[];
  input: string;
  typing: boolean;
  typingStatus?: string;
  chatErr: string;
  attachedFile: { name: string; b64: string; size: string } | null;
  fileUploading: boolean;
  totalLeft: number;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: () => void;
  onContinueChat: (partialText: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
  onClearFile: () => void;
  onPayClick: () => void;
  onGoToDocs: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

// ─── Рендер текста ─────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|ст\.\s*\d+[\w.-]*(?:\s*ГК|ТК|СК|НК|КоАП|АПК|ГПК|КАС|УК)?(?:\s*РФ)?|статьи?\s+\d+[\w.-]*)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-navy-800">{part.slice(2, -2)}</strong>;
    if (/^(ст\.|статьи?)\s*\d+/i.test(part))
      return <span key={i} className="font-semibold text-navy-700 bg-gold-400/20 px-1 rounded text-[12.5px]">{part}</span>;
    return part;
  });
}

function LegalText({ text }: { text: string }) {
  return (
    <div className="space-y-2 font-golos text-[13.5px] text-navy-700 leading-[1.8]">
      {text.split(/\n{2,}/).map((para, pi) => {
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

function AnimatedMessage({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? "" : text);
  const [done, setDone] = useState(!animate);
  useEffect(() => {
    if (!animate) { setShown(text); setDone(true); return; }
    setShown(""); setDone(false);
    let i = 0;
    const go = () => {
      if (i >= text.length) { setDone(true); return; }
      i += Math.min(6, text.length - i);
      setShown(text.slice(0, i));
      setTimeout(go, 14);
    };
    const t = setTimeout(go, 60);
    return () => clearTimeout(t);
  }, [text, animate]);
  if (done) return <LegalText text={text} />;
  return (
    <p className="text-[13.5px] text-navy-700 leading-[1.8] whitespace-pre-wrap font-golos">
      {shown}<span className="inline-block w-0.5 h-4 bg-gold-500 ml-0.5 animate-pulse align-middle rounded-full" />
    </p>
  );
}

function TypingIndicator({ status }: { status: string }) {
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

// ─── Главный компонент ─────────────────────────────────────────────
export default function ChatTab({
  user, messages, input, typing, typingStatus, chatErr,
  attachedFile, fileUploading, totalLeft,
  onInputChange, onSend, onSendFile, onContinueChat,
  onFileSelect, onAttachClick, onClearFile,
  onPayClick, onGoToDocs, chatEndRef, fileInputRef,
}: ChatTabProps) {
  const lastAiIdx = messages.reduce((acc, m, i) => m.role === "ai" ? i : acc, -1);
  const animatedRef = useRef<number>(-1);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Неконтролируемый ref для textarea — решает проблему iOS Safari desync
  const nativeInputRef = useRef<HTMLTextAreaElement>(null);

  const shouldAnimate = useCallback((idx: number) => {
    if (idx !== lastAiIdx) return false;
    if (animatedRef.current === idx) return false;
    animatedRef.current = idx;
    return true;
  }, [lastAiIdx]);

  // Синхронизируем внешний input state → native textarea
  useEffect(() => {
    const el = nativeInputRef.current;
    if (!el) return;
    // Обновляем только если значение реально отличается (не трогаем при фокусе)
    if (el !== document.activeElement && el.value !== input) {
      el.value = input;
    }
  }, [input]);

  // Сброс textarea после отправки
  useEffect(() => {
    if (input === "" && nativeInputRef.current) {
      nativeInputRef.current.value = "";
      nativeInputRef.current.style.height = "44px";
    }
  }, [input]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const scrollToBottom = () => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  // Отправка — читаем из native ref, не из state
  const handleSend = () => {
    const text = nativeInputRef.current?.value?.trim() || input.trim();
    if (!text && !attachedFile) return;
    if (!nativeInputRef.current?.value?.trim() && input.trim()) {
      // state уже есть — просто отправляем
    } else if (nativeInputRef.current?.value?.trim()) {
      // Обновляем state из native ref перед отправкой
      onInputChange(nativeInputRef.current.value);
    }
    if (attachedFile) {
      onSendFile();
    } else {
      onSend();
    }
  };

  // Автовысота textarea
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // Обновляем React state
    onInputChange(el.value);
    // Авто-высота
    el.style.height = "44px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="max-w-3xl w-full mx-auto">

      {/* Скрытые file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" tabIndex={-1} onChange={onFileSelect} />
      <input id="camera-input" type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={onFileSelect} />

      {/* Шапка */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
              <Icon name="Scale" size={14} className="text-gold-400" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${typing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-800">AI-юрист</p>
            <p className="text-[11px] text-muted-foreground">{typing ? (typingStatus || "анализирует...") : "Онлайн · РФ"}</p>
          </div>
        </div>
        {user.isAdmin ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-medium">Админ</span>
        ) : totalLeft === 0 ? (
          <button onClick={onPayClick} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm">
            <Icon name="Plus" size={11} />100 ₽ · 3 вопр.
          </button>
        ) : (
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Icon name="MessageCircle" size={11} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">{user.paidQuestions} вопр.</span>
          </div>
        )}
      </div>

      {/* Лента сообщений — высота через CSS min/max, без svh/dvh */}
      <div className="relative">
        <div
          ref={messagesRef}
          onScroll={handleScroll}
          className="overflow-y-auto rounded-2xl border border-slate-200 shadow-sm bg-white scrollbar-hide"
          style={{ minHeight: "280px", maxHeight: "min(520px, 55vh)" }}
        >
          <div className="p-3 space-y-3">

            {messages.map((msg, i) => {
              const isDocRedir = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
              const doAnim = msg.role === "ai" && !typing && shouldAnimate(i);

              if (msg.role === "user") return (
                <div key={i} className="flex gap-2 justify-end items-end">
                  <div className="max-w-[82%]">
                    <div className="bg-navy-700 text-white rounded-2xl rounded-br-sm px-3 py-2.5 shadow-sm">
                      <p className="whitespace-pre-wrap font-golos" style={{ fontSize: "15px", lineHeight: "1.5" }}>{msg.text}</p>
                    </div>
                  </div>
                  <div className="w-7 h-7 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                    {user.name?.[0] ?? "U"}
                  </div>
                </div>
              );

              return (
                <div key={i} className="flex gap-2 items-start">
                  <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Icon name="Scale" size={13} className="text-gold-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-3 py-3 shadow-sm">
                      <AnimatedMessage text={msg.text} animate={doAnim} />
                      {isDocRedir && (
                        <button onClick={onGoToDocs} className="mt-3 flex items-center gap-2 px-3 py-2 bg-navy-700 text-white text-xs font-semibold rounded-xl w-full justify-center">
                          <Icon name="FileText" size={12} />Перейти в «Документы»
                        </button>
                      )}
                      {msg.truncated && i === lastAiIdx && !typing && (
                        <button onClick={() => onContinueChat(msg.text)} className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl w-full justify-center">
                          <Icon name="ChevronDown" size={12} />Читать дальше
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {typing && <TypingIndicator status={typingStatus || ""} />}

            {chatErr && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <Icon name="AlertCircle" size={12} className="shrink-0" />{chatErr}
              </div>
            )}

            <div ref={chatEndRef} className="h-1" />
          </div>
        </div>

        {/* Кнопка вниз */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full gradient-navy shadow-lg flex items-center justify-center"
            style={{ animation: "bounce 2s infinite" }}
          >
            <Icon name="ChevronDown" size={16} className="text-gold-400" />
          </button>
        )}
      </div>

      {/* Прикреплённый файл */}
      {attachedFile && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
              <Icon name={/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "Image" : "FileText"} size={13} className="text-navy-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy-800 truncate">{attachedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{attachedFile.size}</p>
            </div>
            <button onClick={onClearFile} className="p-1 text-muted-foreground hover:text-red-500">
              <Icon name="X" size={13} />
            </button>
          </div>
          {/\.(jpg|jpeg|png)$/i.test(attachedFile.name) && (
            <p className="text-[11px] text-amber-600 px-1">⚠ Фото должно быть чётким — плохое качество снизит точность AI</p>
          )}
        </div>
      )}

      {/* Поле ввода */}
      <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-end gap-1 px-2 py-2">

          {/* Прикрепить */}
          <button onClick={onAttachClick} disabled={typing || fileUploading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40 active:bg-slate-100">
            {fileUploading
              ? <span className="w-4 h-4 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
              : <Icon name="Paperclip" size={17} className={attachedFile ? "text-navy-600" : ""} />
            }
          </button>

          {/* Камера (мобайл) */}
          <button onClick={() => document.getElementById("camera-input")?.click()} disabled={typing || fileUploading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40 active:bg-slate-100 sm:hidden">
            <Icon name="Camera" size={17} />
          </button>

          {/*
            КРИТИЧНО: неконтролируемый textarea (без value prop) + ref
            Это единственный надёжный способ ввода на iOS Safari.
            value prop вызывает desync: iOS обновляет DOM, React перезаписывает → текст исчезает.
          */}
          <textarea
            ref={nativeInputRef}
            rows={1}
            defaultValue=""
            onInput={handleInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={typing}
            autoCorrect="on"
            autoCapitalize="sentences"
            placeholder={
              attachedFile ? "Вопрос к документу..." :
              (user.isAdmin || totalLeft > 0) ? "Опишите ситуацию или задайте вопрос..." :
              "Оплатите консультацию — 100 ₽ / 3 вопроса"
            }
            className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 outline-none resize-none py-2.5 font-golos"
            style={{ fontSize: "16px", lineHeight: "1.4", minHeight: "44px", maxHeight: "120px" }}
          />

          {/* Отправить */}
          <button
            onClick={handleSend}
            disabled={typing}
            className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-95 shadow-sm"
          >
            <Icon name="Send" size={14} className="text-white ml-0.5" />
          </button>
        </div>
        <div className="px-3 pb-1.5">
          <p className="text-[10px] text-slate-400">Ответы носят информационный характер</p>
        </div>
      </div>

    </div>
  );
}
