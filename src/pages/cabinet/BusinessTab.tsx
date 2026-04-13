import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import {
  hasBusinessSubscription, businessUpdateOrg, businessConsumeAction,
  businessMessagesGet, businessMessageSave,
} from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";

const GIGACHAT_URL_CONST = (func2url as Record<string, string>)["gigachat-proxy"];

interface BusinessTabProps {
  user: User;
  onPayClick: (type: ServiceType, name: string) => void;
  onRefreshUser: () => Promise<void>;
}

type BizTool = "chat" | "contract" | "doc_analyze" | "doc_compare" | "counterparty" | "orders" | "tax";

interface BizMsg {
  id?: number;
  role: "user" | "ai";
  body: string;
  created_at?: string;
}

const TOOLS: { id: BizTool; icon: string; label: string; desc: string }[] = [
  { id: "chat", icon: "Bot", label: "AI-консультант", desc: "Юридические вопросы для бизнеса" },
  { id: "counterparty", icon: "Search", label: "Проверка контрагента", desc: "Due diligence по ИНН" },
  { id: "contract", icon: "FileSignature", label: "Сложный договор", desc: "Лицензионный, опционный и др." },
  { id: "doc_analyze", icon: "FileSearch", label: "Анализ договора", desc: "До 20 страниц" },
  { id: "doc_compare", icon: "GitCompare", label: "Сравнение договоров", desc: "Две версии документа" },
  { id: "orders", icon: "Stamp", label: "Приказы и документы", desc: "Кадровые и корпоративные" },
  { id: "tax", icon: "Calculator", label: "Налоговый анализ", desc: "Расчёт налогов с загрузкой доков" },
];

function fmtDt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-[13px] leading-relaxed space-y-1 whitespace-pre-wrap font-golos">
      {lines.map((line, i) => {
        if (/^#{1,3}\s/.test(line)) {
          return <p key={i} className="font-bold text-navy-800 mt-2">{line.replace(/^#+\s/, "")}</p>;
        }
        if (/^[-*]\s/.test(line)) {
          return <p key={i} className="pl-3 before:content-['•'] before:mr-2 before:text-navy-400">{line.replace(/^[-*]\s/, "")}</p>;
        }
        if (/^\d+\.\s/.test(line)) {
          return <p key={i} className="pl-3">{line}</p>;
        }
        if (line.includes("🟢") || line.includes("🟡") || line.includes("🔴")) {
          return <p key={i} className="font-semibold text-base">{line}</p>;
        }
        return <span key={i}>{line}{i < lines.length - 1 ? "\n" : ""}</span>;
      })}
    </div>
  );
}

export default function BusinessTab({ user, onPayClick, onRefreshUser }: BusinessTabProps) {
  const hasBiz = hasBusinessSubscription(user);
  const [activeTool, setActiveTool] = useState<BizTool>("chat");
  const [messages, setMessages] = useState<BizMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [orgName, setOrgName] = useState(user.businessOrgName || "");
  const [orgEditing, setOrgEditing] = useState(!user.businessOrgName);
  const [orgSaving, setOrgSaving] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; b64: string } | null>(null);
  const [attachedFile2, setAttachedFile2] = useState<{ name: string; b64: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const GIGACHAT_URL = GIGACHAT_URL_CONST;

  // Загрузка истории
  const loadHistory = useCallback(async () => {
    if (!hasBiz) return;
    const msgs = await businessMessagesGet();
    setMessages(msgs.map(m => ({ id: m.id, role: m.role as "user" | "ai", body: m.body, created_at: m.created_at })));
  }, [hasBiz]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

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

  const getToolPrompt = (): string => {
    switch (activeTool) {
      case "counterparty": return `Проверь контрагента по ИНН. Запрос: ${input}`;
      case "contract": return `Составь договор: ${input}`;
      case "doc_analyze": return `Проанализируй договор контрагента: ${input || ""}`;
      case "doc_compare": return `Сравни две версии договора: ${input || ""}`;
      case "orders": return `Составь документ/приказ: ${input}`;
      case "tax": return `Проведи налоговый анализ: ${input || ""}`;
      default: return input;
    }
  };

  const getBizMode = (): string => {
    switch (activeTool) {
      case "counterparty": return "counterparty";
      case "contract": return "contract";
      case "doc_analyze":
      case "doc_compare": return "doc_analyze";
      case "tax": return "tax";
      default: return "chat";
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !attachedFile) return;
    if (!user.isAdmin && (user.businessActionsLeft ?? 0) <= 0) {
      setErr("Нет доступных действий. Пополните пакет.");
      return;
    }

    const userMsg: BizMsg = { role: "user", body: text || `[${attachedFile?.name}]` };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setErr("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await businessMessageSave("user", userMsg.body).catch(() => {});
    if (!user.isAdmin) await businessConsumeAction().catch(() => {});

    try {
      const historyMsgs = [...messages, userMsg].slice(-8).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.body,
      }));

      let finalContent = text || "";
      if (attachedFile) finalContent += `\n\n[Файл: ${attachedFile.name}]`;
      if (attachedFile2) finalContent += `\n\n[Второй файл: ${attachedFile2.name}]`;
      historyMsgs[historyMsgs.length - 1].content = getToolPrompt();

      const reqBody: Record<string, unknown> = {
        mode: "business_chat",
        biz_mode: getBizMode(),
        org_name: orgName,
        messages: historyMsgs,
      };

      if (attachedFile) {
        reqBody.file = attachedFile.b64;
        reqBody.filename = attachedFile.name;
      }
      if (attachedFile2) {
        reqBody.file2 = attachedFile2.b64;
        reqBody.filename2 = attachedFile2.name;
      }

      const res = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      const aiBody = data.answer || "Не удалось получить ответ";
      const aiMsg: BizMsg = { role: "ai", body: aiBody };
      setMessages(prev => [...prev, aiMsg]);
      await businessMessageSave("ai", aiBody).catch(() => {});
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

  // ── Не оплачено ────────────────────────────
  if (!hasBiz) {
    return (
      <div className="max-w-3xl mx-auto px-1">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 rounded-3xl p-6 sm:p-8 mb-4 text-white">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gold-400/10 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none" />
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
              {[
                { num: "80", label: "действий/мес" },
                { num: "7", label: "инструментов" },
                { num: "20", label: "страниц анализа" },
                { num: "1", label: "месяц хранения" },
              ].map((s, i) => (
                <div key={i} className="bg-white/10 rounded-2xl p-3 text-center">
                  <p className="font-cormorant font-bold text-2xl text-gold-400">{s.num}</p>
                  <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => onPayClick("business_subscription", "Бизнес-тариф")}
              className="btn-gold px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 text-sm"
            >
              <Icon name="Zap" size={16} />
              Подключить за 7 000 ₽/мес
            </button>
            <p className="text-white/40 text-xs mt-2">Оплата ежемесячно · Неиспользованные действия сгорают</p>
          </div>
        </div>

        {/* Инструменты */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOOLS.map(t => (
            <div key={t.id} className="flex items-start gap-3 bg-white rounded-2xl border border-border p-4 opacity-60">
              <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
                <Icon name={t.icon} size={16} className="text-navy-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-800">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <Icon name="Lock" size={14} className="text-muted-foreground shrink-0 ml-auto mt-0.5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Оплачено — интерфейс ────────────────────
  const currentTool = TOOLS.find(t => t.id === activeTool)!;
  const needsFile = activeTool === "doc_analyze" || activeTool === "doc_compare" || activeTool === "tax";
  const needsFile2 = activeTool === "doc_compare";
  const actionsLeft = user.isAdmin ? 999 : (user.businessActionsLeft ?? 0);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4" style={{ height: "clamp(500px, calc(100svh - 170px), 800px)" }}>

      {/* Хедер */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-navy-800 to-navy-700 rounded-2xl px-4 py-3 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Briefcase" size={16} className="text-gold-400" />
          </div>
          <div className="min-w-0">
            {orgEditing ? (
              <div className="flex items-center gap-2">
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Название организации"
                  className="bg-white/10 text-white placeholder:text-white/40 text-sm rounded-xl px-3 py-1.5 outline-none border border-white/20 focus:border-gold-400 w-48 sm:w-64"
                  onKeyDown={e => e.key === "Enter" && saveOrgName()}
                />
                <button
                  onClick={saveOrgName}
                  disabled={orgSaving || !orgName.trim()}
                  className="px-3 py-1.5 bg-gold-400 text-navy-900 rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {orgSaving ? "..." : "Сохранить"}
                </button>
              </div>
            ) : (
              <button onClick={() => setOrgEditing(true)} className="flex items-center gap-2 group text-left">
                <p className="font-semibold text-white truncate max-w-48 sm:max-w-64">{orgName || "Укажите организацию"}</p>
                <Icon name="Pencil" size={12} className="text-white/40 group-hover:text-gold-400 shrink-0 transition-colors" />
              </button>
            )}
            <p className="text-xs text-white/50">Для бизнеса · история 1 месяц</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${actionsLeft > 10 ? "bg-emerald-500/20 text-emerald-300" : actionsLeft > 0 ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"}`}>
            <Icon name="Zap" size={12} />
            {user.isAdmin ? "∞" : actionsLeft} действий
          </div>
          {!user.isAdmin && actionsLeft <= 20 && (
            <button
              onClick={() => onPayClick("business_actions_10", "Доп. 10 действий")}
              className="px-2.5 py-1.5 bg-gold-400/20 hover:bg-gold-400/30 text-gold-300 rounded-xl text-xs font-medium transition-colors"
            >
              + пополнить
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Сайдбар инструментов — десктоп */}
        <div className="hidden sm:flex flex-col gap-1.5 w-48 shrink-0">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                activeTool === t.id
                  ? "bg-navy-800 text-white shadow-md"
                  : "bg-white border border-border hover:border-navy-200 hover:bg-slate-50 text-navy-700"
              }`}
            >
              <Icon name={t.icon} size={15} className={activeTool === t.id ? "text-gold-400 mt-0.5 shrink-0" : "text-navy-400 mt-0.5 shrink-0"} />
              <div>
                <p className="text-xs font-semibold leading-tight">{t.label}</p>
                <p className={`text-[10px] leading-tight mt-0.5 ${activeTool === t.id ? "text-white/50" : "text-muted-foreground"}`}>{t.desc}</p>
              </div>
            </button>
          ))}

          {/* Пополнение */}
          {!user.isAdmin && (
            <div className="mt-auto pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Докупить действия:</p>
              {[
                { type: "business_actions_10" as ServiceType, label: "10 действий", price: "1 000 ₽" },
                { type: "business_actions_30" as ServiceType, label: "30 действий", price: "3 000 ₽" },
                { type: "business_actions_60" as ServiceType, label: "60 действий", price: "6 000 ₽" },
              ].map(a => (
                <button
                  key={a.type}
                  onClick={() => onPayClick(a.type, a.label)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 border border-border mb-1 transition-colors"
                >
                  <span className="text-[11px] text-navy-700 font-medium">{a.label}</span>
                  <span className="text-[10px] text-navy-500">{a.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Основная область */}
        <div className="flex-1 flex flex-col min-w-0 gap-2">

          {/* Мобильный выбор инструмента */}
          <div className="sm:hidden">
            <button
              onClick={() => setMobileToolsOpen(!mobileToolsOpen)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-white border border-border rounded-xl text-sm font-medium text-navy-800"
            >
              <Icon name={currentTool.icon} size={15} className="text-navy-600 shrink-0" />
              {currentTool.label}
              <Icon name={mobileToolsOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground ml-auto" />
            </button>
            {mobileToolsOpen && (
              <div className="mt-1 bg-white border border-border rounded-2xl p-2 grid grid-cols-2 gap-1.5 animate-fade-in">
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTool(t.id); setMobileToolsOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeTool === t.id ? "bg-navy-800 text-white" : "hover:bg-slate-50 text-navy-700"}`}
                  >
                    <Icon name={t.icon} size={13} className={activeTool === t.id ? "text-gold-400 shrink-0" : "text-navy-400 shrink-0"} />
                    <span className="text-xs font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Сообщения */}
          <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 space-y-4" style={{ scrollbarWidth: "none" }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
                <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center">
                  <Icon name={currentTool.icon} size={28} className="text-navy-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-700 mb-1">{currentTool.label}</p>
                  <p className="text-xs text-muted-foreground max-w-xs">{currentTool.desc}</p>
                </div>
                {activeTool === "counterparty" && (
                  <p className="text-xs text-navy-500 bg-navy-50 rounded-xl px-4 py-2.5 max-w-xs">Введите ИНН компании или её название для проверки</p>
                )}
                {(activeTool === "doc_analyze" || activeTool === "doc_compare" || activeTool === "tax") && (
                  <p className="text-xs text-navy-500 bg-navy-50 rounded-xl px-4 py-2.5 max-w-xs">Загрузите файл(ы) ниже для анализа</p>
                )}
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={m.id ?? i} className={`flex gap-2 sm:gap-3 items-end ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  {m.role === "ai" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0 shadow-md">
                      <Icon name="Bot" size={14} className="text-gold-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm"
                      : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm"
                  }`}>
                    {m.role === "ai" ? <MarkdownText text={m.body} /> : (
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    )}
                    {m.created_at && (
                      <p className={`text-[10px] mt-1.5 ${m.role === "user" ? "text-white/40 text-right" : "text-muted-foreground/40"}`}>{fmtDt(m.created_at)}</p>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                      {user.name?.[0] ?? "U"}
                    </div>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="flex gap-3 items-end justify-start animate-fade-in">
                <div className="w-8 h-8 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0">
                  <Icon name="Bot" size={14} className="text-gold-400" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {err && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 shrink-0">
              <Icon name="AlertCircle" size={13} className="shrink-0" />{err}
            </div>
          )}

          {/* Файлы */}
          {needsFile && (
            <div className="flex gap-2 flex-wrap shrink-0">
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={e => handleFile(e, 1)} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={fileUploading}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  attachedFile ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-border hover:border-navy-300 text-navy-600"
                }`}
              >
                <Icon name={attachedFile ? "FileCheck" : "Upload"} size={13} />
                {attachedFile ? attachedFile.name : "Загрузить документ"}
              </button>
              {attachedFile && (
                <button onClick={() => setAttachedFile(null)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
                  <Icon name="X" size={12} />
                </button>
              )}
              {needsFile2 && (
                <>
                  <input ref={fileRef2} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={e => handleFile(e, 2)} />
                  <button
                    onClick={() => fileRef2.current?.click()}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                      attachedFile2 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-border hover:border-navy-300 text-navy-600"
                    }`}
                  >
                    <Icon name={attachedFile2 ? "FileCheck" : "Upload"} size={13} />
                    {attachedFile2 ? attachedFile2.name : "Второй документ"}
                  </button>
                  {attachedFile2 && (
                    <button onClick={() => setAttachedFile2(null)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
                      <Icon name="X" size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Поле ввода */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
            <div className="flex items-end gap-2 px-3 py-2.5">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={e => { setInput(e.target.value); adjustTextarea(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={sending}
                placeholder={
                  activeTool === "counterparty" ? "Введите ИНН или название компании..."
                  : activeTool === "doc_analyze" ? "Что именно проанализировать? (необязательно)"
                  : activeTool === "doc_compare" ? "Что сравнить? На что обратить внимание?"
                  : activeTool === "contract" ? "Опишите стороны и условия договора..."
                  : activeTool === "orders" ? "Вид документа и ключевые параметры..."
                  : activeTool === "tax" ? "Какой налог? Загрузите документы выше."
                  : "Задайте юридический вопрос..."
                }
                className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 text-sm outline-none resize-none leading-relaxed py-1"
                style={{ minHeight: "24px", maxHeight: "130px" }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || (!input.trim() && !attachedFile)}
                className="w-9 h-9 bg-navy-700 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm"
              >
                {sending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Icon name="Send" size={15} className="text-white" />
                }
              </button>
            </div>
            <div className="px-4 pb-2">
              <p className="text-[10px] text-muted-foreground/50">Enter — отправить · Shift+Enter — новая строка · История хранится 1 месяц</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}