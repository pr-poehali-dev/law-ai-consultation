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

// ─── Рендер юридического текста ───────────────────────────────────
function LegalText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 font-golos">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n").filter(Boolean);
        if (!lines.length) return null;
        const sectionMatch = lines[0].match(/^(\d+)\.\s+([А-ЯA-ZЁ][А-ЯA-ZЁ\s/]{3,})(.*)/);
        if (sectionMatch) {
          return (
            <div key={pi} className="mt-4 first:mt-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-md bg-navy-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{sectionMatch[1]}</span>
                <span className="text-[12px] font-bold text-navy-700 uppercase tracking-wider">{sectionMatch[2]}{sectionMatch[3]}</span>
              </div>
              {lines.slice(1).map((l, li) => (
                <p key={li} className="text-[13.5px] text-navy-700 leading-[1.8] pl-7">{renderInline(l)}</p>
              ))}
            </div>
          );
        }
        if (lines.every(l => /^[-•·–]\s/.test(l))) {
          return (
            <ul key={pi} className="space-y-1.5 pl-1">
              {lines.map((l, li) => (
                <li key={li} className="flex items-start gap-2 text-[13.5px] text-navy-700 leading-[1.8]">
                  <span className="text-gold-500 font-bold mt-0.5 shrink-0 text-base leading-none">·</span>
                  <span>{renderInline(l.replace(/^[-•·–]\s/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (lines.length === 1 && /ст\.\s*\d+|статья\s+\d+/i.test(lines[0]) && lines[0].length < 150) {
          return (
            <div key={pi} className="flex items-start gap-2 bg-navy-50 border-l-2 border-navy-300 rounded-r-xl px-3 py-2">
              <Icon name="BookOpen" size={13} className="text-navy-400 mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-navy-600 font-medium leading-relaxed">{renderInline(lines[0])}</p>
            </div>
          );
        }
        return (
          <div key={pi} className="space-y-1">
            {lines.map((l, li) => (
              <p key={li} className="text-[13.5px] text-navy-700 leading-[1.8]">{renderInline(l)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|ст\.\s*\d+[\w.-]*(?:\s*ГК|ТК|СК|НК|КоАП|АПК|ГПК|КАС|УК)?(?:\s*РФ)?|статьи?\s+\d+[\w.-]*)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-navy-800">{part.slice(2, -2)}</strong>;
    if (/^(ст\.|статьи?)\s*\d+/i.test(part))
      return <span key={i} className="font-semibold text-navy-700 bg-gold-400/20 px-1 py-0.5 rounded text-[12.5px]">{part}</span>;
    return part;
  });
}

function AnimatedMessage({ text, animate }: { text: string; animate: boolean }) {
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  const [done, setDone] = useState(!animate);
  useEffect(() => {
    if (!animate) { setDisplayed(text); setDone(true); return; }
    setDisplayed(""); setDone(false);
    let i = 0;
    const tick = () => {
      if (i >= text.length) { setDone(true); return; }
      i += Math.min(5, text.length - i);
      setDisplayed(text.slice(0, i));
      setTimeout(tick, 16);
    };
    const t = setTimeout(tick, 80);
    return () => clearTimeout(t);
  }, [text, animate]);
  if (done) return <LegalText text={text} />;
  return (
    <div className="font-golos">
      <p className="text-[13.5px] text-navy-700 leading-[1.8] whitespace-pre-wrap">
        {displayed}
        <span className="inline-block w-0.5 h-4 bg-gold-500 ml-0.5 animate-pulse align-middle rounded-full" />
      </p>
    </div>
  );
}

function TypingIndicator({ status }: { status: string }) {
  return (
    <div className="flex gap-3 items-start animate-fade-in">
      <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Icon name="Scale" size={15} className="text-gold-400" />
      </div>
      <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm min-w-[180px]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
            <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
            <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
          </div>
          <span className="text-[12px] text-muted-foreground italic">{status || "анализирует..."}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────
export default function ChatTab({
  user, messages, input, typing, typingStatus, chatErr,
  attachedFile, fileUploading, totalLeft,
  onInputChange, onSend, onSendFile, onContinueChat,
  onFileSelect, onAttachClick, onClearFile,
  onPayClick, onGoToDocs, chatEndRef, fileInputRef,
}: ChatTabProps) {
  const lastAiIdx = messages.reduce((acc, m, i) => m.role === "ai" ? i : acc, -1);
  const animatedRef = useRef<number>(-1);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const shouldAnimate = useCallback((idx: number) => {
    if (idx !== lastAiIdx) return false;
    if (animatedRef.current === idx) return false;
    animatedRef.current = idx;
    return true;
  }, [lastAiIdx]);

  // Автовысота textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }, [input]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, chatEndRef]);

  // Кнопка "вниз" — появляется когда не на дне
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 100);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    /*
      Ключевое решение для мобильного iOS:
      - НЕ используем flex-stretch / height на контейнере чата
      - Лента сообщений: обычный overflow-y-auto с max-height через CSS var
      - Поле ввода: обычный блок НИЖЕ ленты (не sticky/fixed)
      - Это предотвращает схлопывание при открытии клавиатуры
    */
    <div className="max-w-3xl w-full mx-auto" style={{ paddingBottom: "4px" }}>

      {/* Скрытые inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" tabIndex={-1} onChange={onFileSelect} />
      <input id="camera-input" type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={onFileSelect} />

      {/* Шапка статуса */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
              <Icon name="Scale" size={14} className="text-gold-400" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${typing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-800">AI-юрист</p>
            <p className="text-[11px] text-muted-foreground leading-none">
              {typing && typingStatus ? typingStatus : typing ? "Анализирует..." : "Онлайн"}
            </p>
          </div>
        </div>
        <div>
          {user.isAdmin ? (
            <span className="text-xs px-2 py-1 rounded-xl font-medium bg-purple-50 text-purple-700">Админ</span>
          ) : totalLeft === 0 ? (
            <button onClick={onPayClick} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1">
              <Icon name="Plus" size={11} />100 ₽ · 3 вопр.
            </button>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Icon name="MessageCircle" size={11} className="text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">{user.paidQuestions}</span>
            </div>
          )}
        </div>
      </div>

      {/* Лента сообщений — фиксированная высота через CSS, без flex */}
      <div className="relative">
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="overflow-y-auto rounded-2xl border border-border shadow-sm bg-gradient-to-b from-slate-50/80 to-white scrollbar-hide"
          style={{ height: "clamp(300px, calc(100svh - 260px), 600px)" }}
        >
          <div className="p-3 sm:p-5 space-y-4">
            {messages.map((msg, i) => {
              const isDocRedirect = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
              const doAnimate = msg.role === "ai" && !typing && shouldAnimate(i);

              if (msg.role === "user") {
                return (
                  <div key={i} className="flex gap-2 justify-end items-end animate-fade-in">
                    <div className="max-w-[85%]">
                      <div className="bg-navy-700 text-white rounded-2xl rounded-br-sm px-3 py-2.5 shadow-sm">
                        <p className="leading-relaxed whitespace-pre-wrap font-golos" style={{ fontSize: "15px" }}>{msg.text}</p>
                      </div>
                      {msg.isFile && (
                        <p className="text-[11px] text-muted-foreground mt-1 text-right flex items-center justify-end gap-1">
                          <Icon name="Paperclip" size={10} />документ
                        </p>
                      )}
                    </div>
                    <div className="w-7 h-7 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase shadow-sm">
                      {user.name?.[0] ?? "U"}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="flex gap-2 items-start animate-fade-in">
                  <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Icon name="Scale" size={13} className="text-gold-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-3 shadow-sm">
                      <AnimatedMessage text={msg.text} animate={doAnimate} />
                      {isDocRedirect && (
                        <button onClick={onGoToDocs} className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-navy-700 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl w-full justify-center">
                          <Icon name="FileText" size={13} />Перейти в «Документы»
                        </button>
                      )}
                      {msg.truncated && i === lastAiIdx && !typing && (
                        <button onClick={() => onContinueChat(msg.text)} className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl w-full justify-center">
                          <Icon name="ChevronDown" size={13} />Читать дальше
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 ml-1">AI-юрист</p>
                  </div>
                </div>
              );
            })}

            {typing && <TypingIndicator status={typingStatus || ""} />}
            {chatErr && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <Icon name="AlertCircle" size={13} className="shrink-0" />{chatErr}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Кнопка прокрутки вниз */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full gradient-navy shadow-lg flex items-center justify-center animate-bounce-subtle"
            style={{ animation: "bounce 1.5s infinite" }}
          >
            <Icon name="ChevronDown" size={18} className="text-gold-400" />
          </button>
        )}
      </div>

      {/* Прикреплённый файл */}
      {attachedFile && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-xl animate-fade-in">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "bg-blue-100" : "bg-navy-100"}`}>
              <Icon name={/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "Image" : "FileText"} size={14} className={/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "text-blue-600" : "text-navy-600"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy-800 truncate">{attachedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{attachedFile.size}</p>
            </div>
            <button onClick={onClearFile} className="text-muted-foreground hover:text-red-500 p-1 rounded-lg">
              <Icon name="X" size={13} />
            </button>
          </div>
          {/\.(jpg|jpeg|png)$/i.test(attachedFile.name) && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Icon name="AlertCircle" size={12} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700">Фото должно быть чётким — плохое качество снизит точность AI</p>
            </div>
          )}
        </div>
      )}

      {/* Поле ввода — обычный блок, НЕ fixed/sticky */}
      <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-end gap-1.5 px-2.5 py-2">
          <button
            onClick={onAttachClick}
            disabled={typing || fileUploading}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            {fileUploading
              ? <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              : <Icon name="Paperclip" size={16} className={attachedFile ? "text-navy-600" : "text-slate-400"} />
            }
          </button>

          <button
            onClick={() => document.getElementById("camera-input")?.click()}
            disabled={typing || fileUploading}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center shrink-0 disabled:opacity-40 sm:hidden"
          >
            <Icon name="Camera" size={16} className="text-slate-400" />
          </button>

          {/*
            КРИТИЧНО для iOS: font-size ОБЯЗАН быть >= 16px через атрибут style
            Если меньше — iOS автозумирует страницу при фокусе → viewport прыгает → серый экран
          */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (attachedFile) onSendFile(); else onSend();
              }
            }}
            disabled={typing}
            autoCorrect="on"
            autoCapitalize="sentences"
            placeholder={
              attachedFile ? "Вопрос к документу..." :
              (user.isAdmin || totalLeft > 0) ? "Опишите ситуацию или задайте вопрос..." :
              "100 ₽ / 3 вопроса"
            }
            className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 outline-none resize-none py-2 font-golos disabled:opacity-50"
            style={{ fontSize: "16px", minHeight: "36px", maxHeight: "96px", lineHeight: "1.4" }}
          />

          <button
            onClick={attachedFile ? onSendFile : onSend}
            disabled={(!input.trim() && !attachedFile) || typing}
            className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-95"
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
