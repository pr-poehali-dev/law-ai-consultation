import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { getLegalDocs, deleteLegalDoc, type LegalDoc } from "@/lib/auth";
import { CaseLawTree, StateDutyList } from "./LegalDocTreeViews";
import UploadModal from "./LegalDocUploadModal";
import { YEARS } from "./legalDocsConstants";

export default function AdminLegalDocs() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"case_law" | "state_duty">("case_law");
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

  const caseLawDocs = docs.filter(d => d.category === "case_law");
  const stateDutyDocs = docs.filter(d => d.category === "state_duty");

  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-navy-50 border border-navy-200 flex items-center justify-center">
            <Icon name="FolderOpen" size={18} className="text-navy-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-800">Правовая база</h3>
            <p className="text-[11px] text-muted-foreground">Файлы для AI-консультаций</p>
          </div>
        </div>
        <button
          onClick={() => openUpload()}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-gold rounded-xl text-xs font-semibold"
        >
          <Icon name="Upload" size={13} />Загрузить
        </button>
      </div>

      {/* Табы */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("case_law")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            activeTab === "case_law"
              ? "bg-purple-50 border-purple-200 text-purple-600"
              : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
          }`}
        >
          <Icon name="Gavel" size={12} />
          Судебная практика
          <span className="ml-0.5 bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {caseLawDocs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("state_duty")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            activeTab === "state_duty"
              ? "bg-blue-50 border-blue-200 text-blue-600"
              : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
          }`}
        >
          <Icon name="Receipt" size={12} />
          Госпошлины
          <span className="ml-0.5 bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {stateDutyDocs.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <Icon name="Loader" size={20} className="animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : activeTab === "case_law" ? (
        <CaseLawTree
          docs={caseLawDocs}
          expandedYears={expandedYears}
          expandedSubcats={expandedSubcats}
          deleting={deleting}
          onToggleYear={toggleYear}
          onToggleSubcat={toggleSubcat}
          onUpload={openUpload}
          onDelete={handleDelete}
        />
      ) : (
        <StateDutyList
          docs={stateDutyDocs}
          deleting={deleting}
          onUpload={() => openUpload(undefined, "")}
          onDelete={handleDelete}
        />
      )}

      {/* Статус AI */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            AI читает последние 3 файла из категории при каждом запросе. Более свежие файлы имеют приоритет.
            Судебная практика — для всех документов. Госпошлины — для исков и жалоб.
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
