import { useState } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const GIGACHAT_URL = func2url["gigachat-proxy"];

const MOCK_CONSULTATIONS = [
  {
    id: 1,
    question: "Как оспорить незаконное увольнение?",
    date: "7 апр 2026",
    status: "Отвечено",
    preview: "Согласно ст. 392 ТК РФ, вы вправе обратиться в суд в течение одного месяца со дня...",
  },
  {
    id: 2,
    question: "Могу ли я вернуть товар без чека?",
    date: "5 апр 2026",
    status: "Отвечено",
    preview: "По закону о защите прав потребителей (ст. 25 ЗоЗПП), отсутствие чека не является основанием...",
  },
  {
    id: 3,
    question: "Договор аренды — что обязательно включить?",
    date: "2 апр 2026",
    status: "Отвечено",
    preview: "В договоре аренды квартиры обязательно укажите: срок аренды, размер и порядок оплаты...",
  },
];

const MOCK_DOCUMENTS = [
  { id: 1, name: "Исковое заявление о взыскании долга", date: "7 апр 2026", type: "PDF" },
  { id: 2, name: "Претензия к интернет-магазину", date: "5 апр 2026", type: "DOCX" },
  { id: 3, name: "Договор аренды жилья", date: "2 апр 2026", type: "PDF" },
];

const WELCOME_MSG = "Добрый день! Я AI-юрист, обученный на базе реальных юридических дел. Опишите вашу ситуацию — подготовлю развёрнутый ответ со ссылками на нормативные акты.";

interface CabinetSectionProps {
  isLoggedIn: boolean;
  onLogin: () => void;
}

export default function CabinetSection({ isLoggedIn, onLogin }: CabinetSectionProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "docs">("chat");
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: WELCOME_MSG },
  ]);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [expandedConsult, setExpandedConsult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput("");
    setError(null);
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);

    const newHistory = [...chatHistory, { role: "user", content: userMsg }];
    setChatHistory(newHistory);

    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      const aiText = data.answer as string;
      setChatMessages((prev) => [...prev, { role: "ai", text: aiText }]);
      setChatHistory((prev) => [...prev, { role: "assistant", content: aiText }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось получить ответ";
      setError(msg);
      setChatMessages((prev) => [...prev, { role: "ai", text: "Извините, произошла ошибка при обращении к AI. Попробуйте ещё раз." }]);
    } finally {
      setIsTyping(false);
    }
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
          <button
            onClick={onLogin}
            className="btn-gold px-10 py-4 rounded-2xl text-base font-semibold w-full"
          >
            Войти в кабинет
          </button>
          <p className="text-sm text-muted-foreground mt-4">
            Нет аккаунта?{" "}
            <button onClick={onLogin} className="text-navy-700 font-medium hover:underline">
              Зарегистрируйтесь бесплатно
            </button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="cabinet" className="py-24 bg-gradient-to-b from-slate-50 to-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
          <div>
            <h2 className="font-cormorant font-bold text-4xl text-navy-800 mb-1">Личный кабинет</h2>
            <p className="text-muted-foreground">Добрый день, Алексей Иванович</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-light rounded-2xl px-4 py-2 text-sm">
              <span className="text-muted-foreground">Тариф: </span>
              <span className="font-semibold text-navy-700">Профи</span>
            </div>
            <div className="glass-light rounded-2xl px-4 py-2 text-sm">
              <span className="text-muted-foreground">Консультаций: </span>
              <span className="font-semibold text-navy-700">3 из 5</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-white shadow-sm text-navy-800"
                  : "text-muted-foreground hover:text-navy-700"
              }`}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chat tab */}
        {activeTab === "chat" && (
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm max-w-3xl">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center">
                <Icon name="Bot" size={18} className="text-gold-400" />
              </div>
              <div>
                <div className="font-semibold text-navy-800 text-sm">AI-Юрист</div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isTyping ? "bg-amber-400" : "bg-green-400"}`} />
                  <span className="text-xs text-muted-foreground">
                    {isTyping ? "Формирует ответ..." : "Онлайн · GigaChat · Обучен юристами"}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-80 overflow-y-auto p-5 space-y-4 scrollbar-hide">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-7 h-7 gradient-navy rounded-lg flex items-center justify-center mr-2 mt-1 shrink-0">
                      <Icon name="Scale" size={13} className="text-gold-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-navy-700 text-white rounded-br-sm"
                        : "chat-bubble-ai text-navy-800 rounded-bl-sm"
                    }`}
                  >
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

            {error && (
              <div className="mx-4 mb-0 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {error}
              </div>
            )}
            <div className="p-4 border-t border-border flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Задайте юридический вопрос..."
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

        {/* History tab */}
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
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                      {c.status}
                    </span>
                    <Icon name={expandedConsult === c.id ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
                  </div>
                </button>
                {expandedConsult === c.id && (
                  <div className="px-5 pb-5 border-t border-border">
                    <div className="mt-4 chat-bubble-ai rounded-2xl p-4 text-sm text-navy-700 leading-relaxed">
                      {c.preview}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Docs tab */}
        {activeTab === "docs" && (
          <div className="space-y-3 max-w-3xl">
            {MOCK_DOCUMENTS.map((doc) => (
              <div key={doc.id} className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between hover:border-navy-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${doc.type === "PDF" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                    {doc.type}
                  </div>
                  <div>
                    <div className="font-medium text-navy-800 text-sm">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">{doc.date}</div>
                  </div>
                </div>
                <button className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-navy-50">
                  <Icon name="Download" size={15} />
                  Скачать
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}