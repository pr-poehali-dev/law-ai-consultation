import { useState } from "react";
import { canUseDoc, consumeDoc, getToken, invalidateUserCache, fetchSafe, refundDoc } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import { type DocPhase, type GenDoc } from "@/pages/cabinet/DocsTab";
import { DOC_TYPES, type DocType } from "@/pages/cabinet/docBlocks";
import { ymGoal } from "@/lib/metrika";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-docs"];
const DOC_TIMEOUT_MS = 155_000;

interface UseDocsLogicProps {
  refreshUser: () => Promise<void>;
  onPaymentRequired: (type: ServiceType, name: string, pendingDocType: DocType) => void;
  onDocGenerated?: (doc: GenDoc) => void;
  onDocSaved?: (docName: string) => void;
  getChatHistory?: () => { role: string; content: string }[];
}

function authHeaders(token: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-Auth-Token": token } : {}),
  };
}

export function useDocsLogic({ refreshUser, onPaymentRequired, onDocGenerated, onDocSaved, getChatHistory }: UseDocsLogicProps) {
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docPhase, setDocPhase] = useState<DocPhase>("form");
  const [docDetails, setDocDetails] = useState("");
  const [docGenerating, setDocGenerating] = useState(false);
  const [docRetrying, setDocRetrying] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [currentDoc, setCurrentDoc] = useState<GenDoc | null>(null);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [docAttachedFile, setDocAttachedFile] = useState<{ name: string; b64: string } | null>(null);
  const [docAttachedFiles, setDocAttachedFiles] = useState<{ name: string; b64: string }[]>([]);
  const [genDocs, setGenDocs] = useState<GenDoc[]>(() => {
    try {
      const saved = localStorage.getItem("cabinet_docs");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const saveGenDocs = (docs: GenDoc[]) => {
    setGenDocs(docs);
    localStorage.setItem("cabinet_docs", JSON.stringify(docs));
  };

  const _runGenerate = async (overrideType?: DocType, overrideDetails?: string, fromChat = false, overrideFiles?: { name: string; b64: string }[], customLabel?: string) => {
    const activeType = overrideType ?? docType;
    const activeDetails = overrideDetails ?? docDetails;
    // customLabel — точное название документа, названное AI в рекомендации чата
    // (см. docNameExtractor.ts). Если задано, оно имеет приоритет над activeType.label
    // и передаётся на backend как custom_label — так итоговый документ гарантированно
    // соответствует названию, а не типу, который просто ближе всего подобрался по id.
    const displayLabel = customLabel?.trim() || activeType.label;

    if (!activeDetails.trim()) { setDocErr("Опишите ситуацию"); return; }

    invalidateUserCache();
    const canDoc = await canUseDoc();
    if (!canDoc) {
      onPaymentRequired(activeType.serviceType, displayLabel, activeType);
      return;
    }

    setDocGenerating(true);
    setDocRetrying(false);
    setDocPhase("generating");
    setDocErr("");

    // КРИТИЧНО: списываем документ ДО генерации.
    const consumed = await consumeDoc();
    if (!consumed) {
      invalidateUserCache();
      const stillCan = await canUseDoc();
      if (!stillCan) {
        onPaymentRequired(activeType.serviceType, displayLabel, activeType);
        setDocGenerating(false);
        setDocPhase("form");
        return;
      }
    }

    try {
      const reqBody: Record<string, unknown> = {
        mode: "doc_generate",
        doc_type: activeType.id,
        details: activeDetails,
      };
      // Точное название документа из рекомендации AI в чате — backend сгенерирует
      // документ именно под этим названием (с заголовком customLabel), даже если
      // такого типа нет в каталоге DOC_TYPES (тогда используется универсальный
      // экспертный промт SYSTEM_DOC_GENERATE вместо блока конкретного типа).
      if (customLabel?.trim()) {
        reqBody.custom_label = customLabel.trim();
      }
      // Файлы: overrideFiles (из лендинга/кабинета) или docAttachedFiles (из UI кабинета) или одиночный docAttachedFile
      const activeFiles = overrideFiles ?? (docAttachedFiles.length > 0 ? docAttachedFiles : null);
      if (activeFiles && activeFiles.length > 0) {
        reqBody.files = activeFiles.map(f => ({ b64: f.b64, name: f.name }));
      } else if (docAttachedFile) {
        reqBody.files = [{ b64: docAttachedFile.b64, name: docAttachedFile.name }];
      }
      // История чата передаётся ТОЛЬКО при генерации из чата (fromChat=true)
      // Из раздела Документы — пользователь сам вводит задание, история не нужна
      if (fromChat && getChatHistory) {
        const hist = getChatHistory();
        if (hist.length > 0) reqBody.chat_history = hist.slice(-5);
      }

      const token = getToken();
      const res = await fetchSafe(
        GIGACHAT_URL,
        { method: "POST", headers: authHeaders(token), body: JSON.stringify(reqBody) },
        DOC_TIMEOUT_MS,
        1,
        () => setDocRetrying(true)
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");

      const placeholders: string[] = data.placeholders || [];
      const truncated: boolean = data.truncated || false;
      // recommendations оставляем undefined, если сервер их не прислал —
      // так ViewDocModal поймёт, что фоновый анализ ещё не выполнялся, и запустит его
      const recommendations: GenDoc["recommendations"] = data.recommendations && data.recommendations.length > 0
        ? data.recommendations
        : undefined;
      const newDoc: GenDoc = {
        id: Date.now(),
        name: displayLabel,
        content: data.answer,
        filled: data.answer,
        date: new Date().toLocaleDateString("ru-RU"),
        placeholders,
        truncated,
        recommendations,
      };

      // Сохраняем немедленно — до любых setState
      const updatedDocs = [newDoc, ...genDocs];
      localStorage.setItem("cabinet_docs", JSON.stringify(updatedDocs));

      setDocAttachedFile(null);
      setDocAttachedFiles([]);
      setCurrentDoc(newDoc);
      setGenDocs(updatedDocs);
      setFillValues(Object.fromEntries(placeholders.map((p) => [p, ""])));
      setDocPhase(placeholders.length > 0 ? "filling" : "done");
      ymGoal("doc_generated", { doc_type: activeType.id });
      if (onDocGenerated) onDocGenerated(newDoc);
      if (onDocSaved) onDocSaved(displayLabel);

      refreshUser().catch(() => {});

    } catch (e) {
      // Генерация упала — возвращаем слот (best-effort, без таймаута не блокируем UI)
      // refund-doc — auth action, идёт через auth-handler
      refundDoc().catch(() => {});

      const errMsg = e instanceof Error ? e.message : "Ошибка генерации. Попробуйте ещё раз.";
      setDocErr(errMsg);
      setDocPhase("form");
      invalidateUserCache();
      refreshUser().catch(() => {});
    } finally {
      setDocGenerating(false);
      setDocRetrying(false);
    }
  };

  const generateDoc = () => _runGenerate();

  // fromChat=true — передаём историю чата как контекст (вызов из чата AI).
  // customLabel — точное название документа из рекомендации AI (см. DocFromChatModal).
  const generateDocWith = (dt: DocType, details: string, files?: { name: string; b64: string }[], customLabel?: string) =>
    _runGenerate(dt, details, true, files, customLabel);

  const continueDoc = async () => {
    if (!currentDoc) return;
    setDocGenerating(true);
    setDocErr("");
    try {
      const token = getToken();
      const res = await fetchSafe(
        GIGACHAT_URL,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            mode: "doc_continue",
            doc_type: docType.id,
            partial: currentDoc.content,
          }),
        },
        DOC_TIMEOUT_MS,
        1
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка продолжения");
      const merged = currentDoc.content + "\n" + data.answer;
      const newPlaceholders = [...new Set([
        ...currentDoc.placeholders,
        ...(data.placeholders || []),
      ])];
      const updated: GenDoc = {
        ...currentDoc,
        content: merged,
        filled: merged,
        placeholders: newPlaceholders,
        truncated: data.truncated || false,
      };
      setCurrentDoc(updated);
      saveGenDocs(genDocs.map((d) => d.id === updated.id ? updated : d));
      if (newPlaceholders.length > 0) {
        setFillValues((prev) => ({
          ...prev,
          ...Object.fromEntries(
            (data.placeholders || []).filter((p: string) => !prev[p]).map((p: string) => [p, ""])
          ),
        }));
      }
      setDocPhase(newPlaceholders.length > 0 ? "filling" : "done");
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Ошибка продолжения. Попробуйте ещё раз.");
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
    saveGenDocs(genDocs.map((d) => d.id === updated.id ? updated : d));
  };

  const saveEditedContent = (docId: number, newContent: string) => {
    const now = new Date();
    const editedAt = `${now.toLocaleDateString("ru-RU")} ${now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    const updated = genDocs.map((d) =>
      d.id === docId ? { ...d, editedContent: newContent, editedAt } : d
    );
    saveGenDocs(updated);
    if (currentDoc?.id === docId) {
      setCurrentDoc(prev => prev ? { ...prev, editedContent: newContent, editedAt } : prev);
    }
  };

  /** Сохраняет результат анализа рекомендаций — чтобы он не запускался повторно при переоткрытии документа */
  const saveDocRecommendations = (docId: number, recommendations: GenDoc["recommendations"]) => {
    const updated = genDocs.map((d) =>
      d.id === docId ? { ...d, recommendations } : d
    );
    saveGenDocs(updated);
    if (currentDoc?.id === docId) {
      setCurrentDoc(prev => prev ? { ...prev, recommendations } : prev);
    }
  };

  return {
    docType, setDocType,
    docPhase, setDocPhase,
    docDetails, setDocDetails,
    docGenerating,
    docRetrying,
    docErr, setDocErr,
    currentDoc, setCurrentDoc,
    fillValues, setFillValues,
    genDocs,
    generateDoc,
    generateDocWith,
    continueDoc,
    applyFillValues,
    saveEditedContent,
    saveDocRecommendations,
    docAttachedFile, setDocAttachedFile,
    docAttachedFiles, setDocAttachedFiles,
  };
}