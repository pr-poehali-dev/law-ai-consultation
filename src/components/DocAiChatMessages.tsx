import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { downloadDoc } from "@/lib/docUtils";
import { type AiMsg, renderAnalysisText } from "./DocAiChatTypes";

interface DocAiChatMessagesProps {
  messages: AiMsg[];
  analyzing: boolean;
  editLoading: boolean;
  editStageInfo: { current: number; total: number } | null;
  pendingPartial: { note: string; instruction: string } | null;
  pendingConfirm: boolean;
  pendingMultiStage: { stages: number; totalQ: number; instruction: string } | null;
  docName: string;
  currentContent: string;
  onContinuePartial: () => void;
  onDeclinePartial: () => void;
  onConfirmEdit: () => void;
  onCancelConfirm: () => void;
  onConfirmMultiStage: () => void;
  onCancelMultiStage: () => void;
  onScrollToChanges?: () => void;
  onShowChangesInDoc?: () => void;
}

export default function DocAiChatMessages({
  messages,
  analyzing,
  editLoading,
  editStageInfo,
  pendingPartial,
  pendingConfirm,
  pendingMultiStage,
  docName,
  currentContent,
  onContinuePartial,
  onDeclinePartial,
  onConfirmEdit,
  onCancelConfirm,
  onConfirmMultiStage,
  onCancelMultiStage,
  onScrollToChanges,
  onShowChangesInDoc,
}: DocAiChatMessagesProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, analyzing, editLoading, pendingMultiStage]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0 bg-white">
      {messages.map((msg, i) => {
        // Статус-сообщения этапов — компактный стиль
        if (msg.isStageStatus) {
          return (
            <div key={i} className="flex gap-2 items-center justify-center py-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                {[0, 1, 2].map(j => (
                  <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
                ))}
                <span className="text-[11px] text-slate-600 font-medium">{msg.text}</span>
              </div>
            </div>
          );
        }

        return (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${msg.isEdited ? "bg-emerald-600" : "bg-navy-800"}`}>
                <Icon name={msg.isEdited ? "CheckCircle" : "Scale"} size={12} className="text-white" />
              </div>
            )}

            <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 shadow-sm text-[12px] leading-relaxed border ${
              msg.role === "ai"
                ? msg.isEdited
                  ? "rounded-tl-sm bg-emerald-50 border-emerald-200"
                  : "rounded-tl-sm bg-slate-50 border-slate-200"
                : "rounded-tr-sm bg-navy-800 border-navy-700"
            }`}>

              {/* Шапка правки */}
              {msg.isEdited && (
                <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-emerald-200">
                  <Icon name="Pencil" size={10} className="text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                    Правка #{msg.editNum}{msg.stages && msg.stages > 1 ? ` · ${msg.stages} этапа` : ""}
                  </span>
                </div>
              )}

              {/* Текст */}
              {msg.role === "ai" && !msg.isEdited
                ? renderAnalysisText(msg.text)
                : <p className={`whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-slate-700"}`}>{msg.text}</p>
              }

              {/* Что было изменено */}
              {msg.isEdited && msg.changesSummary && (
                <div className="mt-2 p-2.5 rounded-xl bg-white border border-emerald-200">
                  <p className="text-[10px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <Icon name="List" size={9} className="text-emerald-600" />
                    Что изменено:
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{msg.changesSummary}</p>
                </div>
              )}

              {/* Не вошло в правку */}
              {msg.partialNote && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-[10px] font-bold text-amber-700 mb-0.5">Не было внесено:</p>
                  <p className="text-[10px] text-amber-800 leading-relaxed">{msg.partialNote}</p>
                </div>
              )}

              {/* Кнопки после правки */}
              {msg.isEdited && (
                <div className="mt-2.5 flex gap-2 flex-wrap">
                  {/* На мобильных — кнопка "посмотреть изменения" вместо автосворачивания */}
                  {onShowChangesInDoc && (
                    <button
                      onClick={onShowChangesInDoc}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Icon name="Eye" size={11} />Посмотреть изменения
                    </button>
                  )}
                  <button
                    onClick={() => downloadDoc(docName, currentContent)}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-navy-800 text-gold-400 hover:bg-navy-700 border border-navy-700"
                  >
                    <Icon name="Download" size={11} />Скачать
                  </button>
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold bg-navy-700 text-gold-400 border border-navy-600">
                Я
              </div>
            )}
          </div>
        );
      })}

      {/* Подтверждение обычной правки */}
      {pendingConfirm && !editLoading && (
        <div className="rounded-2xl p-3 space-y-2 bg-navy-50 border border-navy-200">
          <div className="flex items-center gap-1.5">
            <Icon name="AlertCircle" size={13} className="text-navy-600 shrink-0" />
            <p className="text-[11px] font-semibold text-navy-800">Списать 5 вопросов за правку?</p>
          </div>
          <p className="text-[10px] text-slate-500">Документы не списываются. Изменения сохранятся в браузере.</p>
          <div className="flex gap-2">
            <button onClick={onCancelConfirm} className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
              Отмена
            </button>
            <button onClick={onConfirmEdit} className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-navy-800 text-white hover:bg-navy-700">
              Внести правку
            </button>
          </div>
        </div>
      )}

      {/* Предупреждение о многоэтапной правке */}
      {pendingMultiStage && !editLoading && (
        <div className="rounded-2xl p-3.5 space-y-2.5 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Layers" size={15} className="text-amber-700" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-amber-800">Правка будет выполнена в {pendingMultiStage.stages} этапа</p>
              <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                Изменения объёмные — AI разобьёт их на этапы чтобы уложиться в ограничения.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-amber-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Этапов:</span>
              <span className="text-[11px] font-bold text-navy-800">{pendingMultiStage.stages}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Будет списано:</span>
              <span className="text-[11px] font-bold text-amber-700">{pendingMultiStage.totalQ} вопросов</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Примерное время:</span>
              <span className="text-[11px] font-bold text-navy-800">~{pendingMultiStage.stages * 30}–{pendingMultiStage.stages * 60} сек</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancelMultiStage} className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
              Отмена
            </button>
            <button onClick={onConfirmMultiStage} className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-amber-600 text-white hover:bg-amber-700">
              Начать редакцию
            </button>
          </div>
        </div>
      )}

      {/* Предложение продолжить partial */}
      {pendingPartial && !editLoading && (
        <div className="rounded-2xl p-3 space-y-2 bg-amber-50 border border-amber-200">
          <p className="text-[11px] font-semibold text-amber-800">Внести оставшуюся часть правки?</p>
          <p className="text-[10px] text-amber-700 leading-relaxed">{pendingPartial.note}</p>
          <div className="flex gap-2">
            <button onClick={onDeclinePartial} className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">Нет</button>
            <button onClick={onContinuePartial} className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors active:scale-95 bg-navy-800 text-white hover:bg-navy-700">Да, внести</button>
          </div>
        </div>
      )}

      {/* Редактирование / этапы */}
      {editLoading && (
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-emerald-600 shadow-sm">
            <Icon name="PenLine" size={12} className="text-white animate-pulse" />
          </div>
          <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 bg-emerald-50 border border-emerald-200 min-w-[180px]">
            {editStageInfo && editStageInfo.total > 1 ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map(j => (
                    <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
                  ))}
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Этап {editStageInfo.current} из {editStageInfo.total}...
                  </span>
                </div>
                {/* Прогресс-бар */}
                <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(editStageInfo.current / editStageInfo.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(j => (
                  <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${j * 160}ms` }} />
                ))}
                <span className="text-[11px] text-emerald-700 font-medium">Вношу правку в документ...</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
