import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import LoginModal from "@/components/LoginModal";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import { getDailyFreeLeft, incrementDailyFreeCount, fetchSafe } from "@/lib/auth";
import DocChoiceModal from "@/components/DocChoiceModal";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];

// ── Контекст лендинга (история, pending) ─────────────────────────────────────
const CHAT_HISTORY_KEY = "landing_chat_history";
const PENDING_DOC_KEY = "landing_pending_doc";
const PENDING_SERVICE_KEY = "landing_pending_service";
const PENDING_TIMESTAMP_KEY = "landing_pending_ts";
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 минут

function clearLandingPending() {
  localStorage.removeItem(CHAT_HISTORY_KEY);
  localStorage.removeItem(PENDING_DOC_KEY);
  localStorage.removeItem(PENDING_SERVICE_KEY);
  localStorage.removeItem(PENDING_TIMESTAMP_KEY);
}

function checkAndClearExpiredPending() {
  const ts = localStorage.getItem(PENDING_TIMESTAMP_KEY);
  if (!ts) return;
  if (Date.now() - parseInt(ts, 10) > PENDING_TTL_MS) {
    clearLandingPending();
  }
}

function saveHistoryToStorage(hist: { role: string; content: string }[]) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(hist));
    localStorage.setItem(PENDING_TIMESTAMP_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

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
  const docKeywords = ["иск", "претензи", "жалоб", "заявлени", "договор", "апелляц", "кассаци", "ходатайств", "взыскани", "возражени"];
  if (docKeywords.some(k => lower.includes(k))) return "claim";
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
  suggestDocType?: string;
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

// ── Upsell-карточка после исчерпания лимита ───────────────────────────────────
function UpsellBlock({
  onBuyPlan,
  onBuyDoc,
  onLogin,
}: {
  onBuyPlan: () => void;
  onBuyDoc: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="flex gap-2 items-start mt-1">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}
      >
        <Icon name="Scale" size={11} color="#e8a820" />
      </div>

      <div
        className="flex-1 rounded-2xl rounded-tl-sm overflow-hidden"
        style={{ background: "linear-gradient(150deg, #0a1628 0%, #0e2040 100%)", border: "1px solid rgba(232,168,32,0.25)" }}
      >
        {/* Золотая линия */}
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f0c060 50%, #e8a820 70%, transparent)" }} />

        <div className="p-4">
          {/* Шапка */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)" }}>
              <Icon name="Zap" size={13} color="#e8a820" />
            </div>
            <p className="text-sm font-bold text-white">Бесплатные вопросы использованы</p>
          </div>

          <p className="text-xs mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            Продолжите работу с AI-юристом — выберите удобный вариант:
          </p>

          {/* Пакет Старт */}
          <button
            onClick={onBuyPlan}
            className="w-full rounded-xl mb-2 transition-all active:scale-[0.98]"
            style={{ padding: "11px 14px", background: "linear-gradient(135deg, #e8a820, #f0c060)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(10,22,40,0.2)" }}>
                  <Icon name="Crown" size={12} color="#0a1628" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-navy-900 leading-tight">Пакет «Старт» · 30 вопросов</p>
                  <p className="text-[10px]" style={{ color: "rgba(10,22,40,0.6)" }}>+ 5 документов · анализ PDF</p>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-black text-navy-900">990</span>
                <span className="text-[11px] font-semibold" style={{ color: "rgba(10,22,40,0.7)" }}>₽</span>
              </div>
            </div>
          </button>

          {/* Один документ */}
          <button
            onClick={onBuyDoc}
            className="w-full rounded-xl mb-2 transition-all active:scale-[0.98]"
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Icon name="FileText" size={12} color="#a0b4cc" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.9)" }}>Создать один документ</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Иск, претензия, жалоба или договор</p>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-bold" style={{ color: "#f0c060" }}>600</span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>₽</span>
              </div>
            </div>
          </button>

          {/* Войти */}
          <button
            onClick={onLogin}
            className="w-full rounded-xl text-xs font-semibold py-2 transition-all"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Уже есть аккаунт? Войти →
          </button>

          <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const [questionsLeft, setQuestionsLeft] = useState(getDailyFreeLeft());
  const [showUpsell, setShowUpsell] = useState(getDailyFreeLeft() === 0);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showDocChoice, setShowDocChoice] = useState<{ docTypeId: string; docLabel: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProOffer, setShowProOffer] = useState(false);
  const [paymentService, setPaymentService] = useState<{ type: ServiceType; name: string }>({ type: "plan_pro", name: "Тариф «Профи»" });
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const history = useRef<{ role: string; content: string }[]>([]);
  const isFirstRender = useRef(true);

  // При маунте — чистим устаревший pending если прошло > 30 мин
  useEffect(() => {
    checkAndClearExpiredPending();
    // Таймер — очистка через 30 минут если пользователь остался на странице
    const timer = setTimeout(() => clearLandingPending(), PENDING_TTL_MS);
    return () => clearTimeout(timer);
  }, []);

  // Скролл только внутри чат-бокса
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const box = chatBoxRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [messages]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const openPlanPayment = useCallback(() => {
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_SERVICE_KEY, "plan");
    setPaymentService({ type: "plan_starter", name: "Пакет «Старт»" });
    setPendingDocType(null);
    setShowPayment(true);
  }, []);

  const openDocPayment = useCallback((docTypeId?: string) => {
    const dt = docTypeId || "claim";
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_DOC_KEY, dt);
    localStorage.setItem(PENDING_SERVICE_KEY, "doc");
    setPaymentService({ type: "document", name: "Юридический документ" });
    setPendingDocType(dt);
    setShowPayment(true);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || typing) return;

    if (getDailyFreeLeft() === 0) {
      setShowUpsell(true);
      return;
    }

    incrementDailyFreeCount();
    setQuestionsLeft(getDailyFreeLeft());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setMessages(p => [...p, { role: "user", text: msgText }]);
    setTyping(true);
    setMessages(p => [...p, { role: "ai", text: "", typing: true }]);

    const newHist = [...history.current, { role: "user", content: msgText }];
    history.current = newHist;

    try {
      const res = await fetchSafe(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: newHist }),
      }, 90_000, 1);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      const aiText = data.answer as string;
      const updatedHist = [...newHist, { role: "assistant", content: aiText }];
      history.current = updatedHist;
      saveHistoryToStorage(updatedHist);

      const suggestDocType = detectDocSuggestion(aiText);

      setMessages(p => {
        const next = p.filter(m => !m.typing);
        return [...next, { role: "ai", text: aiText, suggestDocType: suggestDocType ?? undefined }];
      });

      // После последнего бесплатного — показываем upsell-блок
      if (getDailyFreeLeft() === 0) {
        setTimeout(() => setShowUpsell(true), 800);
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
    // Анализ файлов — только с тарифа «Профи»
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_SERVICE_KEY, "plan");
    setPendingDocType(null);
    setShowProOffer(true);
  };

  const handleCreateDoc = (docTypeId: string) => {
    setShowDocMenu(false);
    // Показываем выбор: 1 документ 600р vs пакет Старт 990р
    const DOC_LABELS_MAP: Record<string, string> = {
      claim: "Исковое заявление", pretension: "Претензию", complaint: "Жалобу",
      appeal: "Апелляционную жалобу", cassation: "Кассационную жалобу",
      contract: "Договор ГПХ", application: "Заявление / Ходатайство", notification: "Уведомление",
    };
    setShowDocChoice({ docTypeId, docLabel: DOC_LABELS_MAP[docTypeId] || "документ" });
  };

  // После успешной оплаты — переходим к регистрации, данные сохранены
  const handlePaymentSuccess = () => {
    setShowPayment(false);
    // Открываем регистрацию — после неё кабинет подхватит контекст
    onOpenLogin({
      freeTrial: false,
      pendingTab: localStorage.getItem(PENDING_SERVICE_KEY) === "doc" ? "docs" : "chat",
    });
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
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)" }}>
              <Icon name="Scale" size={14} color="#e8a820" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">AI-юрист</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Отвечает мгновенно · на основе законодательства РФ</p>
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
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: questionsLeft > 0 ? "#4ade80" : "#f87171" }} />
            {questionsLeft > 0 ? `${questionsLeft} из 3 вопросов` : "Лимит исчерпан"}
          </div>
        </div>

        {/* Сообщения */}
        <div
          ref={chatBoxRef}
          className="overflow-y-auto px-4 py-4 space-y-3"
          style={{ height: "clamp(280px, 38vh, 440px)" }}
        >
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "ai" && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}>
                    <Icon name="Scale" size={11} color="#e8a820" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm"}`}
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

              {/* Кнопка создать документ под ответом AI */}
              {msg.role === "ai" && !msg.typing && msg.suggestDocType && (
                <div className="ml-9 mt-2">
                  <button
                    onClick={() => handleCreateDoc(msg.suggestDocType!)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: "linear-gradient(135deg, rgba(232,168,32,0.18), rgba(232,168,32,0.08))",
                      border: "1px solid rgba(232,168,32,0.3)",
                      color: "#f0c060",
                    }}
                  >
                    <Icon name="FileText" size={13} color="#f0c060" />
                    Создать {DOC_LABELS[msg.suggestDocType] ?? "документ"}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Upsell-блок после исчерпания лимита */}
          {showUpsell && (
            <UpsellBlock
              onBuyPlan={openPlanPayment}
              onBuyDoc={() => setShowDocChoice({ docTypeId: "claim", docLabel: "документ" })}
              onLogin={() => onOpenLogin({ freeTrial: false })}
            />
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Инпут */}
        <div className="border-t px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-end gap-2">
            {/* Скрепка */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
              title="Анализ документа — тариф «Профи»"
            >
              <Icon name="Paperclip" size={15} />
            </button>

            {/* Меню документов */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowDocMenu(v => !v)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
                title="Создать документ — 600 ₽"
              >
                <Icon name="FileText" size={15} />
              </button>
              {showDocMenu && (
                <div
                  className="absolute bottom-12 left-0 rounded-2xl overflow-hidden shadow-2xl z-50 w-52"
                  style={{ background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-3 pb-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}>Создать документ · 600 ₽</p>
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
              placeholder={questionsLeft > 0 ? "Опишите вашу ситуацию..." : "Выберите вариант продолжения выше"}
              disabled={showUpsell || (questionsLeft === 0 && messages.length > 1)}
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none py-2.5 text-sm font-golos leading-snug"
              style={{ color: "rgba(255,255,255,0.9)", minHeight: "40px", maxHeight: "120px" }}
            />

            {/* Отправить */}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || typing || showUpsell}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
              style={{
                background: input.trim() && !typing && !showUpsell
                  ? "linear-gradient(135deg, #e8a820, #f0c060)"
                  : "rgba(255,255,255,0.06)",
                color: input.trim() && !typing && !showUpsell ? "#0a1628" : "rgba(255,255,255,0.3)",
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
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
        >
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(232,168,32,0.15)" }}>
            <Icon name="UserCheck" size={13} color="#e8a820" />
          </div>
          <span>Консультация живого юриста</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(232,168,32,0.15)", color: "#f0c060" }}>990 ₽</span>
        </button>
        <PWAInstallButton />
      </div>

      <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        3 вопроса бесплатно каждый день · Документы 600 ₽ · Пакет 30 вопросов + 5 документов за 990 ₽
      </p>

      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.heic,.webp" className="hidden" onChange={handleFileSelect} />

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => { setShowLogin(false); navigate("/cabinet"); }}
          freeTrial={false}
        />
      )}

      {showProOffer && (
        <ExpertOfferModal
          onClose={() => setShowProOffer(false)}
          onSelectOffer={(type, name) => {
            setShowProOffer(false);
            setPaymentService({ type, name });
            setShowPayment(true);
          }}
          mode="pro"
        />
      )}

      {showPayment && (
        <PaymentModal
          serviceType={paymentService.type}
          serviceName={paymentService.name}
          onClose={() => { setShowPayment(false); setPendingDocType(null); }}
          onSuccess={handlePaymentSuccess}
          showRegisterPrompt={true}
          onRegisterAfterPay={handlePaymentSuccess}
        />
      )}

      {showDocChoice && (
        <DocChoiceModal
          docLabel={showDocChoice.docLabel}
          onChooseDoc={() => {
            const dtId = showDocChoice.docTypeId;
            setShowDocChoice(null);
            openDocPayment(dtId);
          }}
          onChoosePlan={() => {
            const dtId = showDocChoice.docTypeId;
            setShowDocChoice(null);
            saveHistoryToStorage(history.current);
            localStorage.setItem(PENDING_DOC_KEY, dtId);
            localStorage.setItem(PENDING_SERVICE_KEY, "plan");
            setPaymentService({ type: "plan_starter", name: "Пакет «Старт»" });
            setPendingDocType(dtId);
            setShowPayment(true);
          }}
          onClose={() => setShowDocChoice(null)}
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
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
        <Icon name="Smartphone" size={15} />
        <span className="hidden sm:inline">Приложение</span>
      </button>
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowGuide(false)}>
          <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()}>
            <p className="font-bold text-white mb-3">Добавить на экран (iOS)</p>
            {["Нажмите «Поделиться» (□↑) внизу Safari", "Прокрутите и выберите «На экран Домой»", "Нажмите «Добавить»"].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(232,168,32,0.2)" }}>
                  <span className="text-[10px] font-bold" style={{ color: "#e8a820" }}>{i + 1}</span>
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{step}</p>
              </div>
            ))}
            <button onClick={() => setShowGuide(false)} className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>Понятно</button>
          </div>
        </div>
      )}
    </>
  );
}