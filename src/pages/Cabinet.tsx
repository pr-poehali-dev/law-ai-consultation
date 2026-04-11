import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { getUser, logout, addPaidService, consumeQuestion, consumeDoc, canAskQuestion, canUseDoc, type User } from "@/lib/auth";
import func2url from "../../backend/func2url.json";
import { downloadDoc } from "@/lib/docUtils";
import ChatTab, { type ChatMsg } from "@/pages/cabinet/ChatTab";
import DocsTab, { DOC_TYPES, type DocPhase, type GenDoc } from "@/pages/cabinet/DocsTab";
import HistoryTab from "@/pages/cabinet/HistoryTab";
import ProfileTab from "@/pages/cabinet/ProfileTab";

const GIGACHAT_URL = func2url["gigachat-proxy"];

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
  const [typingStatus, setTypingStatus] = useState("");
  const [chatErr, setChatErr] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; b64: string; size: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // Docs
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docPhase, setDocPhase] = useState<DocPhase>("form");
  const [docDetails, setDocDetails] = useState("");
  const [docGenerating, setDocGenerating] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [currentDoc, setCurrentDoc] = useState<GenDoc | null>(null);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [genDocs, setGenDocs] = useState<GenDoc[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_docs");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Payment
  const [payment, setPayment] = useState<{ type: ServiceType; name: string } | null>(null);
  const [pendingDocType, setPendingDocType] = useState<typeof DOC_TYPES[0] | null>(null);

  // ViewDoc modal
  const [viewDoc, setViewDoc] = useState<GenDoc | null>(null);

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

  const refreshUser = async () => { const u = await getUser(); if (u) setUser(u); };

  const sendMessage = async () => {
    if (!input.trim() || typing) return;
    const userMsg = input.trim();

    const canAsk = await canAskQuestion();
    if (!canAsk) {
      setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" });
      return;
    }

    setInput("");
    setChatErr("");
    setMessages((p) => [...p, { role: "user", text: userMsg }]);
    setTyping(true);
    setTypingStatus("Анализирую запрос...");

    const newHist = [...history, { role: "user", content: userMsg }];
    setHistory(newHist);
    await consumeQuestion();
    refreshUser();

    // Сменяем статусы по таймеру для живости
    const t1 = setTimeout(() => setTypingStatus("Изучаю судебную практику..."), 3000);
    const t2 = setTimeout(() => setTypingStatus("Подбираю нормы законодательства..."), 7000);
    const t3 = setTimeout(() => setTypingStatus("Формирую ответ..."), 12000);

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
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|jpg|jpeg|png)$/i)) {
      setChatErr("Допустимые форматы: PDF, DOC, DOCX, JPEG, PNG");
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setChatErr("Файл слишком большой. Максимум 10 МБ."); return; }
    setFileUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      const sizeStr = file.size < 1024 * 1024
        ? `${Math.round(file.size / 1024)} КБ`
        : `${(file.size / (1024 * 1024)).toFixed(1)} МБ`;
      setAttachedFile({ name: file.name, b64, size: sizeStr });
      setFileUploading(false);
      setChatErr("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sendFileAnalysis = async () => {
    if (!attachedFile || typing) return;
    const canAsk = await canAskQuestion();
    if (!canAsk) {
      setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" });
      return;
    }
    const comment = input.trim();
    const file = attachedFile;
    setAttachedFile(null);
    setInput("");
    setChatErr("");
    setMessages((p) => [...p, {
      role: "user",
      text: `📎 ${file.name}${comment ? `\n${comment}` : ""}`,
      isFile: true,
    } as ChatMsg]);
    setTyping(true);
    setTypingStatus("Читаю документ...");
    await consumeQuestion();
    refreshUser();

    const t1 = setTimeout(() => setTypingStatus("Анализирую структуру и содержание..."), 3000);
    const t2 = setTimeout(() => setTypingStatus("Проверяю соответствие нормам РФ..."), 8000);
    const t3 = setTimeout(() => setTypingStatus("Выявляю правовые риски..."), 14000);

    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "file_analyze", file: file.b64, filename: file.name, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      const aiText = data.answer as string;
      setMessages((p) => [...p, { role: "ai", text: aiText }]);
      setHistory((p) => [...p,
        { role: "user", content: `Анализ документа: ${file.name}${comment ? `. Вопрос: ${comment}` : ""}` },
        { role: "assistant", content: aiText },
      ]);
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Ошибка анализа");
      setMessages((p) => [...p, { role: "ai", text: "Не удалось проанализировать документ. Попробуйте ещё раз." }]);
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
    }
  };

  const generateDoc = async () => {
    if (!docDetails.trim()) { setDocErr("Опишите ситуацию"); return; }
    const canDoc = await canUseDoc();
    if (!canDoc) {
      setPayment({ type: docType.serviceType, name: docType.label });
      setPendingDocType(docType);
      return;
    }
    setDocGenerating(true);
    setDocPhase("generating");
    setDocErr("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "doc_generate", doc_type: docType.id, details: docDetails }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");
      const placeholders: string[] = data.placeholders || [];
      const newDoc: GenDoc = {
        id: Date.now(),
        name: docType.label,
        content: data.answer,
        filled: data.answer,
        date: new Date().toLocaleDateString("ru-RU"),
        placeholders,
      };
      await consumeDoc();
      await refreshUser();
      setCurrentDoc(newDoc);
      setFillValues(Object.fromEntries(placeholders.map((p) => [p, ""])));
      setGenDocs((prev) => [newDoc, ...prev]);
      setDocPhase(placeholders.length > 0 ? "filling" : "done");
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Ошибка генерации");
      setDocPhase("form");
    } finally {
      setDocGenerating(false);
    }
  };

  const applyFillValues = () => {
    if (!currentDoc) return;
    let filled = currentDoc.content;
    Object.entries(fillValues).forEach(([key, val]) => {
      const replacement = val.trim() || `{{${key}}}`;
      filled = filled.replaceAll(`{{${key}}}`, replacement);
    });
    const updated = { ...currentDoc, filled };
    setCurrentDoc(updated);
    setGenDocs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    setDocPhase("done");
  };

  const handlePaySuccess = async (svcType: ServiceType) => {
    try {
      await addPaidService(svcType);
      await refreshUser();
    } catch {
      // сервис уже оплачен — продолжаем
    }
    setPayment(null);
    if (pendingDocType && (svcType === "document" || svcType === "business")) {
      setPendingDocType(null);
      setTimeout(() => generateDoc(), 300);
    } else {
      setPendingDocType(null);
    }
  };

  if (!user) return null;

  const totalLeft = user.isAdmin ? 999 : (user.paidQuestions ?? 0);

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

        {tab === "chat" && (
          <ChatTab
            user={user}
            messages={messages}
            input={input}
            typing={typing}
            typingStatus={typingStatus}
            chatErr={chatErr}
            attachedFile={attachedFile}
            fileUploading={fileUploading}
            totalLeft={totalLeft}
            onInputChange={setInput}
            onSend={sendMessage}
            onSendFile={sendFileAnalysis}
            onFileSelect={handleFileSelect}
            onAttachClick={() => fileInputRef.current?.click()}
            onClearFile={() => setAttachedFile(null)}
            onPayClick={() => setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" })}
            onGoToDocs={() => setTab("docs")}
            chatEndRef={chatEndRef}
            fileInputRef={fileInputRef}
          />
        )}

        {tab === "docs" && (
          <DocsTab
            user={user}
            docType={docType}
            docPhase={docPhase}
            docDetails={docDetails}
            docGenerating={docGenerating}
            docErr={docErr}
            currentDoc={currentDoc}
            fillValues={fillValues}
            genDocs={genDocs}
            onDocTypeChange={(dt) => { setDocType(dt); setDocErr(""); }}
            onDocDetailsChange={setDocDetails}
            onGenerate={generateDoc}
            onApplyFill={applyFillValues}
            onFillChange={(key, val) => setFillValues((p) => ({ ...p, [key]: val }))}
            onSetPhase={setDocPhase}
            onSetCurrentDoc={setCurrentDoc}
            onSetFillValues={setFillValues}
            onResetForm={() => { setDocPhase("form"); setDocDetails(""); setCurrentDoc(null); }}
            onGoToChat={() => setTab("chat")}
            onDownload={downloadDoc}
            onOpenDoc={setViewDoc}
            onPayForDoc={(dt) => { setPayment({ type: dt.serviceType, name: dt.label }); setPendingDocType(dt); }}
          />
        )}

        {tab === "history" && (
          <HistoryTab
            user={user}
            messages={messages}
            onGoToChat={() => setTab("chat")}
          />
        )}

        {tab === "profile" && (
          <ProfileTab
            user={user}
            genDocs={genDocs}
            onPay={(type, name) => setPayment({ type, name })}
            onLogout={async () => { await logout(); navigate("/"); }}
          />
        )}

      </main>

      {payment && (
        <PaymentModal
          serviceType={payment.type}
          serviceName={payment.name}
          onClose={() => { setPayment(null); setPendingDocType(null); }}
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