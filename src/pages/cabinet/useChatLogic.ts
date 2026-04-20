import { useState, useRef, useEffect } from "react";
import { consumeQuestion, getToken, getQuestionsLeft, invalidateUserCache, hasActiveSubscription, getUser } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import { type ChatMsg, type DocHint } from "@/pages/cabinet/ChatTab";
import { ymGoal } from "@/lib/metrika";

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
      if (!saved) return [{ role: "ai", text: WELCOME }];
      // Убираем сохранённый upsell — он будет пересчитан после проверки баланса
      const parsed: ChatMsg[] = JSON.parse(saved);
      return parsed.filter(m => !m.isUpsell);
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

  // При маунте: если вопросов 0 и есть история сообщений — показываем upsell с анимацией
  useEffect(() => {
    const check = async () => {
      const left = await getQuestionsLeft();
      if (left === 0) {
        // Небольшая задержка чтобы чат успел отрендериться и анимация была видна
        setTimeout(() => {
          setMessages(p => {
            if (p.some(m => m.isUpsell)) return p;
            // Показываем только если есть реальные сообщения (не только приветствие)
            const hasRealMessages = p.some(m => m.role === "user");
            if (!hasRealMessages) return p;
            return [...p, { role: "ai", isUpsell: true, text: "" }];
          });
        }, 600);
      }
    };
    check();
   
  }, []);

  useEffect(() => {
    // instant на первом рендере, smooth при новых сообщениях
    const el = chatEndRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    const el = chatEndRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    // Не сохраняем upsell — он пересчитывается при маунте
    // fullAnswer сохраняем: нужен для отображения воронки после перезагрузки
    const toSave = messages.filter(m => !m.isUpsell);
    localStorage.setItem("cabinet_messages", JSON.stringify(toSave));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("cabinet_history", JSON.stringify(history));
  }, [history]);

  const sendMessage = async (overrideText?: string) => {
    const userMsg = (overrideText || input).trim();
    if (!userMsg || typing) return;

    // Один запрос — получаем свежего пользователя и сразу проверяем всё
    invalidateUserCache();
    const currentUser = await getUser();
    if (!currentUser) return;

    const canAsk = currentUser.isAdmin ||
      hasActiveSubscription(currentUser, "consult") ||
      currentUser.paidQuestions > 0;

    if (!canAsk) {
      setMessages((p) => {
        if (p.some(m => m.isUpsell)) return p;
        return [...p, { role: "ai", isUpsell: true, text: "" }];
      });
      return;
    }

    // Воронка: этот вопрос последний если paidQuestions === 1 и нет подписки/админа
    const isLastQuestion =
      !currentUser.isAdmin &&
      !hasActiveSubscription(currentUser, "consult") &&
      currentUser.paidQuestions === 1;

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
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Auth-Token": token } : {}),
        },
        body: JSON.stringify({ mode: "chat", messages: newHist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      const aiText = data.answer as string;
      const truncated = data.truncated as boolean | undefined;
      const needsExpert = data.needs_expert as boolean | undefined;
      const personalDataRefused = data.personal_data_refused as boolean | undefined;

      // Воронка: прячем вторую половину ответа когда это был последний вопрос
      if (isLastQuestion && aiText.length > 200) {
        const half = Math.ceil(aiText.length / 2);
        const cutIdx = aiText.lastIndexOf(" ", half) || half;
        setMessages((p) => [...p, {
          role: "ai",
          text: aiText.slice(0, cutIdx),
          fullAnswer: aiText,
          isLastQuestion: true,
          truncated: false,
          needsExpert: !!needsExpert,
          personalDataRefused: !!personalDataRefused,
        }]);
        ymGoal("chat_funnel_shown");
      } else {
        setMessages((p) => [...p, {
          role: "ai",
          text: aiText,
          truncated: !!truncated,
          needsExpert: !!needsExpert,
          personalDataRefused: !!personalDataRefused,
        }]);
        // Upsell-карточку показываем только если воронка НЕ сработала
        invalidateUserCache();
        const left = await getQuestionsLeft();
        refreshUser();
        if (left === 0) {
          setTimeout(() => {
            setMessages((p) => {
              if (p.some(m => m.isUpsell)) return p;
              return [...p, { role: "ai", isUpsell: true, text: "" }];
            });
          }, 900);
        }
      }

      setHistory((p) => [...p, { role: "assistant", content: aiText }]);
      ymGoal("chat_question_sent");
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Ошибка соединения");
      setMessages((p) => [...p, { role: "ai", text: "Произошла ошибка. Попробуйте ещё раз." }]);
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
    }
  };

  // Открываем полный ответ после оплаты (воронка продаж)
  const revealAnswer = async (msgIndex: number) => {
    // Сначала проверяем — появились ли вопросы после оплаты
    invalidateUserCache();
    const user = await getUser();
    const canReveal = user && (
      hasActiveSubscription(user, "consult") ||
      user.isAdmin ||
      user.paidQuestions > 0
    );
    if (!canReveal) {
      // Вопросов ещё нет — открываем оплату
      onPaymentRequired("consultation", "3 вопроса к AI-юристу");
      return;
    }
    // Раскрываем полный ответ
    setMessages((p) => p.map((m, i) =>
      i === msgIndex && m.isLastQuestion && m.fullAnswer
        ? { ...m, text: m.fullAnswer, isLastQuestion: false, fullAnswer: undefined }
        : m
    ));
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

  /** Сжимает изображение через Canvas до ≤800 КБ и max 1600px, возвращает base64 JPEG */
  const compressImageCanvas = (file: File): Promise<{ b64: string; sizeStr: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_SIDE = 1600;
        const MAX_BYTES = 800_000;
        let { width, height } = img;
        if (Math.max(width, height) > MAX_SIDE) {
          const ratio = MAX_SIDE / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // Подбираем качество пока файл не влезет в лимит
        let quality = 0.82;
        const tryEncode = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const b64 = dataUrl.split(",")[1];
          const bytes = Math.round((b64.length * 3) / 4);
          if (bytes > MAX_BYTES && quality > 0.3) {
            quality -= 0.15;
            tryEncode();
          } else {
            const sizeStr = bytes < 1024 * 1024
              ? `${Math.round(bytes / 1024)} КБ`
              : `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
            resolve({ b64, sizeStr });
          }
        };
        tryEncode();
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img load error")); };
      img.src = url;
    });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name);
    const isDoc = /\.(pdf|doc|docx)$/i.test(file.name)
      || ["application/pdf", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);

    if (!isImage && !isDoc) {
      setChatErr("Допустимые форматы: PDF, DOC, DOCX или любое фото");
      return;
    }

    const maxMb = isImage ? 20 : 10;
    if (file.size > maxMb * 1024 * 1024) {
      setChatErr(`Файл слишком большой. Максимум ${maxMb} МБ.`);
      return;
    }

    setFileUploading(true);
    setChatErr("");

    if (isImage) {
      // Сжимаем через Canvas — работает с любым форматом (HEIC, WebP, BMP и т.д.)
      // и гарантированно отдаёт JPEG до 800 КБ
      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      const normalizedName = baseName + ".jpg";
      compressImageCanvas(file)
        .then(({ b64, sizeStr }) => {
          setAttachedFile({ name: normalizedName, b64, size: sizeStr });
          setFileUploading(false);
        })
        .catch(() => {
          // Fallback: читаем как есть если Canvas не справился
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = (reader.result as string).split(",")[1];
            const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} МБ`;
            setAttachedFile({ name: normalizedName, b64, size: sizeStr });
            setFileUploading(false);
          };
          reader.onerror = () => { setChatErr("Не удалось прочитать файл"); setFileUploading(false); };
          reader.readAsDataURL(file);
        });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        const sizeStr = file.size < 1024 * 1024
          ? `${Math.round(file.size / 1024)} КБ`
          : `${(file.size / (1024 * 1024)).toFixed(1)} МБ`;
        setAttachedFile({ name: file.name, b64, size: sizeStr });
        setFileUploading(false);
      };
      reader.onerror = () => { setChatErr("Не удалось прочитать файл"); setFileUploading(false); };
      reader.readAsDataURL(file);
    }

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
    const isImage = /\.(jpg|jpeg|png)$/i.test(file.name);
    const hasQuestion = !!comment;
    setTyping(true);
    setTypingStatus(isImage ? "Распознаю текст на фото (OCR)..." : "Читаю документ...");
    await consumeQuestion();
    refreshUser();

    const t1 = setTimeout(() => setTypingStatus(hasQuestion ? "Ищу ответ в документе..." : isImage ? "Извлекаю текст из изображения..." : "Анализирую структуру и содержание..."), 4000);
    const t2 = setTimeout(() => setTypingStatus(hasQuestion ? "Формирую ответ..." : "Проверяю соответствие нормам РФ..."), 10000);
    const t3 = setTimeout(() => setTypingStatus(hasQuestion ? "Почти готово..." : "Выявляю правовые риски..."), 16000);

    try {
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Auth-Token": token } : {}),
        },
        body: JSON.stringify({ mode: "file_analyze", file: file.b64, filename: file.name, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      const aiText = data.answer as string;
      const docHint: DocHint | undefined = data.doc_hint
        ? { ...data.doc_hint, extracted_text: data.extracted_text }
        : undefined;
      setMessages((p) => [...p, { role: "ai", text: aiText, docHint }]);
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

  // Вставить сообщение AI без запроса к серверу (для диалога уточнения документа)
  const injectAiMessage = (text: string) => {
    setMessages((p) => [...p, { role: "ai", text }]);
  };

  // Убрать upsell-карточку после успешной оплаты
  const removeUpsell = () => {
    setMessages((p) => p.filter(m => !m.isUpsell));
  };

  // Раскрыть последний заблюренный ответ (вызывается автоматически после оплаты)
  const revealLastFunnelAnswer = () => {
    setMessages((p) => p.map((m) =>
      m.isLastQuestion && m.fullAnswer
        ? { ...m, text: m.fullAnswer, isLastQuestion: false, fullAnswer: undefined }
        : m
    ));
  };

  return {
    messages,
    history,
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
    injectAiMessage,
    removeUpsell,
    revealAnswer,
    revealLastFunnelAnswer,
  };
}