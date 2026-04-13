import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import {
  hasBusinessSubscription, businessUpdateOrg, businessConsumeAction,
  businessMessagesGet, businessMessageSave,
} from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];
const ALLOWED_DOC_EXTS = [".pdf", ".doc", ".docx"];
const ALLOWED_ALL_EXTS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

interface BusinessTabProps {
  user: User;
  onPayClick: (type: ServiceType, name: string) => void;
  onRefreshUser: () => Promise<void>;
}

type BizTool = "chat" | "counterparty" | "contract" | "doc_analyze" | "doc_compare" | "orders";

interface BizMsg {
  id?: number;
  role: "user" | "ai";
  body: string;
  tool: BizTool;
  created_at?: string;
}

// Хранилище сообщений на 1 день в localStorage
const BIZ_STORAGE_KEY = "biz_messages_v2";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function loadLocalMessages(): BizMsg[] {
  try {
    const raw = localStorage.getItem(BIZ_STORAGE_KEY);
    if (!raw) return [];
    const parsed: { messages: BizMsg[]; savedAt: number } = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > ONE_DAY_MS) {
      localStorage.removeItem(BIZ_STORAGE_KEY);
      return [];
    }
    return parsed.messages || [];
  } catch { return []; }
}

function saveLocalMessages(msgs: BizMsg[]) {
  localStorage.setItem(BIZ_STORAGE_KEY, JSON.stringify({ messages: msgs, savedAt: Date.now() }));
}

const TOOLS: { id: BizTool; icon: string; label: string; desc: string; color: string }[] = [
  { id: "chat", icon: "Bot", label: "AI-консультант", desc: "Юридические вопросы для бизнеса", color: "blue" },
  { id: "counterparty", icon: "Search", label: "Проверка контрагента", desc: "Due diligence по ИНН", color: "purple" },
  { id: "contract", icon: "FileSignature", label: "Сложный договор", desc: "Лицензионный, опционный и др.", color: "emerald" },
  { id: "doc_analyze", icon: "FileSearch", label: "Анализ договора", desc: "PDF/DOC до 20 страниц", color: "orange" },
  { id: "doc_compare", icon: "GitCompare", label: "Сравнение договоров", desc: "Две версии PDF/DOC", color: "pink" },
  { id: "orders", icon: "Stamp", label: "Приказы и документы", desc: "Скачивание в .doc · кадровые", color: "teal" },
];

const TOOL_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  pink: "bg-pink-50 text-pink-700 border-pink-100",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
};

function fmtDt(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-[13px] leading-relaxed font-golos whitespace-pre-wrap">
      {text.split("\n").map((line, i) => {
        if (/^#{1,3}\s/.test(line)) return <p key={i} className="font-bold text-navy-800 mt-2 mb-0.5">{line.replace(/^#+\s/, "")}</p>;
        if (/^[-*]\s/.test(line)) return <p key={i} className="pl-3">• {line.replace(/^[-*]\s/, "")}</p>;
        if (/^\d+\.\s/.test(line)) return <p key={i} className="pl-2">{line}</p>;
        if (/\|/.test(line)) return <p key={i} className="font-mono text-xs bg-slate-50 px-1 py-0.5 rounded">{line}</p>;
        if (line.includes("🟢") || line.includes("🟡") || line.includes("🔴")) return <p key={i} className="font-bold text-base mt-1">{line}</p>;
        return <span key={i}>{line}{"\n"}</span>;
      })}
    </div>
  );
}

// Скачивание договора в DOCX
function downloadAsDoc(text: string, filename: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${filename}</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 14pt; margin: 2cm 1.5cm 2cm 3cm; line-height: 1.0; }
  h1, h2, h3 { font-family: Arial, sans-serif; font-size: 16pt; font-weight: bold; text-align: center; text-transform: uppercase; }
  p { text-indent: 1.25cm; margin: 0 0 6pt 0; text-align: justify; }
  .no-indent { text-indent: 0; }
</style></head><body>
${text.split("\n").map(line => {
  if (!line.trim()) return "<p>&nbsp;</p>";
  if (/^\[ЗАГОЛОВОК\]|^\[СТОРОНЫ\]/.test(line)) return `<h2>${line.replace(/^\[.+\]\s*/, "")}</h2>`;
  if (/^#{1,3}\s/.test(line)) return `<h2>${line.replace(/^#+\s/, "")}</h2>`;
  return `<p>${line}</p>`;
}).join("")}
</body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.doc`; a.click();
  URL.revokeObjectURL(url);
}

export default function BusinessTab({ user, onPayClick, onRefreshUser }: BusinessTabProps) {
  const hasBiz = hasBusinessSubscription(user);

  // Отдельные истории для каждого инструмента
  const [allMessages, setAllMessages] = useState<BizMsg[]>(() => loadLocalMessages());
  const [activeTool, setActiveTool] = useState<BizTool>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [orgName, setOrgName] = useState(user.businessOrgName || "");
  const [orgEditing, setOrgEditing] = useState(!user.businessOrgName);
  const [orgSaving, setOrgSaving] = useState(false);

  // Файлы
  const [attachedFile, setAttachedFile] = useState<{ name: string; b64: string } | null>(null);
  const [attachedFile2, setAttachedFile2] = useState<{ name: string; b64: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // Дозаполнение плейсхолдеров (для orders/contract)
  const [fillMode, setFillMode] = useState(false);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [fillDoc, setFillDoc] = useState<string>("");
  const [filledDoc, setFilledDoc] = useState<string>("");

  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  // Только сообщения активного инструмента
  const messages = allMessages.filter(m => m.tool === activeTool);

  const saveMessages = useCallback((msgs: BizMsg[]) => {
    setAllMessages(msgs);
    saveLocalMessages(msgs);
  }, []);

  // Синхронизация с сервером при первом открытии
  useEffect(() => {
    if (!hasBiz) return;
    businessMessagesGet().then(serverMsgs => {
      if (serverMsgs.length > 0) {
        const merged = serverMsgs.map(m => ({
          id: m.id,
          role: m.role as "user" | "ai",
          body: m.body,
          tool: "chat" as BizTool,
          created_at: m.created_at,
        }));
        const local = loadLocalMessages();
        if (local.length === 0) saveMessages(merged);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBiz]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 130) + "px";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, which: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const allowed = (activeTool === "doc_analyze" || activeTool === "doc_compare")
      ? ALLOWED_DOC_EXTS : ALLOWED_ALL_EXTS;
    if (!allowed.includes(ext)) {
      setErr(`Допустимые форматы: ${allowed.join(", ")}`);
      return;
    }
    setFileUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      if (which === 1) setAttachedFile({ name: file.name, b64 });
      else setAttachedFile2({ name: file.name, b64 });
      setFileUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const getBizMode = (): string => {
    switch (activeTool) {
      case "counterparty": return "counterparty";
      case "contract": return "contract";
      case "doc_analyze": return "doc_analyze";
      case "doc_compare": return "doc_analyze";
      case "orders": return "orders";
      default: return "chat";
    }
  };

  const getPromptText = (): string => {
    const text = input.trim();
    switch (activeTool) {
      case "counterparty": return `Проверь контрагента: ${text}`;
      case "contract": return `Составь сложный договор: ${text}`;
      case "doc_analyze": return `Проанализируй договор контрагента. ${text}`;
      case "doc_compare": return `Сравни две версии договора. ${text}`;
      case "orders": return `Составь приказ/документ: ${text}`;
      default: return text;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    const hasFile = !!attachedFile;
    if (!text && !hasFile) return;
    if (!user.isAdmin && (user.businessActionsLeft ?? 0) <= 0) {
      setErr("Нет доступных действий. Пополните пакет.");
      return;
    }

    const userBody = text || (attachedFile ? `[Файл: ${attachedFile.name}]` : "");
    const userMsg: BizMsg = { role: "user", body: userBody, tool: activeTool };
    const newAll = [...allMessages, userMsg];
    saveMessages(newAll);
    setInput("");
    setSending(true);
    setErr("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Сохраняем на сервер и списываем действие
    businessMessageSave("user", userBody).catch(() => {});
    if (!user.isAdmin) businessConsumeAction().catch(() => {});

    try {
      const toolMessages = newAll.filter(m => m.tool === activeTool).slice(-8).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.body,
      }));
      toolMessages[toolMessages.length - 1].content = getPromptText();

      const reqBody: Record<string, unknown> = {
        mode: "business_chat",
        biz_mode: getBizMode(),
        org_name: orgName,
        messages: toolMessages,
      };
      if (attachedFile) { reqBody.file = attachedFile.b64; reqBody.filename = attachedFile.name; }
      if (attachedFile2) { reqBody.file2 = attachedFile2.b64; reqBody.filename2 = attachedFile2.name; }

      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      const aiBody = data.answer || "Не удалось получить ответ";
      const aiMsg: BizMsg = { role: "ai", body: aiBody, tool: activeTool };
      const finalAll = [...newAll, aiMsg];
      saveMessages(finalAll);
      businessMessageSave("ai", aiBody).catch(() => {});
      setAttachedFile(null);
      setAttachedFile2(null);
      // Для приказов и договоров — проверяем плейсхолдеры и предлагаем дозаполнение
      if (activeTool === "orders" || activeTool === "contract") {
        const placeholders = [...new Set([...aiBody.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]))];
        if (placeholders.length > 0) {
          setFillDoc(aiBody);
          setFilledDoc(aiBody);
          setFillValues(Object.fromEntries(placeholders.map(p => [p, ""])));
          setFillMode(true);
        }
      }
      await onRefreshUser();
    } catch {
      setErr("Ошибка запроса. Попробуйте ещё раз.");
    }
    setSending(false);
  };

  const saveOrgName = async () => {
    if (!orgName.trim()) return;
    setOrgSaving(true);
    await businessUpdateOrg(orgName.trim());
    await onRefreshUser();
    setOrgEditing(false);
    setOrgSaving(false);
  };

  const clearToolHistory = () => {
    const filtered = allMessages.filter(m => m.tool !== activeTool);
    saveMessages(filtered);
    setFillMode(false);
  };

  const applyFillValues = () => {
    let result = fillDoc;
    Object.entries(fillValues).forEach(([key, val]) => {
      result = result.replaceAll(`{{${key}}}`, val.trim() || `{{${key}}}`);
    });
    setFilledDoc(result);
  };

  // ── Не оплачено ──
  if (!hasBiz) {
    return (
      <div className="max-w-3xl mx-auto px-1">
        <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 rounded-3xl p-6 sm:p-8 mb-4 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/10 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gold-400/20 rounded-2xl flex items-center justify-center">
                <Icon name="Briefcase" size={24} className="text-gold-400" />
              </div>
              <div>
                <h2 className="font-cormorant font-bold text-2xl sm:text-3xl">Для бизнеса</h2>
                <p className="text-white/60 text-sm">Профессиональные юридические инструменты</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[{n:"150",l:"действий/мес"},{n:"6",l:"инструментов"},{n:"PDF/DOC",l:"анализ"},{n:"24ч",l:"хранение"}].map((s,i)=>(
                <div key={i} className="bg-white/10 rounded-2xl p-3 text-center">
                  <p className="font-cormorant font-bold text-2xl text-gold-400">{s.n}</p>
                  <p className="text-xs text-white/60 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            <button onClick={() => onPayClick("business_subscription", "Бизнес-тариф")} className="btn-gold px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 text-sm">
              <Icon name="Zap" size={16} />Подключить за 4 990 ₽/мес
            </button>
            <p className="text-white/40 text-xs mt-2">Оплата ежемесячно · 150 действий · PDF/DOC анализ · История 24 часа · Скачивание .doc</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOOLS.map(t=>(
            <div key={t.id} className="flex items-start gap-3 bg-white rounded-2xl border border-border p-4 opacity-60">
              <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                <Icon name={t.icon} size={16} className="text-navy-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-800">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <Icon name="Lock" size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Оплачено ──
  const currentTool = TOOLS.find(t => t.id === activeTool)!;
  const actionsLeft = user.isAdmin ? 999 : (user.businessActionsLeft ?? 0);
  const needsFile1 = activeTool === "doc_analyze" || activeTool === "doc_compare" || activeTool === "chat";
  const needsFile2 = activeTool === "doc_compare";
  const isDocOnly = activeTool === "doc_analyze" || activeTool === "doc_compare";
  const lastDownloadableAI = (activeTool === "contract" || activeTool === "orders")
    ? [...messages].reverse().find(m => m.role === "ai")
    : null;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-2 sm:gap-3" style={{ height: "clamp(540px, calc(100svh - 155px), 840px)" }}>

      {/* Хедер — компактный на мобиле */}
      <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-navy-900 to-navy-700 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-white shrink-0">
        <div className="w-7 h-7 sm:w-9 sm:h-9 bg-white/10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Briefcase" size={14} className="text-gold-400" />
        </div>
        <div className="flex-1 min-w-0">
          {orgEditing ? (
            <div className="flex items-center gap-1.5">
              <input value={orgName} onChange={e=>setOrgName(e.target.value)}
                placeholder="Название организации"
                className="bg-white/10 text-white placeholder:text-white/30 text-xs sm:text-sm rounded-lg px-2 py-1 outline-none border border-white/20 focus:border-gold-400 flex-1 min-w-0"
                onKeyDown={e=>e.key==="Enter"&&saveOrgName()} />
              <button onClick={saveOrgName} disabled={orgSaving||!orgName.trim()}
                className="px-2 py-1 bg-gold-400 text-navy-900 rounded-lg text-[11px] font-semibold disabled:opacity-50 shrink-0">
                {orgSaving?"…":"OK"}
              </button>
            </div>
          ) : (
            <button onClick={()=>setOrgEditing(true)} className="flex items-center gap-1.5 group w-full text-left">
              <p className="font-semibold text-white text-sm truncate">{orgName||"Организация"}</p>
              <Icon name="Pencil" size={11} className="text-white/30 group-hover:text-gold-400 shrink-0 transition-colors" />
            </button>
          )}
          <p className="text-[9px] text-white/30 hidden sm:block">История: 24 ч · данные на устройстве</p>
        </div>
        {/* Счётчик действий — всегда видим */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold shrink-0 ${actionsLeft>10?"bg-emerald-500/20 text-emerald-300":actionsLeft>0?"bg-amber-500/20 text-amber-300":"bg-red-500/20 text-red-300"}`}>
          <Icon name="Zap" size={10} />
          {user.isAdmin?"∞":actionsLeft}
          <span className="hidden sm:inline"> дейс.</span>
        </div>
        {!user.isAdmin&&actionsLeft<=30&&(
          <button onClick={()=>onPayClick("business_actions_30","30 действий")}
            className="px-2 py-1 bg-gold-400/25 hover:bg-gold-400/40 text-gold-300 rounded-lg text-[11px] font-semibold transition-colors shrink-0">
            +
          </button>
        )}
      </div>

      <div className="flex gap-2 sm:gap-3 flex-1 min-h-0">
        {/* Сайдбар (только десктоп) */}
        <div className="hidden sm:flex flex-col gap-1 w-44 shrink-0 overflow-y-auto">
          {TOOLS.map(t=>{
            const cnt = allMessages.filter(m=>m.tool===t.id&&m.role==="user").length;
            return (
              <button key={t.id} onClick={()=>{setActiveTool(t.id);setErr("");setAttachedFile(null);setAttachedFile2(null);setFillMode(false);}}
                className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeTool===t.id?"bg-navy-800 text-white shadow-md":"bg-white border border-border hover:border-navy-200 hover:bg-slate-50 text-navy-700"}`}>
                <Icon name={t.icon} size={14} className={activeTool===t.id?"text-gold-400 mt-0.5 shrink-0":"text-navy-400 mt-0.5 shrink-0"} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold leading-tight truncate">{t.label}</p>
                  <p className={`text-[10px] leading-tight mt-0.5 truncate ${activeTool===t.id?"text-white/50":"text-muted-foreground"}`}>{t.desc}</p>
                </div>
                {cnt>0&&<span className="shrink-0 w-4 h-4 bg-gold-400/30 text-gold-700 text-[9px] font-bold rounded-full flex items-center justify-center">{cnt}</span>}
              </button>
            );
          })}
          {!user.isAdmin&&(
            <div className="mt-auto pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium px-1">Докупить:</p>
              {([["business_actions_10","+10","1 000 ₽"],["business_actions_30","+30","3 000 ₽"],["business_actions_50","+50","3 500 ₽"],["business_actions_150","+150","9 000 ₽"]] as [ServiceType,string,string][]).map(([t,l,p])=>(
                <button key={t} onClick={()=>onPayClick(t,l)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 border border-border mb-1 transition-colors">
                  <span className="text-[10px] text-navy-700 font-medium">{l}</span>
                  <span className="text-[9px] text-navy-500">{p}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Основная область */}
        <div className="flex-1 flex flex-col min-w-0 gap-2">

          {/* Мобильный выбор инструмента — горизонтальный скролл */}
          <div className="sm:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{scrollbarWidth:"none"}}>
              {TOOLS.map(t=>(
                <button key={t.id} onClick={()=>{setActiveTool(t.id);setErr("");setAttachedFile(null);setAttachedFile2(null);setFillMode(false);}}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-medium shrink-0 transition-all ${activeTool===t.id?"bg-navy-800 text-white shadow-md":"bg-white border border-border text-navy-600 hover:border-navy-200"}`}>
                  <Icon name={t.icon} size={12} className={activeTool===t.id?"text-gold-400":"text-navy-400"} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>



          {/* Тул-хедер */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${TOOL_COLORS[currentTool.color]} shrink-0`}>
            <div className="flex items-center gap-2">
              <Icon name={currentTool.icon} size={14} />
              <span className="text-xs font-semibold">{currentTool.label}</span>
              {messages.length>0&&<span className="text-[10px] opacity-60">· {messages.filter(m=>m.role==="user").length} запр.</span>}
            </div>
            <div className="flex items-center gap-2">
              {lastDownloadableAI&&(
                <button onClick={()=>downloadAsDoc(lastDownloadableAI.body, activeTool==="orders"?"Приказ":"Договор")}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white transition-colors">
                  <Icon name="Download" size={12} />Скачать .doc
                </button>
              )}
              {messages.length>0&&(
                <button onClick={clearToolHistory} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Icon name="Trash2" size={11} />очистить
                </button>
              )}
            </div>
          </div>

          {/* Сообщения */}
          <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4 space-y-3" style={{scrollbarWidth:"none"}}>
            {messages.length===0?(
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${TOOL_COLORS[currentTool.color]}`}>
                  <Icon name={currentTool.icon} size={26} />
                </div>
                <div className="max-w-xs">
                  <p className="text-sm font-semibold text-navy-700 mb-1">{currentTool.label}</p>
                  <p className="text-xs text-muted-foreground">{currentTool.desc}</p>
                  {activeTool==="doc_compare"&&(
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-100 rounded-xl">
                        <div className="w-5 h-5 bg-pink-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-pink-600">1</div>
                        <span className="text-xs text-pink-700">Загрузите первый договор (PDF/DOC)</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-blue-600">2</div>
                        <span className="text-xs text-blue-700">Загрузите второй договор (PDF/DOC)</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center pt-1">AI сравнит оба документа и выделит различия</p>
                    </div>
                  )}
                  {activeTool==="doc_analyze"&&(
                    <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mt-2">Загрузите договор в формате PDF, DOC или DOCX</p>
                  )}
                  {activeTool==="orders"&&(
                    <p className="text-xs text-teal-600 bg-teal-50 rounded-xl px-3 py-2 mt-2">Опишите вид приказа и параметры — скачаете в .doc</p>
                  )}
                </div>
              </div>
            ):messages.map((m,i)=>(
              <div key={i} className={`flex gap-2 items-end ${m.role==="user"?"justify-end":"justify-start"} animate-fade-in`}>
                {m.role==="ai"&&(
                  <div className="w-7 h-7 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                    <Icon name="Bot" size={13} className="text-gold-400" />
                  </div>
                )}
                <div className={`max-w-[86%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm ${m.role==="user"?"bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm":"bg-white border border-slate-100 text-navy-800 rounded-bl-sm"}`}>
                  {m.role==="ai"?<MarkdownText text={m.body}/>:<p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>}
                  <p className={`text-[10px] mt-1 ${m.role==="user"?"text-white/40 text-right":"text-muted-foreground/40"}`}>{fmtDt(m.created_at)}</p>
                </div>
                {m.role==="user"&&(
                  <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-navy-700 uppercase">
                    {user.name?.[0]??"U"}
                  </div>
                )}
              </div>
            ))}
            {sending&&(
              <div className="flex gap-2 items-end justify-start animate-fade-in">
                <div className="w-7 h-7 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                  <Icon name="Bot" size={13} className="text-gold-400" />
                </div>
                <div className="bg-white border border-navy-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[200px]">
                  <div className="flex gap-1 items-center mb-1.5">
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full"/>
                    <span className="typing-dot w-2 h-2 bg-navy-500 rounded-full"/>
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full"/>
                  </div>
                  <p className="text-[10px] text-muted-foreground animate-pulse">
                    {activeTool==="counterparty"?"Проверяю контрагента..."
                    :activeTool==="contract"?"Составляю договор..."
                    :activeTool==="doc_analyze"?"Анализирую документ..."
                    :activeTool==="doc_compare"?"Сравниваю документы..."
                    :activeTool==="orders"?"Составляю приказ..."
                    :"Анализирую запрос..."}
                  </p>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {err&&<div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 shrink-0"><Icon name="AlertCircle" size={12} className="shrink-0"/>{err}</div>}

          {/* Файловые кнопки */}
          {needsFile1&&(
            <div className="flex gap-2 flex-wrap shrink-0">
              <input ref={fileRef} type="file"
                accept={isDocOnly?".pdf,.doc,.docx":".pdf,.doc,.docx,.jpg,.jpeg,.png"}
                className="hidden" onChange={e=>handleFile(e,1)}/>
              {attachedFile?(
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                  <Icon name="FileCheck" size={12}/>
                  <span className="truncate max-w-32">{attachedFile.name}</span>
                  <button onClick={()=>setAttachedFile(null)} className="text-emerald-500 hover:text-red-500 ml-1"><Icon name="X" size={11}/></button>
                </div>
              ):(
                <button onClick={()=>fileRef.current?.click()} disabled={fileUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border hover:border-navy-300 rounded-xl text-xs text-navy-600 transition-all disabled:opacity-50">
                  <Icon name="Upload" size={12}/>
                  {isDocOnly?"Загрузить PDF/DOC":"Загрузить документ или фото"}
                </button>
              )}
              {needsFile2&&(
                <>
                  <input ref={fileRef2} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e=>handleFile(e,2)}/>
                  {attachedFile2?(
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                      <Icon name="FileCheck" size={12}/>
                      <span className="truncate max-w-32">{attachedFile2.name}</span>
                      <button onClick={()=>setAttachedFile2(null)} className="text-emerald-500 hover:text-red-500 ml-1"><Icon name="X" size={11}/></button>
                    </div>
                  ):(
                    <button onClick={()=>fileRef2.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border hover:border-navy-300 rounded-xl text-xs text-navy-600 transition-all">
                      <Icon name="Upload" size={12}/>Второй документ (PDF/DOC)
                    </button>
                  )}
                </>
              )}
              {isDocOnly&&<span className="text-[10px] text-muted-foreground self-center">· только PDF, DOC, DOCX</span>}
            </div>
          )}

          {/* Режим дозаполнения плейсхолдеров */}
          {fillMode && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 shrink-0 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="PenLine" size={14} className="text-teal-700" />
                  <span className="text-sm font-semibold text-teal-800">Заполните реквизиты</span>
                </div>
                <button onClick={()=>setFillMode(false)} className="text-teal-500 hover:text-teal-700 transition-colors">
                  <Icon name="X" size={14}/>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {Object.keys(fillValues).map(key => (
                  <div key={key}>
                    <label className="text-[10px] font-medium text-teal-700 uppercase tracking-wide block mb-0.5">{key.replace(/_/g," ")}</label>
                    <input value={fillValues[key]}
                      onChange={e=>setFillValues(p=>({...p,[key]:e.target.value}))}
                      placeholder={`{{${key}}}`}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white outline-none focus:border-teal-500 transition-colors"/>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={applyFillValues}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors">
                  Применить и обновить
                </button>
                <button onClick={()=>downloadAsDoc(filledDoc, activeTool==="orders"?"Приказ":"Договор")}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-teal-300 text-teal-700 text-xs font-semibold rounded-xl hover:bg-teal-50 transition-colors">
                  <Icon name="Download" size={12}/>Скачать .doc
                </button>
              </div>
            </div>
          )}

          {/* Поле ввода */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
            <div className="flex items-end gap-2 px-3 py-2.5">
              <textarea ref={textareaRef} rows={1} value={input}
                onChange={e=>{setInput(e.target.value);adjustTextarea();}}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                disabled={sending}
                placeholder={
                  activeTool==="counterparty"?"Введите ИНН или название компании для проверки..."
                  :activeTool==="contract"?"Опишите стороны и условия договора..."
                  :activeTool==="doc_analyze"?"Что именно проверить? (необязательно)"
                  :activeTool==="doc_compare"?"На что обратить особое внимание при сравнении?"
                  :activeTool==="orders"?"Вид приказа/документа и ключевые параметры..."
                  :"Задайте юридический вопрос для вашего бизнеса..."
                }
                className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 text-sm outline-none resize-none leading-relaxed py-1"
                style={{minHeight:"24px",maxHeight:"130px"}}/>
              <button onClick={sendMessage} disabled={sending||(!input.trim()&&!attachedFile)}
                className="w-9 h-9 bg-navy-700 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
                {sending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                  : <Icon name="Send" size={15} className="text-white"/>}
              </button>
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/50">Enter — отправить · Shift+Enter — новая строка</p>
              <p className="text-[10px] text-muted-foreground/40">История: 24 часа</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}