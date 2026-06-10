import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { getLegalDocs, deleteLegalDoc, requestLegalDocDeleteOtp, reindexLegalDocs, type LegalDoc } from "@/lib/auth";
import { CaseLawTree, StateDutyList, SimpleDocList } from "./LegalDocTreeViews";
import UploadModal from "./LegalDocUploadModal";
import { YEARS, CATEGORIES, type LegalCategory } from "./legalDocsConstants";

export default function AdminLegalDocs() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LegalCategory>("case_law");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([YEARS[0]]));
  const [expandedSubcats, setExpandedSubcats] = useState<Set<string>>(new Set(["civil"]));
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDefaults, setUploadDefaults] = useState<{ year?: number; subcategory?: string }>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ doc: LegalDoc; step: "confirm" | "otp"; otp: string; sending: boolean; error: string } | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ reindexed: number; errors: string[] } | null>(null);

  const load = async () => {
    setLoading(true);
    const all = await getLegalDocs();
    setDocs(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) { next.delete(year); } else { next.add(year); }
      return next;
    });
  };

  const toggleSubcat = (key: string) => {
    setExpandedSubcats(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const openUpload = (year?: number, subcategory?: string) => {
    setUploadDefaults({ year, subcategory });
    setShowUpload(true);
  };

  const handleDelete = (doc: LegalDoc) => {
    setDeleteModal({ doc, step: "confirm", otp: "", sending: false, error: "" });
  };

  const handleSendOtp = async () => {
    if (!deleteModal) return;
    setDeleteModal(m => m ? { ...m, sending: true, error: "" } : null);
    const res = await requestLegalDocDeleteOtp(deleteModal.doc.id);
    if (res.error) {
      setDeleteModal(m => m ? { ...m, sending: false, error: res.error! } : null);
    } else {
      setDeleteModal(m => m ? { ...m, sending: false, step: "otp" } : null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal || !deleteModal.otp.trim()) return;
    setDeleteModal(m => m ? { ...m, sending: true, error: "" } : null);
    setDeleting(deleteModal.doc.id);
    const res = await deleteLegalDoc(deleteModal.doc.id, deleteModal.otp.trim());
    if (res.error) {
      setDeleteModal(m => m ? { ...m, sending: false, error: res.error! } : null);
      setDeleting(null);
    } else {
      setDeleteModal(null);
      setDeleting(null);
      await load();
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    const res = await reindexLegalDocs(activeTab);
    setReindexing(false);
    if (res.ok) {
      setReindexResult({ reindexed: res.reindexed ?? 0, errors: res.errors ?? [] });
      await load();
    }
  };

  const countByCategory = (cat: LegalCategory) => docs.filter(d => d.category === cat).length;
  const activeCat = CATEGORIES.find(c => c.id === activeTab)!;

  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-navy-50 border border-navy-200 flex items-center justify-center">
            <Icon name="FolderOpen" size={18} className="text-navy-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-800">Правовая база</h3>
            <p className="text-[11px] text-muted-foreground">{docs.length} документов · AI использует при генерации</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(activeTab === "codex" || activeTab === "court_definitions") && (
            <button
              onClick={handleReindex}
              disabled={reindexing}
              title={activeTab === "codex" ? "Перенарезать кодексы по статьям" : "Перенарезать обзоры по правовым позициям"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              {reindexing
                ? <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <Icon name="RefreshCw" size={13} />}
              {reindexing ? "Переиндексация..." : "Переиндексировать"}
            </button>
          )}
          <button
            onClick={() => openUpload()}
            className="flex items-center gap-1.5 px-3 py-1.5 btn-gold rounded-xl text-xs font-semibold"
          >
            <Icon name="Upload" size={13} />Загрузить
          </button>
        </div>
      </div>

      {/* Табы — 4 категории */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {CATEGORIES.map(cat => {
          const count = countByCategory(cat.id);
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border transition-all text-left ${
                isActive ? `${cat.bg} ${cat.border} ${cat.color}` : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5 w-full">
                <Icon name={cat.icon as never} size={13} className="shrink-0" />
                <span className="text-[11px] font-semibold truncate">{cat.shortLabel}</span>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/60" : "bg-white border border-border"}`}>
                  {count}
                </span>
              </div>
              <p className="text-[10px] opacity-70 leading-tight line-clamp-2 hidden sm:block">{cat.description}</p>
            </button>
          );
        })}
      </div>

      {/* Результат переиндексации */}
      {reindexResult && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <Icon name="CheckCircle" size={14} color="#059669" className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-800">
              Переиндексировано {reindexResult.reindexed} документов по статьям
            </p>
            {reindexResult.errors.length > 0 && (
              <p className="text-[11px] text-amber-700 mt-0.5">Ошибки: {reindexResult.errors.join(", ")}</p>
            )}
          </div>
          <button onClick={() => setReindexResult(null)} className="text-emerald-400 hover:text-emerald-600">
            <Icon name="X" size={13} />
          </button>
        </div>
      )}

      {/* Описание активной категории */}
      <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl ${activeCat.bg} border ${activeCat.border}`}>
        <Icon name={activeCat.icon as never} size={14} className={`${activeCat.color} shrink-0 mt-0.5`} />
        <div>
          <p className={`text-xs font-semibold ${activeCat.color}`}>{activeCat.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{activeCat.description}</p>
        </div>
      </div>

      {/* Контент */}
      {loading ? (
        <div className="py-6 text-center">
          <Icon name="Loader" size={20} className="animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : activeTab === "case_law" ? (
        <CaseLawTree
          docs={docs.filter(d => d.category === "case_law")}
          expandedYears={expandedYears}
          expandedSubcats={expandedSubcats}
          deleting={deleting}
          onToggleYear={toggleYear}
          onToggleSubcat={toggleSubcat}
          onUpload={openUpload}
          onDelete={handleDelete}
        />
      ) : activeTab === "state_duty" ? (
        <StateDutyList
          docs={docs.filter(d => d.category === "state_duty")}
          deleting={deleting}
          onUpload={() => openUpload(undefined, "")}
          onDelete={handleDelete}
        />
      ) : (
        <SimpleDocList
          docs={docs.filter(d => d.category === activeTab)}
          category={activeTab}
          deleting={deleting}
          onUpload={() => openUpload()}
          onDelete={handleDelete}
        />
      )}

      {/* Статус AI */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-start gap-2">
          <Icon name="Sparkles" size={13} className="text-violet-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            AI использует все 4 категории при генерации документов: ищет релевантные фрагменты по теме запроса.
            Кодексы и разъяснения позволяют точно ссылаться на статьи без ошибок.
          </p>
        </div>
      </div>

      {showUpload && (
        <UploadModal
          defaultCategory={activeTab}
          defaultYear={uploadDefaults.year}
          defaultSubcategory={uploadDefaults.subcategory}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); load(); }}
        />
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <Icon name="Trash2" size={16} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-800">Удаление документа</h3>
                <p className="text-xs text-muted-foreground">Правовая база</p>
              </div>
            </div>

            {deleteModal.step === "confirm" ? (
              <>
                <p className="text-sm text-navy-700">
                  Для удаления <span className="font-semibold">«{deleteModal.doc.title}»</span> необходимо подтверждение через код на почту администратора.
                </p>
                {deleteModal.error && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{deleteModal.error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-slate-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={deleteModal.sending}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {deleteModal.sending ? "Отправка..." : "Отправить код"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-navy-700">
                  Код отправлен на <span className="font-semibold">ilya.povarchuk@mail.ru</span>. Введите его для подтверждения удаления.
                </p>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={deleteModal.otp}
                  onChange={e => setDeleteModal(m => m ? { ...m, otp: e.target.value.replace(/\D/g, "") } : null)}
                  className="w-full px-4 py-2.5 text-center text-xl font-mono tracking-widest border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300"
                  autoFocus
                />
                {deleteModal.error && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{deleteModal.error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-slate-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleteModal.sending || deleteModal.otp.length !== 6}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {deleteModal.sending ? "Удаление..." : "Удалить"}
                  </button>
                </div>
                <button
                  onClick={handleSendOtp}
                  className="w-full text-xs text-muted-foreground hover:text-navy-700 transition-colors"
                >
                  Отправить код повторно
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}