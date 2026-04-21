import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { getActivePlan, PLANS } from "@/pages/cabinet/PlanModal";
import PlanBanner from "@/pages/cabinet/PlanBanner";
import PWAInstallButton from "@/components/PWAInstallButton";
import ChatMessageList from "@/pages/cabinet/ChatMessageList";
import ChatInputBar from "@/pages/cabinet/ChatInputBar";

export interface DocHint { doc_type: string; details: string; doc_label: string; extracted_text?: string; }
export interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; truncated?: boolean; isUpsell?: boolean; needsExpert?: boolean; personalDataRefused?: boolean; docHint?: DocHint; isLastQuestion?: boolean; fullAnswer?: string; }

interface ChatTabProps {
  user: User;
  messages: ChatMsg[];
  input: string;
  typing: boolean;
  typingStatus?: string;
  chatErr: string;
  attachedFile: { name: string; b64: string; size: string } | null;
  fileUploading: boolean;
  totalLeft: number;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: (comment: string) => void;
  onContinueChat: (partialText: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
  onClearFile: () => void;
  onPayClick: () => void;
  onExpertClick: () => void;
  onGoToDocs: () => void;
  onSelectPlan: () => void;
  onCreateDocFromMsg?: (aiText: string, userText: string, docHint?: DocHint) => void;
  creatingDocFromChat?: boolean;
  onRevealAnswer?: (msgIndex: number) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export default function ChatTab({
  user, messages, input, typing, typingStatus, chatErr,
  attachedFile, fileUploading, totalLeft,
  onInputChange, onSend, onSendFile, onContinueChat,
  onFileSelect, onAttachClick, onClearFile,
  onPayClick, onExpertClick, onGoToDocs, onSelectPlan, onCreateDocFromMsg, creatingDocFromChat, onRevealAnswer, chatEndRef, fileInputRef,
}: ChatTabProps) {
  const activePlanId = getActivePlan(user);
  const activePlan = PLANS.find(p => p.id === activePlanId);
  const lastAiIdx = messages.reduce((acc, m, i) => m.role === "ai" ? i : acc, -1);

  return (
    <div className="max-w-3xl w-full mx-auto flex-1 min-h-0 flex flex-col">

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
              <Icon name="Plus" size={11} />350 ₽ · 3 вопр.
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
      />

      {/* Поле ввода + файл */}
      <ChatInputBar
        user={user}
        input={input}
        typing={typing}
        fileUploading={fileUploading}
        totalLeft={totalLeft}
        attachedFile={attachedFile}
        fileInputRef={fileInputRef}
        onInputChange={onInputChange}
        onSend={onSend}
        onSendFile={onSendFile}
        onAttachClick={onAttachClick}
        onClearFile={onClearFile}
        onFileSelect={onFileSelect}
      />

    </div>
  );
}