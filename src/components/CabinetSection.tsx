import { useState } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import CabinetChatTab from "@/components/cabinet/CabinetChatTab";
import CabinetDocsTab from "@/components/cabinet/CabinetDocsTab";
import CabinetHistoryTab from "@/components/cabinet/CabinetHistoryTab";

const GIGACHAT_URL = func2url["gigachat-proxy"];

const FREE_QUESTIONS_LIMIT = 30;

const MOCK_CONSULTATIONS = [
  { id: 1, question: "Как оспорить незаконное увольнение?", date: "7 апр 2026", status: "Отвечено", preview: "Согласно ст. 392 ТК РФ, вы вправе обратиться в суд в течение одного месяца со дня вручения копии приказа об увольнении..." },
  { id: 2, question: "Могу ли я вернуть товар без чека?", date: "5 апр 2026", status: "Отвечено", preview: "По закону о защите прав потребителей (ст. 25 ЗоЗПП), отсутствие чека не является основанием для отказа в возврате..." },
  { id: 3, question: "Договор аренды — что обязательно включить?", date: "2 апр 2026", status: "Отвечено", preview: "В договоре аренды квартиры обязательно укажите: срок, размер и порядок оплаты, права и обязанности сторон..." },
];

const MOCK_DOCUMENTS: { id: number; name: string; date: string; type: "PDF" | "DOCX"; content?: string }[] = [
  { id: 1, name: "Исковое заявление о взыскании долга", date: "7 апр 2026", type: "PDF" },
  { id: 2, name: "Претензия к интернет-магазину", date: "5 апр 2026", type: "DOCX" },
];

const WELCOME_MSG = "Добрый день! Я AI-юрист, обученный на базе реальных юридических дел. Опишите вашу ситуацию — подготовлю развёрнутый ответ со ссылками на нормативные акты.\n\n*У вас 30 бесплатных вопросов.*";

const DOC_TYPES = [
  { id: "claim", label: "Исковое заявление", icon: "Gavel", price: 500 },
  { id: "pretension", label: "Претензия", icon: "AlertCircle", price: 500 },
  { id: "complaint", label: "Жалоба (Роспотребнадзор)", icon: "Building", price: 500 },
  { id: "contract", label: "Договор ГПХ", icon: "FileCheck", price: 500 },
  { id: "business_contract", label: "Договор для бизнеса", icon: "Briefcase", price: 1000 },
];

interface CabinetSectionProps {
  isLoggedIn: boolean;
  onLogin: () => void;
}

export default function CabinetSection({ isLoggedIn, onLogin }: CabinetSectionProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "docs">("chat");

  // Chat state
  const [chatMessages, setChatMessages] = useState([{ role: "ai", text: WELCOME_MSG }]);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [freeQuestionsUsed, setFreeQuestionsUsed] = useState(0);
  const [paidConsultations, setPaidConsultations] = useState(0);

  // Documents state
  const [documents, setDocuments] = useState(MOCK_DOCUMENTS);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docDetails, setDocDetails] = useState("");
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Payment
  const [showPayment, setShowPayment] = useState(false);
  const [pendingPaymentService, setPendingPaymentService] = useState<ServiceType>("consultation");
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);

  // History
  const [expandedConsult, setExpandedConsult] = useState<number | null>(null);

  const freeLeft = Math.max(0, FREE_QUESTIONS_LIMIT - freeQuestionsUsed);
  const canAsk = freeLeft > 0 || paidConsultations > 0;

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    if (!canAsk) {
      setChatMessages((prev) => [...prev, {
        role: "ai",
        text: "⚠️ Вы использовали все 3 бесплатных вопроса. Для продолжения оплатите консультацию (100 ₽ = ещё 3 вопроса).",
      }]);
      setPendingPaymentService("consultation");
      setShowPayment(true);
      return;
    }

    const userMsg = input.trim();
    setInput("");
    setChatError(null);
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);

    const newHistory = [...chatHistory, { role: "user", content: userMsg }];
    setChatHistory(newHistory);

    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: newHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      const aiText = data.answer as string;
      setChatMessages((prev) => [...prev, { role: "ai", text: aiText }]);
      setChatHistory((prev) => [...prev, { role: "assistant", content: aiText }]);

      if (freeLeft > 0) {
        setFreeQuestionsUsed((n) => n + 1);
      } else {
        setPaidConsultations((n) => n - 1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось получить ответ";
      setChatError(msg);
      setChatMessages((prev) => [...prev, { role: "ai", text: "Извините, произошла ошибка. Попробуйте ещё раз." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const downloadDocx = async (name: string, content: string) => {
    const lines = content.split("\n");
    const paragraphs = lines.map((line) =>
      line.trim() === ""
        ? new Paragraph({ text: "" })
        : new Paragraph({ children: [new TextRun({ text: line, size: 24, font: "Times New Roman" })] })
    );
    const doc = new Document({
      sections: [{ children: [
        new Paragraph({ text: name, heading: HeadingLevel.HEADING_1, spacing: { after: 300 } }),
        ...paragraphs,
      ]}],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${name}.docx`);
  };

  const handleGenerateDoc = async (dtId: string) => {
    if (!docDetails.trim()) {
      setDocError("Опишите подробности для составления документа");
      return;
    }
    setGeneratingDoc(true);
    setDocError(null);
    setGeneratedDoc(null);
    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "document", doc_type: dtId, details: docDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");
      setGeneratedDoc(data.answer);
      const dt = DOC_TYPES.find((d) => d.id === dtId);
      setDocuments((prev) => [{
        id: Date.now(),
        name: dt?.label || "Документ",
        date: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }),
        type: "DOCX",
        content: data.answer,
      }, ...prev]);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handlePaymentSuccess = (svcType: ServiceType) => {
    setShowPayment(false);
    if (svcType === "consultation") {
      setPaidConsultations((n) => n + 3);
      setChatMessages((prev) => [...prev, { role: "ai", text: "✅ Оплата прошла! Вам начислено ещё 3 вопроса. Продолжайте!" }]);
    } else if (svcType === "document" || svcType === "business") {
      if (pendingDocType) {
        handleGenerateDoc(pendingDocType);
        setPendingDocType(null);
      }
    }
  };

  const requestDocPayment = (dt: typeof DOC_TYPES[0]) => {
    setDocType(dt);
    setPendingDocType(dt.id);
    setPendingPaymentService(dt.id === "business_contract" ? "business" : "document");
    setShowPayment(true);
  };

  const tabs = [
    { id: "chat", label: "Чат с AI", icon: "Bot" },
    { id: "history", label: "История", icon: "Clock" },
    { id: "docs", label: "Документы", icon: "FolderOpen" },
  ] as const;

  if (!isLoggedIn) {
    return (
      <section id="cabinet" className="py-24 bg-gradient-to-b from-slate-50 to-background">
        <div className="container mx-auto px-4 max-w-lg text-center">
          <div className="w-20 h-20 gradient-navy rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Icon name="Lock" size={36} className="text-gold-400" />
          </div>
          <h2 className="font-cormorant font-bold text-4xl text-navy-800 mb-3">Личный кабинет</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Войдите, чтобы получить доступ к истории консультаций, документам и чату с AI-юристом
          </p>
          <button onClick={onLogin} className="btn-gold px-10 py-4 rounded-2xl text-base font-semibold w-full">
            Войти в кабинет
          </button>
          <p className="text-sm text-muted-foreground mt-4">
            Нет аккаунта?{" "}
            <button onClick={onLogin} className="text-navy-700 font-medium hover:underline">Зарегистрируйтесь бесплатно</button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="cabinet" className="py-24 bg-gradient-to-b from-slate-50 to-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
          <div>
            <h2 className="font-cormorant font-bold text-4xl text-navy-800 mb-1">Личный кабинет</h2>
            <p className="text-muted-foreground">Добрый день!</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`rounded-2xl px-4 py-2 text-sm border ${freeLeft > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <span className="text-muted-foreground">Бесплатных вопросов: </span>
              <span className={`font-semibold ${freeLeft > 0 ? "text-emerald-700" : "text-red-600"}`}>{freeLeft} из {FREE_QUESTIONS_LIMIT}</span>
            </div>
            {paidConsultations > 0 && (
              <div className="bg-gold-400/10 rounded-2xl px-4 py-2 text-sm border border-gold-400/30">
                <span className="text-muted-foreground">Платных: </span>
                <span className="font-semibold text-gold-600">{paidConsultations}</span>
              </div>
            )}
            {freeLeft === 0 && paidConsultations === 0 && (
              <button
                onClick={() => { setPendingPaymentService("consultation"); setShowPayment(true); }}
                className="btn-gold px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                <Icon name="Plus" size={14} />
                Докупить вопросы — 100 ₽
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id ? "bg-white shadow-sm text-navy-800" : "text-muted-foreground hover:text-navy-700"
              }`}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* === CHAT TAB === */}
        {activeTab === "chat" && (
          <CabinetChatTab
            chatMessages={chatMessages}
            input={input}
            isTyping={isTyping}
            chatError={chatError}
            canAsk={canAsk}
            onInputChange={setInput}
            onSend={sendMessage}
            onPayClick={() => { setPendingPaymentService("consultation"); setShowPayment(true); }}
          />
        )}

        {/* === DOCS TAB === */}
        {activeTab === "docs" && (
          <CabinetDocsTab
            docType={docType}
            docTypes={DOC_TYPES}
            docDetails={docDetails}
            generatingDoc={generatingDoc}
            generatedDoc={generatedDoc}
            docError={docError}
            documents={documents}
            onDocTypeChange={setDocType}
            onDocDetailsChange={setDocDetails}
            onGenerate={() => handleGenerateDoc(docType.id)}
            onDownload={downloadDocx}
          />
        )}

        {/* === HISTORY TAB === */}
        {activeTab === "history" && (
          <CabinetHistoryTab
            consultations={MOCK_CONSULTATIONS}
            expandedId={expandedConsult}
            onToggle={(id) => setExpandedConsult(expandedConsult === id ? null : id)}
          />
        )}
      </div>

      {showPayment && (
        <PaymentModal
          serviceType={pendingPaymentService}
          serviceName={
            pendingPaymentService === "consultation" ? "AI-консультация (3 вопроса)" :
            pendingPaymentService === "document" ? "Подготовка документа" :
            pendingPaymentService === "business" ? "Договор для бизнеса" :
            "Проверка юристом"
          }
          onClose={() => { setShowPayment(false); setPendingDocType(null); }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </section>
  );
}
