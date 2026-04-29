import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import LoginModal from "@/components/LoginModal";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import { getDailyFreeLeft, incrementDailyFreeCount, fetchSafe, getUser, lawyerSend } from "@/lib/auth";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocChoiceModal from "@/components/DocChoiceModal";
import {
  PENDING_DOC_KEY, PENDING_SERVICE_KEY, PENDING_TTL_MS,
  clearLandingPending, checkAndClearExpiredPending, saveHistoryToStorage,
  detectDocSuggestion, DOC_LABELS_MAP, type Message,
} from "@/components/landingChatUtils";
import LandingChatMessages from "@/components/LandingChatMessages";
import LandingChatInput from "@/components/LandingChatInput";
import { PWAInstallButton } from "@/components/LandingChatUpsell";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];

interface LandingChatProps {
  onOpenLogin: (opts?: { freeTrial?: boolean; pendingTab?: string }) => void;
}

export default function LandingChat({ onOpenLogin }: LandingChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Напишите, какой документ нужен (иск, претензия, договор), и я подготовлю его за 5 минут.\n\n**3 вопроса в день — бесплатно** для всех.",
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
  const [showExpertMaxOffer, setShowExpertMaxOffer] = useState(false);
  const [pendingLawyerMsg, setPendingLawyerMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const history = useRef<{ role: string; content: string }[]>([]);
  const isFirstRender = useRef(true);

  // При маунте — чистим устаревший pending если прошло > 30 мин
  useEffect(() => {
    checkAndClearExpiredPending();
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
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_SERVICE_KEY, "plan");
    setPendingDocType(null);
    setShowProOffer(true);
  };

  const handleSendToLawyer = useCallback(async (msgText: string) => {
    const user = await getUser();
    if (!user || !user.paidExpert) {
      setPendingLawyerMsg(msgText);
      setShowExpertMaxOffer(true);
      return;
    }
    const recentHistory = history.current.slice(-6);
    const chatSummary = recentHistory.map(m => `${m.role === "user" ? "Вопрос" : "Ответ AI"}: ${m.content}`).join("\n\n");
    await lawyerSend({
      body: "Прошу проверить ответ AI на мой вопрос.",
      attachment_type: "chat_answer",
      attachment_name: msgText.slice(0, 80) + (msgText.length > 80 ? "…" : ""),
      attachment_content: chatSummary || msgText,
    });
    // Перенаправляем в кабинет к разделу юрист
    saveHistoryToStorage(history.current);
    onOpenLogin({ freeTrial: false, pendingTab: "expert" });
  }, [onOpenLogin]);

  const handleExpertMaxSuccess = useCallback(async () => {
    setShowExpertMaxOffer(false);
    if (pendingLawyerMsg) {
      const recentHistory = history.current.slice(-6);
      const chatSummary = recentHistory.map(m => `${m.role === "user" ? "Вопрос" : "Ответ AI"}: ${m.content}`).join("\n\n");
      await lawyerSend({
        body: "Прошу проверить ответ AI на мой вопрос.",
        attachment_type: "chat_answer",
        attachment_name: pendingLawyerMsg.slice(0, 80) + (pendingLawyerMsg.length > 80 ? "…" : ""),
        attachment_content: chatSummary || pendingLawyerMsg,
      });
      setPendingLawyerMsg(null);
    }
    onOpenLogin({ freeTrial: false, pendingTab: "expert" });
  }, [pendingLawyerMsg, onOpenLogin]);

  const handleCreateDoc = (docTypeId: string) => {
    setShowDocMenu(false);
    setShowDocChoice({ docTypeId, docLabel: DOC_LABELS_MAP[docTypeId] || "документ" });
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    onOpenLogin({
      freeTrial: false,
      pendingTab: localStorage.getItem(PENDING_SERVICE_KEY) === "doc" ? "docs" : "chat",
    });
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
        <LandingChatMessages
          messages={messages}
          showUpsell={showUpsell}
          chatBoxRef={chatBoxRef}
          chatEndRef={chatEndRef}
          onCreateDoc={handleCreateDoc}
          onBuyPlan={openPlanPayment}
          onBuyDoc={() => setShowDocChoice({ docTypeId: "claim", docLabel: "документ" })}
          onLogin={() => onOpenLogin({ freeTrial: false })}
          onSendToLawyer={handleSendToLawyer}
        />

        {/* Инпут */}
        <LandingChatInput
          input={input}
          typing={typing}
          showUpsell={showUpsell}
          questionsLeft={questionsLeft}
          showDocMenu={showDocMenu}
          fileInputRef={fileInputRef}
          textareaRef={textareaRef}
          messagesLength={messages.length}
          onInputChange={setInput}
          onSend={() => sendMessage()}
          onKeyDown={handleKeyDown}
          onAttachClick={() => fileInputRef.current?.click()}
          onToggleDocMenu={() => setShowDocMenu(v => !v)}
          onCreateDoc={handleCreateDoc}
          onFileSelect={handleFileSelect}
        />
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

      {/* Социальные сети */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>Мы в соцсетях:</span>
        <a
          href="https://vk.ru/ai_pravorf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          <img src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/f966fdfe-7ab1-464e-bb46-e70bf162004e.jpg" alt="VK" className="w-4 h-4 rounded-full object-cover" />
          <span className="text-[11px] font-medium">ВКонтакте</span>
        </a>
        <a
          href="https://vk.com/away.php?to=https%3A%2F%2Fmax.ru%2Fjoin%2FzoHlcjX6QssCLMfhkcWj08KtE0Q_C4HQJhp6WdHNhbY&utf=1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          <img src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/4b6ec240-afc6-41c9-befd-87022247d412.jpg" alt="MAX" className="w-4 h-4 rounded-full object-cover" />
          <span className="text-[11px] font-medium">MAX</span>
        </a>
        <a
          href="https://vc.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>VC</span>
          <span className="text-[11px] font-medium">Читать на VC.ru</span>
        </a>
      </div>

      <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        3 вопроса бесплатно каждый день · Документы 600 ₽ · Пакет 30 вопросов + 5 документов за 990 ₽
      </p>

      {/* Модалки */}
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

      {showExpertMaxOffer && (
        <ExpertMaxOfferModal
          context="chat"
          onClose={() => { setShowExpertMaxOffer(false); setPendingLawyerMsg(null); }}
          onSuccess={handleExpertMaxSuccess}
        />
      )}
    </div>
  );
}