import { useState } from "react";
import { canUseDoc, consumeDoc, getToken, invalidateUserCache, fetchSafe, refundDoc } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import { type DocPhase, type GenDoc } from "@/pages/cabinet/DocsTab";
import { DOC_TYPES, type DocType } from "@/pages/cabinet/docBlocks";
import { ymGoal } from "@/lib/metrika";

const GIGACHAT_URL = (func2url as Record<string, string>)["ai-docs"];
const DOC_TIMEOUT_MS = 120_000;

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

  const _runGenerate = async (overrideType?: DocType, overrideDetails?: string, fromChat = false) => {
    const activeType = overrideType ?? docType;
    const activeDetails = overrideDetails ?? docDetails;

    if (!activeDetails.trim()) { setDocErr("Опишите ситуацию"); return; }

    invalidateUserCache();
    const canDoc = await canUseDoc();
    if (!canDoc) {
      onPaymentRequired(activeType.serviceType, activeType.label, activeType);
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
        onPaymentRequired(activeType.serviceType, activeType.label, activeType);
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
      if (docAttachedFile) {
        reqBody.file = docAttachedFile.b64;
        reqBody.filename = docAttachedFile.name;
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
      const newDoc: GenDoc = {
        id: Date.now(),
        name: activeType.label,
        content: data.answer,
        filled: data.answer,
        date: new Date().toLocaleDateString("ru-RU"),
        placeholders,
        truncated,
      };

      // Сохраняем немедленно — до любых setState
      const updatedDocs = [newDoc, ...genDocs];
      localStorage.setItem("cabinet_docs", JSON.stringify(updatedDocs));

      setDocAttachedFile(null);
      setCurrentDoc(newDoc);
      setGenDocs(updatedDocs);
      setFillValues(Object.fromEntries(placeholders.map((p) => [p, ""])));
      setDocPhase(placeholders.length > 0 ? "filling" : "done");
      ymGoal("doc_generated", { doc_type: activeType.id });
      if (onDocGenerated) onDocGenerated(newDoc);
      if (onDocSaved) onDocSaved(activeType.label);

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

  // fromChat=true — передаём историю чата как контекст (вызов из чата AI)
  const generateDocWith = (dt: DocType, details: string) => _runGenerate(dt, details, true);

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
    setDocPhase("done");
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
    docAttachedFile, setDocAttachedFile,
  };
}