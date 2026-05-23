import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@/lib/auth";
import { lawyerSend, lawyerMessages, lawyerUploadFile } from "@/lib/auth";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import ExpertPaywall from "./ExpertPaywall";
import ExpertDialogList from "./ExpertDialogList";
import ExpertChat from "./ExpertChat";
import type { Attachment, FileAttachment, ContentAttachment } from "./ExpertAttachPanel";
import { useAttachment } from "./ExpertAttachPanel";
import Icon from "@/components/ui/icon";

interface ExpertTabProps {
  user: User;
  messages: ChatMsg[];
  genDocs: GenDoc[];
  onPayClick?: () => void;
  onBuyLawyerQuestions?: () => void;
}

export default function ExpertTab({ user, messages, genDocs, onPayClick, onBuyLawyerQuestions }: ExpertTabProps) {
  const [lmsgs, setLmsgs] = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  // Актуальный остаток вопросов — обновляется после каждой отправки
  const [lawyerQLeft, setLawyerQLeft] = useState<number>(user.lawyerQuestionsLeft ?? 0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    attachments, addAttachment, addFiles, removeAttachment, clearAttachments,
    showAttachPanel, setShowAttachPanel,
    viewFullMsg, setViewFullMsg,
  } = useAttachment();

  const isPaid = user.isAdmin || user.paidExpert;
  // Чат заблокирован когда вопросы исчерпаны (только для не-админов)
  const isBlocked = !user.isAdmin && isPaid && lawyerQLeft <= 0;

  const loadMessages = useCallback(async () => {
    if (!isPaid) return;
    if (user.isAdmin && !selectedUserId) {
      const res = await lawyerMessages();
      if (res.dialogs) setDialogs(res.dialogs);
      setLoading(false);
      return;
    }
    const params = user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {};
    const res = await lawyerMessages(params);
    if (res.messages) setLmsgs(res.messages);
    setLoading(false);
  }, [isPaid, user.isAdmin, selectedUserId]);

  useEffect(() => {
    if (!isPaid) { setLoading(false); return; }
    loadMessages();
    pollRef.current = setInterval(loadMessages, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages, isPaid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lmsgs]);

  // Синхронизируем lawyerQLeft с пропсом при обновлении user
  useEffect(() => {
    setLawyerQLeft(user.lawyerQuestionsLeft ?? 0);
  }, [user.lawyerQuestionsLeft]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  };

  const send = async () => {
    if (isBlocked) return;
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setSending(true);
    setErr("");
    setUploadProgress(0);

    const fileAtts = attachments.filter(a => a.type === "file") as FileAttachment[];
    const contentAtts = attachments.filter(a => a.type !== "file") as ContentAttachment[];
    const uploadedUrls: { name: string; url: string }[] = [];

    if (fileAtts.length > 0) {
      for (let i = 0; i < fileAtts.length; i++) {
        const f = fileAtts[i];
        setUploadProgress(Math.round(((i) / fileAtts.length) * 80));
        const res = await lawyerUploadFile(f.b64, f.name);
        if (res.error) {
          setErr(`Ошибка загрузки ${f.name}: ${res.error}`);
          setSending(false);
          setUploadProgress(0);
          return;
        }
        if (res.url) uploadedUrls.push({ name: f.name, url: res.url });
      }
      setUploadProgress(90);
    }

    const bodyParts: string[] = [];
    if (text) bodyParts.push(text);
    if (uploadedUrls.length > 0) {
      const fileLinks = uploadedUrls.map(f => `📎 ${f.name}: ${f.url}`).join("\n");
      bodyParts.push(`[Прикреплённые файлы]\n${fileLinks}`);
    }
    const bodyText = bodyParts.join("\n").trim() || (contentAtts[0] ? `Прикрепляю: ${contentAtts[0].name}` : "");

    const firstContent = contentAtts[0] || null;
    const params: Parameters<typeof lawyerSend>[0] = {
      body: bodyText,
      ...(user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {}),
      ...(firstContent ? {
        attachment_type: firstContent.type,
        attachment_name: firstContent.name,
        attachment_content: firstContent.content || firstContent.name,
      } : {}),
    };

    if (contentAtts.length > 1) {
      const extra = contentAtts.slice(1).map(a => `📄 ${a.name}`).join("\n");
      params.body = params.body + `\n\nТакже прикреплено:\n${extra}`;
    }

    const res = await lawyerSend(params);
    setUploadProgress(100);
    if (res.error) { setErr(res.error); setSending(false); setUploadProgress(0); return; }

    // Обновляем остаток вопросов из ответа бэкенда
    if (!user.isAdmin && res.lawyer_questions_left !== undefined) {
      setLawyerQLeft(res.lawyer_questions_left);
    } else if (!user.isAdmin) {
      setLawyerQLeft(prev => Math.max(0, prev - 1));
    }

    setInput("");
    clearAttachments();
    setShowAttachPanel(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    await loadMessages();
    setSending(false);
    setUploadProgress(0);
  };

  if (!isPaid && !user.isAdmin) {
    return <ExpertPaywall onPayClick={onPayClick} />;
  }

  if (user.isAdmin && !selectedUserId) {
    return (
      <ExpertDialogList
        dialogs={dialogs}
        loading={loading}
        onSelect={(userId) => { setSelectedUserId(userId); setLmsgs([]); setLoading(true); }}
        onRefresh={loadMessages}
      />
    );
  }

  const currentDialog = user.isAdmin ? dialogs.find((d) => d.user_id === selectedUserId) : null;
  const aiAnswers = messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-5);

  // Определяем какой тариф активен для воронки
  const currentPlanId = (user.paidQuestions ?? 0) >= 300 ? "plan_max"
    : (user.paidQuestions ?? 0) >= 100 ? "plan_pro"
    : "plan_starter";

  return (
    <div className="flex flex-col h-full">
      {/* Счётчик вопросов юристу (только для пользователя) */}
      {!user.isAdmin && (
        <div className={`flex items-center justify-between px-4 py-2 mx-0 sm:mx-0 border-b text-xs shrink-0 ${
          lawyerQLeft <= 1 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"
        }`}>
          <div className="flex items-center gap-2">
            <Icon name="User" size={12} className={lawyerQLeft <= 1 ? "text-amber-500" : "text-navy-500"} />
            <span className={lawyerQLeft <= 1 ? "text-amber-700 font-semibold" : "text-slate-600"}>
              {lawyerQLeft > 0
                ? `Вопросов юристу: ${lawyerQLeft}`
                : "Вопросы к юристу исчерпаны"}
            </span>
          </div>
          {lawyerQLeft <= 2 && (
            <button
              onClick={onBuyLawyerQuestions}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all"
            >
              +5 вопросов · 990 ₽
            </button>
          )}
        </div>
      )}

      {/* Воронка при исчерпании вопросов */}
      {isBlocked && (
        <div className="mx-4 mt-3 mb-1 rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 to-white shrink-0">
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Icon name="Lock" size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-800">Вопросы к юристу исчерпаны</p>
                <p className="text-xs text-slate-500 mt-0.5">Вы можете читать ответы юриста, но не писать новые сообщения.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Докупить вопросы */}
              <button
                onClick={onBuyLawyerQuestions}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
                  <Icon name="MessageCircle" size={14} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-800">+5 вопросов юристу</p>
                  <p className="text-[10px] text-amber-600 font-semibold">990 ₽</p>
                </div>
              </button>

              {/* Повышение тарифа */}
              {currentPlanId !== "plan_max" && (
                <button
                  onClick={onPayClick}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-navy-200 bg-navy-50 hover:bg-navy-100 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-navy-200 flex items-center justify-center shrink-0">
                    <Icon name="TrendingUp" size={14} className="text-navy-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-800">
                      {currentPlanId === "plan_starter" ? "Перейти на «Профи»" : "Перейти на «Максимум»"}
                    </p>
                    <p className="text-[10px] text-navy-500">
                      {currentPlanId === "plan_starter" ? "+5 вопросов юристу" : "+30 вопросов юристу"}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ExpertChat
        isAdmin={user.isAdmin}
        selectedUserId={selectedUserId}
        currentDialog={currentDialog}
        lmsgs={lmsgs}
        loading={loading}
        input={input}
        sending={sending}
        uploadProgress={uploadProgress}
        err={err}
        attachments={attachments}
        showAttachPanel={showAttachPanel}
        viewFullMsg={viewFullMsg}
        aiAnswers={aiAnswers}
        genDocs={genDocs}
        isBlocked={isBlocked}
        onBack={() => { setSelectedUserId(null); setLmsgs([]); }}
        onRefresh={loadMessages}
        onInputChange={setInput}
        onSend={send}
        onToggleAttachPanel={() => setShowAttachPanel(p => !p)}
        onHideAttachPanel={() => setShowAttachPanel(false)}
        onAddAttachment={addAttachment}
        onAddFiles={addFiles}
        onRemoveAttachment={removeAttachment}
        onViewFullMsg={setViewFullMsg}
        onCloseFullMsg={() => setViewFullMsg(null)}
        textareaRef={textareaRef}
        bottomRef={bottomRef}
        adjustTextarea={adjustTextarea}
      />
    </div>
  );
}
