import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import LoginModal from "@/components/LoginModal";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import DocAnalysisPaywall from "@/components/DocAnalysisPaywall";
import { getDailyFreeLeft, incrementDailyFreeCount, fetchSafe, getUser, lawyerSend } from "@/lib/auth";
import { getCachedAnswer, setCachedAnswer } from "@/lib/chatCache";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocChoiceModal from "@/components/DocChoiceModal";
import {
  PENDING_DOC_KEY, PENDING_SERVICE_KEY, PENDING_TTL_MS, PENDING_FILE_KEY,
  clearLandingPending, checkAndClearExpiredPending, saveHistoryToStorage,
  detectDocSuggestion, DOC_LABELS_MAP, type Message,
} from "@/components/landingChatUtils";
import LandingChatMessages from "@/components/LandingChatMessages";
import LandingChatInput from "@/components/LandingChatInput";
import { PWAInstallButton } from "@/components/LandingChatUpsell";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-chat"];

interface LandingChatProps {
  onOpenLogin: (opts?: { freeTrial?: boolean; pendingTab?: string }) => void;
}

export default function LandingChat({ onOpenLogin }: LandingChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Укажите, какой документ нужен (иск, претензия, договор, возражение и т.п.), и искусственный интеллект подготовит его за 5 минут.\n\nСтоимость создания 1 документа — **990 рублей**.\n\nНачиная с пакета «Старт» доступна отправка сгенерированного документа на проверку живому юристу с доступом к чату.\n\nЧем детальнее вы опишете ситуацию — тем качественнее получится документ.\n\n**3 вопроса в день к AI-юристу — бесплатно** для всех!",
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
  const [showDocAnalysisPaywall, setShowDocAnalysisPaywall] = useState(false);
  const [paymentService, setPaymentService] = useState<{ type: ServiceType; name: string }>({ type: "plan_pro", name: "Тариф «Профи»" });
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const [showExpertMaxOffer, setShowExpertMaxOffer] = useState(false);
  const [pendingLawyerMsg, setPendingLawyerMsg] = useState<string | null>(null);
  // Прикреплённый файл для анализа
  const [attachedFile, setAttachedFile] = useState<{ name: string; b64: string } | null>(null);
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

  const openQuickQuestionsPayment = useCallback(() => {
    // Сохраняем историю диалога — кабинет подхватит и покажет её в чате
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_SERVICE_KEY, "quick_questions");
    setPaymentService({ type: "quick_questions", name: "+3 вопроса AI-юристу" });
    setPendingDocType(null);
    setShowPayment(true);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || typing) return;

    // Если есть прикреплённый файл — показываем paywall анализа
    if (attachedFile) {
      setShowDocAnalysisPaywall(true);
      return;
    }

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
      // Проверяем кэш перед запросом к AI (5 минут TTL)
      const cached = getCachedAnswer(newHist);
      let aiText: string;
      if (cached) {
        aiText = cached.answer;
      } else {
        const res = await fetchSafe(GIGACHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat", messages: newHist }),
        }, 90_000, 1);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка");
        aiText = data.answer as string;
        setCachedAnswer(newHist, aiText, !!(data.truncated), !!(data.needs_expert));
      }
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
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    // Читаем файл в base64 и сохраняем в state — модалка появится позже при нажатии «Отправить»
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setAttachedFile({ name: file.name, b64 });
    };
    reader.readAsDataURL(file);
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

  // Запускает оплату анализа документа (разовый 99₽ или Профи)
  const openDocAnalysisPayment = useCallback((serviceType: ServiceType, serviceName: string) => {
    if (!attachedFile) return;
    setShowDocAnalysisPaywall(false);
    // Сохраняем файл и запрос в localStorage — подхватим в кабинете после оплаты
    try {
      localStorage.setItem(PENDING_FILE_KEY, JSON.stringify({ name: attachedFile.name, b64: attachedFile.b64, comment: input.trim() }));
      localStorage.setItem(PENDING_SERVICE_KEY, "file_analysis");
      localStorage.setItem("landing_pending_ts", String(Date.now()));
    } catch { /* ignore quota */ }
    saveHistoryToStorage(history.current);
    setPaymentService({ type: serviceType, name: serviceName });
    setShowPayment(true);
  }, [attachedFile, input]);

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    const pendingService = localStorage.getItem(PENDING_SERVICE_KEY);
    if (pendingService === "file_analysis" || pendingService === "quick_questions") {
      navigate("/cabinet?from=payment&tab=chat");
    } else {
      navigate("/cabinet?from=payment&tab=" + (pendingService === "doc" ? "docs" : "docs"));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Чат */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "#ffffff",
          boxShadow: "0 32px 80px rgba(10,22,40,0.55), 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{
            background: "linear-gradient(135deg, #060e1f 0%, #0d2348 60%, #152d5c 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(145deg, #1a3a6b, #0c1f40)",
                  border: "1px solid rgba(232,168,32,0.35)",
                  boxShadow: "0 0 16px rgba(232,168,32,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}>
                <Icon name="Scale" size={15} color="#e8a820" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ background: "#22c55e", border: "2px solid #060e1f", boxShadow: "0 0 6px rgba(34,197,94,0.6)" }} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">AI-юрист</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.01em" }}>законодательство РФ · онлайн</p>
            </div>
          </div>
          {questionsLeft > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.18)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
              <span className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>1 вопрос бесплатно</span>
            </div>
          )}
        </div>

        {/* Сообщения */}
        <LandingChatMessages
          messages={messages}
          showUpsell={showUpsell}
          chatBoxRef={chatBoxRef}
          chatEndRef={chatEndRef}
          onCreateDoc={handleCreateDoc}
          onBuyPlan={openPlanPayment}
          onBuyQuickQuestions={openQuickQuestionsPayment}
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
          attachedFile={attachedFile}
          onInputChange={setInput}
          onSend={() => sendMessage()}
          onKeyDown={handleKeyDown}
          onAttachClick={() => setShowDocAnalysisPaywall(true)}
          onToggleDocMenu={() => setShowDocMenu(v => !v)}
          onCreateDoc={handleCreateDoc}
          onFileSelect={handleFileSelect}
          onRemoveFile={() => setAttachedFile(null)}
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
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>Мы в соцсетях:</span>
        <div className="flex items-center gap-2 flex-wrap justify-center">
        <a
          href="https://vk.ru/ai_pravorf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 active:scale-95"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          <img src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/f966fdfe-7ab1-464e-bb46-e70bf162004e.jpg" alt="VK" className="w-5 h-5 rounded-full object-cover shrink-0" />
          <span className="text-xs font-medium">ВКонтакте</span>
        </a>
        <a
          href="https://vk.com/away.php?to=https%3A%2F%2Fmax.ru%2Fjoin%2FzoHlcjX6QssCLMfhkcWj08KtE0Q_C4HQJhp6WdHNhbY&utf=1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 active:scale-95"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          <img src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/4b6ec240-afc6-41c9-befd-87022247d412.jpg" alt="MAX" className="w-5 h-5 rounded-full object-cover shrink-0" />
          <span className="text-xs font-medium">MAX</span>
        </a>
        <a
          href="https://dzen.ru/jurist_ai?share_to=link"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 active:scale-95"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          <span className="text-xs font-bold shrink-0 text-yellow-300" style={{ color: "rgba(255,82,82,0.9)" }}>Д</span>
          <span className="text-xs font-medium">Читать на Дзен</span>
        </a>
        </div>
      </div>

      <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>3 вопроса бесплатно каждый день · Документ 990 ₽ · Пакет 30 вопросов + 5 документов за 1490 ₽</p>

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
          onChoosePlan={(planId) => {
            const dtId = showDocChoice.docTypeId;
            setShowDocChoice(null);
            saveHistoryToStorage(history.current);
            localStorage.setItem(PENDING_DOC_KEY, dtId);
            localStorage.setItem(PENDING_SERVICE_KEY, "plan");
            const id = (planId || "plan_starter") as ServiceType;
            const nameMap: Record<string, string> = {
              plan_starter: "Тариф «Старт»",
              plan_pro: "Тариф «Профи»",
              plan_max: "Тариф «Максимум»",
            };
            setPaymentService({ type: id, name: nameMap[id] || "Тариф" });
            setPendingDocType(dtId);
            setShowPayment(true);
          }}
          onClose={() => setShowDocChoice(null)}
          onLoginClick={() => { setShowDocChoice(null); setShowLogin(true); }}
        />
      )}

      {showExpertMaxOffer && (
        <ExpertMaxOfferModal
          context="chat"
          onClose={() => { setShowExpertMaxOffer(false); setPendingLawyerMsg(null); }}
          onSuccess={handleExpertMaxSuccess}
        />
      )}

      {showDocAnalysisPaywall && (
        <DocAnalysisPaywall
          onChoosePro={() => openDocAnalysisPayment("plan_pro", "Тариф «Профи»")}
          onChooseMax={() => openDocAnalysisPayment("plan_max", "Тариф «Максимум»")}
          onClose={() => setShowDocAnalysisPaywall(false)}
        />
      )}
    </div>
  );
}