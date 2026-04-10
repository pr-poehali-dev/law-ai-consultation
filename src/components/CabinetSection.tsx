import { useState } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

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
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm max-w-3xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center">
                  <Icon name="Bot" size={18} className="text-gold-400" />
                </div>
                <div>
                  <div className="font-semibold text-navy-800 text-sm">AI-Юрист</div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isTyping ? "bg-amber-400" : "bg-green-400"}`} />
                    <span className="text-xs text-muted-foreground">
                      {isTyping ? "AI-юрист формирует ответ..." : "Онлайн · Обучен реальными юристами"}
                    </span>
                  </div>
                </div>
              </div>
              {!canAsk && (
                <button
                  onClick={() => { setPendingPaymentService("consultation"); setShowPayment(true); }}
                  className="btn-gold px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Icon name="Zap" size={12} />
                  100 ₽ / 3 вопроса
                </button>
              )}
            </div>

            <div className="h-80 overflow-y-auto p-5 space-y-4 scrollbar-hide">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-7 h-7 gradient-navy rounded-lg flex items-center justify-center mr-2 mt-1 shrink-0">
                      <Icon name="Scale" size={13} className="text-gold-400" />
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-navy-700 text-white rounded-br-sm" : "chat-bubble-ai text-navy-800 rounded-bl-sm"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 gradient-navy rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="Scale" size={13} className="text-gold-400" />
                  </div>
                  <div className="chat-bubble-ai rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full inline-block" />
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full inline-block" />
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full inline-block" />
                  </div>
                </div>
              )}
            </div>

            {chatError && (
              <div className="mx-4 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{chatError}</div>
            )}

            <div className="p-4 border-t border-border flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder={canAsk ? "Задайте юридический вопрос..." : "Оплатите консультацию для продолжения..."}
                disabled={isTyping}
                className="flex-1 bg-slate-50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-navy-400 transition-colors disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                className="btn-gold px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="Send" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* === DOCS TAB === */}
        {activeTab === "docs" && (
          <div className="max-w-3xl space-y-6">
            {/* Doc generator */}
            <div className="bg-card rounded-3xl border border-border p-6">
              <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">Создать документ</h3>
              <p className="text-sm text-muted-foreground mb-5">AI сформирует готовый юридический документ по вашим данным</p>

              {/* Type selector */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
                {DOC_TYPES.map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => setDocType(dt)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all ${
                      docType.id === dt.id ? "border-navy-600 bg-navy-50" : "border-border hover:border-navy-200"
                    }`}
                  >
                    <Icon name={dt.icon as any} size={16} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
                    <div>
                      <div className={`text-xs font-medium leading-tight ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{dt.price} ₽</div>
                    </div>
                  </button>
                ))}
              </div>

              <textarea
                value={docDetails}
                onChange={(e) => setDocDetails(e.target.value)}
                placeholder={`Опишите ситуацию для составления документа «${docType.label}»...\n\nНапример: Иванов И.И. должен мне 50 000 рублей по договору займа от 01.01.2025, срок возврата прошёл, на звонки не отвечает.`}
                rows={4}
                className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
              />

              {docError && (
                <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{docError}</div>
              )}

              <button
                onClick={() => handleGenerateDoc(docType.id)}
                disabled={generatingDoc || !docDetails.trim()}
                className="btn-gold w-full py-3.5 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingDoc ? (
                  <>
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  </>
                ) : (
                  <>
                    <Icon name="Zap" size={16} />
                    Создать бесплатно
                  </>
                )}
              </button>
            </div>

            {/* Generated doc */}
            {generatedDoc && (
              <div className="bg-card rounded-3xl border border-emerald-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Icon name="CheckCircle" size={18} className="text-emerald-500" />
                    <span className="font-semibold text-navy-800">{docType.label} — готов!</span>
                  </div>
                  <button
                    onClick={() => downloadDocx(docType.label, generatedDoc)}
                    className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 font-medium px-3 py-1.5 rounded-xl hover:bg-navy-50 transition-colors"
                  >
                    <Icon name="Download" size={15} />
                    Скачать .docx
                  </button>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-sm text-navy-700 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-hide font-mono text-xs">
                  {generatedDoc}
                </div>
              </div>
            )}

            {/* Doc history */}
            {documents.length > 0 && (
              <div>
                <h4 className="font-semibold text-navy-800 mb-3 text-sm">Ранее созданные документы</h4>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between hover:border-navy-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${doc.type === "PDF" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                          {doc.type}
                        </div>
                        <div>
                          <div className="font-medium text-navy-800 text-sm">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.date}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => doc.content && downloadDocx(doc.name, doc.content)}
                        className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-navy-50"
                      >
                        <Icon name="Download" size={15} />
                        Скачать .docx
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === HISTORY TAB === */}
        {activeTab === "history" && (
          <div className="space-y-3 max-w-3xl">
            {MOCK_CONSULTATIONS.map((c) => (
              <div key={c.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <button
                  className="w-full p-5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setExpandedConsult(expandedConsult === c.id ? null : c.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="MessageCircle" size={17} className="text-navy-600" />
                    </div>
                    <div>
                      <div className="font-medium text-navy-800 text-sm mb-1">{c.question}</div>
                      <div className="text-xs text-muted-foreground">{c.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">{c.status}</span>
                    <Icon name={expandedConsult === c.id ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
                  </div>
                </button>
                {expandedConsult === c.id && (
                  <div className="px-5 pb-5 border-t border-border">
                    <div className="mt-4 chat-bubble-ai rounded-2xl p-4 text-sm text-navy-700 leading-relaxed">{c.preview}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
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