import { useState, useRef, useEffect } from "react";
import { canAskQuestion, consumeQuestion } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import { type ChatMsg } from "@/pages/cabinet/ChatTab";

const GIGACHAT_URL = func2url["gigachat-proxy"];
const WELCOME = "Добрый день! Я AI-юрист, обученный на реальной судебной практике РФ.\n\nЗадайте ваш правовой вопрос — отвечу со ссылками на законы.";

interface UseChatLogicProps {
  refreshUser: () => Promise<void>;
  onPaymentRequired: (type: ServiceType, name: string) => void;
}

export function useChatLogic({ refreshUser, onPaymentRequired }: UseChatLogicProps) {
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

  // Автоочистка чата раз в сутки
  useEffect(() => {
    const CHAT_CLEAR_KEY = "cabinet_chat_cleared_at";
    const now = Date.now();
    const lastCleared = parseInt(localStorage.getItem(CHAT_CLEAR_KEY) || "0", 10);
    if (now - lastCleared > 24 * 60 * 60 * 1000) {
      setMessages([{ role: "ai", text: WELCOME }]);
      setHistory([]);
      localStorage.setItem(CHAT_CLEAR_KEY, String(now));
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    localStorage.setItem("cabinet_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("cabinet_history", JSON.stringify(history));
  }, [history]);

  const sendMessage = async (overrideText?: string) => {
    const userMsg = (overrideText || input).trim();
    if (!userMsg || typing) return;

    const canAsk = await canAskQuestion();
    if (!canAsk) {
      onPaymentRequired("consultation", "AI-консультация (3 вопроса)");
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
      const truncated = data.truncated as boolean | undefined;
      setMessages((p) => [...p, { role: "ai", text: aiText, truncated: !!truncated }]);
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

  const continueChat = async (partialText: string) => {
    if (typing) return;
    setTyping(true);
    setTypingStatus("Продолжаю ответ...");
    setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, truncated: false } : m));
    try {
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat_continue", messages: history, partial: partialText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      const continuation = data.answer as string;
      const merged = partialText + "\n\n" + continuation;
      setMessages((p) => p.map((m, i) =>
        i === p.length - 1 ? { ...m, text: merged, truncated: false } : m
      ));
      setHistory((p) => {
        const prev = [...p];
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") prev[prev.length - 1] = { ...last, content: merged };
        return prev;
      });
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Ошибка продолжения");
    } finally {
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
      onPaymentRequired("consultation", "AI-консультация (3 вопроса)");
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

  return {
    messages,
    input, setInput,
    typing,
    typingStatus,
    chatErr,
    attachedFile, setAttachedFile,
    fileUploading,
    chatEndRef,
    fileInputRef,
    sendMessage,
    continueChat,
    handleFileSelect,
    sendFileAnalysis,
  };
}