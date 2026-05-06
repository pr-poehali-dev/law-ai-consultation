import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { getLegalDocs, deleteLegalDoc, type LegalDoc } from "@/lib/auth";
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

  const handleDelete = async (doc: LegalDoc) => {
    if (!confirm(`Удалить «${doc.title}»?`)) return;
    setDeleting(doc.id);
    await deleteLegalDoc(doc.id);
    await load();
    setDeleting(null);
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
        <button
          onClick={() => openUpload()}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-gold rounded-xl text-xs font-semibold"
        >
          <Icon name="Upload" size={13} />Загрузить
        </button>
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
    </div>
  );
}
