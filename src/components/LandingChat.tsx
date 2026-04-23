import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import LoginModal from "@/components/LoginModal";
import PaymentModal from "@/components/PaymentModal";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];

// ── Лимит: 3 бесплатных вопроса в день ───────────────────────────────────────
const DAILY_KEY = "landing_daily_questions";
const CHAT_HISTORY_KEY = "landing_chat_history";
interface DailyData { date: string; count: number }

function getTodayStr() {
  return new Date().toLocaleDateString("ru-RU");
}
function getDailyCount(): number {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return 0;
    const d: DailyData = JSON.parse(raw);
    if (d.date !== getTodayStr()) return 0;
    return d.count;
  } catch { return 0; }
}
function incrementDailyCount() {
  const count = getDailyCount() + 1;
  localStorage.setItem(DAILY_KEY, JSON.stringify({ date: getTodayStr(), count }));
  return count;
}

// Сохраняем контекст диалога чтобы после регистрации не потерять
function saveHistoryToStorage(hist: { role: string; content: string }[]) {
  try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(hist)); } catch { /* ignore */ }
}

const FREE_LIMIT = 3;

// Ключевые слова, по которым AI может предложить документ
const DOC_KEYWORDS = [
  "иск", "претензи", "жалоб", "заявлени", "договор", "апелляц", "кассаци",
  "ходатайств", "уведомлени", "суд", "взыскани", "возражени",
];

function detectDocSuggestion(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("исков")) return "claim";
  if (lower.includes("претензи")) return "pretension";
  if (lower.includes("апелляц")) return "appeal";
  if (lower.includes("кассаци")) return "cassation";
  if (lower.includes("жалоб")) return "complaint";
  if (lower.includes("договор")) return "contract";
  if (lower.includes("ходатайств") || lower.includes("заявлени")) return "application";
  if (lower.includes("уведомлени")) return "notification";
  // Общая проверка — если AI упоминает составление документа
  const hasDocKeyword = DOC_KEYWORDS.some(k => lower.includes(k));
  if (hasDocKeyword) return "claim";
  return null;
}

const DOC_LABELS: Record<string, string> = {
  claim: "Исковое заявление",
  pretension: "Претензию",
  complaint: "Жалобу",
  appeal: "Апелляционную жалобу",
  cassation: "Кассационную жалобу",
  contract: "Договор ГПХ",
  application: "Заявление / Ходатайство",
  notification: "Уведомление",
};

interface Message {
  role: "user" | "ai";
  text: string;
  typing?: boolean;
  suggestDocType?: string; // если AI предложил документ
}

interface LandingChatProps {
  onOpenLogin: (opts?: { freeTrial?: boolean; pendingTab?: string }) => void;
}

const DOC_TYPES = [
  { id: "claim", label: "Исковое заявление" },
  { id: "pretension", label: "Претензия" },
  { id: "complaint", label: "Жалоба" },
  { id: "appeal", label: "Апелляционная жалоба" },
  { id: "contract", label: "Договор ГПХ" },
  { id: "application", label: "Заявление / Ходатайство" },
];

export default function LandingChat({ onOpenLogin }: LandingChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Добрый день! Я AI-юрист. Задайте свой вопрос — я отвечу мгновенно и со ссылками на законодательство РФ.\n\n**3 вопроса в день — бесплатно** для всех.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [questionsLeft, setQuestionsLeft] = useState(FREE_LIMIT - getDailyCount());
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // scrollIntoView только внутри чат-контейнера, не страницы
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const history = useRef<{ role: string; content: string }[]>([]);
  const isFirstRender = useRef(true);

  // Скролл ТОЛЬКО внутри чат-бокса, не двигаем страницу
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const box = chatBoxRef.current;
    const end = chatEndRef.current;
    if (!box || !end) return;
    // scrollTop внутри контейнера — страница не трогается
    box.scrollTop = box.scrollHeight;
  }, [messages]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || typing) return;

    const used = getDailyCount();
    if (used >= FREE_LIMIT) {
      setMessages(p => [...p, {
        role: "ai",
        text: "Вы использовали 3 бесплатных вопроса на сегодня. Войдите в личный кабинет или приобретите пакет «Старт» — 30 вопросов + 5 документов за **990 ₽**.",
      }]);
      setShowPayment(true);
      return;
    }

    const newCount = incrementDailyCount();
    setQuestionsLeft(FREE_LIMIT - newCount);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setMessages(p => [...p, { role: "user", text: msgText }]);
    setTyping(true);
    setMessages(p => [...p, { role: "ai", text: "", typing: true }]);

    const newHist = [...history.current, { role: "user", content: msgText }];
    history.current = newHist;

    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: newHist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      const aiText = data.answer as string;
      const updatedHist = [...newHist, { role: "assistant", content: aiText }];
      history.current = updatedHist;
      // Сохраняем историю — понадобится после регистрации для генерации документа
      saveHistoryToStorage(updatedHist);

      // Определяем, предложить ли кнопку документа
      const suggestDocType = detectDocSuggestion(aiText);

      setMessages(p => {
        const next = p.filter(m => !m.typing);
        return [...next, { role: "ai", text: aiText, suggestDocType: suggestDocType ?? undefined }];
      });

      if (newCount >= FREE_LIMIT) {
        setTimeout(() => {
          setMessages(p => [...p, {
            role: "ai",
            text: "Это был ваш последний бесплатный вопрос на сегодня. Для продолжения — **войдите** или приобретите пакет «Старт» — 30 вопросов + 5 документов за **990 ₽**.",
          }]);
        }, 600);
      }
    } catch {
      setMessages(p => {
        const next = p.filter(m => !m.typing);
        return [...next, { role: "ai", text: "Произошла ошибка. Попробуйте ещё раз." }];
      });
    } finally {
      setTyping(false);
    }
  }, [input, typing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    e.target.value = "";
    setMessages(p => [...p, {
      role: "ai",
      text: "📎 Загрузка и анализ документов доступны в пакете **«Старт»** (990 ₽). Войдите или зарегистрируйтесь, чтобы получить доступ.",
    }]);
    setShowPayment(true);
  };

  // Нажатие «Создать документ» — сохраняем тип и историю, ведём к оплате/регистрации
  const handleCreateDoc = (docTypeId: string) => {
    setShowDocMenu(false);
    // Сохраняем тип документа и контекст диалога для кабинета
    localStorage.setItem("landing_pending_doc", docTypeId);
    saveHistoryToStorage(history.current);
    setPendingDocType(docTypeId);
    setShowPayment(true);
  };

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Чат */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Шапка */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)" }}>
              <Icon name="Scale" size={14} color="#e8a820" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">AI-юрист</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                Отвечает мгновенно · на основе законодательства РФ
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: questionsLeft > 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: questionsLeft > 0 ? "#4ade80" : "#f87171",
              border: `1px solid ${questionsLeft > 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: questionsLeft > 0 ? "#4ade80" : "#f87171" }} />
            {questionsLeft > 0 ? `${questionsLeft} из ${FREE_LIMIT} вопросов` : "Лимит исчерпан"}
          </div>
        </div>

        {/* Сообщения — overflow-y-auto только внутри блока */}
        <div
          ref={chatBoxRef}
          className="overflow-y-auto px-4 py-4 space-y-3"
          style={{ height: "clamp(300px, 40vh, 420px)" }}
        >
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "ai" && (
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}
                  >
                    <Icon name="Scale" size={11} color="#e8a820" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm"
                  }`}
                  style={
                    msg.role === "user"
                      ? { background: "linear-gradient(135deg, #162d5a, #0a1e3f)", border: "1px solid rgba(232,168,32,0.2)" }
                      : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }
                  }
                >
                  {msg.typing ? (
                    <div className="flex items-center gap-1 py-1">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ background: "#e8a820", animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                  )}
                </div>
              </div>

              {/* Кнопка «Создать документ» — появляется под ответом AI если детектирован тип */}
              {msg.role === "ai" && !msg.typing && msg.suggestDocType && (
                <div className="ml-9 mt-2">
                  <button
                    onClick={() => handleCreateDoc(msg.suggestDocType!)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: "linear-gradient(135deg, rgba(232,168,32,0.2), rgba(232,168,32,0.1))",
                      border: "1px solid rgba(232,168,32,0.35)",
                      color: "#f0c060",
                    }}
                  >
                    <Icon name="FileText" size={13} color="#f0c060" />
                    Создать {DOC_LABELS[msg.suggestDocType] ?? "документ"} · 600 ₽
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Блок действий при исчерпанном лимите */}
        {questionsLeft === 0 && !typing && (
          <div className="mx-4 mb-3 p-3 rounded-2xl"
            style={{ background: "rgba(232,168,32,0.08)", border: "1px solid rgba(232,168,32,0.2)" }}>
            <p className="text-xs text-center mb-2.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Получите полный доступ к AI-юристу
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onOpenLogin({ freeTrial: false })}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Войти в кабинет
              </button>
              <button
                onClick={() => setShowPayment(true)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)", color: "#0a1628" }}
              >
                Старт · 990 ₽
              </button>
            </div>
          </div>
        )}

        {/* Инпут */}
        <div className="border-t px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-end gap-2">
            {/* Скрепка */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
              title="Прикрепить документ (требует пакет)"
            >
              <Icon name="Paperclip" size={15} />
            </button>

            {/* Меню документов */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowDocMenu(v => !v)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
                title="Создать документ"
              >
                <Icon name="FileText" size={15} />
              </button>
              {showDocMenu && (
                <div
                  className="absolute bottom-12 left-0 rounded-2xl overflow-hidden shadow-2xl z-50 w-52"
                  style={{ background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-3 pb-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}>Создать документ</p>
                  {DOC_TYPES.map(dt => (
                    <button
                      key={dt.id}
                      onClick={() => handleCreateDoc(dt.id)}
                      className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder={
                questionsLeft > 0
                  ? "Опишите вашу ситуацию..."
                  : "Лимит исчерпан — войдите или купите пакет"
              }
              disabled={questionsLeft === 0 && messages.length > 1}
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none py-2.5 text-sm font-golos leading-snug"
              style={{ color: "rgba(255,255,255,0.9)", minHeight: "40px", maxHeight: "120px" }}
            />

            {/* Отправить */}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || typing || (questionsLeft === 0 && messages.length > 1)}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
              style={{
                background: input.trim() && !typing && questionsLeft > 0
                  ? "linear-gradient(135deg, #e8a820, #f0c060)"
                  : "rgba(255,255,255,0.06)",
                color: input.trim() && !typing && questionsLeft > 0 ? "#0a1628" : "rgba(255,255,255,0.3)",
              }}
            >
              <Icon name="Send" size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Кнопка живого юриста + PWA */}
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => onOpenLogin({ freeTrial: false, pendingTab: "expert" })}
          className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(232,168,32,0.15)" }}>
            <Icon name="UserCheck" size={13} color="#e8a820" />
          </div>
          <span>Консультация живого юриста</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(232,168,32,0.15)", color: "#f0c060" }}>
            990 ₽
          </span>
        </button>
        <PWAInstallButton />
      </div>

      <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        3 вопроса бесплатно каждый день · Без регистрации · Документы и анализ файлов — пакет «Старт» 990 ₽
      </p>

      <input ref={fileInputRef} type="file"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.heic,.webp"
        className="hidden" onChange={handleFileSelect} />

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => { setShowLogin(false); navigate("/cabinet"); }}
          freeTrial={false}
        />
      )}

      {showPayment && (
        <PaymentModal
          serviceType="plan_starter"
          serviceName="Пакет «Старт»"
          onClose={() => { setShowPayment(false); setPendingDocType(null); }}
          onSuccess={() => { setShowPayment(false); }}
          showRegisterPrompt={true}
          onRegisterAfterPay={() => {
            setShowPayment(false);
            onOpenLogin({ freeTrial: false, pendingTab: pendingDocType ? "docs" : "chat" });
          }}
        />
      )}
    </div>
  );
}

// ── PWA Install ───────────────────────────────────────────────────────────────
function PWAInstallButton() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hasPrompt = !!(window as unknown as Record<string, unknown>).__pwaPrompt;
    if (ios || hasPrompt) { setIsIOS(ios); setShow(true); }
  }, []);

  if (!show) return null;

  const handleClick = async () => {
    if (isIOS) { setShowGuide(true); return; }
    const prompt = (window as unknown as Record<string, unknown>).__pwaPrompt as { prompt: () => void } | undefined;
    prompt?.prompt();
  };

  return (
    <>
      <button onClick={handleClick}
        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm transition-all active:scale-[0.98] shrink-0"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
        title="Добавить на экран">
        <Icon name="Smartphone" size={15} />
        <span className="hidden sm:inline">Добавить на экран</span>
      </button>
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowGuide(false)}>
          <div className="w-full max-w-sm rounded-3xl p-5"
            style={{ background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <p className="font-bold text-white mb-3">Добавить на экран (iOS)</p>
            {["Нажмите кнопку «Поделиться» (□↑) внизу Safari", "Прокрутите и выберите «На экран Домой»", "Нажмите «Добавить»"].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(232,168,32,0.2)" }}>
                  <span className="text-[10px] font-bold" style={{ color: "#e8a820" }}>{i + 1}</span>
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{step}</p>
              </div>
            ))}
            <button onClick={() => setShowGuide(false)}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
