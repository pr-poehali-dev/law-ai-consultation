import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { sendReport } from "@/lib/auth";
import { getActivePlan, PLANS } from "@/pages/cabinet/PlanModal";
import PlanBanner from "@/pages/cabinet/PlanBanner";
import PWAInstallButton from "@/components/PWAInstallButton";
import ChatMessageList from "@/pages/cabinet/ChatMessageList";
import ChatInputBar from "@/pages/cabinet/ChatInputBar";

export interface DocHint { doc_type: string; details: string; doc_label: string; extracted_text?: string; }
export interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; truncated?: boolean; isUpsell?: boolean; needsExpert?: boolean; personalDataRefused?: boolean; docHint?: DocHint; isLastQuestion?: boolean; fullAnswer?: string; isPenaltyCalc?: boolean; }

interface ChatTabProps {
  user: User;
  messages: ChatMsg[];
  input: string;
  typing: boolean;
  typingStatus?: string;
  chatErr: string;
  attachedFiles: { name: string; b64: string; size: string }[];
  fileUploading: boolean;
  totalLeft: number;
  canUploadFiles?: boolean;
  onUpgradeClick?: () => void;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: (comment: string) => void;
  onContinueChat: (partialText: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
  onRemoveFile: (idx: number) => void;
  onPayClick: () => void;
  onExpertClick: () => void;
  onGoToDocs: () => void;
  onSelectPlan: () => void;
  onCreateDocFromMsg?: (aiText: string, userText: string, docHint?: DocHint) => void;
  creatingDocFromChat?: boolean;
  onRevealAnswer?: (msgIndex: number) => void;
  onSendToLawyer?: (msgText: string, prevUserText?: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function ReportPopoverChat({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const result = await sendReport(text.trim());
    setSending(false);
    if (result.ok) { setSent(true); setTimeout(onClose, 1800); }
    else setErr(result.error || "Ошибка");
  };
  return (
    <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl border border-border shadow-2xl z-50 p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-navy-800">Сообщить о проблеме</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-navy-700"><Icon name="X" size={13} /></button>
      </div>
      {sent ? (
        <div className="flex items-center gap-2 text-emerald-600 py-2"><Icon name="CheckCircle" size={15} /><span className="text-sm font-medium">Отправлено!</span></div>
      ) : (
        <>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Опишите что случилось..." rows={3}
            className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 resize-none mb-2" autoFocus />
          {err && <p className="text-xs text-red-500 mb-1.5">{err}</p>}
          <button onClick={handleSend} disabled={sending || !text.trim()}
            className="w-full py-2 rounded-xl text-sm font-semibold btn-gold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {sending ? <><Icon name="Loader" size={13} className="animate-spin" />Отправка...</> : <><Icon name="Send" size={13} />Отправить</>}
          </button>
        </>
      )}
    </div>
  );
}

export default function ChatTab({
  user, messages, input, typing, typingStatus, chatErr,
  attachedFiles, fileUploading, totalLeft, canUploadFiles = false, onUpgradeClick,
  onInputChange, onSend, onSendFile, onContinueChat,
  onFileSelect, onAttachClick, onRemoveFile,
  onPayClick, onExpertClick, onGoToDocs, onSelectPlan, onCreateDocFromMsg, creatingDocFromChat, onRevealAnswer, onSendToLawyer, chatEndRef, fileInputRef,
}: ChatTabProps) {
  const activePlanId = getActivePlan(user);
  const activePlan = PLANS.find(p => p.id === activePlanId);
  const lastAiIdx = messages.reduce((acc, m, i) => m.role === "ai" ? i : acc, -1);
  const [showReport, setShowReport] = useState(false);

  return (
    <div className="max-w-3xl w-full mx-auto flex-1 min-h-0 flex flex-col">
      {showReport && <div className="fixed inset-0 z-40" onClick={() => setShowReport(false)} />}

      {/* Шапка */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
              <Icon name="Scale" size={14} className="text-gold-400" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${typing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-800">AI-юрист</p>
            <p className="text-[11px] text-muted-foreground">{typing ? (typingStatus || "анализирует...") : "Онлайн · РФ"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PWAInstallButton />
          {/* Кнопка «Сообщить о проблеме» */}
          <div className="relative">
            <button
              onClick={() => setShowReport(v => !v)}
              title="Сообщить о проблеме"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs transition-colors border ${
                showReport ? "bg-orange-50 border-orange-200 text-orange-600" : "bg-slate-50 border-border text-muted-foreground hover:bg-orange-50 hover:text-orange-500 hover:border-orange-200"
              }`}
            >
              <Icon name="LifeBuoy" size={13} />
              <span className="hidden sm:inline font-medium">Проблема?</span>
            </button>
            {showReport && <ReportPopoverChat onClose={() => setShowReport(false)} />}
          </div>
          {user.isAdmin ? (
            <span className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-medium">Админ</span>
          ) : activePlan ? (
            <button
              onClick={onSelectPlan}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors"
            >
              <Icon name="Zap" size={11} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">{activePlan.name}</span>
              <span className="text-[10px] text-emerald-500">·</span>
              <span className="text-xs font-medium text-emerald-700">{user.paidQuestions} вопр.</span>
            </button>
          ) : totalLeft === 0 ? (
            <button onClick={onPayClick} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm">
              <Icon name="Plus" size={11} />Купить доступ
            </button>
          ) : (
            <button
              onClick={onSelectPlan}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <Icon name="Zap" size={11} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-700">{user.paidQuestions > 0 ? `${user.paidQuestions} вопр. ·` : ""} Тарифы</span>
            </button>
          )}
        </div>
      </div>

      {/* Баннер тарифа */}
      <PlanBanner user={user} mode="chat" onSelectPlan={onSelectPlan} />

      {/* Хранение переписки */}
      <div className="flex items-center gap-2 px-1 mb-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Переписка хранится 24 часа и очищается автоматически
        </div>
      </div>

      {/* Лента сообщений */}
      <ChatMessageList
        user={user}
        messages={messages}
        typing={typing}
        typingStatus={typingStatus}
        chatErr={chatErr}
        lastAiIdx={lastAiIdx}
        chatEndRef={chatEndRef}
        onPayClick={onPayClick}
        onSelectPlan={onSelectPlan}
        onGoToDocs={onGoToDocs}
        onContinueChat={onContinueChat}
        onExpertClick={onExpertClick}
        onRevealAnswer={onRevealAnswer}
        onCreateDocFromMsg={onCreateDocFromMsg}
        creatingDocFromChat={creatingDocFromChat}
        onSendToLawyer={onSendToLawyer}
      />

      {/* Поле ввода + файл */}
      <ChatInputBar
        user={user}
        input={input}
        typing={typing}
        fileUploading={fileUploading}
        totalLeft={totalLeft}
        canUploadFiles={canUploadFiles}
        onUpgradeClick={onUpgradeClick}
        attachedFiles={attachedFiles}
        fileInputRef={fileInputRef}
        onInputChange={onInputChange}
        onSend={onSend}
        onSendFile={onSendFile}
        onAttachClick={onAttachClick}
        onRemoveFile={onRemoveFile}
        onFileSelect={onFileSelect}
      />

    </div>
  );
}