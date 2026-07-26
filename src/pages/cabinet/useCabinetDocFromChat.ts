import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { type DocHint } from "@/pages/cabinet/ChatTab";
import { type User } from "@/lib/auth";
import { DOC_TYPES, type DocType } from "@/pages/cabinet/docBlocks";
import { extractDocNameFromAiText } from "@/pages/cabinet/docNameExtractor";
import func2url from "../../../backend/func2url.json";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-chat"];

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";

interface UseDocsLogicSlice {
  setDocType: (dt: DocType) => void;
  setDocDetails: (v: string) => void;
  setDocPhase: (v: string) => void;
  setDocErr: (v: string) => void;
  generateDocWith: (dt: DocType, details: string, files?: undefined, customLabel?: string) => void;
  docDetails: string;
}

interface UseChatLogicSlice {
  messages: { role: string; text: string }[];
}

interface UseCabinetDocFromChatOptions {
  user: User | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  docs: UseDocsLogicSlice;
  chat: UseChatLogicSlice;
  openDocChoice: (docTypeId: string, docLabel: string) => void;
}

/** Данные для модалки подтверждения документа перед генерацией из чата */
export interface DocFromChatDraft {
  /** Название, показанное/редактируемое пользователем в модалке */
  label: string;
  /** id из каталога, если найдено совпадение — иначе "claim" (используется только
   * для выбора системного промта/цены; фактический заголовок задаёт customLabel) */
  docTypeId: string;
  /** Ситуация пользователя + факты из диалога — техническое задание для генерации */
  details: string;
  /** true, пока идёт fallback-запрос определения типа (когда нет docHint и не
   * удалось распарсить название из текста рекомендации) */
  loadingLabel: boolean;
}

export function useCabinetDocFromChat({
  user,
  tab,
  setTab,
  docs,
  chat,
  openDocChoice,
}: UseCabinetDocFromChatOptions) {
  const [pendingDocFromChat, setPendingDocFromChat] = useState<{ details: string; docTypeId: string; customLabel: string } | null>(null);
  const [creatingDocFromChat, setCreatingDocFromChat] = useState(false);
  // Черновик для модалки подтверждения — показывается ПЕРЕД реальной генерацией
  const [docDraft, setDocDraft] = useState<DocFromChatDraft | null>(null);

  useEffect(() => {
    if (!pendingDocFromChat || tab !== "docs") return;
    const dt = DOC_TYPES.find(d => d.id === pendingDocFromChat.docTypeId) || DOC_TYPES[0];
    const details = pendingDocFromChat.details;
    const customLabel = pendingDocFromChat.customLabel;
    setPendingDocFromChat(null);
    docs.setDocType(dt);
    docs.setDocDetails(details);
    docs.setDocPhase("form");
    docs.setDocErr("");
    setTimeout(() => docs.generateDocWith(dt, details, undefined, customLabel), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocFromChat, tab]);

  /**
   * Шаг 1: клик «Создать документ» — определяем тип/название и открываем
   * модалку подтверждения (DocFromChatModal), генерация НЕ запускается сразу.
   */
  const createDocFromChat = async (aiText: string, userText: string, docHint?: DocHint) => {
    if (creatingDocFromChat || !user) return;
    setCreatingDocFromChat(true);

    try {
      const canDoc = user.isAdmin || (user.paidDocs ?? 0) > 0 ||
        (user.subscriptionDocsUntil ? new Date(user.subscriptionDocsUntil) > new Date() : false);

      // Базовые данные ситуации — история диалога передаётся отдельно на генерацию
      // (см. useDocsLogic → chat_history), здесь достаточно последнего обмена.
      const baseDetails = `${userText}\n\n${aiText.slice(0, 500)}`;

      // 1) Если backend уже вернул структурированный doc_hint (сценарий анализа файла) —
      //    используем его напрямую, это самый точный источник.
      if (docHint?.doc_type && docHint?.details) {
        const details = docHint.extracted_text
          ? `${docHint.details}\n\n[Текст из документа пользователя]:\n${docHint.extracted_text.slice(0, 4000)}`
          : docHint.details;
        const docTypeId = DOC_TYPES.some(d => d.id === docHint.doc_type) ? docHint.doc_type : "claim";
        if (!canDoc) { openDocChoice(docTypeId, docHint.doc_label || "документ"); return; }
        setDocDraft({ label: docHint.doc_label || "документ", docTypeId, details, loadingLabel: false });
        return;
      }

      // 2) Обычный текстовый чат: пытаемся извлечь ТОЧНОЕ название документа прямо
      //    из текста рекомендации AI (без повторного обращения к AI) — это устраняет
      //    расхождение между тем, что AI порекомендовал, и тем, что в итоге создаётся.
      const extracted = extractDocNameFromAiText(aiText);
      if (extracted) {
        const docTypeId = extracted.matchedTypeId || "claim";
        if (!canDoc) { openDocChoice(docTypeId, extracted.label); return; }
        setDocDraft({ label: extracted.label, docTypeId, details: baseDetails, loadingLabel: false });
        return;
      }

      // 3) Fallback — рекомендация не найдена по известным паттернам (редкий случай,
      //    например если промт AI изменится). Открываем модалку сразу с плейсхолдером
      //    и в фоне уточняем тип через отдельный AI-запрос по истории диалога —
      //    пользователь в любом случае видит и может поправить название перед генерацией.
      if (!canDoc) { openDocChoice("claim", "документ"); return; }
      setDocDraft({ label: "", docTypeId: "claim", details: baseDetails, loadingLabel: true });

      const recentMessages = chat.messages.slice(-5);
      const dialogContext = recentMessages
        .filter(m => m.text && m.text.length > 5)
        .map(m => `${m.role === "user" ? "Пользователь" : "Юрист"}: ${m.text.slice(0, 500)}`)
        .join("\n\n");

      try {
        const validIds = new Set(DOC_TYPES.map(d => d.id));
        const docTypesList = DOC_TYPES.map(d => `"${d.id}":${d.label}`).join("|");
        const systemPrompt = `Ты — помощник юриста. На основе переписки определи нужный тип документа и сформулируй подробное техническое задание для его генерации.
Список типов (id:название): ${docTypesList}
Извлеки из переписки: стороны (ФИО/организации), суммы, даты, адреса, предмет спора, нарушенные права — всё что поможет составить документ.
Выбери ОДИН id из списка выше. Ответь ТОЛЬКО JSON: {"doc_type":"id_из_списка","details":"подробное описание ситуации и всех известных фактов"}`;
        const userPrompt = `Переписка:\n\n${dialogContext}\n\nПоследний ответ юриста:\n${aiText.slice(0, 800)}`;
        const token = getToken();
        const res = await fetch(GIGACHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
          body: JSON.stringify({ mode: "chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
        });
        const data = await res.json();
        const match = (data.answer || "").match(/\{[\s\S]*?\}/);
        let docTypeId = "claim";
        let details = baseDetails;
        if (match) {
          try {
            const p = JSON.parse(match[0]);
            const rawId = p.doc_type || "";
            docTypeId = validIds.has(rawId) ? rawId : "claim";
            details = p.details || details;
          } catch { /* дефолты */ }
        }
        const dt = DOC_TYPES.find(d => d.id === docTypeId) || DOC_TYPES[0];
        setDocDraft({ label: dt.label, docTypeId, details, loadingLabel: false });
      } catch {
        const dt = DOC_TYPES.find(d => d.id === "claim") || DOC_TYPES[0];
        setDocDraft({ label: dt.label, docTypeId: "claim", details: baseDetails, loadingLabel: false });
      }
    } finally {
      setCreatingDocFromChat(false);
    }
  };

  /**
   * Шаг 2: пользователь подтвердил (или поправил) название документа и дополнения
   * в модалке — теперь запускаем реальную генерацию с точным customLabel.
   */
  const confirmDocFromChat = (label: string, addition: string) => {
    if (!docDraft) return;
    const details = addition ? `${docDraft.details}\n\n[Дополнения пользователя]:\n${addition}` : docDraft.details;
    setPendingDocFromChat({ details, docTypeId: docDraft.docTypeId, customLabel: label });
    setDocDraft(null);
    setTab("docs");
  };

  const closeDocDraft = () => setDocDraft(null);

  return { creatingDocFromChat, createDocFromChat, docDraft, confirmDocFromChat, closeDocDraft };
}