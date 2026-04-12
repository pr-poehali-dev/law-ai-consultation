import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import DocPreview from "@/components/DocPreview";
import type { User } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";

export type DocPhase = "form" | "generating" | "filling" | "done";

export interface GenDoc {
  id: number;
  name: string;
  content: string;
  filled: string;
  date: string;
  placeholders: string[];
  truncated?: boolean;
}

const DOC_TYPES = [
  { id: "claim", label: "Исковое заявление", icon: "Gavel", price: 500, serviceType: "document" as ServiceType },
  { id: "pretension", label: "Претензия", icon: "AlertCircle", price: 500, serviceType: "document" as ServiceType },
  { id: "complaint", label: "Жалоба", icon: "Building", price: 500, serviceType: "document" as ServiceType },
  { id: "contract", label: "Договор ГПХ", icon: "FileCheck", price: 500, serviceType: "document" as ServiceType },
  { id: "business_contract", label: "Договор для бизнеса", icon: "Briefcase", price: 1000, serviceType: "business" as ServiceType },
];

interface DocsTabProps {
  user: User;
  docType: typeof DOC_TYPES[0];
  docPhase: DocPhase;
  docDetails: string;
  docGenerating: boolean;
  docErr: string;
  currentDoc: GenDoc | null;
  fillValues: Record<string, string>;
  genDocs: GenDoc[];
  onDocTypeChange: (dt: typeof DOC_TYPES[0]) => void;
  onDocDetailsChange: (v: string) => void;
  onGenerate: () => void;
  onContinue: () => void;
  onApplyFill: () => void;
  onFillChange: (key: string, value: string) => void;
  onSetPhase: (phase: DocPhase) => void;
  onSetCurrentDoc: (doc: GenDoc) => void;
  onSetFillValues: (vals: Record<string, string>) => void;
  onResetForm: () => void;
  onGoToChat: () => void;
  onDownload: (name: string, content: string) => void;
  onOpenDoc: (doc: GenDoc) => void;
  onPayForDoc: (dt: typeof DOC_TYPES[0]) => void;
}

export { DOC_TYPES };

// Анимированные статусы генерации
const GEN_STATUSES = [
  "Анализирую запрос...",
  "Изучаю судебную практику...",
  "Подбираю нормы законодательства...",
  "Формирую структуру документа...",
  "Составляю текст...",
  "Проверяю соответствие нормам РФ...",
  "Финальная проверка...",
];

function GeneratingOverlay({ docLabel }: { docLabel: string }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((i) => (i + 1) % GEN_STATUSES.length);
    }, 4000);
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 1.2, 92));
    }, 600);
    return () => { clearInterval(interval); clearInterval(progressInterval); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Иконка с пульсацией */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-gold-400/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-gold-400/30 animate-pulse" />
          <div className="relative w-20 h-20 gradient-navy rounded-full flex items-center justify-center shadow-lg">
            <Icon name="FileText" size={32} className="text-gold-400" />
          </div>
        </div>

        <h3 className="font-cormorant font-bold text-xl text-navy-800 mb-1">Составляю {docLabel}</h3>
        <p className="text-xs text-muted-foreground mb-6">AI-юрист работает над документом</p>

        {/* Прогресс-бар */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-navy-600 to-gold-400 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Анимированный статус */}
        <p className="text-[12.5px] text-navy-600 font-medium animate-fade-in min-h-[20px] transition-all duration-500">
          {GEN_STATUSES[statusIdx]}
        </p>

        {/* Мигающие точки */}
        <div className="flex justify-center gap-1.5 mt-4">
          <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-navy-300 rounded-full" />
        </div>

        <p className="text-[11px] text-muted-foreground/60 mt-4">Обычно занимает 20–60 секунд</p>
      </div>
    </div>
  );
}

export default function DocsTab({
  user,
  docType,
  docPhase,
  docDetails,
  docGenerating,
  docErr,
  currentDoc,
  fillValues,
  genDocs,
  onDocTypeChange,
  onDocDetailsChange,
  onGenerate,
  onContinue,
  onApplyFill,
  onFillChange,
  onSetPhase,
  onSetCurrentDoc,
  onSetFillValues,
  onResetForm,
  onGoToChat,
  onDownload,
  onOpenDoc,
  onPayForDoc,
}: DocsTabProps) {
  return (
    <div className="max-w-4xl mx-auto">

      {/* Оверлей генерации */}
      {docGenerating && docPhase === "generating" && (
        <GeneratingOverlay docLabel={docType.label} />
      )}

      {/* ФАЗА: форма запроса */}
      {(docPhase === "form" || docPhase === "generating") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
            <h2 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">Создать документ</h2>
            <p className="text-sm text-muted-foreground mb-4">Опишите ситуацию — AI-юрист составит полный документ. Реквизиты заполните после генерации.</p>
            <div className="space-y-2 mb-4">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => { onDocTypeChange(dt); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                    docType.id === dt.id ? "border-navy-500 bg-navy-50" : "border-border hover:border-navy-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${docType.id === dt.id ? "bg-navy-100" : "bg-slate-100"}`}>
                      <Icon name={dt.icon} size={15} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
                    </div>
                    <span className={`text-sm font-medium ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-navy-500">{dt.price} ₽</span>
                </button>
              ))}
            </div>
            <textarea
              value={docDetails}
              onChange={(e) => onDocDetailsChange(e.target.value)}
              disabled={docGenerating}
              placeholder={`Опишите ситуацию для «${docType.label}»...\n\nНапример: что произошло, с кем, когда, какой результат нужен. Реквизиты сторон можно добавить после генерации документа.`}
              rows={6}
              className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-3 disabled:opacity-60"
            />
            {docErr && (
              <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <Icon name="AlertCircle" size={13} className="shrink-0" />{docErr}
              </div>
            )}

            {/* Баланс документов */}
            {user && !user.isAdmin && (
              <div className={`mb-3 flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs ${
                user.paidDocs > 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}>
                <div className="flex items-center gap-2">
                  <Icon name={user.paidDocs > 0 ? "CheckCircle" : "AlertCircle"} size={13} className="shrink-0" />
                  {user.paidDocs > 0
                    ? `Доступно документов: ${user.paidDocs}`
                    : "Нет доступных документов"}
                </div>
                {user.paidDocs === 0 && (
                  <button
                    onClick={() => onPayForDoc(docType)}
                    className="font-semibold underline hover:no-underline"
                  >
                    Оплатить {docType.price} ₽
                  </button>
                )}
              </div>
            )}
            {user?.isAdmin && (
              <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-800">
                <Icon name="ShieldCheck" size={13} />
                Администратор · все функции бесплатны
              </div>
            )}

            <button
              onClick={onGenerate}
              disabled={docGenerating || !docDetails.trim()}
              className="btn-gold w-full py-3.5 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {docGenerating ? (
                <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
              ) : user && !user.isAdmin && user.paidDocs === 0 ? (
                <><Icon name="Lock" size={16} />Оплатить и сгенерировать · {docType.price} ₽</>
              ) : (
                <><Icon name="Zap" size={16} />Сгенерировать документ</>
              )}
            </button>
            {docGenerating && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                AI-юрист составляет документ... После генерации вы сможете заполнить реквизиты сторон.
              </p>
            )}
          </div>

          {/* Правая колонка — история документов */}
          <div className="space-y-4">
            <button
              onClick={onGoToChat}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 text-white rounded-2xl transition-all group"
            >
              <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Icon name="MessageCircle" size={16} className="text-gold-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold">Нужна консультация?</div>
                <div className="text-xs text-white/70">AI-юрист ответит на ваш вопрос</div>
              </div>
              <Icon name="ChevronRight" size={16} className="text-white/50 group-hover:text-white transition-colors" />
            </button>

            {genDocs.length > 0 ? (
              <div className="bg-white rounded-3xl border border-border shadow-sm p-5">
                <h3 className="font-semibold text-navy-800 text-sm mb-3">Созданные документы</h3>
                <div className="space-y-2">
                  {genDocs.map((doc) => (
                    <div key={doc.id} className="py-2.5 border-b border-border/60 last:border-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-navy-800 truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.date}</div>
                        </div>
                        <button onClick={() => onOpenDoc(doc)} className="shrink-0 p-1.5 rounded-lg hover:bg-navy-50 text-navy-400 hover:text-navy-700 transition-colors">
                          <Icon name="Eye" size={14} />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { onSetCurrentDoc(doc); onSetFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); onSetPhase("filling"); }} className="flex-1 text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors border border-border text-center">Реквизиты</button>
                        <button onClick={() => onDownload(doc.name, doc.filled)} className="flex-1 text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center justify-center gap-1 border border-border">
                          <Icon name="Download" size={12} />Скачать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-border shadow-sm p-10 text-center">
                <div className="w-12 h-12 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Icon name="FileText" size={22} className="text-navy-400" />
                </div>
                <p className="text-sm text-muted-foreground">Опишите ситуацию — AI составит документ</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ФАЗА: автозаполнение реквизитов */}
      {docPhase === "filling" && currentDoc && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-cormorant font-bold text-2xl text-navy-800">Заполнить реквизиты</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{currentDoc.name}</p>
              </div>
              <button
                onClick={() => onSetPhase("form")}
                className="text-xs text-muted-foreground hover:text-navy-700 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Icon name="ArrowLeft" size={13} />Назад
              </button>
            </div>

            {currentDoc.placeholders.length === 0 ? (
              <div className="text-center py-6">
                <Icon name="CheckCircle" size={32} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-navy-700 font-medium">Все реквизиты уже заполнены</p>
                <p className="text-xs text-muted-foreground mt-1">AI внёс данные из вашего описания в документ</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 rounded-2xl px-4 py-3 mb-4 border border-blue-100">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    AI выделил поля, которые нужно заполнить. Введите данные — документ обновится автоматически.
                  </p>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {currentDoc.placeholders.map((key) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-navy-700 mb-1 block">
                        {key.replace(/_/g, " ")}
                      </label>
                      <input
                        type="text"
                        value={fillValues[key] || ""}
                        onChange={(e) => onFillChange(key, e.target.value)}
                        placeholder={`Введите ${key.replace(/_/g, " ").toLowerCase()}`}
                        className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy-400 transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={onApplyFill}
                  className="btn-gold w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 mt-5"
                >
                  <Icon name="CheckCircle" size={16} />Применить реквизиты
                </button>
              </>
            )}
          </div>

          <div className="hidden lg:flex bg-white rounded-3xl border border-border shadow-sm flex-col overflow-hidden" style={{ maxHeight: "calc(100dvh - 180px)", minHeight: "300px" }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-navy-800">Предпросмотр</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenDoc(currentDoc)}
                  className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Полный экран
                </button>
                <button
                  onClick={() => onDownload(currentDoc.name, currentDoc.filled)}
                  className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                >
                  <Icon name="Download" size={12} />Скачать
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <DocPreview content={currentDoc.filled} fillValues={fillValues} />
            </div>
          </div>
          {/* Мобильная кнопка предпросмотра */}
          <div className="lg:hidden bg-white rounded-3xl border border-border shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                <Icon name="FileText" size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-800">{currentDoc.name}</p>
                <p className="text-xs text-muted-foreground">Документ готов к просмотру</p>
              </div>
            </div>
            <button
              onClick={() => onOpenDoc(currentDoc)}
              className="btn-gold w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <Icon name="Eye" size={15} />Просмотреть документ
            </button>
            <button
              onClick={() => onDownload(currentDoc.name, currentDoc.filled)}
              className="w-full py-3 rounded-2xl font-medium flex items-center justify-center gap-2 text-sm border border-border text-navy-700 hover:bg-slate-50 transition-colors"
            >
              <Icon name="Download" size={15} />Скачать .docx
            </button>
          </div>
        </div>
      )}

      {/* ФАЗА: готово */}
      {docPhase === "done" && currentDoc && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
              <Icon name="CheckCircle" size={22} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-navy-800">{currentDoc.name} — готов</div>
              <div className="text-xs text-muted-foreground mt-0.5">Реквизиты заполнены и применены к документу</div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => onOpenDoc(currentDoc)}
                className="text-xs text-navy-600 hover:text-navy-800 px-3 py-2 rounded-xl border border-emerald-200 hover:bg-white transition-colors font-medium"
              >
                Открыть
              </button>
              <button
                onClick={() => onDownload(currentDoc.name, currentDoc.filled)}
                className="btn-gold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium"
              >
                <Icon name="Download" size={13} />Скачать .docx
              </button>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onResetForm}
              className="text-sm text-navy-600 hover:text-navy-800 px-5 py-2.5 rounded-xl border border-border hover:border-navy-300 transition-colors"
            >
              Создать ещё
            </button>
            <button
              onClick={onGoToChat}
              className="btn-gold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2"
            >
              <Icon name="MessageCircle" size={15} />Задать вопрос юристу
            </button>
          </div>
          {genDocs.length > 0 && (
            <div className="bg-white rounded-3xl border border-border shadow-sm p-5">
              <h3 className="font-semibold text-navy-800 text-sm mb-3">Все документы</h3>
              <div className="space-y-2">
                {genDocs.map((doc) => (
                  <div key={doc.id} className="py-2.5 border-b border-border/60 last:border-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-navy-800 truncate">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{doc.date}</div>
                      </div>
                      <button onClick={() => onOpenDoc(doc)} className="shrink-0 p-1.5 rounded-lg hover:bg-navy-50 text-navy-400 hover:text-navy-700 transition-colors">
                        <Icon name="Eye" size={14} />
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { onSetCurrentDoc(doc); onSetFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); onSetPhase("filling"); }} className="flex-1 text-xs text-navy-600 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors border border-border text-center">Реквизиты</button>
                      <button onClick={() => onDownload(doc.name, doc.filled)} className="flex-1 text-xs text-navy-600 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center justify-center gap-1 border border-border">
                        <Icon name="Download" size={12} />Скачать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}