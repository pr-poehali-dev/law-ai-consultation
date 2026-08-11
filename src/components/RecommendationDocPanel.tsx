import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getToken, canUseRequest, consumeRequest } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["ai-docs"];

const REC_DOC_LABELS: Record<string, string> = {
  motion_restore_term: "Ходатайство о восстановлении срока",
  motion_evidence: "Ходатайство об истребовании доказательств",
  motion_witness: "Ходатайство о вызове свидетеля",
  motion_third_party: "Ходатайство о привлечении третьего лица",
  motion_expertise: "Ходатайство о назначении экспертизы",
  motion_enforcement: "Ходатайство об обеспечении иска",
  pretension: "Досудебная претензия",
  complaint: "Жалоба",
  appeal: "Апелляционная жалоба",
};

interface RecommendationDocPanelProps {
  recDocType: string;
  recTitle: string;
  recReason: string;
  docContext: string;
  onClose: () => void;
  onPaymentRequired: () => void;
  onSuccess?: () => void;
}

export default function RecommendationDocPanel({
  recDocType, recTitle, recReason, docContext, onClose, onPaymentRequired, onSuccess,
}: RecommendationDocPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  const [generated, setGenerated] = useState(false);

  const docLabel = REC_DOC_LABELS[recDocType] || recTitle;

  const handleGenerate = async () => {
    setErr("");
    setLoading(true);
    const canDoc = await canUseRequest();
    if (!canDoc) { setLoading(false); onPaymentRequired(); return; }
    const { ok: consumed } = await consumeRequest();
    if (!consumed) { setLoading(false); onPaymentRequired(); return; }
    try {
      const token = getToken();
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          mode: "rec_doc_generate",
          rec_doc_type: recDocType,
          rec_context: docContext,
          rec_reason: recReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");
      setResult(data.answer || "");
      setGenerated(true);
      // onSuccess вызывается после скачивания, не сразу
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadDoc(docLabel, result);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Icon name="FileText" size={14} className="text-blue-600" />
          </div>
          <span className="font-semibold text-navy-800 text-sm truncate">{docLabel}</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy-700 transition-colors shrink-0 ml-2">
          <Icon name="X" size={14} />
        </button>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {!generated ? (
          <>
            {/* Обоснование */}
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-start gap-2">
                <Icon name="Info" size={13} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-0.5">Почему это нужно</p>
                  <p className="text-xs text-blue-600 leading-relaxed">{recReason}</p>
                </div>
              </div>
            </div>

            {/* Описание */}
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-700 to-navy-500 mx-auto flex items-center justify-center mb-3 shadow-md">
                <Icon name="Sparkles" size={20} className="text-gold-400" />
              </div>
              <p className="font-semibold text-navy-800 text-sm mb-1">{docLabel}</p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                AI подготовит документ с учётом уже созданных материалов по вашему делу
              </p>
            </div>

            {err && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 rounded-xl px-3 py-2">
                <Icon name="AlertCircle" size={13} />
                <span className="text-xs">{err}</span>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-700">Документ подготовлен</p>
                <p className="text-[10px] text-emerald-600">Нажмите «Скачать» чтобы сохранить</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 max-h-48 overflow-y-auto">
              <p className="text-[11px] text-navy-700 whitespace-pre-wrap leading-relaxed">{result}</p>
            </div>
          </div>
        )}
      </div>

      {/* Кнопки */}
      <div className="px-4 py-3 border-t border-slate-100 shrink-0 space-y-2">
        {generated ? (
          <button onClick={handleDownload} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center justify-center gap-1.5">
            <Icon name="Download" size={14} />Скачать .docx
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-navy-700 to-navy-600 hover:from-navy-800 hover:to-navy-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Icon name="Loader" size={14} className="animate-spin" />Создаём документ...</>
            ) : (
              <><Icon name="Sparkles" size={14} />Подготовить документ · 1 документ</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}