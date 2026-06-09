import { useState } from "react";
import { sendReport } from "@/lib/auth";
import type { User } from "@/lib/auth";
import DocsGeneratingOverlay from "@/pages/cabinet/DocsGeneratingOverlay";
import DocsFormPhase from "@/pages/cabinet/DocsFormPhase";
import DocsFillingPhase from "@/pages/cabinet/DocsFillingPhase";
import DocsDonePhase from "@/pages/cabinet/DocsDonePhase";
import DocsReportModal from "@/pages/cabinet/DocsReportModal";

export type DocPhase = "form" | "generating" | "filling" | "done";

export interface DocRecommendationItem {
  type: "penalty_calc" | "doc" | "general" | "state_duty";
  title: string;
  reason: string;
  doc_type?: string;
  /** Только для general: текстовая рекомендация без кнопки действия */
  advice?: string;
  /** Для state_duty: текущий расчёт неверный */
  duty_note?: string;
}

export interface GenDoc {
  id: number;
  name: string;
  content: string;
  filled: string;
  date: string;
  placeholders: string[];
  truncated?: boolean;
  recommendations?: DocRecommendationItem[];
}

import { DOC_TYPES } from "@/pages/cabinet/docBlocks";
import type { DocType } from "@/pages/cabinet/docBlocks";
export { DOC_TYPES };
export type { DocType };

interface DocsTabProps {
  user: User;
  docType: DocType;
  docPhase: DocPhase;
  docDetails: string;
  docGenerating: boolean;
  docRetrying?: boolean;
  docErr: string;
  currentDoc: GenDoc | null;
  fillValues: Record<string, string>;
  genDocs: GenDoc[];
  attachedFiles?: { name: string; b64: string }[];
  onAttachedFilesChange?: (files: { name: string; b64: string }[]) => void;
  onDocTypeChange: (dt: DocType) => void;
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
  onPayForDoc: (dt: DocType) => void;
  onAnalyzeDoc: (doc: GenDoc) => void;
  onSelectPlan: () => void;
}

export default function DocsTab({
  user,
  docType,
  docPhase,
  docDetails,
  docGenerating,
  docRetrying,
  docErr,
  currentDoc,
  fillValues,
  genDocs,
  attachedFiles = [],
  onAttachedFilesChange,
  onDocTypeChange,
  onDocDetailsChange,
  onGenerate,
  onApplyFill,
  onFillChange,
  onSetPhase,
  onSetCurrentDoc,
  onSetFillValues,
  onResetForm,
  onGoToChat,
  onDownload,
  onOpenDoc,
  onAnalyzeDoc,
  onSelectPlan,
}: DocsTabProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const handleSendReport = async () => {
    if (!reportText.trim()) return;
    setReportLoading(true);
    await sendReport(reportText.trim());
    setReportLoading(false);
    setReportSent(true);
    setReportText("");
  };

  const handleCloseReport = () => {
    setReportOpen(false);
    setReportSent(false);
    setReportText("");
  };

  return (
    <div className="max-w-4xl mx-auto">

      {/* Оверлей генерации */}
      {docGenerating && docPhase === "generating" && (
        <DocsGeneratingOverlay docLabel={docType.label} retrying={docRetrying} />
      )}

      {/* ФАЗА: форма запроса */}
      {(docPhase === "form" || docPhase === "generating") && (
        <DocsFormPhase
          user={user}
          docType={docType}
          docDetails={docDetails}
          docGenerating={docGenerating}
          docErr={docErr}
          genDocs={genDocs}
          attachedFiles={attachedFiles}
          onAttachedFilesChange={onAttachedFilesChange ?? (() => {})}
          onDocTypeChange={onDocTypeChange}
          onDocDetailsChange={onDocDetailsChange}
          onGenerate={onGenerate}
          onGoToChat={onGoToChat}
          onOpenDoc={onOpenDoc}
          onDownload={onDownload}
          onSelectPlan={onSelectPlan}
        />
      )}

      {/* ФАЗА: автозаполнение реквизитов */}
      {docPhase === "filling" && currentDoc && (
        <DocsFillingPhase
          user={user}
          currentDoc={currentDoc}
          fillValues={fillValues}
          onFillChange={onFillChange}
          onApplyFill={onApplyFill}
          onSetPhase={onSetPhase}
          onOpenDoc={onOpenDoc}
          onDownload={onDownload}
          onAnalyzeDoc={onAnalyzeDoc}
          onOpenReport={() => setReportOpen(true)}
        />
      )}

      {/* ФАЗА: готово */}
      {docPhase === "done" && currentDoc && (
        <DocsDonePhase
          user={user}
          currentDoc={currentDoc}
          genDocs={genDocs}
          onResetForm={onResetForm}
          onGoToChat={onGoToChat}
          onOpenDoc={onOpenDoc}
          onDownload={onDownload}
          onAnalyzeDoc={onAnalyzeDoc}
          onSetCurrentDoc={onSetCurrentDoc}
          onSetFillValues={onSetFillValues}
          onSetPhase={onSetPhase}
          onOpenReport={() => setReportOpen(true)}
        />
      )}

      {/* Модалка: Сообщить о проблеме (глобальная для всех фаз) */}
      {reportOpen && (
        <DocsReportModal
          reportText={reportText}
          reportLoading={reportLoading}
          reportSent={reportSent}
          onChangeText={setReportText}
          onSend={handleSendReport}
          onClose={handleCloseReport}
        />
      )}

    </div>
  );
}