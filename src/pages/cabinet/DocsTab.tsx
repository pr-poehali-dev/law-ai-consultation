import { useState } from "react";
import { sendReport } from "@/lib/auth";
import type { User } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";
import DocsGeneratingOverlay from "@/pages/cabinet/DocsGeneratingOverlay";
import DocsFormPhase from "@/pages/cabinet/DocsFormPhase";
import DocsFillingPhase from "@/pages/cabinet/DocsFillingPhase";
import DocsDonePhase from "@/pages/cabinet/DocsDonePhase";
import DocsReportModal from "@/pages/cabinet/DocsReportModal";

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

export { DOC_TYPES };

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
  onAnalyzeDoc: (doc: GenDoc) => void;
  onSelectPlan: () => void;
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
        <DocsGeneratingOverlay docLabel={docType.label} />
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
          onDocTypeChange={onDocTypeChange}
          onDocDetailsChange={onDocDetailsChange}
          onGenerate={onGenerate}
          onGoToChat={onGoToChat}
          onOpenDoc={onOpenDoc}
          onDownload={onDownload}
          onSetCurrentDoc={onSetCurrentDoc}
          onSetFillValues={onSetFillValues}
          onSetPhase={onSetPhase}
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