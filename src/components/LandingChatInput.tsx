import { useState } from "react";
import Icon from "@/components/ui/icon";
import DocPickerSheet from "@/components/DocPickerSheet";
import DocDetailsModal, { type DocAttachedFile } from "@/components/DocDetailsModal";
import { DOC_BLOCKS } from "@/pages/cabinet/docBlocks";

interface LandingChatInputProps {
  lastSuggestDocType?: string;
  onCreateDoc: (docTypeId: string, query: string, comment: string, files: DocAttachedFile[]) => void;
  onLogin?: () => void;
}

export default function LandingChatInput({
  lastSuggestDocType,
  onCreateDoc,
  onLogin,
}: LandingChatInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<{ id: string; label: string } | null>(null);

  const handlePickerSelect = (id: string) => {
    setShowPicker(false);
    const fullLabel = DOC_BLOCKS.flatMap(b => b.types).find(t => t.id === id)?.label || id;
    setPendingDoc({ id, label: fullLabel });
  };

  return (
    <>
      <div className="px-4 pb-4 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid #edf0f7", background: "#ffffff" }}>
        {/* Кнопка создания документа */}
        <button
          onClick={() => setShowPicker(true)}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #e8a820, #f0c060)",
            color: "#0a1628",
            boxShadow: "0 4px 16px rgba(232,168,32,0.35)",
          }}
        >
          <Icon name="FileText" size={15} color="#0a1628" />
          Создать документ
        </button>

        {/* Кнопка входа/регистрации */}
        <button
          onClick={() => onLogin?.()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, rgba(13,32,64,0.04), rgba(22,45,90,0.07))",
            border: "1px solid rgba(13,32,64,0.12)",
          }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #0d2040, #162d5a)", boxShadow: "0 2px 6px rgba(10,22,40,0.2)" }}>
            <Icon name="LogIn" size={12} color="#e8a820" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[12px] font-semibold leading-tight" style={{ color: "#0d2040" }}>
              Для доступа ко всем функциям
            </p>
            <p className="text-[11px] leading-tight mt-0.5" style={{ color: "#64748b" }}>
              зарегистрируйтесь или авторизуйтесь
            </p>
          </div>
          <Icon name="ChevronRight" size={13} color="#94a3b8" />
        </button>
      </div>

      {/* Пикер типа документа */}
      {showPicker && (
        <DocPickerSheet
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Детали документа */}
      {pendingDoc && (
        <DocDetailsModal
          docTypeId={pendingDoc.id}
          docLabel={pendingDoc.label}
          initialQuery=""
          onProceed={(query, comment, files, docTypeId, docLabel) => {
            setPendingDoc(null);
            onCreateDoc(docTypeId, query, comment, files);
          }}
          onClose={() => setPendingDoc(null)}
        />
      )}
    </>
  );
}