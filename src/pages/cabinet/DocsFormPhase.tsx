import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";
import PlanBanner from "@/pages/cabinet/PlanBanner";
import type { GenDoc } from "@/pages/cabinet/DocsTab";
import PWAInstallButton from "@/components/PWAInstallButton";

const DOC_TYPES_INTERNAL = [
  { id: "claim", label: "Исковое заявление", icon: "Gavel", price: 600, serviceType: "document" as ServiceType },
  { id: "response_to_claim", label: "Отзыв на иск", icon: "FileSearch", price: 600, serviceType: "document" as ServiceType },
  { id: "objection", label: "Возражение", icon: "ShieldAlert", price: 600, serviceType: "document" as ServiceType },
  { id: "appeal", label: "Апелляционная жалоба", icon: "ArrowUpCircle", price: 600, serviceType: "document" as ServiceType },
  { id: "cassation", label: "Кассационная жалоба", icon: "RefreshCcw", price: 600, serviceType: "document" as ServiceType },
  { id: "supervisory", label: "Надзорная жалоба", icon: "Eye", price: 600, serviceType: "document" as ServiceType },
  { id: "pretension", label: "Претензия", icon: "AlertCircle", price: 600, serviceType: "document" as ServiceType },
  { id: "complaint", label: "Жалоба", icon: "Building", price: 600, serviceType: "document" as ServiceType },
  { id: "application", label: "Заявления / Ходатайства", icon: "ClipboardList", price: 600, serviceType: "document" as ServiceType },
  { id: "notification", label: "Уведомления", icon: "Bell", price: 600, serviceType: "document" as ServiceType },
  { id: "contract", label: "Договор ГПХ", icon: "FileCheck", price: 600, serviceType: "document" as ServiceType },
  { id: "court_speech", label: "Речь для суда", icon: "Mic", price: 600, serviceType: "document" as ServiceType },
];

interface DocsFormPhaseProps {
  user: User;
  docType: typeof DOC_TYPES_INTERNAL[0];
  docDetails: string;
  docGenerating: boolean;
  docErr: string;
  genDocs: GenDoc[];
  onDocTypeChange: (dt: typeof DOC_TYPES_INTERNAL[0]) => void;
  onDocDetailsChange: (v: string) => void;
  onGenerate: () => void;
  onGoToChat: () => void;
  onOpenDoc: (doc: GenDoc) => void;
  onDownload: (name: string, content: string) => void;
  onSetCurrentDoc: (doc: GenDoc) => void;
  onSetFillValues: (vals: Record<string, string>) => void;
  onSetPhase: (phase: "form" | "generating" | "filling" | "done") => void;
  onSelectPlan: () => void;
}

export default function DocsFormPhase({
  user,
  docType,
  docDetails,
  docGenerating,
  docErr,
  genDocs,
  onDocTypeChange,
  onDocDetailsChange,
  onGenerate,
  onGoToChat,
  onOpenDoc,
  onDownload,
  onSetCurrentDoc,
  onSetFillValues,
  onSetPhase,
  onSelectPlan,
}: DocsFormPhaseProps) {
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);

  // При смене типа документа — фокус на поле ввода (только десктоп)
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      desktopTextareaRef.current?.focus();
    }
  }, [docType.id]);

  return (
    <>
    {/* ── МОБИЛЬ: список типов + история + sticky-панель снизу ── */}
    <div className="lg:hidden flex flex-col pb-tab-bar">
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm mb-3">
        <PlanBanner user={user} mode="docs" onSelectPlan={onSelectPlan} />
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-cormorant font-bold text-xl text-navy-800">Создать документ</h2>
          <PWAInstallButton />
        </div>
        <p className="text-xs text-muted-foreground mb-3">Выберите тип, опишите ситуацию — AI составит документ.</p>
        <div className="space-y-2">
          {DOC_TYPES_INTERNAL.map((dt) => (
            <button
              key={dt.id}
              onClick={() => { onDocTypeChange(dt); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border transition-all ${
                docType.id === dt.id ? "border-navy-500 bg-navy-50" : "border-border hover:border-navy-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${docType.id === dt.id ? "bg-navy-100" : "bg-slate-100"}`}>
                  <Icon name={dt.icon} size={14} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
                </div>
                <span className={`text-sm font-medium truncate ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</span>
              </div>
              <span className="text-xs font-semibold text-navy-500 shrink-0 ml-2">{dt.price} ₽</span>
            </button>
          ))}
        </div>
      </div>

      {/* История на мобиле — под списком типов */}
      <div className="space-y-3 mb-3">
        <button
          onClick={onGoToChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 text-white rounded-2xl transition-all group"
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
        {genDocs.length > 0 && (
          <div className="bg-white rounded-3xl border border-border shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3 text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              Документы хранятся в вашем браузере — скачайте, чтобы не потерять при очистке
            </div>
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
                    <button
                      onClick={() => { onSetCurrentDoc(doc); onSetFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); onSetPhase("filling"); }}
                      className="flex-1 text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors border border-border text-center"
                    >Реквизиты</button>
                    <button
                      onClick={() => onDownload(doc.name, doc.filled)}
                      className="flex-1 text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center justify-center gap-1 border border-border"
                    ><Icon name="Download" size={12} />Скачать</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky-панель снизу на мобиле */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border px-4 pt-3 pb-[calc(56px+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <p className="text-xs text-navy-500 font-medium mb-1.5">
          <Icon name="FileText" size={11} className="inline mr-1 mb-0.5" />
          {docType.label}
        </p>
        <textarea
          value={docDetails}
          onChange={(e) => onDocDetailsChange(e.target.value)}
          disabled={docGenerating}
          placeholder={`Опишите ситуацию для «${docType.label}»...`}
          rows={3}
          className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-2 disabled:opacity-60"
        />
        {docErr && (
          <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <Icon name="AlertCircle" size={12} className="shrink-0" />{docErr}
          </div>
        )}
        <button
          onClick={onGenerate}
          disabled={docGenerating || !docDetails.trim()}
          className="btn-gold w-full py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {docGenerating ? (
            <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
          ) : user && !user.isAdmin && user.paidDocs === 0 ? (
            <><Icon name="Lock" size={15} />Оплатить и сгенерировать · {docType.price} ₽</>
          ) : (
            <><Icon name="Zap" size={15} />Сгенерировать документ</>
          )}
        </button>
      </div>
    </div>

    {/* ── ДЕСКТОП: слева — выбор типа, справа — форма + история ── */}
    <div className="hidden lg:grid lg:grid-cols-2 gap-6">
      {/* Левая колонка — только выбор типа документа */}
      <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
        <PlanBanner user={user} mode="docs" onSelectPlan={onSelectPlan} />
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-cormorant font-bold text-2xl text-navy-800">Тип документа</h2>
          <PWAInstallButton />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Выберите нужный тип — справа опишите ситуацию.</p>
        <div className="space-y-2">
          {DOC_TYPES_INTERNAL.map((dt) => (
            <button
              key={dt.id}
              onClick={() => { onDocTypeChange(dt); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                docType.id === dt.id ? "border-navy-500 bg-navy-50" : "border-border hover:border-navy-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${docType.id === dt.id ? "bg-navy-100" : "bg-slate-100"}`}>
                  <Icon name={dt.icon} size={14} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
                </div>
                <span className={`text-sm font-medium truncate ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</span>
              </div>
              <span className="text-xs font-semibold text-navy-500 shrink-0 ml-2">{dt.price} ₽</span>
            </button>
          ))}
        </div>
      </div>

      {/* Правая колонка — форма генерации + история */}
      <div className="flex flex-col gap-4">
        {/* Форма */}
        <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
          <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">
            {docType.label}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Опишите ситуацию — AI-юрист составит полный документ. Реквизиты заполните после генерации.</p>
          <textarea
            ref={desktopTextareaRef}
            value={docDetails}
            onChange={(e) => onDocDetailsChange(e.target.value)}
            disabled={docGenerating}
            placeholder={`Опишите ситуацию для «${docType.label}»...\n\nНапример: что произошло, с кем, когда, какой результат нужен. Реквизиты сторон можно добавить после генерации документа.`}
            rows={7}
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-3 disabled:opacity-60"
          />
          {docErr && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <Icon name="AlertCircle" size={13} className="shrink-0" />{docErr}
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

        {/* История документов */}
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

        {genDocs.length > 0 && (
          <div className="bg-white rounded-3xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-1.5 mb-3 text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              Документы хранятся в вашем браузере — скачайте, чтобы не потерять при очистке
            </div>
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
                    <button
                      onClick={() => { onSetCurrentDoc(doc); onSetFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); onSetPhase("filling"); }}
                      className="flex-1 text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors border border-border text-center"
                    >
                      Реквизиты
                    </button>
                    <button
                      onClick={() => onDownload(doc.name, doc.filled)}
                      className="flex-1 text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center justify-center gap-1 border border-border"
                    >
                      <Icon name="Download" size={12} />Скачать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}