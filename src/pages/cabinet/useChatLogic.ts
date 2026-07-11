import { useState, useRef, useEffect } from "react";
import { consumeQuestion, getToken, getQuestionsLeft, invalidateUserCache, hasActiveSubscription, getUser, getDailyFreeLeft, incrementDailyFreeCount, fetchSafe } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import { type ChatMsg, type DocHint } from "@/pages/cabinet/ChatTab";
import { ymGoal } from "@/lib/metrika";
import { getCachedAnswer, setCachedAnswer } from "@/lib/chatCache";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-chat"];
const AI_DOCS_URL = (func2url as Record<string, string>)["ai-docs"];
const WEB_SEARCH_URL = (func2url as Record<string, string>)["web-search"];
const WELCOME = "Добрый день! Я AI-юрист, обученный на реальной судебной практике РФ.\n\nЗадайте ваш правовой вопрос — отвечу со ссылками на законы.";

interface UseChatLogicProps {
  refreshUser: () => Promise<void>;
  onPaymentRequired: (type: ServiceType, name: string) => void;
}

export function useChatLogic({ refreshUser, onPaymentRequired }: UseChatLogicProps) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_messages");
      if (saved) {
        const parsed: ChatMsg[] = JSON.parse(saved);
        return parsed.filter(m => !m.isUpsell);
      }
      // Нет сохранённых сообщений — пробуем перенести историю с лендинга
      const landingRaw = localStorage.getItem("landing_chat_history");
      if (landingRaw) {
        const landingHist: { role: string; content: string }[] = JSON.parse(landingRaw);
        if (landingHist.length > 0) {
          const msgs: ChatMsg[] = [{ role: "ai", text: WELCOME }];
          for (const m of landingHist) {
            if (m.role === "user") msgs.push({ role: "user", text: m.content });
            else if (m.role === "assistant") msgs.push({ role: "ai", text: m.content });
          }
          return msgs;
        }
      }
      return [{ role: "ai", text: WELCOME }];
    } catch { return [{ role: "ai", text: WELCOME }]; }
  });
  const [history, setHistory] = useState<{ role: string; content: string }[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_history");
      if (saved) return JSON.parse(saved);
      // Нет истории кабинета — берём с лендинга
      const landingRaw = localStorage.getItem("landing_chat_history");
      if (landingRaw) {
        const landingHist: { role: string; content: string }[] = JSON.parse(landingRaw);
        return landingHist.map(m => ({
          role: m.role === "assistant" ? "assistant" : m.role,
          content: m.content,
        }));
      }
      return [];
    } catch { return []; }
  });
  // ref всегда хранит актуальное значение истории — нужен для async функций
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState("");
  const [chatErr, setChatErr] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; b64: string; size: string }[]>([]);
  // ref всегда актуален для async функций (stale closure fix)
  const attachedFilesRef = useRef<{ name: string; b64: string; size: string }[]>([]);
  useEffect(() => { attachedFilesRef.current = attachedFiles; }, [attachedFiles]);
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
    const rawMsg = (overrideText || input).trim();
    if (!rawMsg || typing) return;

    // Retry: если последнее сообщение — ошибка с тем же текстом, убираем её и предыдущий user-msg
    // чтобы не было дублей в чате
    if (overrideText) {
      setMessages(p => {
        const last = p[p.length - 1];
        if (last?.isError && last.retryText === overrideText) {
          // Убираем и ошибку, и user-сообщение перед ней
          const withoutError = p.slice(0, -1);
          const prevLast = withoutError[withoutError.length - 1];
          if (prevLast?.role === "user" && prevLast.text === overrideText) {
            return withoutError.slice(0, -1);
          }
          return withoutError;
        }
        return p;
      });
    }

    // Специальный маркер — данные калькулятора неустойки
    if (rawMsg.startsWith("__PENALTY_DATA__:")) {
      try {
        const penaltyData = JSON.parse(rawMsg.slice("__PENALTY_DATA__:".length));
        setMessages(p => [...p, { role: "user", text: "📊 Расчёт неустойки из калькулятора", penaltyData }]);
        setInput("");
        return;
      } catch (e) { console.error("penalty parse", e); }
    }

    const userMsg = rawMsg;

    // Один свежий запрос — проверяем баланс
    invalidateUserCache();
    const currentUser = await getUser();
    if (!currentUser) return;

    const hasDailyFree = getDailyFreeLeft() > 0;
    const isPremium = currentUser.isAdmin || hasActiveSubscription(currentUser, "consult");
    // Пользователь с купленным тарифом (purchasedPlan) не использует бесплатные вопросы —
    // они доступны только пользователям без тарифа
    const hasPurchasedPlan = !!currentUser.purchasedPlan;
    const canUseDailyFree = hasDailyFree && !hasPurchasedPlan;
    const canAsk = isPremium ||
      canUseDailyFree ||
      currentUser.paidQuestions > 0;

    if (!canAsk) {
      setMessages((p) => {
        if (p.some(m => m.isUpsell)) return p;
        return [...p, { role: "ai", isUpsell: true, text: "" }];
      });
      return;
    }

    // Определяем тип вопроса: бесплатный дневной или платный
    const usingDailyFree = !isPremium && canUseDailyFree && currentUser.paidQuestions === 0;

    // Если это бесплатный дневной вопрос — инкрементируем счётчик (не списываем платное)
    if (usingDailyFree) {
      incrementDailyFreeCount();
    }

    setInput("");
    setChatErr("");

    // Детектируем запрос расчёта неустойки/процентов/долга — предлагаем калькулятор кнопкой
    const penaltyKeywords = /(рассчитай|посчитай|подсчитай|сделай\s+расчёт|сделай\s+расчет|помоги\s+рассчитать|как\s+рассчитать|рассчитать|посчитать|нужен\s+расчёт|нужен\s+расчет|хочу\s+рассчитать)\s.*(неустойк|пен[иею]|штраф|процент.*(долг|задолженн)|задолженн.*процент|сумм.*долг|долг.*сумм)/i;
    if (penaltyKeywords.test(userMsg)) {
      setMessages((p) => [
        ...p,
        { role: "user", text: userMsg },
        {
          role: "ai",
          text: "На нашем сервисе есть точный юридический калькулятор неустойки (пеней). Он учитывает все варианты ставок: проценты от долга, ключевую ставку ЦБ РФ или твёрдую сумму в день, а также частичные оплаты и увеличения долга.\n\nДоступно с тарифа **Профи** и выше. Нажмите кнопку ниже, чтобы открыть калькулятор прямо здесь:",
          isPenaltyCalc: true,
        },
      ]);
      return;
    }

    setMessages((p) => [...p, { role: "user", text: userMsg }]);
    setTyping(true);
    setTypingStatus("Анализирую запрос...");

    const newHist = [...historyRef.current, { role: "user", content: userMsg }];
    setHistory(newHist);

    // Вопрос НЕ списываем здесь — только после успешного ответа AI
    const t1 = setTimeout(() => setTypingStatus("Изучаю судебную практику..."), 3000);
    const t2 = setTimeout(() => setTypingStatus("Подбираю нормы законодательства..."), 7000);
    const t3 = setTimeout(() => setTypingStatus("Формирую ответ..."), 12000);

    try {
      const token = getToken();

      // Проверяем кэш перед запросом к AI (5 минут TTL)
      const cached = getCachedAnswer(newHist);
      let aiText: string;
      let truncated: boolean | undefined;
      let needsExpert: boolean | undefined;
      let personalDataRefused: boolean | undefined;

      if (cached) {
        aiText = cached.answer;
        truncated = cached.truncated;
        needsExpert = cached.needs_expert;
        personalDataRefused = undefined;
      } else {
        const res = await fetchSafe(GIGACHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
          body: JSON.stringify({ mode: "chat", messages: newHist }),
        }, 90_000, 1, () => setTypingStatus("Переподключаемся..."));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка сервера");
        aiText = data.answer as string;
        truncated = data.truncated as boolean | undefined;
        needsExpert = data.needs_expert as boolean | undefined;
        personalDataRefused = data.personal_data_refused as boolean | undefined;
        setCachedAnswer(newHist, aiText, !!truncated, !!needsExpert);
      }

      // Списываем вопрос только после успешного ответа — не теряем при ошибке
      let isLastQuestion = false;
      if (!usingDailyFree && !isPremium) {
        const consumeResult = await consumeQuestion();
        isLastQuestion = consumeResult.isLastQuestion;
      }

      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
      setMessages((p) => [...p, {
        role: "ai",
        text: aiText,
        isStreaming: false,
        truncated: !!truncated,
        needsExpert: !!needsExpert,
        personalDataRefused: !!personalDataRefused,
        isLastQuestion,
      }]);

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

      setHistory((p) => [...p, { role: "assistant", content: aiText }]);
      ymGoal("chat_question_sent");
    } catch (e) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
      setChatErr(e instanceof Error ? e.message : "Ошибка соединения");
      // Сохраняем текст вопроса в retryText — пользователь может повторить без переписывания
      setMessages((p) => [...p, {
        role: "ai",
        text: "",
        isError: true,
        retryText: userMsg,
      }]);
    }
  };

  const revealAnswer = (_msgIndex: number) => { /* воронка отключена */ };

  const continueChat = async (partialText: string) => {
    if (typing) return;
    setTyping(true);
    setTypingStatus("Продолжаю ответ...");
    setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, truncated: false } : m));
    try {
      const res = await fetchSafe(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat_continue", messages: history, partial: partialText }),
      }, 90_000, 1, () => setTypingStatus("Переподключаемся..."));
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

  /** Поиск судебной практики по конкретному ответу AI прямо в чате (списывает 1 вопрос) */
  const searchCaseLawForMsg = async (aiText: string, msgIdx: number) => {
    // Проверяем баланс так же, как перед обычным вопросом
    invalidateUserCache();
    const currentUser = await getUser();
    if (!currentUser) return;

    const hasDailyFree = getDailyFreeLeft() > 0;
    const isPremium = currentUser.isAdmin || hasActiveSubscription(currentUser, "consult");
    const hasPurchasedPlan = !!currentUser.purchasedPlan;
    const canUseDailyFree = hasDailyFree && !hasPurchasedPlan;
    const canAsk = isPremium || canUseDailyFree || currentUser.paidQuestions > 0;

    if (!canAsk) {
      setMessages((p) => {
        if (p.some(m => m.isUpsell)) return p;
        return [...p, { role: "ai", isUpsell: true, text: "" }];
      });
      return;
    }
    const usingDailyFree = !isPremium && canUseDailyFree && currentUser.paidQuestions === 0;

    // Добавляем карточку поиска сразу после сообщения — со статусом загрузки
    setMessages((p) => [
      ...p.slice(0, msgIdx + 1),
      { role: "ai", text: "", isCaseLawSearch: true, caseLawLoading: true, caseLawSourceText: aiText },
      ...p.slice(msgIdx + 1),
    ]);
    const insertedIdx = msgIdx + 1;

    try {
      const token = getToken();
      // Шаг 1: собираем короткий поисковый запрос через AI
      const qRes = await fetchSafe(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "case_law_query", messages: historyRef.current, ai_answer: aiText }),
      }, 30_000, 1);
      const qData = await qRes.json();
      if (!qRes.ok) throw new Error(qData.error || "Не удалось составить запрос");
      const searchQuery = (qData.search_query as string || "").trim();
      if (!searchQuery) throw new Error("Не удалось составить поисковый запрос");

      setMessages((p) => p.map((m, i) => i === insertedIdx ? { ...m, caseLawQuery: searchQuery } : m));

      // Шаг 2: ищем через web-search (та же логика что и кнопка «Судебная практика»)
      const sRes = await fetch(WEB_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ query: searchQuery, limit: 6 }),
      });
      const sData = await sRes.json();
      if (!sRes.ok || sData.error) throw new Error(sData.error || "Ошибка поиска");

      setMessages((p) => p.map((m, i) => i === insertedIdx
        ? { ...m, caseLawLoading: false, caseLawResults: sData.results ?? [] }
        : m));

      // Списываем вопрос только после успешного поиска
      if (usingDailyFree) {
        incrementDailyFreeCount();
      } else if (!isPremium) {
        await consumeQuestion();
      }
      invalidateUserCache();
      refreshUser();
      const left = await getQuestionsLeft();
      if (left === 0) {
        setTimeout(() => {
          setMessages((p) => {
            if (p.some(m => m.isUpsell)) return p;
            return [...p, { role: "ai", isUpsell: true, text: "" }];
          });
        }, 900);
      }
      ymGoal("case_law_from_chat");
    } catch (e) {
      setMessages((p) => p.map((m, i) => i === insertedIdx
        ? { ...m, caseLawLoading: false, caseLawError: e instanceof Error ? e.message : "Ошибка поиска" }
        : m));
    }
  };

  /** Оценка перспективы дела на основе найденной судебной практики (списывает 1 вопрос) */
  const assessCaseLawPerspective = async (caseLawMsgIdx: number) => {
    const caseLawMsg = messages[caseLawMsgIdx];
    if (!caseLawMsg || !caseLawMsg.caseLawResults || caseLawMsg.caseLawResults.length === 0) return;

    // Проверяем баланс так же, как перед обычным вопросом
    invalidateUserCache();
    const currentUser = await getUser();
    if (!currentUser) return;

    const hasDailyFree = getDailyFreeLeft() > 0;
    const isPremium = currentUser.isAdmin || hasActiveSubscription(currentUser, "consult");
    const hasPurchasedPlan = !!currentUser.purchasedPlan;
    const canUseDailyFree = hasDailyFree && !hasPurchasedPlan;
    const canAsk = isPremium || canUseDailyFree || currentUser.paidQuestions > 0;

    if (!canAsk) {
      setMessages((p) => {
        if (p.some(m => m.isUpsell)) return p;
        return [...p, { role: "ai", isUpsell: true, text: "" }];
      });
      return;
    }
    const usingDailyFree = !isPremium && canUseDailyFree && currentUser.paidQuestions === 0;

    // Помечаем карточку поиска как «оценка запущена» — прячем кнопку
    setMessages((p) => p.map((m, i) => i === caseLawMsgIdx ? { ...m, caseLawAssessed: true } : m));

    // Добавляем карточку оценки сразу после карточки поиска — со статусом загрузки
    setMessages((p) => [
      ...p.slice(0, caseLawMsgIdx + 1),
      { role: "ai", text: "", isCaseLawAssessment: true, caseLawAssessmentLoading: true },
      ...p.slice(caseLawMsgIdx + 1),
    ]);
    const insertedIdx = caseLawMsgIdx + 1;

    try {
      const token = getToken();
      const res = await fetchSafe(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "case_law_assessment",
          messages: historyRef.current,
          ai_answer: caseLawMsg.caseLawSourceText || "",
          case_results: caseLawMsg.caseLawResults,
        }),
      }, 40_000, 1);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Не удалось оценить перспективу дела");

      setMessages((p) => p.map((m, i) => i === insertedIdx
        ? { ...m, caseLawAssessmentLoading: false, text: data.answer as string }
        : m));

      // Списываем вопрос только после успешной оценки
      if (usingDailyFree) {
        incrementDailyFreeCount();
      } else if (!isPremium) {
        await consumeQuestion();
      }
      invalidateUserCache();
      refreshUser();
      const left = await getQuestionsLeft();
      if (left === 0) {
        setTimeout(() => {
          setMessages((p) => {
            if (p.some(m => m.isUpsell)) return p;
            return [...p, { role: "ai", isUpsell: true, text: "" }];
          });
        }, 900);
      }
      ymGoal("case_law_assessment");
    } catch (e) {
      setMessages((p) => p.map((m, i) => i === insertedIdx
        ? { ...m, caseLawAssessmentLoading: false, caseLawAssessmentError: e instanceof Error ? e.message : "Ошибка оценки" }
        : m));
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

  const MAX_ATTACHED = 3;

  const processFile = (file: File): Promise<{ name: string; b64: string; size: string } | null> => {
    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name);
    const isDoc = /\.(pdf|doc|docx|txt)$/i.test(file.name)
      || ["application/pdf", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);

    if (!isImage && !isDoc) return Promise.resolve(null);

    // Лимит: документы 5МБ, фото 5МБ.
    // ВАЖНО: 5 файлов × 5МБ × 1.33 base64 = ~33МБ — слишком много для платформы (~10МБ лимит).
    // Платформа режет запрос молча. 3 файла по 5МБ = ~20МБ — тоже на грани.
    // Безопасный расчёт: лимит платформы ~10МБ ÷ 1.33 ÷ MAX_ATTACHED = ~1.5МБ/файл при 5.
    // Но при 1-3 файлах допускаем до 5МБ (3 × 5 × 1.33 = ~20МБ — граница).
    const maxMb = 5;
    if (file.size > maxMb * 1024 * 1024) return Promise.resolve(null);

    if (isImage) {
      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      const normalizedName = baseName + ".jpg";
      return compressImageCanvas(file)
        .then(({ b64, sizeStr }) => ({ name: normalizedName, b64, size: sizeStr }))
        .catch(() => new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = (reader.result as string).split(",")[1];
            res({ name: normalizedName, b64, size: `${(file.size / (1024 * 1024)).toFixed(1)} МБ` });
          };
          reader.onerror = () => res(null);
          reader.readAsDataURL(file);
        }));
    } else {
      return new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(",")[1];
          const sizeStr = file.size < 1024 * 1024
            ? `${Math.round(file.size / 1024)} КБ`
            : `${(file.size / (1024 * 1024)).toFixed(1)} МБ`;
          res({ name: file.name, b64, size: sizeStr });
        };
        reader.onerror = () => res(null);
        reader.readAsDataURL(file);
      });
    }
  };

  const _processFiles = (files: File[]) => {
    if (!files.length) return;
    const slotsLeft = MAX_ATTACHED - attachedFiles.length;
    if (slotsLeft <= 0) {
      setChatErr(`Можно прикрепить не более ${MAX_ATTACHED} файлов`);
      return;
    }
    const toProcess = files.slice(0, slotsLeft);
    setChatErr("");
    setFileUploading(true);
    Promise.all(toProcess.map(processFile)).then((results) => {
      const valid = results.filter((r): r is { name: string; b64: string; size: string } => r !== null);
      if (valid.length) {
        setAttachedFiles((prev) => [...prev, ...valid].slice(0, MAX_ATTACHED));
      } else {
        setChatErr("Допустимые форматы: PDF/DOCX до 1.5 МБ, фото JPG/PNG до 5 МБ.");
      }
      setFileUploading(false);
    });
  };

  const handleFileDrop = (fileList: FileList) => {
    _processFiles(Array.from(fileList));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    _processFiles(files);
  };

  // comment передаётся явным параметром из ChatInputBar (native ref) — без iOS race condition
  const sendFileAnalysis = async (commentFromInput?: string, directFiles?: { name: string; b64: string; size: string }[]) => {
    // directFiles — файлы из конвертора (передаются напрямую, минуя ref)
    const currentFiles = directFiles ?? attachedFilesRef.current;
    if (!currentFiles.length || typing) return;

    invalidateUserCache();
    const currentUser = await getUser();
    if (!currentUser) return;
    const canAsk = currentUser.isAdmin ||
      hasActiveSubscription(currentUser, "consult") ||
      currentUser.hasFileAnalysis ||
      currentUser.paidQuestions > 0;
    if (!canAsk) {
      setMessages((p) => {
        if (p.some(m => m.isUpsell)) return p;
        return [...p, { role: "ai", isUpsell: true, text: "" }];
      });
      return;
    }

    const comment = (commentFromInput ?? input).trim();
    const files = currentFiles;
    setAttachedFiles([]);
    setInput("");
    setChatErr("");

    // Сообщение пользователя со списком файлов
    const filesLabel = files.map(f => `📎 ${f.name}`).join("\n");
    setMessages((p) => [...p, {
      role: "user",
      text: `${filesLabel}${comment ? `\n${comment}` : ""}`,
      isFile: true,
    } as ChatMsg]);

    const hasImages = files.some(f => /\.(jpg|jpeg|png)$/i.test(f.name));
    const hasQuestion = !!comment;
    const multiFile = files.length > 1;
    setTyping(true);
    setTypingStatus(
      multiFile ? "Читаю документы..." :
      hasImages ? "Распознаю текст на фото (OCR)..." : "Читаю документ..."
    );

    const t1 = setTimeout(() => setTypingStatus(hasQuestion ? "Ищу ответ в документах..." : "Анализирую структуру и содержание..."), 4000);
    const t2 = setTimeout(() => setTypingStatus(hasQuestion ? "Формирую ответ..." : "Проверяю соответствие нормам РФ..."), 10000);
    const t3 = setTimeout(() => setTypingStatus(hasQuestion ? "Почти готово..." : "Выявляю правовые риски..."), 16000);

    try {
      const consumeResult = await consumeQuestion();
      if (!consumeResult.ok) {
        setTyping(false);
        setTypingStatus("");
        clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
        setMessages((p) => {
          if (p.some(m => m.isUpsell)) return p;
          return [...p, { role: "ai", isUpsell: true, text: "" }];
        });
        return;
      }
      const isLastQuestion = consumeResult.isLastQuestion;
      refreshUser();

      const token = getToken();
      // Платформа режет запросы > ~7 МБ (JSON + заголовки + base64 overhead 1.33x).
      // Безопасная граница — 4.5 МБ суммарного b64.
      const PLATFORM_LIMIT_BYTES = 4.5 * 1024 * 1024;
      const totalB64 = files.reduce((sum, f) => sum + f.b64.length, 0);
      if (totalB64 > PLATFORM_LIMIT_BYTES) {
        const totalMb = (totalB64 / 1024 / 1024).toFixed(1);
        throw new Error(
          `Файлы слишком большие (${totalMb} МБ суммарно). ` +
          `Попробуйте уменьшить количество файлов или их размер — максимум ~4 МБ суммарно.`
        );
      }

      const res = await fetchSafe(AI_DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "file_analyze",
          comment,
          files: files.map(f => ({ file: f.b64, filename: f.name })),
        }),
      }, 115_000, 0);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      const aiText = data.answer as string;
      const docHint: DocHint | undefined = data.doc_hint
        ? { ...data.doc_hint, extracted_text: data.extracted_text }
        : undefined;

      if (isLastQuestion && aiText.length > 200) {
        const half = Math.ceil(aiText.length / 2);
        const cutIdx = aiText.lastIndexOf(" ", half) || half;
        const visibleText = aiText.slice(0, cutIdx).trimEnd() + "…";
        setMessages((p) => [...p, {
          role: "ai",
          text: visibleText,
          fullAnswer: aiText,
          isLastQuestion: true,
          truncated: false,
          docHint,
        }]);
        ymGoal("chat_funnel_shown");
      } else {
        setMessages((p) => [...p, { role: "ai", text: aiText, docHint }]);
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

      const fileNames = files.map(f => f.name).join(", ");
      // Записываем в историю: пользователь + ответ AI (для уточняющих вопросов)
      setHistory((p) => [...p,
        { role: "user", content: `Я загрузил документ${files.length > 1 ? "ы" : ""}: ${fileNames}${comment ? `. Мой вопрос: ${comment}` : ""}` },
        { role: "assistant", content: aiText },
      ]);
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Ошибка анализа");
      setMessages((p) => [...p, { role: "ai", text: "Не удалось проанализировать документ. Попробуйте ещё раз." }]);
      // При ошибке тоже пишем в историю — без ответа, только запрос пользователя
      // Это позволит задать уточняющий вопрос вручную
      const fileNames = files.map(f => f.name).join(", ");
      setHistory((p) => [...p,
        { role: "user", content: `Я загрузил документ${files.length > 1 ? "ы" : ""}: ${fileNames}${comment ? `. Мой вопрос: ${comment}` : ""}` },
      ]);
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
    }
  };

  // Анализ готового/заполненного документа из раздела Документы
  const sendDocAnalysis = async (docName: string, docText: string) => {
    if (typing) return;

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

    setChatErr("");
    setMessages((p) => [...p, { role: "user", text: `📄 Проанализировать: ${docName}`, isFile: true } as ChatMsg]);
    setTyping(true);
    setTypingStatus("Читаю документ...");

    const t1 = setTimeout(() => setTypingStatus("Анализирую структуру и содержание..."), 4000);
    const t2 = setTimeout(() => setTypingStatus("Проверяю соответствие нормам РФ..."), 10000);
    const t3 = setTimeout(() => setTypingStatus("Выявляю правовые риски..."), 16000);

    try {
      const consumeResult = await consumeQuestion();
      if (!consumeResult.ok) {
        clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
        setTyping(false);
        setTypingStatus("");
        setMessages((p) => {
          if (p.some(m => m.isUpsell)) return p;
          return [...p, { role: "ai", isUpsell: true, text: "" }];
        });
        return;
      }
      const isLastQuestion = consumeResult.isLastQuestion;
      refreshUser();

      const token = getToken();
      // Кодируем текст документа как .txt файл в base64
      const textBytes = new TextEncoder().encode(docText.slice(0, 12000));
      // btoa на больших данных — безопасный способ через reduce
      const b64 = btoa(Array.from(textBytes).map(b => String.fromCharCode(b)).join(""));
      const filename = `${docName}.txt`;

      // sendDocAnalysis → ai-docs. timeout=115с, retries=0.
      const res = await fetchSafe(AI_DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({ mode: "file_analyze", file: b64, filename, comment: "" }),
      }, 115_000, 0);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      const aiText = data.answer as string;
      const docHint: DocHint | undefined = data.doc_hint
        ? { ...data.doc_hint, extracted_text: data.extracted_text }
        : undefined;

      if (isLastQuestion && aiText.length > 200) {
        const half = Math.ceil(aiText.length / 2);
        const cutIdx = aiText.lastIndexOf(" ", half) || half;
        const visibleText = aiText.slice(0, cutIdx).trimEnd() + "…";
        setMessages((p) => [...p, { role: "ai", text: visibleText, fullAnswer: aiText, isLastQuestion: true, truncated: false, docHint }]);
        ymGoal("chat_funnel_shown");
      } else {
        setMessages((p) => [...p, { role: "ai", text: aiText, docHint }]);
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

      setHistory((p) => [...p,
        { role: "user", content: `Я загрузил документ: ${docName}` },
        { role: "assistant", content: aiText },
      ]);
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Ошибка анализа");
      setMessages((p) => [...p, { role: "ai", text: "Не удалось проанализировать документ. Попробуйте ещё раз." }]);
      setHistory((p) => [...p, { role: "user", content: `Я загрузил документ: ${docName}` }]);
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setTyping(false);
      setTypingStatus("");
    }
  };

  // Запустить анализ файла напрямую (используется при редиректе из лендинга после оплаты)
  const analyzeFileDirectly = async (file: { name: string; b64: string }, comment: string) => {
    invalidateUserCache();
    const currentUser = await getUser();
    if (!currentUser) return;
    const canAsk = currentUser.isAdmin ||
      hasActiveSubscription(currentUser, "consult") ||
      currentUser.hasFileAnalysis ||
      currentUser.paidQuestions > 0;
    if (!canAsk) return;

    const files = [{ ...file, size: "" }];
    setChatErr("");
    const hasImages = /\.(jpg|jpeg|png)$/i.test(file.name);
    const hasQuestion = !!comment.trim();

    setMessages((p) => [...p, {
      role: "user",
      text: `📎 ${file.name}${comment.trim() ? `\n${comment.trim()}` : ""}`,
      isFile: true,
    } as ChatMsg]);

    setTyping(true);
    setTypingStatus(hasImages ? "Распознаю текст на фото (OCR)..." : "Читаю документ...");

    const t1 = setTimeout(() => setTypingStatus(hasQuestion ? "Ищу ответ в документах..." : "Анализирую структуру и содержание..."), 4000);
    const t2 = setTimeout(() => setTypingStatus(hasQuestion ? "Формирую ответ..." : "Проверяю соответствие нормам РФ..."), 10000);
    const t3 = setTimeout(() => setTypingStatus("Выявляю правовые риски..."), 16000);

    try {
      const consumeResult = await consumeQuestion();
      if (!consumeResult.ok) {
        setMessages((p) => {
          if (p.some(m => m.isUpsell)) return p;
          return [...p, { role: "ai", isUpsell: true, text: "" }];
        });
        return;
      }
      refreshUser();

      const token = getToken();
      const res = await fetchSafe(AI_DOCS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "file_analyze",
          comment: comment.trim(),
          files: files.map(f => ({ file: f.b64, filename: f.name })),
        }),
      }, 115_000, 0);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");
      const aiText = data.answer as string;
      const docHint: DocHint | undefined = data.doc_hint
        ? { ...data.doc_hint, extracted_text: data.extracted_text }
        : undefined;

      // analyzeFileDirectly — оплаченный анализ, ответ никогда не обрезается
      setMessages((p) => [...p, { role: "ai", text: aiText, docHint }]);
      invalidateUserCache();
      refreshUser();
      setHistory((p) => [...p,
        { role: "user", content: `Я загрузил документ: ${file.name}` },
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
    attachedFiles, setAttachedFiles,
    fileUploading,
    chatEndRef,
    fileInputRef,
    sendMessage,
    continueChat,
    searchCaseLawForMsg,
    assessCaseLawPerspective,
    handleFileSelect,
    handleFileDrop,
    sendFileAnalysis,
    sendDocAnalysis,
    analyzeFileDirectly,
    injectAiMessage,
    removeUpsell,
    revealAnswer,
    revealLastFunnelAnswer,
  };
}