import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { sendReport, hasPurchasedPlan } from "@/lib/auth";
import OrganizerPanel from "@/pages/cabinet/OrganizerPanel";
import { getActivePlan, PLANS } from "@/pages/cabinet/PlanModal";
import PlanBanner from "@/pages/cabinet/PlanBanner";
import PWAInstallButton from "@/components/PWAInstallButton";
import ChatMessageList from "@/pages/cabinet/ChatMessageList";
import ChatInputBar from "@/pages/cabinet/ChatInputBar";
import PenaltyCalculatorPanel from "@/pages/cabinet/PenaltyCalculatorPanel";
import DutyCalculatorPanel from "@/pages/cabinet/DutyCalculatorPanel";
import CaseLawSearchPanel from "@/pages/cabinet/CaseLawSearchPanel";
import JurisdictionPanel from "@/pages/cabinet/JurisdictionPanel";
import type { DocFromChatDraft } from "@/pages/cabinet/useCabinetDocFromChat";

export interface DocHint { doc_type: string; details: string; doc_label: string; extracted_text?: string; }
export interface CaseLawResult { url: string; title: string; snippet: string; source: string; }
export interface ChatMsg { role: "ai" | "user"; text: string; isFile?: boolean; truncated?: boolean; isUpsell?: boolean; needsExpert?: boolean; personalDataRefused?: boolean; docHint?: DocHint; isLastQuestion?: boolean; fullAnswer?: string; isPenaltyCalc?: boolean; penaltyData?: import("@/pages/cabinet/PenaltyResultMessage").PenaltyData; isStreaming?: boolean; isError?: boolean; retryText?: string; isCaseLawSearch?: boolean; caseLawQuery?: string; caseLawResults?: CaseLawResult[]; caseLawLoading?: boolean; caseLawError?: string; caseLawSourceText?: string; caseLawAssessed?: boolean; isCaseLawAssessment?: boolean; caseLawAssessmentLoading?: boolean; caseLawAssessmentError?: string; }

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
  onSend: (text?: string) => void;
  onSendFile: (comment: string) => void;
  onContinueChat: (partialText: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop?: (files: FileList) => void;
  onAttachClick: () => void;
  onRemoveFile: (idx: number) => void;
  onPayClick: () => void;
  onTrialClick: () => void;
  onExpertClick: () => void;
  onGoToDocs: () => void;
  onSelectPlan: () => void;
  onCreateDocFromMsg?: (aiText: string, userText: string, docHint?: DocHint) => void;
  creatingDocFromChat?: boolean;
  onRevealAnswer?: (msgIndex: number) => void;
  onSendToLawyer?: (msgText: string, prevUserText?: string) => void;
  onAddFiles?: (files: { name: string; b64: string; size: string }[]) => void;
  onSearchCaseLaw?: (aiText: string, msgIdx: number) => void;
  onAssessCaseLaw?: (caseLawMsgIdx: number) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  /** Всплывающая карточка подтверждения документа над кнопкой «Создать документ» */
  docDraft?: DocFromChatDraft | null;
  docGenerating?: boolean;
  onConfirmDocDraft?: (label: string, addition: string) => void;
  onCloseDocDraft?: () => void;
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
  onFileSelect, onFileDrop, onAttachClick, onRemoveFile,
  onPayClick, onTrialClick, onExpertClick, onGoToDocs, onSelectPlan, onCreateDocFromMsg, creatingDocFromChat, onRevealAnswer, onSendToLawyer, onAddFiles, onSearchCaseLaw, onAssessCaseLaw, chatEndRef, fileInputRef,
  docDraft, docGenerating, onConfirmDocDraft, onCloseDocDraft,
}: ChatTabProps) {
  const activePlanId = getActivePlan(user);
  const activePlan = PLANS.find(p => p.id === activePlanId);
  const lastAiIdx = messages.reduce((acc, m, i) => m.role === "ai" ? i : acc, -1);
  const [showReport, setShowReport] = useState(false);
  const [activeTool, setActiveTool] = useState<"penalty" | "duty" | "case_law" | "jurisdiction" | null>(null);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [showMobileOrganizer, setShowMobileOrganizer] = useState(false);

  // Открытие инструмента «по требованию» — например, из документа (кнопка «Проверьте судебную практику»)
  useEffect(() => {
    const pending = localStorage.getItem("pending_chat_tool");
    if (pending === "case_law" || pending === "duty") {
      localStorage.removeItem("pending_chat_tool");
      if (!user.isAdmin && !hasPurchasedPlan(user)) { setShowPremiumPopup(true); return; }
      setActiveTool(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickAction = (text: string) => {
    // Все инструменты требуют тариф «Старт» и выше
    const premiumTools = ["__penalty__", "__duty__", "__case_law__", "__jurisdiction__"];
    if (premiumTools.includes(text) && !user.isAdmin && !hasPurchasedPlan(user)) {
      setShowPremiumPopup(true);
      return;
    }
    if (text === "__penalty__")      { setActiveTool("penalty");      return; }
    if (text === "__duty__")         { setActiveTool("duty");         return; }
    if (text === "__case_law__")     { setActiveTool("case_law");     return; }
    if (text === "__jurisdiction__") { setActiveTool("jurisdiction"); return; }
    onSend(text);
  };

  // Поиск судебной практики и оценка перспективы дела из чата — тоже премиум-функции
  const handleSearchCaseLaw = (aiText: string, msgIdx: number) => {
    if (!user.isAdmin && !hasPurchasedPlan(user)) { setShowPremiumPopup(true); return; }
    onSearchCaseLaw?.(aiText, msgIdx);
  };
  const handleAssessCaseLaw = (caseLawMsgIdx: number) => {
    if (!user.isAdmin && !hasPurchasedPlan(user)) { setShowPremiumPopup(true); return; }
    onAssessCaseLaw?.(caseLawMsgIdx);
  };

  return (
    <div className="max-w-5xl w-full mx-auto flex-1 min-h-0 flex gap-3">
      {showReport && <div className="fixed inset-0 z-40" onClick={() => setShowReport(false)} />}

      {/* Попап: требуется тариф Старт */}
      {showPremiumPopup && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowPremiumPopup(false)} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(420px,calc(100vw-32px))]">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}>
              {/* Шапка с градиентом */}
              <div className="px-6 pt-6 pb-4 text-center"
                style={{ background: "linear-gradient(135deg,#0f4c81 0%,#1a6bb5 50%,#2563eb 100%)" }}>
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
                  <Icon name="Sparkles" size={26} color="#fff" />
                </div>
                <p className="text-white font-bold text-lg leading-tight">Доступно после подключения тарифа</p>
                <p className="text-white/75 text-sm mt-1">Судебная практика и подсудность — премиум-инструменты</p>
              </div>
              {/* Список фич */}
              <div className="px-6 py-4 space-y-2.5">
                {[
                  { icon: "BookOpen",  text: "Поиск судебной практики по базе и интернету" },
                  { icon: "MapPin",    text: "Определение территориальной подсудности" },
                  { icon: "Zap",       text: "Списание 1 вопроса за каждый поиск" },
                  { icon: "Scale",     text: "Доступ к обзорам ВС РФ и кодексам" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(15,76,129,0.08)" }}>
                      <Icon name={f.icon as Parameters<typeof Icon>[0]["name"]} size={13} color="#0f4c81" />
                    </div>
                    <p className="text-[13px] text-slate-700">{f.text}</p>
                  </div>
                ))}
              </div>
              {/* Кнопки */}
              <div className="px-6 pb-6 space-y-2">
                <button
                  onClick={() => { setShowPremiumPopup(false); onSelectPlan(); }}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                  Выбрать тариф
                </button>
                <button
                  onClick={() => setShowPremiumPopup(false)}
                  className="w-full py-2.5 rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-all">
                  Позже
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Основная колонка чата */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0 w-full">

      {/* Шапка — скрыта на мобиле, видна только на десктопе */}
      <div className="hidden lg:flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/8f28f89e-42b3-4a6e-acfb-54b3ac0d4c86.jpg"
              alt="AI-юрист"
              className="w-9 h-9 rounded-2xl shadow-md object-cover"
            />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${typing ? "bg-amber-400" : "bg-emerald-400"}`}
              style={typing ? { animation: "pulse 1s infinite" } : {}} />
          </div>
          <div>
            <p className="text-sm font-bold text-navy-800 leading-tight">AI-юрист</p>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              {typing ? (typingStatus || "анализирует...") : "Онлайн · Законы РФ"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <PWAInstallButton />

          {!user.isAdmin && (
            activePlan && user.paidRequests > 0 ? (
              <button onClick={onSelectPlan}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-slate-50"
                style={{ background: "rgba(16,185,129,0.07)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
                <Icon name="MessageCircle" size={11} color="#059669" />
                {user.paidRequests} запр.
              </button>
            ) : activePlan ? (
              <button onClick={onSelectPlan}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all animate-pulse"
                style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Icon name="AlertCircle" size={11} color="#dc2626" />Продлить тариф
              </button>
            ) : totalLeft === 0 ? (
              <button onClick={onPayClick}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}>
                <Icon name="Plus" size={11} color="#0a1628" />Купить доступ
              </button>
            ) : (
              <button onClick={onSelectPlan}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-slate-50"
                style={{ background: "rgba(245,158,11,0.08)", color: "#92400e", border: "1px solid rgba(245,158,11,0.2)" }}>
                <Icon name="Zap" size={11} color="#d97706" />Тарифы
              </button>
            )
          )}
          {user.isAdmin && (
            <span className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold">Админ</span>
          )}

          <div className="relative">
            <button
              onClick={() => setShowReport(v => !v)}
              title="Сообщить о проблеме"
              className={`px-2 py-1 rounded-xl flex items-center justify-center transition-all text-[11px] font-bold tracking-wide ${showReport ? "bg-orange-100 text-orange-600 border border-orange-300" : "bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-500 border border-transparent"}`}
            >
              SOS
            </button>
            {showReport && <ReportPopoverChat onClose={() => setShowReport(false)} />}
          </div>
        </div>
      </div>

      {/* Баннер тарифа */}
      <PlanBanner user={user} mode="chat" onSelectPlan={onSelectPlan} />

      {/* Мобиле: компактная строка под тарифом — Дела + PWA */}
      <div className="lg:hidden flex items-center justify-between px-1">
        {hasPurchasedPlan(user) ? (
          <div className="flex flex-col w-full gap-0">
            {/* Кнопка-триггер Дела */}
            <button
              onClick={() => setShowMobileOrganizer(v => !v)}
              className="flex items-center gap-2 py-1.5 px-2 rounded-xl transition-all active:scale-[0.97] self-start"
              style={{ color: "#0f4c81" }}
            >
              <Icon name="Scale" size={14} color="#0f4c81" />
              <span className="text-[12px] font-semibold text-navy-700">Дела</span>
              <Icon name={showMobileOrganizer ? "ChevronUp" : "ChevronDown"} size={12} color="#64748b" />
            </button>
            {/* Inline-раскрытие органайзера */}
            {showMobileOrganizer && (
              <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm mt-1"
                style={{ maxHeight: "320px", overflowY: "auto" }}>
                <OrganizerPanel user={user} mobileMode />
              </div>
            )}
          </div>
        ) : (
          <div />
        )}
        <PWAInstallButton />
      </div>

      {/* Дисклеймер */}
      <div className="flex items-center gap-1.5 px-1">
        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
        <p className="text-[11px] text-slate-400">Переписка хранится 24 часа и очищается автоматически</p>
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
        onTrialClick={onTrialClick}
        onSelectPlan={onSelectPlan}
        onGoToDocs={onGoToDocs}
        onContinueChat={onContinueChat}
        onExpertClick={onExpertClick}
        onRevealAnswer={onRevealAnswer}
        onCreateDocFromMsg={onCreateDocFromMsg}
        creatingDocFromChat={creatingDocFromChat}
        onSendToLawyer={onSendToLawyer}
        onSendMessage={onSend}
        onSearchCaseLaw={handleSearchCaseLaw}
        onAssessCaseLaw={handleAssessCaseLaw}
        docDraft={docDraft}
        docGenerating={docGenerating}
        onConfirmDocDraft={onConfirmDocDraft}
        onCloseDocDraft={onCloseDocDraft}
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
        onFileDrop={onFileDrop}
        onQuickAction={handleQuickAction}
        onSosClick={() => setShowReport(v => !v)}
        onFilesFromConverter={onAddFiles}
      />
      {/* SOS попап — мобиле (рендерится под ChatInputBar) */}
      {showReport && (
        <div className="lg:hidden relative">
          <ReportPopoverChat onClose={() => setShowReport(false)} />
        </div>
      )}

      </div>{/* конец основной колонки */}

      {/* Органайзер — боковая панель (только десктоп) */}
      <OrganizerPanel user={user} />

      {/* Всплывающее облачко калькулятора */}
      {(activeTool === "penalty" || activeTool === "duty" || activeTool === "case_law" || activeTool === "jurisdiction") && (
        <>
          {/* Backdrop — закрывает по клику вне */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setActiveTool(null)}
          />
          {/* Само облачко — снизу по центру, над полем ввода */}
          <div
            className="fixed z-50 left-1/2 -translate-x-1/2"
            style={{
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
              width: "min(480px, calc(100vw - 24px))",
            }}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              style={{
                maxHeight: "75dvh",
                border: "1px solid rgba(226,232,240,0.9)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              {activeTool === "penalty" && (
                <PenaltyCalculatorPanel
                  onClose={() => setActiveTool(null)}
                  onSendToChat={(text) => { setActiveTool(null); onSend(text); }}
                />
              )}
              {activeTool === "duty" && (
                <DutyCalculatorPanel
                  onClose={() => setActiveTool(null)}
                  onSendToChat={(text) => { setActiveTool(null); onSend(text); }}
                />
              )}
              {activeTool === "case_law" && (
                <CaseLawSearchPanel
                  onClose={() => setActiveTool(null)}
                  onSendToChat={(text) => { setActiveTool(null); onSend(text); }}
                />
              )}
              {activeTool === "jurisdiction" && (
                <JurisdictionPanel
                  onClose={() => setActiveTool(null)}
                  onSendToChat={(text) => { setActiveTool(null); onSend(text); }}
                />
              )}
            </div>
            {/* Хвостик облачка */}
            <div className="flex justify-center mt-1">
              <div className="w-0 h-0"
                style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid white", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.06))" }} />
            </div>
          </div>
        </>
      )}



    </div>
  );
}