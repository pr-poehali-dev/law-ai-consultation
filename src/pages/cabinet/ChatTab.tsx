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

        // Нумерованный раздел: "1. ПРАВОВАЯ КВАЛИФИКАЦИЯ"
        const sectionMatch = lines[0].match(/^(\d+)\.\s+([А-ЯA-ZЁ][А-ЯA-ZЁ\s/]{3,})(.*)/);
        if (sectionMatch) {
          return (
            <div key={pi} className="mt-4 first:mt-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-md bg-navy-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {sectionMatch[1]}
                </span>
                <span className="text-[12px] font-bold text-navy-700 uppercase tracking-wider">
                  {sectionMatch[2]}{sectionMatch[3]}
                </span>
              </div>
              {lines.slice(1).map((l, li) => (
                <p key={li} className="text-[13.5px] text-navy-700 leading-[1.8] pl-7">
                  {renderInline(l)}
                </p>
              ))}
            </div>
          );
        }

        // Bullet / список
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

        // Строка со ссылкой на статью — выделяем блоком
        if (lines.length === 1 && /ст\.\s*\d+|статья\s+\d+/i.test(lines[0]) && lines[0].length < 150) {
          return (
            <div key={pi} className="flex items-start gap-2 bg-navy-50 border-l-2 border-navy-300 rounded-r-xl px-3 py-2">
              <Icon name="BookOpen" size={13} className="text-navy-400 mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-navy-600 font-medium leading-relaxed">{renderInline(lines[0])}</p>
            </div>
          );
        }

        // Обычный абзац
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
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-navy-800">{part.slice(2, -2)}</strong>;
    }
    if (/^(ст\.|статьи?)\s*\d+/i.test(part)) {
      return (
        <span key={i} className="font-semibold text-navy-700 bg-gold-400/20 px-1 py-0.5 rounded text-[12.5px]">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Плавный typewriter ───────────────────────────────────────────
function AnimatedMessage({ text, animate }: { text: string; animate: boolean }) {
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  const [done, setDone] = useState(!animate);

  useEffect(() => {
    if (!animate) { setDisplayed(text); setDone(true); return; }
    setDisplayed("");
    setDone(false);
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

// ─── Анимированный статус "AI думает" ────────────────────────────
function TypingIndicator({ status }: { status: string }) {
  return (
    <div className="flex gap-3 items-start animate-fade-in">
      <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Icon name="Scale" size={15} className="text-gold-400" />
      </div>
      <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm min-w-[220px]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
            <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
            <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
          </div>
          <span className="text-[12px] text-muted-foreground italic transition-all duration-500">
            {status || "анализирует..."}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────
export default function ChatTab({
  user,
  messages,
  input,
  typing,
  typingStatus,
  chatErr,
  attachedFile,
  fileUploading,
  totalLeft,
  onInputChange,
  onSend,
  onSendFile,
  onContinueChat,
  onFileSelect,
  onAttachClick,
  onClearFile,
  onPayClick,
  onGoToDocs,
  chatEndRef,
  fileInputRef,
}: ChatTabProps) {
  const lastAiIdx = messages.reduce((acc, m, i) => m.role === "ai" ? i : acc, -1);
  const animatedRef = useRef<number>(-1);

  const shouldAnimate = useCallback((idx: number) => {
    if (idx !== lastAiIdx) return false;
    if (animatedRef.current === idx) return false;
    animatedRef.current = idx;
    return true;
  }, [lastAiIdx]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100dvh - 120px)" }}>

      {/* Шапка статуса */}
      <div className="flex items-center justify-between mb-2 sm:mb-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
              <Icon name="Scale" size={16} className="text-gold-400" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${typing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-800">AI-юрист</p>
            <p className="text-[11px] text-muted-foreground">
              {typing && typingStatus ? typingStatus : typing ? "Анализирует запрос..." : "Онлайн · законодательство РФ"}
            </p>
          </div>
        </div>
        <div>
          {user.isAdmin ? (
            <span className="text-xs px-2.5 py-1 rounded-xl font-medium bg-purple-50 text-purple-700 border border-purple-100">Администратор</span>
          ) : totalLeft === 0 ? (
            <button onClick={onPayClick} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
              <Icon name="Plus" size={12} />100 ₽ / 3 вопроса
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Icon name="MessageCircle" size={12} className="text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">{user.paidQuestions} вопр.</span>
            </div>
          )}
        </div>
      </div>

      {/* Лента сообщений */}
      <div className="flex-1 overflow-y-auto rounded-2xl sm:rounded-3xl border border-border shadow-sm bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-5 space-y-4 sm:space-y-5 scrollbar-hide">
        {messages.map((msg, i) => {
          const isDocRedirect = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
          const doAnimate = msg.role === "ai" && !typing && shouldAnimate(i);

          if (msg.role === "user") {
            return (
              <div key={i} className="flex gap-2 sm:gap-3 justify-end items-end animate-fade-in">
                <div className="max-w-[85%] sm:max-w-[75%]">
                  <div className="bg-navy-700 text-white rounded-2xl rounded-br-sm px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
                    <p className="text-[13px] sm:text-[13.5px] leading-relaxed whitespace-pre-wrap font-golos">{msg.text}</p>
                  </div>
                  {msg.isFile && (
                    <p className="text-[11px] text-muted-foreground mt-1 text-right flex items-center justify-end gap-1">
                      <Icon name="Paperclip" size={10} />документ приложен
                    </p>
                  )}
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase shadow-sm">
                  {user.name?.[0] ?? "U"}
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex gap-2 sm:gap-3 items-start animate-fade-in">
              <div className="w-8 h-8 sm:w-9 sm:h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Icon name="Scale" size={14} className="text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-3 sm:px-5 py-3 sm:py-4 shadow-sm">
                  <AnimatedMessage text={msg.text} animate={doAnimate} />
                  {isDocRedirect && (
                    <button
                      onClick={onGoToDocs}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-navy-700 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl transition-all w-full justify-center shadow-sm hover:shadow-md"
                    >
                      <Icon name="FileText" size={14} />
                      Перейти в раздел «Документы»
                    </button>
                  )}
                  {/* Кнопка «Читать дальше» при обрыве ответа */}
                  {msg.truncated && i === lastAiIdx && !typing && (
                    <button
                      onClick={() => onContinueChat(msg.text)}
                      className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl transition-all w-full justify-center"
                    >
                      <Icon name="ChevronDown" size={14} />
                      Читать дальше
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/50 mt-1 ml-1">AI-юрист</p>
              </div>
            </div>
          );
        })}

        {typing && <TypingIndicator status={typingStatus || ""} />}
        <div ref={chatEndRef} />
      </div>

      {/* Ошибка */}
      {chatErr && (
        <div className="mt-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
          <Icon name="AlertCircle" size={13} className="shrink-0" />{chatErr}
        </div>
      )}

      {/* Прикреплённый файл */}
      {attachedFile && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5 bg-navy-50 border border-navy-200 rounded-2xl animate-fade-in">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "bg-blue-100" : "bg-navy-100"}`}>
              <Icon name={/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "Image" : "FileText"} size={15} className={/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "text-blue-600" : "text-navy-600"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy-800 truncate">{attachedFile.name}</p>
              <p className="text-[11px] text-muted-foreground">{attachedFile.size} · удалится через 30 мин</p>
            </div>
            <button onClick={onClearFile} className="text-muted-foreground hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
              <Icon name="X" size={13} />
            </button>
          </div>
          {/\.(jpg|jpeg|png)$/i.test(attachedFile.name) && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Icon name="AlertCircle" size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">Для качественного анализа фото должно быть чётким, текст читаемым. Плохое качество снизит точность AI.</p>
            </div>
          )}
        </div>
      )}

      {/* Поле ввода */}
      <div className="mt-2 sm:mt-3 bg-white border border-border rounded-2xl shadow-sm overflow-hidden focus-within:border-navy-300 focus-within:ring-2 focus-within:ring-navy-100 transition-all">
        {/* Скрытые input для файлов */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={onFileSelect}
        />
        {/* Отдельный инпут для камеры (capture=environment) */}
        <input
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileSelect}
        />

        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Кнопка прикрепить — раскрывает меню на мобиле */}
          <div className="relative shrink-0">
            <button
              onClick={onAttachClick}
              disabled={typing || fileUploading}
              title="Прикрепить файл"
              className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              {fileUploading
                ? <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                : <Icon name="Paperclip" size={17} className={attachedFile ? "text-navy-600" : "text-muted-foreground"} />
              }
            </button>
          </div>

          {/* Кнопка камеры — только на мобиле */}
          <button
            onClick={() => document.getElementById("camera-input")?.click()}
            disabled={typing || fileUploading}
            title="Сфотографировать документ"
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 sm:hidden"
          >
            <Icon name="Camera" size={17} className="text-muted-foreground" />
          </button>

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
            placeholder={
              attachedFile ? "Задайте вопрос к документу..." :
              (user.isAdmin || totalLeft > 0) ? "Опишите ситуацию или задайте вопрос..." :
              "Оплатите консультацию — 100 ₽ / 3 вопроса"
            }
            className="flex-1 bg-transparent text-[13.5px] text-navy-800 placeholder-muted-foreground outline-none resize-none py-1.5 leading-relaxed font-golos disabled:opacity-50"
            style={{ minHeight: "36px", maxHeight: "120px" }}
          />
          <button
            onClick={attachedFile ? onSendFile : onSend}
            disabled={(!input.trim() && !attachedFile) || typing}
            className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0 disabled:opacity-30 transition-all hover:shadow-md hover:scale-105 active:scale-95"
          >
            <Icon name="Send" size={15} className="text-white ml-0.5" />
          </button>
        </div>

        <div className="px-3 sm:px-4 pb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[10.5px] text-muted-foreground/60 hidden sm:block">Enter — отправить</p>
          <p className="text-[10px] sm:text-[10.5px] text-muted-foreground/60 text-right flex-1">Ответы носят информационный характер</p>
        </div>
      </div>
    </div>
  );
}