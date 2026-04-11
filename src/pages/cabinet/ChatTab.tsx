import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

export interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; }

interface ChatTabProps {
  user: User;
  messages: ChatMsg[];
  input: string;
  typing: boolean;
  chatErr: string;
  attachedFile: { name: string; b64: string; size: string } | null;
  fileUploading: boolean;
  totalLeft: number;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
  onClearFile: () => void;
  onPayClick: () => void;
  onGoToDocs: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

/** Рендер markdown-подобного текста юридического ответа */
function LegalText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Пустая строка — разрыв
    if (!line.trim()) { elements.push(<div key={i} className="h-2" />); i++; continue; }

    // Заголовки разделов (нумерованные или CAPS)
    const sectionMatch = line.match(/^(\d+)\.\s+([А-ЯA-Z\s/]{4,})(.*)/);
    if (sectionMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2.5 mt-4 first:mt-0">
          <div className="w-6 h-6 rounded-lg bg-navy-700 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {sectionMatch[1]}
          </div>
          <p className="font-semibold text-navy-800 text-[13.5px] leading-5 tracking-wide uppercase">
            {sectionMatch[2]}{sectionMatch[3]}
          </p>
        </div>
      );
      i++; continue;
    }

    // Пункты с тире или bullet
    if (/^[-•–]\s/.test(line)) {
      elements.push(
        <div key={i} className="flex items-start gap-2 ml-2">
          <span className="text-gold-500 font-bold mt-1 shrink-0">·</span>
          <p className="text-[13px] text-navy-700 leading-relaxed">{renderInline(line.replace(/^[-•–]\s/, ""))}</p>
        </div>
      );
      i++; continue;
    }

    // Ссылки на статьи (жирным)
    if (/ст\.\s*\d+|статья\s+\d+/i.test(line) && line.length < 120) {
      elements.push(
        <p key={i} className="text-[13px] text-navy-600 leading-relaxed font-medium bg-navy-50/60 rounded-lg px-3 py-1.5 border-l-2 border-navy-200">
          {renderInline(line)}
        </p>
      );
      i++; continue;
    }

    // Обычный абзац
    elements.push(
      <p key={i} className="text-[13.5px] text-navy-700 leading-[1.75] tracking-wide">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1.5 font-golos">{elements}</div>;
}

/** Выделяем **жирное**, ст. XXX, номера статей */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|ст\.\s*\d+[\w.-]*|статьи?\s+\d+[\w.-]*)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-navy-800">{part.slice(2, -2)}</strong>;
    }
    if (/^(ст\.|статьи?)/i.test(part)) {
      return <span key={i} className="font-semibold text-navy-700 bg-gold-400/15 px-1 rounded">{part}</span>;
    }
    return part;
  });
}

/** Плавный typewriter — посимвольно, но с переменной скоростью */
function AnimatedMessage({ text, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  const [done, setDone] = useState(!animate);

  useEffect(() => {
    if (!animate) { setDisplayed(text); setDone(true); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    // Переменная скорость: быстрее в середине, медленнее в начале/конце
    const tick = () => {
      if (i >= text.length) { setDone(true); onDone?.(); return; }
      const chunk = Math.min(3, text.length - i);
      i += chunk;
      setDisplayed(text.slice(0, i));
      setTimeout(tick, 18);
    };
    const t = setTimeout(tick, 120); // небольшая задержка перед стартом
    return () => clearTimeout(t);
  }, [text, animate, onDone]);

  if (done) return <LegalText text={text} />;
  return (
    <div className="space-y-1.5 font-golos">
      <p className="text-[13.5px] text-navy-700 leading-[1.75] whitespace-pre-wrap">
        {displayed}
        <span className="inline-block w-0.5 h-4 bg-gold-500 ml-0.5 animate-pulse align-middle" />
      </p>
    </div>
  );
}

export default function ChatTab({
  user,
  messages,
  input,
  typing,
  chatErr,
  attachedFile,
  fileUploading,
  totalLeft,
  onInputChange,
  onSend,
  onSendFile,
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
  // Авторесайз textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 140px)" }}>

      {/* ── Шапка статуса ── */}
      <div className="flex items-center justify-between mb-3 px-1">
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
              {typing ? "Анализирует ситуацию..." : "Онлайн · законодательство РФ"}
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

      {/* ── Лента сообщений ── */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-border shadow-sm bg-gradient-to-b from-slate-50/80 to-white p-5 space-y-5 scrollbar-hide">

        {messages.map((msg, i) => {
          const isDocRedirect = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
          const doAnimate = msg.role === "ai" && !typing && shouldAnimate(i);

          if (msg.role === "user") {
            return (
              <div key={i} className="flex gap-3 justify-end items-end animate-fade-in">
                <div className="max-w-[75%]">
                  <div className="bg-navy-700 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-golos">{msg.text}</p>
                  </div>
                  {msg.isFile && (
                    <p className="text-[11px] text-muted-foreground mt-1 text-right flex items-center justify-end gap-1">
                      <Icon name="Paperclip" size={10} />докум��нт приложен
                    </p>
                  )}
                </div>
                <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase shadow-sm">
                  {user.name?.[0] ?? "U"}
                </div>
              </div>
            );
          }

          // AI message
          return (
            <div key={i} className="flex gap-3 items-start animate-fade-in">
              <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Icon name="Scale" size={15} className="text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
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
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-1.5 ml-1">AI-юрист</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing && (
          <div className="flex gap-3 items-start animate-fade-in">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <Icon name="Scale" size={15} className="text-gold-400" />
            </div>
            <div className="bg-white border border-navy-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
                  <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
                  <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
                </div>
                <span className="text-xs text-muted-foreground italic">анализирует законодательство...</span>
              </div>
            </div>
          </div>
        )}
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
        <div className="mt-2 flex items-center gap-2.5 px-4 py-2.5 bg-navy-50 border border-navy-200 rounded-2xl">
          <div className="w-9 h-9 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="FileText" size={15} className="text-navy-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-navy-800 truncate">{attachedFile.name}</p>
            <p className="text-[11px] text-muted-foreground">{attachedFile.size} · удалится че��ез 30 мин</p>
          </div>
          <button onClick={onClearFile} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* ── Поле ввода ── */}
      <div className="mt-3 bg-white border border-border rounded-2xl shadow-sm overflow-hidden focus-within:border-navy-300 focus-within:ring-2 focus-within:ring-navy-100 transition-all">
        <div className="flex items-end gap-2 px-3 py-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={onFileSelect}
          />
          <button
            onClick={onAttachClick}
            disabled={typing || fileUploading}
            title="PDF, DOC, DOCX, JPEG, PNG · до 10 МБ"
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
          >
            {fileUploading
              ? <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full animate-pulse" />
              : <Icon name="Paperclip" size={17} className={attachedFile ? "text-navy-600" : "text-muted-foreground"} />
            }
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
              attachedFile ? "Задайте вопрос к докуме��ту или отправьте без вопроса..." :
              (user.isAdmin || totalLeft > 0) ? "Опишите вашу ситуацию или задайте вопрос..." :
              "Оп��атите консультацию — 100 ₽ за 3 вопроса"
            }
            className="flex-1 bg-transparent text-sm text-navy-800 placeholder-muted-foreground outline-none resize-none py-1.5 leading-relaxed font-golos disabled:opacity-50"
            style={{ minHeight: "36px", maxHeight: "140px" }}
          />
          <button
            onClick={attachedFile ? onSendFile : onSend}
            disabled={(!input.trim() && !attachedFile) || typing}
            className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0 disabled:opacity-30 transition-all hover:shadow-md hover:scale-105 active:scale-95"
          >
            <Icon name="Send" size={15} className="text-white ml-0.5" />
          </button>
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <p className="text-[10.5px] text-muted-foreground/70">
            Enter — отправить · Shift+Enter — новая строка
          </p>
          <p className="text-[10.5px] text-muted-foreground/70">
            Ответы носят информационный характер
          </p>
        </div>
      </div>
    </div>
  );
}