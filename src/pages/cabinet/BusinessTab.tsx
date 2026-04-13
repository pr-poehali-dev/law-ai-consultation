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

type BizTool = "chat" | "counterparty" | "contract" | "doc_analyze" | "doc_compare" | "orders" | "tax";

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
  { id: "orders", icon: "Stamp", label: "Приказы и документы", desc: "Кадровые и корпоративные", color: "teal" },
  { id: "tax", icon: "Calculator", label: "Налоговый анализ", desc: "Калькулятор · ввод вручную", color: "amber" },
];

const TOOL_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  pink: "bg-pink-50 text-pink-700 border-pink-100",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
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

  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  // Только сообщения активного инструмента
  const messages = allMessages.filter(m => m.tool === activeTool);

  // Последнее AI-сообщение в contract для скачивания
  const lastContractAI = activeTool === "contract"
    ? [...messages].reverse().find(m => m.role === "ai")
    : null;

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
      case "tax": return "tax";
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
      case "orders": return `Составь документ/приказ: ${text}`;
      case "tax": return text;
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
              {[{n:"80",l:"действий/мес"},{n:"7",l:"инструментов"},{n:"20",l:"стр. анализа"},{n:"1 день",l:"хранение"}].map((s,i)=>(
                <div key={i} className="bg-white/10 rounded-2xl p-3 text-center">
                  <p className="font-cormorant font-bold text-2xl text-gold-400">{s.n}</p>
                  <p className="text-xs text-white/60 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            <button onClick={() => onPayClick("business_subscription", "Бизнес-тариф")} className="btn-gold px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 text-sm">
              <Icon name="Zap" size={16} />Подключить за 7 000 ₽/мес
            </button>
            <p className="text-white/40 text-xs mt-2">Оплата ежемесячно · Неиспользованные действия сгорают в конце месяца · История запросов — 1 день</p>
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
  const isTax = activeTool === "tax";

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-3" style={{ height: "clamp(520px, calc(100svh - 170px), 820px)" }}>

      {/* Хедер */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-navy-800 to-navy-700 rounded-2xl px-4 py-3 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Briefcase" size={16} className="text-gold-400" />
          </div>
          <div className="min-w-0">
            {orgEditing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input value={orgName} onChange={e=>setOrgName(e.target.value)}
                  placeholder="Название организации"
                  className="bg-white/10 text-white placeholder:text-white/40 text-sm rounded-xl px-3 py-1.5 outline-none border border-white/20 focus:border-gold-400 w-44 sm:w-60"
                  onKeyDown={e=>e.key==="Enter"&&saveOrgName()} />
                <button onClick={saveOrgName} disabled={orgSaving||!orgName.trim()}
                  className="px-3 py-1.5 bg-gold-400 text-navy-900 rounded-xl text-xs font-semibold disabled:opacity-50">
                  {orgSaving?"…":"Сохранить"}
                </button>
              </div>
            ) : (
              <button onClick={()=>setOrgEditing(true)} className="flex items-center gap-2 group text-left">
                <p className="font-semibold text-white truncate max-w-40 sm:max-w-56">{orgName||"Укажите организацию"}</p>
                <Icon name="Pencil" size={12} className="text-white/40 group-hover:text-gold-400 shrink-0 transition-colors" />
              </button>
            )}
            <p className="text-[10px] text-white/40">История запросов: 1 день · данные на вашем устройстве</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${actionsLeft>10?"bg-emerald-500/20 text-emerald-300":actionsLeft>0?"bg-yellow-500/20 text-yellow-300":"bg-red-500/20 text-red-300"}`}>
            <Icon name="Zap" size={11} />
            {user.isAdmin?"∞":actionsLeft} действий
          </div>
          {!user.isAdmin&&actionsLeft<=20&&(
            <button onClick={()=>onPayClick("business_actions_10","10 доп. действий")}
              className="px-2 py-1.5 bg-gold-400/20 hover:bg-gold-400/30 text-gold-300 rounded-xl text-xs font-medium transition-colors">
              +пополнить
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Сайдбар */}
        <div className="hidden sm:flex flex-col gap-1 w-44 shrink-0 overflow-y-auto">
          {TOOLS.map(t=>{
            const cnt = allMessages.filter(m=>m.tool===t.id&&m.role==="user").length;
            return (
              <button key={t.id} onClick={()=>{setActiveTool(t.id);setErr("");setAttachedFile(null);setAttachedFile2(null);}}
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
          {/* Докупка */}
          {!user.isAdmin&&(
            <div className="mt-auto pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium px-1">Докупить действия:</p>
              {([["business_actions_10","10 дейс.","1 000 ₽"],["business_actions_30","30 дейс.","3 000 ₽"],["business_actions_60","60 дейс.","6 000 ₽"]] as [ServiceType,string,string][]).map(([t,l,p])=>(
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

          {/* Мобильный выбор */}
          <div className="sm:hidden">
            <button onClick={()=>setMobileToolsOpen(!mobileToolsOpen)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-white border border-border rounded-xl text-sm font-medium text-navy-800">
              <Icon name={currentTool.icon} size={14} className="text-navy-500 shrink-0" />
              <span className="flex-1 text-left">{currentTool.label}</span>
              <Icon name={mobileToolsOpen?"ChevronUp":"ChevronDown"} size={14} className="text-muted-foreground" />
            </button>
            {mobileToolsOpen&&(
              <div className="mt-1 bg-white border border-border rounded-2xl p-2 grid grid-cols-2 gap-1 animate-fade-in">
                {TOOLS.map(t=>(
                  <button key={t.id} onClick={()=>{setActiveTool(t.id);setMobileToolsOpen(false);setErr("");}}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${activeTool===t.id?"bg-navy-800 text-white":"hover:bg-slate-50 text-navy-700"}`}>
                    <Icon name={t.icon} size={13} className={activeTool===t.id?"text-gold-400 shrink-0":"text-navy-400 shrink-0"} />
                    <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Тул-хедер */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${TOOL_COLORS[currentTool.color]} shrink-0`}>
            <div className="flex items-center gap-2">
              <Icon name={currentTool.icon} size={14} />
              <span className="text-xs font-semibold">{currentTool.label}</span>
              {messages.length>0&&<span className="text-[10px] opacity-60">· {messages.filter(m=>m.role==="user").length} запр.</span>}
            </div>
            <div className="flex items-center gap-2">
              {activeTool==="contract"&&lastContractAI&&(
                <button onClick={()=>downloadAsDoc(lastContractAI.body,"Договор")}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white transition-colors">
                  <Icon name="Download" size={12} />DOC
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
                <div>
                  <p className="text-sm font-semibold text-navy-700 mb-1">{currentTool.label}</p>
                  {isTax?(
                    <div className="text-left max-w-xs text-xs text-navy-600 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                      <p className="font-semibold">Введите вручную:</p>
                      <p>• Систему налогообложения (ОСН / УСН 6% / УСН 15% / НПД)</p>
                      <p>• Доходы (₽)</p>
                      <p>• Расходы (₽, если нужны)</p>
                      <p>• ФОТ и количество сотрудников (если есть)</p>
                    </div>
                  ):(
                    <p className="text-xs text-muted-foreground max-w-xs">{currentTool.desc}</p>
                  )}
                  {(activeTool==="doc_analyze"||activeTool==="doc_compare")&&(
                    <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mt-2">Допустимые форматы: PDF, DOC, DOCX</p>
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
                <div className="w-7 h-7 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0">
                  <Icon name="Bot" size={13} className="text-gold-400" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="typing-dot w-1.5 h-1.5 bg-navy-300 rounded-full"/>
                    <span className="typing-dot w-1.5 h-1.5 bg-navy-400 rounded-full"/>
                    <span className="typing-dot w-1.5 h-1.5 bg-navy-300 rounded-full"/>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {err&&<div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 shrink-0"><Icon name="AlertCircle" size={12} className="shrink-0"/>{err}</div>}

          {/* Файловые кнопки */}
          {needsFile1&&!isTax&&(
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

          {/* Поле ввода */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
            <div className="flex items-end gap-2 px-3 py-2.5">
              <textarea ref={textareaRef} rows={1} value={input}
                onChange={e=>{setInput(e.target.value);adjustTextarea();}}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                disabled={sending}
                placeholder={
                  isTax?"Введите: систему налогообложения, доходы, расходы, ФОТ, кол-во сотрудников..."
                  :activeTool==="counterparty"?"Введите ИНН или название компании для проверки..."
                  :activeTool==="contract"?"Опишите стороны и условия договора..."
                  :activeTool==="doc_analyze"?"Что именно проверить? (необязательно)"
                  :activeTool==="doc_compare"?"На что обратить особое внимание при сравнении?"
                  :activeTool==="orders"?"Вид документа и ключевые параметры..."
                  :"Задайте юридический вопрос для вашего бизнеса..."
                }
                className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 text-sm outline-none resize-none leading-relaxed py-1"
                style={{minHeight:"24px",maxHeight:"130px"}}/>
              <button onClick={sendMessage} disabled={sending||(!input.trim()&&!attachedFile)}
                className="w-9 h-9 bg-navy-700 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
                {sending?<div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>:<Icon name="Send" size={15} className="text-white"/>}
              </button>
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/50">Enter — отправить · Shift+Enter — новая строка</p>
              <p className="text-[10px] text-muted-foreground/40">История: 1 день</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
