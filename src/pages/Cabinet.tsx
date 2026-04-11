import { useState, useEffect, useRef } from "react";  
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import { getUser, logout, addPaidService, consumeQuestion, consumeDoc, canAskQuestion, canUseDoc, type User } from "@/lib/auth";
import func2url from "../../backend/func2url.json";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from "docx";
import { saveAs } from "file-saver";

const GIGACHAT_URL = func2url["gigachat-proxy"];

const DOC_TYPES = [
  { id: "claim", label: "Исковое заявление", icon: "Gavel", price: 500, serviceType: "document" as ServiceType },
  { id: "pretension", label: "Претензия", icon: "AlertCircle", price: 500, serviceType: "document" as ServiceType },
  { id: "complaint", label: "Жалоба (Роспотребнадзор)", icon: "Building", price: 500, serviceType: "document" as ServiceType },
  { id: "contract", label: "Договор ГПХ", icon: "FileCheck", price: 500, serviceType: "document" as ServiceType },
  { id: "business_contract", label: "Договор для бизнеса", icon: "Briefcase", price: 1000, serviceType: "business" as ServiceType },
];

interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; }

type DocPhase = "form" | "generating" | "filling" | "done";

interface GenDoc {
  id: number;
  name: string;
  content: string; // текст с метками {{...}}
  filled: string;  // текст с заполненными метками
  date: string;
  placeholders: string[]; // список меток
}

const WELCOME = "Добрый день! Я AI-юрист, обученный на реальной судебной практике РФ.\n\nЗадайте ваш правовой вопрос — отвечу со ссылками на законы.";

// Лейблы для секций документа
const SECTION_LABELS: Record<string, string> = {
  ШАПКА: "", ЗАГОЛОВОК: "", ТЕЛО: "Обстоятельства дела",
  ТРЕБОВАНИЯ: "Просительная часть", ПРИЛОЖЕНИЯ: "Приложения",
  ПОДПИСЬ: "", ОБОСНОВАНИЕ: "Правовое обоснование", ПРИМЕЧАНИЯ: "Примечания",
};

function DocPreview({ content, fillValues }: { content: string; fillValues: Record<string, string> }) {
  // Подставляем заполненные значения
  const rendered = content.replace(/\{\{([^}]+)\}\}/g, (_, k) =>
    fillValues[k]?.trim() ? fillValues[k].trim() : `▢ ${k.replace(/_/g, " ")}`
  );

  // Разбиваем на блоки
  const sections: { tag: string; text: string }[] = [];
  let cur = { tag: "RAW", text: "" };
  for (const line of rendered.split("\n")) {
    const m = line.match(/^\[([А-ЯA-Z_]+)\]$/);
    if (m) { sections.push(cur); cur = { tag: m[1], text: "" }; }
    else { cur.text += line + "\n"; }
  }
  sections.push(cur);

  const hasTags = sections.some((s) => s.tag !== "RAW");

  if (!hasTags) {
    // Fallback: plain красивый рендер
    return (
      <div className="font-serif text-[13px] leading-6 text-gray-800 space-y-1">
        {rendered.split("\n").map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          const isSectionHead = /^[-─═]{3,}|^[А-Я\s]{5,}:?\s*$/.test(line.trim());
          return isSectionHead
            ? <p key={i} className="font-bold text-navy-700 mt-3 mb-1 uppercase tracking-wide text-[11px]">{line.trim()}</p>
            : <p key={i} className="text-justify indent-6">{line.trim()}</p>;
        })}
      </div>
    );
  }

  return (
    <div className="font-serif text-[13px] leading-6 text-gray-800 space-y-4">
      {sections.map((sec, idx) => {
        if (!sec.text.trim() && sec.tag === "RAW") return null;
        const lines = sec.text.trim().split("\n").filter(Boolean);

        if (sec.tag === "ШАПКА") return (
          <div key={idx} className="text-right text-[12px] text-gray-700 leading-5 space-y-0.5 border-r-2 border-navy-200 pr-3">
            {lines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        );

        if (sec.tag === "ЗАГОЛОВОК") return (
          <div key={idx} className="text-center py-3">
            <p className="font-bold text-[15px] text-navy-900 uppercase tracking-widest">{lines.join(" ")}</p>
            <div className="mt-2 h-0.5 bg-navy-700 mx-8" />
          </div>
        );

        if (sec.tag === "ТЕЛО") return (
          <div key={idx} className="space-y-2">
            {lines.map((l, i) => <p key={i} className="text-justify indent-8">{l}</p>)}
          </div>
        );

        if (sec.tag === "ТРЕБОВАНИЯ") return (
          <div key={idx}>
            <p className="font-bold text-navy-800 mb-1">ПРОШУ:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              {lines.map((l, i) => <li key={i} className="text-justify">{l.replace(/^\d+\.\s*/, "")}</li>)}
            </ol>
          </div>
        );

        if (sec.tag === "ПРИЛОЖЕНИЯ") return (
          <div key={idx} className="border-t border-dashed border-gray-300 pt-3">
            <p className="font-bold text-navy-800 mb-1 text-[11px] uppercase tracking-wide">Приложения:</p>
            <ul className="space-y-0.5 pl-2">
              {lines.map((l, i) => <li key={i} className="text-[12px] text-gray-700">• {l}</li>)}
            </ul>
          </div>
        );

        if (sec.tag === "ПОДПИСЬ") return (
          <div key={idx} className="text-right text-[12px] text-gray-700 mt-4 space-y-1 border-t border-gray-200 pt-3">
            {lines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        );

        if (sec.tag === "ОБОСНОВАНИЕ") return (
          <div key={idx} className="bg-blue-50 rounded-xl p-3 mt-2">
            <p className="font-bold text-navy-700 text-[11px] uppercase tracking-wide mb-1">Правовое обоснование</p>
            {lines.map((l, i) => <p key={i} className="text-[12px] text-gray-600 leading-5">{l}</p>)}
          </div>
        );

        if (sec.tag === "ПРИМЕЧАНИЯ") return (
          <div key={idx} className="bg-amber-50 rounded-xl p-3">
            <p className="font-bold text-amber-800 text-[11px] uppercase tracking-wide mb-1">Примечания</p>
            {lines.map((l, i) => <p key={i} className="text-[12px] text-amber-900 italic leading-5">{l}</p>)}
          </div>
        );

        // RAW или неизвестный тег
        return (
          <div key={idx} className="space-y-1">
            {sec.tag !== "RAW" && SECTION_LABELS[sec.tag] && (
              <p className="font-bold text-navy-700 text-[11px] uppercase tracking-wide">{SECTION_LABELS[sec.tag]}</p>
            )}
            {lines.map((l, i) => <p key={i} className="text-justify indent-6">{l}</p>)}
          </div>
        );
      })}
    </div>
  );
}

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

    const newHist = [...history, { role: "user", content: userMsg }];
    setHistory(newHist);
    await consumeQuestion();
    refreshUser(); // fire-and-forget — счётчик обновится в фоне

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
    await consumeQuestion();
    refreshUser();
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
      setTyping(false);
    }
  };

  const generateDoc = async () => {
    if (!docDetails.trim()) { setDocErr("Опишите ситуацию"); return; }
    // Проверяем право на создание документа
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
      // Списываем 1 документ со счёта (для admin — бесплатно)
      await consumeDoc();
      await refreshUser(); // обновляем баланс сразу после списания
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

  // Применяет заполненные реквизиты к тексту документа
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
      await refreshUser(); // ждём обновления баланса перед генерацией
    } catch {
      // сервис уже оплачен — продолжаем
    }
    setPayment(null);
    if (pendingDocType && (svcType === "document" || svcType === "business")) {
      setPendingDocType(null);
      setTimeout(() => generateDoc(), 300); // даём время React обновить state
    } else {
      setPendingDocType(null);
    }
  };

  const downloadDoc = async (name: string, content: string) => {
    // Парсим блоки по маркерам [ШАПКА], [ЗАГОЛОВОК], [ТЕЛО] и т.д.
    const blocks: Record<string, string> = {};
    const blockOrder: string[] = [];
    let currentBlock = "INTRO";
    blocks[currentBlock] = "";
    for (const line of content.split("\n")) {
      const match = line.match(/^\[([А-ЯA-Z_]+)\]$/);
      if (match) {
        currentBlock = match[1];
        blocks[currentBlock] = "";
        blockOrder.push(currentBlock);
      } else {
        blocks[currentBlock] = (blocks[currentBlock] || "") + line + "\n";
      }
    }

    const FONT = "Times New Roman";
    const children: Paragraph[] = [];

    const spacer = () => new Paragraph({ text: "", spacing: { after: 80 } });

    const textPara = (text: string, opts?: {
      bold?: boolean; italic?: boolean; center?: boolean; size?: number; indent?: number; spaceBefore?: number; spaceAfter?: number;
    }) => new Paragraph({
      alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.BOTH,
      indent: opts?.indent ? { left: opts.indent } : undefined,
      spacing: { before: opts?.spaceBefore ?? 0, after: opts?.spaceAfter ?? 120, line: 360 },
      children: [new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italic,
        size: opts?.size ?? 24,
        font: FONT,
      })],
    });

    const hrLine = () => new Paragraph({
      spacing: { before: 80, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2C3E6B" } },
      children: [],
    });

    // Шапка (правый угол)
    if (blocks["ШАПКА"]) {
      for (const line of blocks["ШАПКА"].split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 60, line: 320 },
          children: [new TextRun({ text: line.trim(), size: 22, font: FONT })],
        }));
      }
      children.push(spacer());
    }

    // Заголовок
    if (blocks["ЗАГОЛОВОК"]) {
      const title = blocks["ЗАГОЛОВОК"].trim();
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: title, bold: true, size: 28, font: FONT, allCaps: true })],
      }));
      children.push(hrLine());
      children.push(spacer());
    } else {
      // Fallback — имя документа как заголовок
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: name.toUpperCase(), bold: true, size: 28, font: FONT, allCaps: true })],
      }));
      children.push(hrLine());
    }

    // Тело
    if (blocks["ТЕЛО"]) {
      for (const line of blocks["ТЕЛО"].split("\n")) {
        if (line.trim() === "") { children.push(spacer()); continue; }
        children.push(textPara(line.trim(), { indent: 720, spaceAfter: 100 }));
      }
      children.push(spacer());
    }

    // Требования
    if (blocks["ТРЕБОВАНИЯ"]) {
      children.push(textPara("ПРОСИМ СУД:", { bold: true, spaceAfter: 60 }));
      for (const line of blocks["ТРЕБОВАНИЯ"].split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          indent: { left: 720, hanging: 360 },
          spacing: { after: 80, line: 340 },
          children: [new TextRun({ text: line.trim(), size: 24, font: FONT })],
        }));
      }
      children.push(spacer());
    }

    // Приложения
    if (blocks["ПРИЛОЖЕНИЯ"]) {
      children.push(hrLine());
      children.push(textPara("ПРИЛОЖЕНИЯ:", { bold: true, spaceAfter: 60 }));
      for (const line of blocks["ПРИЛОЖЕНИЯ"].split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 360 },
          spacing: { after: 60, line: 320 },
          children: [new TextRun({ text: line.trim(), size: 22, font: FONT })],
        }));
      }
      children.push(spacer());
    }

    // Подпись
    if (blocks["ПОДПИСЬ"]) {
      children.push(hrLine());
      for (const line of blocks["ПОДПИСЬ"].split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 80, line: 320 },
          children: [new TextRun({ text: line.trim(), size: 22, font: FONT })],
        }));
      }
      children.push(spacer());
    }

    // Обоснование
    if (blocks["ОБОСНОВАНИЕ"]) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: "ПРАВОВОЕ ОБОСНОВАНИЕ", bold: true, size: 22, font: FONT, color: "2C3E6B" })],
      }));
      children.push(hrLine());
      for (const line of blocks["ОБОСНОВАНИЕ"].split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { after: 60, line: 320 },
          children: [new TextRun({ text: line.trim(), size: 20, font: FONT, color: "444444" })],
        }));
      }
      children.push(spacer());
    }

    // Примечания
    if (blocks["ПРИМЕЧАНИЯ"]) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "ПРИМЕЧАНИЯ", bold: true, size: 22, font: FONT, color: "7B6B3A" })],
      }));
      children.push(hrLine());
      for (const line of blocks["ПРИМЕЧАНИЯ"].split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { after: 60, line: 320 },
          children: [new TextRun({ text: line.trim(), size: 20, font: FONT, color: "555555", italics: true })],
        }));
      }
    }

    // Если маркеров нет — красивый fallback построчно
    if (blockOrder.length === 0) {
      for (const line of content.split("\n")) {
        if (line.trim() === "") { children.push(spacer()); continue; }
        const isSectionHeader = /^[-─═]{3,}/.test(line) || /^[А-Я\s]{5,}:?\s*$/.test(line.trim());
        if (isSectionHeader) {
          children.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: line.trim(), bold: true, size: 22, font: FONT, color: "2C3E6B" })],
          }));
        } else {
          children.push(new Paragraph({
            alignment: AlignmentType.BOTH,
            indent: { left: 360 },
            spacing: { after: 80, line: 340 },
            children: [new TextRun({ text: line.trim(), size: 24, font: FONT })],
          }));
        }
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: FONT, size: 24 },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1701, right: 850 }, // 2cm/3cm поля
          },
        },
        children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${name}.docx`);
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
                {user.isAdmin ? (
                  <span className="text-xs px-2.5 py-1 rounded-xl font-medium bg-purple-50 text-purple-700">
                    Администратор
                  </span>
                ) : totalLeft === 0 ? (
                  <button
                    onClick={() => setPayment({ type: "consultation", name: "AI-консультация (3 вопроса)" })}
                    className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
                  >
                    <Icon name="Plus" size={12} />
                    100 ₽ / 3 вопроса
                  </button>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-xl font-medium bg-emerald-50 text-emerald-700">
                    {user.paidQuestions} вопр. осталось
                  </span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-white rounded-3xl border border-border shadow-sm p-5 space-y-4 scrollbar-hide">
              {messages.map((msg, i) => {
                const isDocRedirect = msg.role === "ai" && /раздел[е]?\s+[«"]?Документы[»"]?/i.test(msg.text);
                return (
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
                      {isDocRedirect && (
                        <button
                          onClick={() => setTab("docs")}
                          className="mt-3 flex items-center gap-2 px-4 py-2 bg-navy-700 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl transition-colors w-full justify-center"
                        >
                          <Icon name="FileText" size={14} />
                          Перейти в раздел «Документы»
                        </button>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-navy-600 uppercase">
                        {user.name?.[0] ?? "U"}
                      </div>
                    )}
                  </div>
                );
              })}
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
              <div className="mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <Icon name="AlertCircle" size={13} className="shrink-0" />{chatErr}
              </div>
            )}

            {/* Превью прикреплённого файла */}
            {attachedFile && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-2xl">
                <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name="FileText" size={14} className="text-navy-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-navy-800 truncate">{attachedFile.name}</div>
                  <div className="text-xs text-muted-foreground">{attachedFile.size} · будет удалён через 30 мин</div>
                </div>
                <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                  <Icon name="X" size={14} />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="mt-3 flex gap-2">
              {/* Скрытый file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileSelect}
              />
              {/* Кнопка прикрепить файл */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={typing || fileUploading}
                title="Прикрепить документ (PDF, DOC, DOCX, JPEG, PNG)"
                className="w-12 h-12 rounded-2xl border border-border bg-white hover:bg-slate-50 hover:border-navy-300 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
              >
                {fileUploading
                  ? <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full animate-pulse" />
                  : <Icon name="Paperclip" size={18} className={attachedFile ? "text-navy-600" : "text-muted-foreground"} />
                }
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (attachedFile) { sendFileAnalysis(); } else { sendMessage(); }
                  }
                }}
                disabled={typing}
                placeholder={
                  attachedFile
                    ? "Задайте вопрос к документу или отправьте без вопроса..."
                    : (user.isAdmin || totalLeft > 0)
                      ? "Задайте юридический вопрос или прикрепите документ..."
                      : "Оплатите консультацию — 100 ₽ за 3 вопроса"
                }
                className="flex-1 bg-white border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors disabled:opacity-60"
              />
              <button
                onClick={attachedFile ? sendFileAnalysis : sendMessage}
                disabled={(!input.trim() && !attachedFile) || typing}
                className="btn-gold w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Icon name="Send" size={18} />
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Ответы AI не заменяют консультацию практикующего юриста · Файлы удаляются через 30 минут
            </p>
          </div>
        )}

        {/* ===== DOCS TAB ===== */}
        {tab === "docs" && (
          <div className="max-w-4xl mx-auto">

            {/* ФАЗА: форма запроса */}
            {(docPhase === "form" || docPhase === "generating") && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
                  <h2 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">Создать документ</h2>
                  <p className="text-sm text-muted-foreground mb-4">Опишите ситуацию — AI-юрист составит полный документ. Реквизиты заполните после генерации.</p>
                  <div className="space-y-2 mb-4">
                    {DOC_TYPES.map((dt) => (
                      <button
                        key={dt.id}
                        onClick={() => { setDocType(dt); setDocErr(""); }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                          docType.id === dt.id ? "border-navy-500 bg-navy-50" : "border-border hover:border-navy-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${docType.id === dt.id ? "bg-navy-100" : "bg-slate-100"}`}>
                            <Icon name={dt.icon} size={15} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
                          </div>
                          <span className={`text-sm font-medium ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-navy-500">{dt.price} ₽</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={docDetails}
                    onChange={(e) => setDocDetails(e.target.value)}
                    disabled={docGenerating}
                    placeholder={`Опишите ситуацию для «${docType.label}»...\n\nНапример: что произошло, с кем, когда, какой результат нужен. Реквизиты сторон можно добавить после генерации документа.`}
                    rows={6}
                    className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-3 disabled:opacity-60"
                  />
                  {docErr && (
                    <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                      <Icon name="AlertCircle" size={13} className="shrink-0" />{docErr}
                    </div>
                  )}

                  {/* Баланс документов */}
                  {user && !user.isAdmin && (
                    <div className={`mb-3 flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs ${
                      user.paidDocs > 0
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Icon name={user.paidDocs > 0 ? "CheckCircle" : "AlertCircle"} size={13} className="shrink-0" />
                        {user.paidDocs > 0
                          ? `Доступно документов: ${user.paidDocs}`
                          : "Нет доступных документов"}
                      </div>
                      {user.paidDocs === 0 && (
                        <button
                          onClick={() => { setPayment({ type: docType.serviceType, name: docType.label }); setPendingDocType(docType); }}
                          className="font-semibold underline hover:no-underline"
                        >
                          Оплатить {docType.price} ₽
                        </button>
                      )}
                    </div>
                  )}
                  {user?.isAdmin && (
                    <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-800">
                      <Icon name="ShieldCheck" size={13} />
                      Администратор · все функции бесплатны
                    </div>
                  )}

                  <button
                    onClick={generateDoc}
                    disabled={docGenerating || !docDetails.trim()}
                    className="btn-gold w-full py-3.5 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {docGenerating ? (
                      <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
                    ) : user && !user.isAdmin && user.paidDocs === 0 ? (
                      <><Icon name="Lock" size={16} />Оплатить и сгенерировать · {docType.price} ₽</>
                    ) : (
                      <><Icon name="Zap" size={16} />Сгенерировать документ</>
                    )}
                  </button>
                  {docGenerating && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      AI-юрист составляет документ... После генерации вы сможете заполнить реквизиты сторон.
                    </p>
                  )}
                </div>

                {/* Правая колонка — история документов */}
                <div className="space-y-4">
                  {/* Баннер перехода в чат */}
                  <button
                    onClick={() => setTab("chat")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 text-white rounded-2xl transition-all group"
                  >
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                      <Icon name="MessageCircle" size={16} className="text-gold-400" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-sm font-semibold">Нужна консультация?</div>
                      <div className="text-xs text-white/70">AI-юрист ответит на ваш вопрос</div>
                    </div>
                    <Icon name="ChevronRight" size={16} className="text-white/50 group-hover:text-white transition-colors" />
                  </button>

                  {genDocs.length > 0 ? (
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
                              <button onClick={() => { setCurrentDoc(doc); setFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); setDocPhase("filling"); }} className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-1.5 rounded-lg hover:bg-navy-50 transition-colors">Реквизиты</button>
                              <button onClick={() => downloadDoc(doc.name, doc.filled)} className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-1.5 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1">
                                <Icon name="Download" size={12} />Скачать
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-border shadow-sm p-10 text-center">
                      <div className="w-12 h-12 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Icon name="FileText" size={22} className="text-navy-400" />
                      </div>
                      <p className="text-sm text-muted-foreground">Опишите ситуацию — AI составит документ</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ФАЗА: автозаполнение реквизитов */}
            {docPhase === "filling" && currentDoc && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Форма реквизитов */}
                <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-cormorant font-bold text-2xl text-navy-800">Заполнить реквизиты</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{currentDoc.name}</p>
                    </div>
                    <button
                      onClick={() => setDocPhase("form")}
                      className="text-xs text-muted-foreground hover:text-navy-700 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <Icon name="ArrowLeft" size={13} />Назад
                    </button>
                  </div>

                  {currentDoc.placeholders.length === 0 ? (
                    <div className="text-center py-6">
                      <Icon name="CheckCircle" size={32} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-navy-700 font-medium">Все реквизиты уже заполнены</p>
                      <p className="text-xs text-muted-foreground mt-1">AI внёс данные из вашего описания в документ</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 rounded-2xl px-4 py-3 mb-4 border border-blue-100">
                        <p className="text-xs text-blue-700 leading-relaxed">
                          AI выделил поля, которые нужно заполнить. Введите данные — документ обновится автоматически.
                        </p>
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {currentDoc.placeholders.map((key) => (
                          <div key={key}>
                            <label className="text-xs font-medium text-navy-700 mb-1 block">
                              {key.replace(/_/g, " ")}
                            </label>
                            <input
                              type="text"
                              value={fillValues[key] || ""}
                              onChange={(e) => setFillValues((p) => ({ ...p, [key]: e.target.value }))}
                              placeholder={`Введите ${key.replace(/_/g, " ").toLowerCase()}`}
                              className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy-400 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={applyFillValues}
                        className="btn-gold w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 mt-5"
                      >
                        <Icon name="CheckCircle" size={16} />Применить реквизиты
                      </button>
                    </>
                  )}
                </div>

                {/* Предпросмотр документа */}
                <div className="bg-white rounded-3xl border border-border shadow-sm flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 200px)" }}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
                    <span className="text-sm font-semibold text-navy-800">Предпросмотр</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewDoc(currentDoc)}
                        className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                      >
                        Полный экран
                      </button>
                      <button
                        onClick={() => downloadDoc(currentDoc.name, currentDoc.filled)}
                        className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                      >
                        <Icon name="Download" size={12} />Скачать
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <DocPreview content={currentDoc.filled} fillValues={fillValues} />
                  </div>
                </div>
              </div>
            )}

            {/* ФАЗА: готово */}
            {docPhase === "done" && currentDoc && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Icon name="CheckCircle" size={22} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-navy-800">{currentDoc.name} — готов</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Реквизиты заполнены и применены к документу</div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => setViewDoc(currentDoc)}
                      className="text-xs text-navy-600 hover:text-navy-800 px-3 py-2 rounded-xl border border-emerald-200 hover:bg-white transition-colors font-medium"
                    >
                      Открыть
                    </button>
                    <button
                      onClick={() => downloadDoc(currentDoc.name, currentDoc.filled)}
                      className="btn-gold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium"
                    >
                      <Icon name="Download" size={13} />Скачать .docx
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setDocPhase("form"); setDocDetails(""); setCurrentDoc(null); }}
                    className="text-sm text-navy-600 hover:text-navy-800 px-5 py-2.5 rounded-xl border border-border hover:border-navy-300 transition-colors"
                  >
                    Создать ещё
                  </button>
                  <button
                    onClick={() => setTab("chat")}
                    className="btn-gold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2"
                  >
                    <Icon name="MessageCircle" size={15} />Задать вопрос юристу
                  </button>
                </div>
                {genDocs.length > 0 && (
                  <div className="bg-white rounded-3xl border border-border shadow-sm p-5">
                    <h3 className="font-semibold text-navy-800 text-sm mb-3">Все документы</h3>
                    <div className="space-y-2">
                      {genDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                          <div>
                            <div className="text-sm font-medium text-navy-800">{doc.name}</div>
                            <div className="text-xs text-muted-foreground">{doc.date}</div>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => { setCurrentDoc(doc); setFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); setDocPhase("filling"); }} className="text-xs text-navy-600 px-2.5 py-1.5 rounded-lg hover:bg-navy-50 transition-colors">Реквизиты</button>
                            <button onClick={() => downloadDoc(doc.name, doc.filled)} className="text-xs text-navy-600 px-2.5 py-1.5 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1">
                              <Icon name="Download" size={12} />Скачать
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                      <Icon name={stat.icon} size={16} />
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
                        <Icon name={item.icon} size={15} className="text-navy-600" />
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