import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { type DocHint } from "@/pages/cabinet/ChatTab";
import { type User } from "@/lib/auth";
import { DOC_TYPES, type DocType } from "@/pages/cabinet/docBlocks";
import func2url from "../../../backend/func2url.json";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-chat"];

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";

interface UseDocsLogicSlice {
  setDocType: (dt: DocType) => void;
  setDocDetails: (v: string) => void;
  setDocPhase: (v: string) => void;
  setDocErr: (v: string) => void;
  generateDocWith: (dt: DocType, details: string) => void;
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

export function useCabinetDocFromChat({
  user,
  tab,
  setTab,
  docs,
  chat,
  openDocChoice,
}: UseCabinetDocFromChatOptions) {
  const [pendingDocFromChat, setPendingDocFromChat] = useState<{ details: string; docTypeId: string } | null>(null);
  const [creatingDocFromChat, setCreatingDocFromChat] = useState(false);

  useEffect(() => {
    if (!pendingDocFromChat || tab !== "docs") return;
    const dt = DOC_TYPES.find(d => d.id === pendingDocFromChat.docTypeId) || DOC_TYPES[0];
    const details = pendingDocFromChat.details;
    setPendingDocFromChat(null);
    docs.setDocType(dt);
    docs.setDocDetails(details);
    docs.setDocPhase("form");
    docs.setDocErr("");
    setTimeout(() => docs.generateDocWith(dt, details), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocFromChat, tab]);

  const createDocFromChat = async (aiText: string, userText: string, docHint?: DocHint) => {
    if (creatingDocFromChat || !user) return;

    const canDoc = user.isAdmin || (user.paidDocs ?? 0) > 0 ||
      (user.subscriptionDocsUntil ? new Date(user.subscriptionDocsUntil) > new Date() : false);
    if (!canDoc) {
      const hintDocId = docHint?.doc_type || "claim";
      const hintDocLabel = docHint?.doc_label || "документ";
      openDocChoice(hintDocId, hintDocLabel);
      return;
    }

    if (docHint?.doc_type && docHint?.details) {
      const details = docHint.extracted_text
        ? `${docHint.details}\n\n[Текст из документа пользователя]:\n${docHint.extracted_text.slice(0, 4000)}`
        : docHint.details;
      setPendingDocFromChat({ details, docTypeId: docHint.doc_type });
      setTab("docs");
      return;
    }

    setCreatingDocFromChat(true);

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
      let details = `${userText}\n\n${aiText.slice(0, 500)}`;
      if (match) {
        try {
          const p = JSON.parse(match[0]);
          const rawId = p.doc_type || "";
          docTypeId = validIds.has(rawId) ? rawId : "claim";
          details = p.details || details;
        } catch { /* дефолты */ }
      }
      setPendingDocFromChat({ details, docTypeId });
      setTab("docs");
    } catch {
      setPendingDocFromChat({ details: `${userText}\n\n${aiText.slice(0, 500)}`, docTypeId: "claim" });
      setTab("docs");
    } finally {
      setCreatingDocFromChat(false);
    }
  };

  return { creatingDocFromChat, createDocFromChat };
}