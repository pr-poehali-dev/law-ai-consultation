import Icon from "@/components/ui/icon";
import { type LegalDoc } from "@/lib/auth";
import { YEARS, SUBCATEGORIES } from "./legalDocsConstants";
import DocRow from "./LegalDocRow";

// ─── Дерево судебной практики ────────────────────────────────────────────────

export function CaseLawTree({
  docs, expandedYears, expandedSubcats, deleting,
  onToggleYear, onToggleSubcat, onUpload, onDelete,
}: {
  docs: LegalDoc[];
  expandedYears: Set<number>;
  expandedSubcats: Set<string>;
  deleting: number | null;
  onToggleYear: (y: number) => void;
  onToggleSubcat: (k: string) => void;
  onUpload: (year: number, subcategory: string) => void;
  onDelete: (doc: LegalDoc) => void;
}) {
  const totalCount = docs.length;

  if (totalCount === 0) {
    return (
      <div className="py-8 text-center">
        <Icon name="Gavel" size={32} className="text-purple-400 mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">Нет файлов судебной практики</p>
        <button onClick={() => onUpload(YEARS[0], "civil")}
          className="mt-3 text-xs px-4 py-2 rounded-xl btn-gold font-semibold">
          Загрузить первый файл
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {YEARS.map(year => {
        const yearDocs = docs.filter(d => d.doc_year === year);
        const isExpanded = expandedYears.has(year);

        return (
          <div key={year} className="border border-border rounded-xl overflow-hidden">
            {/* Год-заголовок */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => onToggleYear(year)}>
              <div className="flex items-center gap-2">
                <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={14} className="text-muted-foreground" />
                <Icon name="FolderOpen" size={14} className="text-navy-500" />
                <span className="text-xs font-bold text-navy-700">{year} год</span>
                <span className="text-[10px] text-muted-foreground bg-white border border-border rounded-full px-1.5 py-0.5 font-medium">
                  {yearDocs.length} файлов
                </span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onUpload(year, "civil"); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-colors"
              >
                <Icon name="Plus" size={10} />
                Добавить
              </button>
            </div>

            {/* Подкатегории */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {SUBCATEGORIES.map(subcat => {
                  const subcatDocs = yearDocs.filter(d => d.subcategory === subcat.id);
                  const treeKey = `${year}-${subcat.id}`;
                  const isSubExpanded = expandedSubcats.has(treeKey);

                  return (
                    <div key={subcat.id}>
                      {/* Подкатегория-заголовок */}
                      <div
                        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => onToggleSubcat(treeKey)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name={isSubExpanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-muted-foreground" />
                          <div className={`w-5 h-5 rounded-md ${subcat.bg} flex items-center justify-center`}>
                            <Icon name={subcat.icon as Parameters<typeof Icon>[0]["name"]} size={11} className={subcat.color} />
                          </div>
                          <span className="text-[11px] font-semibold text-navy-700">{subcat.label}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${subcat.bg} ${subcat.color} border ${subcat.border}`}>
                            {subcatDocs.length}
                          </span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); onUpload(year, subcat.id); }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${subcat.bg} ${subcat.color} border ${subcat.border} hover:opacity-80 transition-opacity`}
                        >
                          <Icon name="Plus" size={9} />
                          Загрузить
                        </button>
                      </div>

                      {/* Файлы подкатегории */}
                      {isSubExpanded && (
                        <div className="px-4 pb-2 space-y-1.5">
                          {subcatDocs.length === 0 ? (
                            <div className="py-3 text-center">
                              <p className="text-[11px] text-muted-foreground">Нет файлов</p>
                              <button
                                onClick={() => onUpload(year, subcat.id)}
                                className={`mt-1.5 text-[10px] px-3 py-1 rounded-lg font-semibold ${subcat.bg} ${subcat.color} border ${subcat.border}`}
                              >
                                Добавить первый
                              </button>
                            </div>
                          ) : (
                            subcatDocs.map(doc => (
                              <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Файлы без подкатегории */}
                {yearDocs.filter(d => !d.subcategory).length > 0 && (
                  <div className="px-4 py-2">
                    <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">Без подкатегории</p>
                    <div className="space-y-1.5">
                      {yearDocs.filter(d => !d.subcategory).map(doc => (
                        <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Файлы без года */}
      {docs.filter(d => !d.doc_year).length > 0 && (
        <div className="border border-dashed border-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Без года</p>
          <div className="space-y-1.5">
            {docs.filter(d => !d.doc_year).map(doc => (
              <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Список госпошлин ─────────────────────────────────────────────────────────

export function StateDutyList({ docs, deleting, onUpload, onDelete }: {
  docs: LegalDoc[];
  deleting: number | null;
  onUpload: () => void;
  onDelete: (doc: LegalDoc) => void;
}) {
  if (docs.length === 0) {
    return (
      <div className="py-8 text-center">
        <Icon name="Receipt" size={32} className="text-blue-400 mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">Нет файлов госпошлин</p>
        <button onClick={onUpload} className="mt-3 text-xs px-4 py-2 rounded-xl btn-gold font-semibold">
          Загрузить первый файл
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {docs.map(doc => (
        <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
      ))}
    </div>
  );
}
