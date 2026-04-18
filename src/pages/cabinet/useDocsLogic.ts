import { useState } from "react";
import { canUseDoc, consumeDoc, getToken } from "@/lib/auth";
import { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import { DOC_TYPES, type DocPhase, type GenDoc } from "@/pages/cabinet/DocsTab";
import { ymGoal } from "@/lib/metrika";

const GIGACHAT_URL = func2url["gigachat-proxy"];

interface UseDocsLogicProps {
  refreshUser: () => Promise<void>;
  onPaymentRequired: (type: ServiceType, name: string, pendingDocType: typeof DOC_TYPES[0]) => void;
  onDocGenerated?: (doc: GenDoc) => void;
  getChatHistory?: () => { role: string; content: string }[];
}

export function useDocsLogic({ refreshUser, onPaymentRequired, onDocGenerated, getChatHistory }: UseDocsLogicProps) {
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docPhase, setDocPhase] = useState<DocPhase>("form");
  const [docDetails, setDocDetails] = useState("");
  const [docGenerating, setDocGenerating] = useState(false);
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

  const _runGenerate = async (overrideType?: typeof DOC_TYPES[0], overrideDetails?: string) => {
    const activeType = overrideType ?? docType;
    const activeDetails = overrideDetails ?? docDetails;
    if (!activeDetails.trim()) { setDocErr("Опишите ситуацию"); return; }
    const canDoc = await canUseDoc();
    if (!canDoc) {
      onPaymentRequired(activeType.serviceType, activeType.label, activeType);
      return;
    }
    setDocGenerating(true);
    setDocPhase("generating");
    setDocErr("");
    try {
      const reqBody: Record<string, unknown> = { mode: "doc_generate", doc_type: activeType.id, details: activeDetails };
      if (docAttachedFile) {
        reqBody.file = docAttachedFile.b64;
        reqBody.filename = docAttachedFile.name;
      }
      if (getChatHistory) {
        const hist = getChatHistory();
        if (hist.length > 0) reqBody.chat_history = hist.slice(-10);
      }
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify(reqBody),
      });
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
      await consumeDoc();
      await refreshUser();
      setDocAttachedFile(null);
      setCurrentDoc(newDoc);
      setFillValues(Object.fromEntries(placeholders.map((p) => [p, ""])));
      saveGenDocs([newDoc, ...genDocs]);
      setDocPhase(placeholders.length > 0 ? "filling" : "done");
      ymGoal("doc_generated", { doc_type: activeType.id });
      if (onDocGenerated) onDocGenerated(newDoc);
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Ошибка генерации");
      setDocPhase("form");
    } finally {
      setDocGenerating(false);
    }
  };

  const generateDoc = () => _runGenerate();

  // Вариант с явным типом и деталями — для запуска из createDocFromChat
  const generateDocWith = (dt: typeof DOC_TYPES[0], details: string) => _runGenerate(dt, details);

  const continueDoc = async () => {
    if (!currentDoc) return;
    setDocGenerating(true);
    setDocErr("");
    try {
      const token = getToken();
      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "doc_continue",
          doc_type: docType.id,
          partial: currentDoc.content,
        }),
      });
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
      setDocErr(e instanceof Error ? e.message : "Ошибка продолжения");
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