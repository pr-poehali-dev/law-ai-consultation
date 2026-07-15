import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import func2url from "../../backend/func2url.json";
import { fetchSafe, getUser, lawyerSend } from "@/lib/auth";
import { type ServiceType } from "@/components/PaymentModal";
import { type DocAttachedFile } from "@/components/DocDetailsModal";
import { DOC_BLOCKS } from "@/pages/cabinet/docBlocks";
import {
  PENDING_DOC_KEY, PENDING_SERVICE_KEY, PENDING_TTL_MS, PENDING_FILE_KEY,
  clearLandingPending, checkAndClearExpiredPending, saveHistoryToStorage,
  saveChatMessages,
  detectDocSuggestion, DOC_LABELS_MAP, type Message,
  getSessionQuestionsLeft, incrementSessionCount, resetSessionCount,
} from "@/components/landingChatUtils";
import LandingChatMessages from "@/components/LandingChatMessages";
import LandingChatInput from "@/components/LandingChatInput";
import LandingChatHeader from "@/components/LandingChatHeader";
import LandingChatFooter from "@/components/LandingChatFooter";
import LandingChatModals from "@/components/LandingChatModals";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-chat"];

interface LandingChatProps {
  onOpenLogin: (opts?: { freeTrial?: boolean; pendingTab?: string }) => void;
}

const WELCOME_MESSAGE: Message = {
  role: "ai",
  text: "Укажите, какой документ нужен (иск, претензия, договор, возражение и т.п.), и искусственный интеллект подготовит его за 5 минут.\n\nСтоимость создания 1 документа — **590 рублей**.\n\nНачиная с пакета «Старт» доступна отправка сгенерированного документа на проверку живому юристу с доступом к чату.\n\nЧем детальнее вы опишете ситуацию — тем качественнее получится документ.",
};

export default function LandingChat({ onOpenLogin }: LandingChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sessionLeft, setSessionLeft] = useState(getSessionQuestionsLeft());
  const [landingStep, setLandingStep] = useState(1);
  const [showUpsell] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showDocChoice, setShowDocChoice] = useState<{ docTypeId: string; docLabel: string } | null>(null);
  const [showDocDetails, setShowDocDetails] = useState<{ docTypeId: string; docLabel: string; query: string } | null>(null);
  const [docDetailsData, setDocDetailsData] = useState<{ query: string; comment: string; files: DocAttachedFile[] } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProOffer, setShowProOffer] = useState(false);
  const [showDocAnalysisPaywall, setShowDocAnalysisPaywall] = useState(false);
  const [paymentService, setPaymentService] = useState<{ type: ServiceType; name: string }>({ type: "plan_pro", name: "Тариф «Профи»" });
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const [showExpertMaxOffer, setShowExpertMaxOffer] = useState(false);
  const [pendingLawyerMsg, setPendingLawyerMsg] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; b64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const history = useRef<{ role: string; content: string }[]>([]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    resetSessionCount();
    setSessionLeft(getSessionQuestionsLeft());
  }, []);

  useEffect(() => {
    checkAndClearExpiredPending();
    const timer = setTimeout(() => clearLandingPending(), PENDING_TTL_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (messages.length > 1) saveChatMessages(messages);
  }, [messages]);

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

  const openDocPayment = useCallback((docTypeId?: string, details?: { query: string; comment: string; files?: DocAttachedFile[] }) => {
    const dt = docTypeId || "claim";
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_DOC_KEY, dt);
    localStorage.setItem(PENDING_SERVICE_KEY, "doc");
    if (details) {
      const combined = details.comment
        ? `${details.query}\n\n[Дополнения от пользователя]:\n${details.comment}`
        : details.query;
      localStorage.setItem("landing_pending_doc_details", combined);
      if (details.files && details.files.length > 0) {
        try {
          localStorage.setItem("landing_pending_doc_files", JSON.stringify(
            details.files.map(f => ({ name: f.name, b64: f.b64 }))
          ));
        } catch { /* quota */ }
      } else {
        localStorage.removeItem("landing_pending_doc_files");
      }
    }
    localStorage.setItem("landing_pending_ts", String(Date.now()));
    setPaymentService({ type: "document", name: "Юридический документ" });
    setPendingDocType(dt);
    setShowPayment(true);
  }, []);

  const openQuickQuestionsPayment = useCallback(() => {
    saveHistoryToStorage(history.current);
    localStorage.setItem(PENDING_SERVICE_KEY, "quick_questions");
    setPaymentService({ type: "quick_questions", name: "+3 вопроса AI-юристу" });
    setPendingDocType(null);
    setShowPayment(true);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || typing) return;
    if (getSessionQuestionsLeft() === 0) return;

    incrementSessionCount();
    setSessionLeft(getSessionQuestionsLeft());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setMessages(p => [...p, { role: "user", text: msgText }]);
    setTyping(true);
    setMessages(p => [...p, { role: "ai", text: "", typing: true }]);

    const currentStep = landingStep;
    const trimmedHist = history.current.slice(-4);
    const newHist = [...trimmedHist, { role: "user", content: msgText }];
    history.current = [...history.current, { role: "user", content: msgText }];

    try {
      const res = await fetchSafe(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "landing_chat", messages: newHist, step: currentStep }),
      }, 90_000, 1);
      if (!res.ok) {
        let errMsg = "Ошибка сервера";
        try { const d = await res.json(); errMsg = d.error || errMsg; } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      const data = await res.json();
      const aiText = data.answer as string;
      const suggestFromBackend: string | undefined = data.suggest_doc_type || undefined;

      history.current = [...history.current, { role: "assistant", content: aiText }];
      saveHistoryToStorage(history.current.slice(-6));

      const newSessionLeft = getSessionQuestionsLeft();
      const suggestDocType = suggestFromBackend || detectDocSuggestion(aiText) || undefined;
      const finalSuggest = newSessionLeft === 0 ? (suggestDocType || "claim") : suggestDocType;
      setLandingStep(s => s + 1);
      setMessages(p => {
        const next = p.filter(m => !m.typing);
        return [...next, { role: "ai", text: aiText, suggestDocType: finalSuggest }];
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Произошла ошибка";
      setMessages(p => {
        const next = p.filter(m => !m.typing);
        return [...next, { role: "ai", text: `${msg}. Попробуйте ещё раз.` }];
      });
    } finally {
      setTyping(false);
    }
  }, [input, typing, landingStep]);

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

  const handleCreateDoc = (docTypeId: string, query?: string, comment?: string, files?: DocAttachedFile[]) => {
    setShowDocMenu(false);
    const fullLabel = DOC_BLOCKS.flatMap(b => b.types).find(t => t.id === docTypeId)?.label;
    const docLabel = fullLabel || DOC_LABELS_MAP[docTypeId] || "документ";
    if (query !== undefined) {
      setDocDetailsData({ query, comment: comment || "", files: files || [] });
      setShowDocChoice({ docTypeId, docLabel });
      return;
    }
    setShowDocDetails({ docTypeId, docLabel, query: "" });
  };

  const handleDocDetailsProceed = (query: string, comment: string, files: DocAttachedFile[], docTypeId: string, docLabel: string) => {
    setDocDetailsData({ query, comment, files });
    setShowDocDetails(null);
    setShowDocChoice({ docTypeId, docLabel });
  };

  const openDocAnalysisPayment = useCallback((serviceType: ServiceType, serviceName: string) => {
    if (!attachedFile) return;
    setShowDocAnalysisPaywall(false);
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
      <div
        className="rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "#ffffff",
          boxShadow: "0 32px 80px rgba(10,22,40,0.55), 0 0 0 1px rgba(255,255,255,0.1)",
          height: "clamp(480px, 72vh, 680px)",
        }}
      >
        <LandingChatHeader />

        <LandingChatMessages
          messages={messages}
          showUpsell={showUpsell}
          chatBoxRef={chatBoxRef}
          chatEndRef={chatEndRef}
          onCreateDoc={handleCreateDoc}
          onBuyPlan={openPlanPayment}
          onBuyQuickQuestions={openQuickQuestionsPayment}
          onSendToLawyer={handleSendToLawyer}
        />

        <LandingChatInput
          onCreateDoc={(docTypeId, query, comment, files) => handleCreateDoc(docTypeId, query, comment, files)}
          onLogin={() => onOpenLogin({ freeTrial: false })}
          lastSuggestDocType={messages.filter(m => m.role === "ai" && m.suggestDocType).at(-1)?.suggestDocType}
        />
      </div>

      <LandingChatFooter />

      <LandingChatModals
        showLogin={showLogin}
        showProOffer={showProOffer}
        showPayment={showPayment}
        showDocDetails={showDocDetails}
        showDocChoice={showDocChoice}
        showExpertMaxOffer={showExpertMaxOffer}
        showDocAnalysisPaywall={showDocAnalysisPaywall}
        paymentService={paymentService}
        docDetailsData={docDetailsData}
        pendingDocType={pendingDocType}
        historyRef={history}
        onCloseLogin={() => setShowLogin(false)}
        onLoginSuccess={() => { setShowLogin(false); navigate("/cabinet"); }}
        onCloseProOffer={() => setShowProOffer(false)}
        onSelectProOffer={(type, name) => { setPaymentService({ type, name }); setShowPayment(true); }}
        onClosePayment={() => { setShowPayment(false); setPendingDocType(null); }}
        onPaymentSuccess={handlePaymentSuccess}
        onDocDetailsProceed={handleDocDetailsProceed}
        onCloseDocDetails={() => setShowDocDetails(null)}
        onDocChooseDoc={() => {
          const dtId = showDocChoice?.docTypeId;
          const det = docDetailsData;
          setShowDocChoice(null);
          openDocPayment(dtId, det || undefined);
        }}
        onDocChoosePlan={(planId) => {
          const dtId = showDocChoice?.docTypeId || "";
          setPendingDocType(dtId);
          const id = (planId || "plan_starter") as ServiceType;
          const nameMap: Record<string, string> = {
            plan_starter: "Тариф «Старт»",
            plan_pro: "Тариф «Профи»",
            plan_max: "Тариф «Максимум»",
          };
          setPaymentService({ type: id, name: nameMap[id] || "Тариф" });
          setShowPayment(true);
        }}
        onCloseDocChoice={() => { setShowDocChoice(null); setDocDetailsData(null); }}
        onLoginClickFromDocChoice={() => { setShowDocChoice(null); setShowLogin(true); }}
        onCloseExpertMaxOffer={() => { setShowExpertMaxOffer(false); setPendingLawyerMsg(null); }}
        onExpertMaxSuccess={handleExpertMaxSuccess}
        onChooseProDocAnalysis={() => openDocAnalysisPayment("plan_pro", "Тариф «Профи»")}
        onChooseMaxDocAnalysis={() => openDocAnalysisPayment("plan_max", "Тариф «Максимум»")}
        onCloseDocAnalysisPaywall={() => setShowDocAnalysisPaywall(false)}
      />
    </div>
  );
}