import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { getUser, logout, addPaidService, consumeQuestion, canAskQuestion, getFreeLeft, type User } from "@/lib/auth";
import func2url from "../../backend/func2url.json";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

const GIGACHAT_URL = func2url["gigachat-proxy"];

const DOC_TYPES = [
  { id: "claim", label: "Исковое заявление", icon: "Gavel", price: 500, serviceType: "document" as ServiceType },
  { id: "pretension", label: "Претензия", icon: "AlertCircle", price: 500, serviceType: "document" as ServiceType },
  { id: "complaint", label: "Жалоба (Роспотребнадзор)", icon: "Building", price: 500, serviceType: "document" as ServiceType },
  { id: "contract", label: "Договор ГПХ", icon: "FileCheck", price: 500, serviceType: "document" as ServiceType },
  { id: "business_contract", label: "Договор для бизнеса", icon: "Briefcase", price: 1000, serviceType: "business" as ServiceType },
];

interface ChatMsg { role: "ai" | "user"; text: string; }

const WELCOME = "Добрый день! Я AI-юрист, обученный на реальной судебной практике РФ.\n\nЗадайте ваш правовой вопрос — отвечу со ссылками на законы.";

export default function Cabinet() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"chat" | "docs" | "history" | "profile">("chat");

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_messages");
      return saved ? JSON.parse(saved) : [{ role: "ai", text: WELCOME }];
    } catch { return [{ role: "ai", text: WELCOME }]; }
  });
  const [history, setHistory] = useState<{ role: string; content: string }[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Docs
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docDetails, setDocDetails] = useState("");
  const [genDocs, setGenDocs] = useState<{ id: number; name: string; content: string; date: string }[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_docs");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [viewDoc, setViewDoc] = useState<null | { name: string; content: string }>(null);

  // Payment
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);

  useEffect(() => {
    getUser().then((u) => {
      if (!u) { navigate("/"); return; }
      setUser(u);
    });
  }, [navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    localStorage.setItem("cabinet_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("cabinet_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("cabinet_docs", JSON.stringify(genDocs));
  }, [genDocs]);

  const refreshUser = () => getUser().then((u) => { if (u) setUser(u); });

  const sendMessage = async () => {
    if (!input.trim() || typing) return;
    const userMsg = input.trim();

    const canAsk = await canAskQuestion();
    if (!canAsk) {
      setMessages((p) => [...p, {
        role: "ai",
        text: "⚠️ Вы использовали все бесплатные вопросы. Оплатите консультацию — 100 ₽ за 3 вопроса.",
      }]);
      setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" });
      return;
    }

    setInput("");
    setChatErr("");
    setMessages((p) => [...p, { role: "user", text: userMsg }]);
    setTyping(true);

    const newHist = [...history, { role: "user", content: userMsg }];
    setHistory(newHist);
    await consumeQuestion();
    refreshUser();

    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: newHist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      const aiText = data.answer as string;
      setMessages((p) => [...p, { role: "ai", text: aiText }]);
      setHistory((p) => [...p, { role: "assistant", content: aiText }]);
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Ошибка соединения");
      setMessages((p) => [...p, { role: "ai", text: "Произошла ошибка. Попробуйте ещё раз." }]);
    } finally {
      setTyping(false);
    }
  };

  const generateDoc = async (dtId: string) => {
    if (!docDetails.trim()) { setDocErr("Опишите ситуацию подробнее"); return; }
    setGeneratingDoc(true);
    setDocErr("");
    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "document", doc_type: dtId, details: docDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");
      const dt = DOC_TYPES.find((d) => d.id === dtId)!;
      const newDoc = { id: Date.now(), name: dt.label, content: data.answer, date: new Date().toLocaleDateString("ru-RU") };
      setGenDocs((p) => [newDoc, ...p]);
      setViewDoc(newDoc);
      setDocDetails("");
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handlePaySuccess = async (svcType: ServiceType) => {
    await addPaidService(svcType);
    refreshUser();
    setPayment(null);
    if (pendingDocId) {
      generateDoc(pendingDocId);
      setPendingDocId(null);
    }
  };

  const requestDoc = (dt: typeof DOC_TYPES[0]) => {
    setDocType(dt);
    setPendingDocId(dt.id);
    setPayment({ type: dt.serviceType, name: dt.label });
  };

  const downloadDoc = async (name: string, content: string) => {
    const lines = content.split("\n");
    const paragraphs = lines.map((line) =>
      line.trim() === ""
        ? new Paragraph({ text: "" })
        : new Paragraph({
            children: [new TextRun({ text: line, size: 24, font: "Times New Roman" })],
          })
    );
    const doc = new Document({
      sections: [{ children: [
        new Paragraph({
          text: name,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 },
        }),
        ...paragraphs,
      ]}],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${name}.docx`);
  };

  if (!user) return null;

  const freeLeft = getFreeLeft(user);
  const totalLeft = freeLeft + (user.paidQuestions ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 font-golos">
      {/* Top nav */}
      <header className="sticky top-0 z-40 glass-light border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center">
              <Icon name="Scale" size={15} className="text-gold-400" />
            </div>
            <span className="font-cormorant font-bold text-lg text-navy-800">
              Юрист<span className="text-gradient-gold"> AI</span>
            </span>
          </button>

          {/* Tabs — desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
            {[
              { id: "chat", label: "Чат с AI", icon: "Bot" },
              { id: "docs", label: "Документы", icon: "FileText" },
              { id: "history", label: "История", icon: "Clock" },
              { id: "profile", label: "Профиль", icon: "User" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id ? "bg-white shadow-sm text-navy-800" : "text-muted-foreground hover:text-navy-700"
                }`}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Questions counter */}
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
              totalLeft > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"
            }`}>
              <Icon name="MessageCircle" size={12} />
              {totalLeft > 0 ? `${totalLeft} вопр.` : "Нет вопросов"}
            </div>
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center text-white text-xs font-bold uppercase">
              {user.name?.[0] ?? "U"}
            </div>
            <button
              onClick={async () => { await logout(); navigate("/"); }}
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-navy-700 transition-colors"
            >
              <Icon name="LogOut" size={14} />
              Выйти
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex border-t border-border">
          {[
            { id: "chat", label: "Чат", icon: "Bot" },
            { id: "docs", label: "Документы", icon: "FileText" },
            { id: "history", label: "История", icon: "Clock" },
            { id: "profile", label: "Профиль", icon: "User" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                tab === t.id ? "text-navy-700 bg-navy-50" : "text-muted-foreground"
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ===== CHAT TAB ===== */}
        {tab === "chat" && (
          <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
            {/* Status bar */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${typing ? "bg-amber-400 animate-pulse" : "bg-green-400 animate-pulse"}`} />
                <span className="text-xs text-muted-foreground">
                  {typing ? "AI-юрист формирует ответ..." : "AI-юрист онлайн · обучен реальными юристами"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {totalLeft === 0 ? (
                  <button
                    onClick={() => setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" })}
                    className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
                  >
                    <Icon name="Plus" size={12} />
                    100 ₽ / 3 вопроса
                  </button>
                ) : (
                  <span className={`text-xs px-2.5 py-1 rounded-xl font-medium ${freeLeft > 0 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                    {freeLeft > 0 ? `${freeLeft} бесплатных` : `${user.paidQuestions} платных`}
                  </span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-white rounded-3xl border border-border shadow-sm p-5 space-y-4 scrollbar-hide">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="Scale" size={14} className="text-gold-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-navy-700 text-white rounded-br-sm"
                      : "bg-blue-50/60 border-l-2 border-gold-400 text-navy-800 rounded-bl-sm"
                  }`}>
                    {msg.text}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-navy-600 uppercase">
                      {user.name?.[0] ?? "U"}
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="Scale" size={14} className="text-gold-400" />
                  </div>
                  <div className="bg-blue-50/60 border-l-2 border-gold-400 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {chatErr && (
              <div className="mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{chatErr}</div>
            )}

            {/* Input */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) sendMessage(); }}
                disabled={typing}
                placeholder={totalLeft > 0 ? "Задайте юридический вопрос... (Enter для отправки)" : "Оплатите консультацию для продолжения"}
                className="flex-1 bg-white border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || typing}
                className="btn-gold w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Icon name="Send" size={18} />
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Ответы AI не заменяют консультацию практикующего юриста
            </p>
          </div>
        )}

        {/* ===== DOCS TAB ===== */}
        {tab === "docs" && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — generator */}
            <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
              <h2 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">Создать документ</h2>
              <p className="text-sm text-muted-foreground mb-5">AI составит полный юридический документ по вашей ситуации</p>

              <div className="space-y-2 mb-5">
                {DOC_TYPES.map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => setDocType(dt)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                      docType.id === dt.id ? "border-navy-500 bg-navy-50" : "border-border hover:border-navy-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${docType.id === dt.id ? "bg-navy-100" : "bg-slate-100"}`}>
                        <Icon name={dt.icon as any} size={16} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
                      </div>
                      <span className={`text-sm font-medium ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-navy-600">{dt.price} ₽</span>
                  </button>
                ))}
              </div>

              <textarea
                value={docDetails}
                onChange={(e) => setDocDetails(e.target.value)}
                placeholder={`Опишите вашу ситуацию для «${docType.label}»...\n\nЧем подробнее — тем точнее документ.`}
                rows={5}
                className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
              />

              {docErr && (
                <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{docErr}</div>
              )}

              <button
                onClick={() => generateDoc(docType.id)}
                disabled={generatingDoc || !docDetails.trim()}
                className="btn-gold w-full py-3.5 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingDoc ? (
                  <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
                ) : (
                  <><Icon name="Zap" size={16} />Создать бесплатно</>
                )}
              </button>
            </div>

            {/* Right — result / list */}
            <div className="space-y-4">
              {viewDoc && (
                <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-4 flex items-center gap-3">
                  <Icon name="CheckCircle" size={18} className="text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-navy-800 flex-1">{viewDoc.name} — готов</span>
                  <button onClick={() => setViewDoc(viewDoc)} className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl hover:bg-white transition-colors font-medium">Открыть</button>
                </div>
              )}

              {genDocs.length > 0 && (
                <div className="bg-white rounded-3xl border border-border shadow-sm p-5">
                  <h3 className="font-semibold text-navy-800 text-sm mb-3">Созданные документы</h3>
                  <div className="space-y-2">
                    {genDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-navy-800">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.date}</div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => setViewDoc(doc)} className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-1.5 rounded-lg hover:bg-navy-50 transition-colors">
                            Просмотр
                          </button>
                          <button onClick={() => downloadDoc(doc.name, doc.content)} className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-1.5 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1">
                            <Icon name="Download" size={12} />
                            Скачать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {genDocs.length === 0 && !viewDoc && (
                <div className="bg-white rounded-3xl border border-border shadow-sm p-10 text-center">
                  <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon name="FileText" size={24} className="text-navy-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">Созданные документы появятся здесь</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== HISTORY TAB ===== */}
        {tab === "history" && (
          <div className="max-w-3xl mx-auto">
            <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">История консультаций</h2>
            {messages.filter((m) => m.role === "user").length === 0 ? (
              <div className="bg-white rounded-3xl border border-border p-12 text-center shadow-sm">
                <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="Clock" size={24} className="text-navy-400" />
                </div>
                <p className="text-muted-foreground">Вопросов ещё не задавалось</p>
                <button onClick={() => setTab("chat")} className="mt-4 btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">
                  Задать вопрос
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => {
                  if (msg.role !== "user") return null;
                  const aiReply = messages[i + 1];
                  return (
                    <div key={i} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                            {user.name?.[0] ?? "U"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-navy-800">{msg.text}</p>
                            <p className="text-xs text-muted-foreground mt-1">{new Date().toLocaleDateString("ru-RU")}</p>
                          </div>
                        </div>
                        {aiReply && (
                          <div className="ml-11 bg-blue-50/60 border-l-2 border-gold-400 rounded-2xl p-4 text-xs text-navy-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {aiReply.text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== PROFILE TAB ===== */}
        {tab === "profile" && (
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">Профиль</h2>

            <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center text-white text-2xl font-bold uppercase">
                  {user.name?.[0] ?? "U"}
                </div>
                <div>
                  <div className="font-semibold text-navy-800 text-lg">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Бесплатных вопросов", value: `${getFreeLeft(user)} из 30`, icon: "Gift", color: "text-emerald-600 bg-emerald-50" },
                  { label: "Платных вопросов", value: user.paidQuestions ?? 0, icon: "MessageCircle", color: "text-blue-600 bg-blue-50" },
                  { label: "Создано документов", value: genDocs.length, icon: "FileText", color: "text-amber-600 bg-amber-50" },
                  { label: "Проверок юристом", value: user.paidExpert ? "Активно" : "Нет", icon: "Shield", color: "text-purple-600 bg-purple-50" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border p-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${stat.color}`}>
                      <Icon name={stat.icon as any} size={16} />
                    </div>
                    <div className="font-bold text-navy-800 text-lg">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Buy more */}
            <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-navy-800 mb-4">Пополнить баланс</h3>
              <div className="space-y-3">
                {[
                  { label: "3 вопроса AI-юристу", price: "100 ₽", type: "consultation" as ServiceType, name: "AI-консультация (3 вопроса)", icon: "MessageCircle" },
                  { label: "Подготовка документа", price: "500 ₽", type: "document" as ServiceType, name: "Подготовка документа", icon: "FileText" },
                  { label: "Проверка экспертом-юристом", price: "1 500 ₽", type: "expert" as ServiceType, name: "Проверка юристом", icon: "UserCheck" },
                  { label: "Договор для бизнеса", price: "1 000 ₽", type: "business" as ServiceType, name: "Договор для бизнеса", icon: "Briefcase" },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => setPayment({ type: item.type, name: item.name })}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border hover:border-navy-300 hover:bg-navy-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center group-hover:bg-navy-100 transition-colors">
                        <Icon name={item.icon as any} size={15} className="text-navy-600" />
                      </div>
                      <span className="text-sm font-medium text-navy-800">{item.label}</span>
                    </div>
                    <span className="font-semibold text-navy-700 text-sm">{item.price}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={async () => { await logout(); navigate("/"); }}
              className="w-full py-3 rounded-2xl border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all text-sm font-medium flex items-center justify-center gap-2"
            >
              <Icon name="LogOut" size={15} />
              Выйти из аккаунта
            </button>
          </div>
        )}
      </main>

      {payment && (
        <PaymentModal
          serviceType={payment.type}
          serviceName={payment.name}
          onClose={() => { setPayment(null); setPendingDocId(null); }}
          onSuccess={handlePaySuccess}
        />
      )}

      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewDoc(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="FileText" size={18} className="text-navy-600" />
                <span className="font-semibold text-navy-800">{viewDoc.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadDoc(viewDoc.name, viewDoc.content)}
                  className="flex items-center gap-1.5 text-sm text-navy-600 hover:text-navy-800 font-medium px-3 py-1.5 rounded-xl hover:bg-navy-50 transition-colors"
                >
                  <Icon name="Download" size={15} />
                  Скачать .docx
                </button>
                <button onClick={() => setViewDoc(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-muted-foreground hover:text-navy-700">
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <pre className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap font-sans">{viewDoc.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}