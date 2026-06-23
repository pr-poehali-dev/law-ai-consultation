import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";

interface ViewDocFooterProps {
  docName: string;
  currentDocContent: string;
  sentToLawyer: boolean;
  sendingToLawyer: boolean;
  showLawyerSuccess: boolean;
  onCloseLawyerSuccess: () => void;
  recsAnalyzing: boolean;
  hasRecs: boolean;
  liveRecs: DocRecommendationItem[];
  showRecs: boolean;
  reportOpen: boolean;
  reportText: string;
  reportLoading: boolean;
  reportSent: boolean;
  showEditor: boolean;
  onSendToLawyer: (comment: string) => void;
  onAiEditorClick: () => void;
  onAiFillChatClick: () => void;
  onToggleRecs: () => void;
  onClose: () => void;
  onOpenReport: () => void;
  onCloseReport: () => void;
  onReportTextChange: (v: string) => void;
  onSendReport: () => void;
}

export default function ViewDocFooter({
  docName,
  currentDocContent,
  sentToLawyer,
  sendingToLawyer,
  showLawyerSuccess,
  onCloseLawyerSuccess,
  recsAnalyzing,
  hasRecs,
  liveRecs,
  showRecs,
  reportOpen,
  reportText,
  reportLoading,
  reportSent,
  showEditor,
  onSendToLawyer,
  onAiEditorClick,
  onAiFillChatClick,
  onToggleRecs,
  onClose,
  onOpenReport,
  onCloseReport,
  onReportTextChange,
  onSendReport,
}: ViewDocFooterProps) {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [lawyerComment, setLawyerComment] = useState("");

  const handleOpenComment = () => { setLawyerComment(""); setShowCommentModal(true); };
  const handleSubmitComment = () => { setShowCommentModal(false); onSendToLawyer(lawyerComment); };

  return (
    <>
      {/* Нижняя панель */}
      <div className="border-t border-slate-100 px-4 sm:px-5 py-3 shrink-0 bg-slate-50/80 rounded-b-3xl space-y-2">
        {sentToLawyer ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200">
            <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
            <p className="text-xs font-medium text-emerald-700">Отправлен юристу</p>
          </div>
        ) : (
          <button onClick={handleOpenComment} disabled={sendingToLawyer}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)", border: "1px solid rgba(232,168,32,0.3)", color: "#f0c060" }}>
            {sendingToLawyer
              ? <><span className="w-3.5 h-3.5 border-2 border-gold-400/40 border-t-gold-400 rounded-full animate-spin" />Отправляю...</>
              : <><Icon name="UserCheck" size={13} color="#f0c060" />Отправить на проверку юристу</>}
          </button>
        )}



        {/* Кнопка редактора + AI */}
        <button
          onClick={onAiEditorClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 shadow-sm"
          style={{ background: showEditor ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white" }}
        >
          <Icon name={showEditor ? "X" : "PenLine"} size={13} />
          {showEditor ? "Закрыть редактор" : "Редактировать онлайн + AI"}
          {!showEditor && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold">Профи+</span>}
        </button>
        <p className="text-[10px] text-slate-400 text-center leading-snug">
          Редактор документа с AI-консультантом по заполнению
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button onClick={onOpenReport} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <Icon name="AlertTriangle" size={10} />Проблема
          </button>
          <div className="flex gap-2 items-center">
            {recsAnalyzing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] text-slate-400 bg-slate-100">
                <Icon name="Loader" size={10} className="animate-spin" />Анализ...
              </div>
            )}
            {hasRecs && !recsAnalyzing && (
              <button onClick={onToggleRecs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors">
                <Icon name="Sparkles" size={11} />Рекомендации ({liveRecs.length})
              </button>
            )}
            <button onClick={onClose} className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-navy-200 hover:bg-white transition-colors font-medium">
              Закрыть
            </button>
            <button onClick={() => downloadDoc(docName, currentDocContent)} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold">
              <Icon name="Download" size={12} />Скачать
            </button>
          </div>
        </div>
      </div>

      {/* Модалка: Комментарий для юриста */}
      {showCommentModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCommentModal(false)}>
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: "linear-gradient(160deg,#0a1628 0%,#162d5a 60%,#0d2040 100%)" }} onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(232,168,32,0.12) 0%, transparent 70%)", transform: "translate(20%,-20%)" }} />
            <div className="relative px-6 pt-7 pb-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.25)" }}>
                    <Icon name="MessageSquare" size={18} color="#f0c060" />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#f0c060" }}>Юрист-эксперт</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Проверка документа</p>
                  </div>
                </div>
                <button onClick={() => setShowCommentModal(false)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-white/10">
                  <Icon name="X" size={15} color="rgba(255,255,255,0.4)" />
                </button>
              </div>
              <p className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                Укажите комментарии для юриста-эксперта по ситуации:
              </p>
              <textarea
                value={lawyerComment}
                onChange={e => setLawyerComment(e.target.value)}
                placeholder="Например: хочу понять, насколько документ защищает мои интересы..."
                rows={5} autoFocus
                className="w-full text-sm outline-none resize-none rounded-2xl px-4 py-3 transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", caretColor: "#f0c060" }}
                onFocus={e => { e.target.style.borderColor = "rgba(232,168,32,0.4)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
              <p className="text-[10px] mt-1.5 mb-5" style={{ color: "rgba(255,255,255,0.3)" }}>Комментарий необязателен — можно оставить пустым</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowCommentModal(false)} className="flex-1 py-2.5 rounded-2xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>Отмена</button>
                <button onClick={handleSubmitComment} className="flex-[2] py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}>
                  <Icon name="Send" size={14} color="#0a1628" />Отправить юристу
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Документ успешно отправлен юристу */}
      {showLawyerSuccess && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={onCloseLawyerSuccess}>
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: "linear-gradient(160deg,#0a1628 0%,#162d5a 60%,#0d2040 100%)" }} onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #e8a820 0%, transparent 70%)", transform: "translate(30%,-30%)" }} />
            <div className="relative px-6 pt-8 pb-6">
              <div className="flex justify-center mb-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.3)" }}>
                    <Icon name="Send" size={36} color="#f0c060" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    <Icon name="Check" size={14} color="white" />
                  </div>
                </div>
              </div>
              <h3 className="text-center font-bold text-xl mb-1.5" style={{ color: "#f0c060" }}>Документ отправлен!</h3>
              <p className="text-center text-sm mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>Юрист получил ваш документ на проверку</p>
              <div className="rounded-2xl mb-5 p-4 space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {[
                  { icon: "Clock", title: "Среднее время ответа", sub: "от 1 до 6 часов", color: "#f0c060", bg: "rgba(232,168,32,0.15)" },
                  { icon: "AlertCircle", title: "При высокой загруженности", sub: "задержка до 12 часов", color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" },
                  { icon: "MessageSquare", title: "Результат проверки", sub: "юрист ответит в чате по документу", color: "#f0c060", bg: "rgba(232,168,32,0.12)" },
                ].map((item, i, arr) => (
                  <div key={item.icon}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.bg }}>
                        <Icon name={item.icon as "Clock"} size={15} color={item.color} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{item.title}</p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>{item.sub}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && <div className="h-px mt-3" style={{ background: "rgba(255,255,255,0.06)" }} />}
                  </div>
                ))}
              </div>
              <button onClick={onCloseLawyerSuccess} className="w-full py-3 rounded-2xl font-bold text-sm active:scale-[0.98]" style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Сообщить о проблеме */}
      {reportOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onCloseReport}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-navy-800 text-lg mb-2">Сообщение получено</h3>
                <p className="text-sm text-muted-foreground mb-6">Мы разберёмся и ответим в течение 24 часов.</p>
                <button onClick={onCloseReport} className="btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">Закрыть</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                      <Icon name="AlertTriangle" size={17} className="text-red-500" />
                    </div>
                    <h3 className="font-semibold text-navy-800">Сообщить о проблеме</h3>
                  </div>
                  <button onClick={onCloseReport} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </button>
                </div>
                <textarea value={reportText} onChange={e => onReportTextChange(e.target.value)} placeholder="Опишите что не так с документом..." rows={4} className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4" />
                <div className="flex gap-2">
                  <button onClick={onCloseReport} className="flex-1 py-2.5 rounded-xl text-sm text-navy-600 border border-border hover:bg-slate-50 transition-colors">Отмена</button>
                  <button onClick={onSendReport} disabled={!reportText.trim() || reportLoading} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-navy-800 text-white hover:bg-navy-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {reportLoading ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
                    {reportLoading ? "Отправка..." : "Отправить"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}