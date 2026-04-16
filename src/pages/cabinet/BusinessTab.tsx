import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import {
  hasBusinessSubscription, businessUpdateOrg, businessConsumeAction,
  businessMessagesGet, businessMessageSave,
} from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";
import func2url from "../../../backend/func2url.json";
import BusinessPaywall from "./BusinessPaywall";
import BusinessSidebar, { TOOLS, type BizTool } from "./BusinessSidebar";
import BusinessMessages, { type BizMsg } from "./BusinessMessages";
import BusinessInput, { downloadAsDoc } from "./BusinessInput";

const GIGACHAT_URL = (func2url as Record<string, string>)["gigachat-proxy"];

const TOOL_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  pink: "bg-pink-50 text-pink-700 border-pink-100",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
};

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

interface BusinessTabProps {
  user: User;
  onPayClick: (type: ServiceType, name: string) => void;
  onRefreshUser: () => Promise<void>;
}

export default function BusinessTab({ user, onPayClick, onRefreshUser }: BusinessTabProps) {
  const hasBiz = hasBusinessSubscription(user);

  const [allMessages, setAllMessages] = useState<BizMsg[]>(() => loadLocalMessages());
  const [activeTool, setActiveTool] = useState<BizTool>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [orgName, setOrgName] = useState(user.businessOrgName || "");
  const [orgEditing, setOrgEditing] = useState(!user.businessOrgName);
  const [orgSaving, setOrgSaving] = useState(false);

  const [attachedFile, setAttachedFile] = useState<{ name: string; b64: string } | null>(null);
  const [attachedFile2, setAttachedFile2] = useState<{ name: string; b64: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  const [fillMode, setFillMode] = useState(false);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [fillDoc, setFillDoc] = useState<string>("");
  const [filledDoc, setFilledDoc] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = allMessages.filter(m => m.tool === activeTool);

  const saveMessages = useCallback((msgs: BizMsg[]) => {
    setAllMessages(msgs);
    saveLocalMessages(msgs);
  }, []);

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

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 130) + "px";
  };

  const getBizMode = (): string => {
    switch (activeTool) {
      case "counterparty": return "counterparty";
      case "contract": return "contract";
      case "doc_analyze": return "doc_analyze";
      case "doc_compare": return "doc_analyze";
      case "orders": return "orders";
      case "pretension": return "pretension";
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
      case "pretension": return `Составь досудебную претензию (или ответ на претензию): ${text}`;
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

    businessMessageSave("user", userBody).catch(() => {});
    if (!user.isAdmin) businessConsumeAction().catch(() => {});

    try {
      const toolMessages = newAll.filter(m => m.tool === activeTool).slice(-10).map(m => ({
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
      if (activeTool === "orders" || activeTool === "contract" || activeTool === "pretension") {
        const placeholders = [...new Set([...aiBody.matchAll(/\{\{([^}]+)\}\}/g)].map((m: RegExpMatchArray) => m[1]))];
        if (placeholders.length > 0) {
          setFillDoc(aiBody);
          setFilledDoc(aiBody);
          setFillValues(Object.fromEntries(placeholders.map((p: string) => [p, ""])));
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
    return <BusinessPaywall onPayClick={onPayClick} />;
  }

  // ── Оплачено ──
  const currentTool = TOOLS.find(t => t.id === activeTool)!;
  const actionsLeft = user.isAdmin ? 999 : (user.businessActionsLeft ?? 0);
  const lastDownloadableAI = (activeTool === "contract" || activeTool === "orders" || activeTool === "pretension")
    ? [...messages].reverse().find(m => m.role === "ai")
    : null;

  const messageCounts = Object.fromEntries(
    TOOLS.map(t => [t.id, allMessages.filter(m => m.tool === t.id && m.role === "user").length])
  ) as Record<BizTool, number>;

  const handleSelectTool = (tool: BizTool) => {
    setActiveTool(tool);
    setErr("");
    setAttachedFile(null);
    setAttachedFile2(null);
    setFillMode(false);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-2 sm:gap-3" style={{ height: "clamp(540px, calc(100svh - 155px), 840px)" }}>

      {/* Хедер */}
      <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-navy-900 to-navy-700 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-white shrink-0">
        <div className="w-7 h-7 sm:w-9 sm:h-9 bg-white/10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Briefcase" size={14} className="text-gold-400" />
        </div>
        <div className="flex-1 min-w-0">
          {orgEditing ? (
            <div className="flex items-center gap-1.5">
              <input value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="Название организации"
                className="bg-white/10 text-white placeholder:text-white/30 text-xs sm:text-sm rounded-lg px-2 py-1 outline-none border border-white/20 focus:border-gold-400 flex-1 min-w-0"
                onKeyDown={e => e.key === "Enter" && saveOrgName()} />
              <button onClick={saveOrgName} disabled={orgSaving || !orgName.trim()}
                className="px-2 py-1 bg-gold-400 text-navy-900 rounded-lg text-[11px] font-semibold disabled:opacity-50 shrink-0">
                {orgSaving ? "…" : "OK"}
              </button>
            </div>
          ) : (
            <button onClick={() => setOrgEditing(true)} className="flex items-center gap-1.5 group w-full text-left">
              <p className="font-semibold text-white text-sm truncate">{orgName || "Организация"}</p>
              <Icon name="Pencil" size={11} className="text-white/30 group-hover:text-gold-400 shrink-0 transition-colors" />
            </button>
          )}
          <p className="text-[9px] text-white/30 hidden sm:block">История: 24 ч · данные на устройстве</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold shrink-0 ${actionsLeft>10?"bg-emerald-500/20 text-emerald-300":actionsLeft>0?"bg-amber-500/20 text-amber-300":"bg-red-500/20 text-red-300"}`}>
          <Icon name="Zap" size={10} />
          {user.isAdmin ? "∞" : actionsLeft}
          <span className="hidden sm:inline"> дейс.</span>
        </div>
        {!user.isAdmin && actionsLeft <= 30 && (
          <button onClick={() => onPayClick("business_actions_30", "30 действий")}
            className="px-2 py-1 bg-gold-400/25 hover:bg-gold-400/40 text-gold-300 rounded-lg text-[11px] font-semibold transition-colors shrink-0">
            +
          </button>
        )}
      </div>

      <div className="flex gap-2 sm:gap-3 flex-1 min-h-0">
        {/* Десктоп-сайдбар (внутри BusinessSidebar скрыт на мобиле) */}
        <BusinessSidebar
          activeTool={activeTool}
          isAdmin={user.isAdmin}
          messageCounts={messageCounts}
          onSelectTool={handleSelectTool}
          onPayClick={onPayClick}
        />

        {/* Основная область */}
        <div className="flex-1 flex flex-col min-w-0 gap-2">

          {/* Мобильный скролл (внутри BusinessSidebar скрыт на десктопе) */}
          <BusinessSidebar
            activeTool={activeTool}
            isAdmin={user.isAdmin}
            messageCounts={messageCounts}
            onSelectTool={handleSelectTool}
            onPayClick={onPayClick}
          />

          {/* Тул-хедер */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${TOOL_COLORS[currentTool.color]} shrink-0`}>
            <div className="flex items-center gap-2">
              <Icon name={currentTool.icon} size={14} />
              <span className="text-xs font-semibold">{currentTool.label}</span>
              {messages.length > 0 && <span className="text-[10px] opacity-60">· {messages.filter(m=>m.role==="user").length} запр.</span>}
            </div>
            <div className="flex items-center gap-2">
              {lastDownloadableAI && (
                <button onClick={() => downloadAsDoc(lastDownloadableAI.body, activeTool === "orders" ? "Приказ" : "Договор")}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white transition-colors">
                  <Icon name="Download" size={12}/>Скачать .doc
                </button>
              )}
              {messages.length > 0 && (
                <button onClick={clearToolHistory} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Icon name="Trash2" size={11}/>очистить
                </button>
              )}
            </div>
          </div>

          <BusinessMessages
            messages={messages}
            activeTool={activeTool}
            sending={sending}
            userName={user.name}
            onSetInput={setInput}
          />

          <BusinessInput
            activeTool={activeTool}
            input={input}
            sending={sending}
            err={err}
            attachedFile={attachedFile}
            attachedFile2={attachedFile2}
            fileUploading={fileUploading}
            fillMode={fillMode}
            fillValues={fillValues}
            filledDoc={filledDoc}
            onInputChange={setInput}
            onSend={sendMessage}
            onSetAttachedFile={setAttachedFile}
            onSetAttachedFile2={setAttachedFile2}
            onSetFileUploading={setFileUploading}
            onSetErr={setErr}
            onSetFillMode={setFillMode}
            onSetFillValues={setFillValues}
            onApplyFillValues={applyFillValues}
            adjustTextarea={adjustTextarea}
            textareaRef={textareaRef}
          />
        </div>
      </div>
    </div>
  );
}