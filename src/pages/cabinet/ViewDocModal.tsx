import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import type { DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";
import { sendReport, getUser, lawyerSend, getToken } from "@/lib/auth";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocRecsPanel from "@/components/DocRecsPanel";
import DocAiChatPanel from "@/components/DocAiChatPanel";
import UpgradeNoticeModal from "@/components/UpgradeNoticeModal";
import ViewDocContent from "./ViewDocContent";
import ViewDocFooter from "./ViewDocFooter";
import type { ViewDocModalProps } from "./ViewDocUtils";
import func2url from "../../../backend/func2url.json";

const AI_DOCS_URL = (func2url as Record<string, string>)["ai-docs"];

export default function ViewDocModal({ doc, onClose, onOpenPlanModal }: ViewDocModalProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [showExpertOffer, setShowExpertOffer] = useState(false);
  const [sendingToLawyer, setSendingToLawyer] = useState(false);
  const [sentToLawyer, setSentToLawyer] = useState(false);
  const [showLawyerSuccess, setShowLawyerSuccess] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  const [liveRecs, setLiveRecs] = useState<DocRecommendationItem[]>(doc.recommendations || []);
  const [recsAnalyzing, setRecsAnalyzing] = useState(false);
  const hasRecs = liveRecs.length > 0;
  const [showRecs, setShowRecs] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [currentDocContent, setCurrentDocContent] = useState(doc.content);
  const [prevDocContent, setPrevDocContent] = useState<string | null>(null);
  const [docFlash, setDocFlash] = useState(false);
  const docScrollRef = useRef<HTMLDivElement | null>(null);

  // Фоновый анализ рекомендаций — запускается после показа документа
  useEffect(() => {
    if (doc.recommendations && doc.recommendations.length > 0) {
      setLiveRecs(doc.recommendations);
      const t = setTimeout(() => setShowRecs(true), 800);
      return () => clearTimeout(t);
    }
    const runRecsAnalysis = async () => {
      setRecsAnalyzing(true);
      try {
        const token = getToken();
        const res = await fetch(AI_DOCS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
          body: JSON.stringify({
            mode: "doc_recommendations",
            doc_name: doc.name,
            doc_content: doc.content.slice(0, 2000),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const recs: DocRecommendationItem[] = data.recommendations || [];
          if (recs.length > 0) {
            setLiveRecs(recs);
            setShowRecs(true);
          }
        }
      } catch {
        // Тихо — анализ рекомендаций не критичен
      } finally {
        setRecsAnalyzing(false);
      }
    };
    const t = setTimeout(runRecsAnalysis, 1500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleCloseReport = () => { setReportOpen(false); setReportSent(false); setReportText(""); };

  const handleSendReport = async () => {
    if (!reportText.trim()) return;
    setReportLoading(true);
    await sendReport(reportText.trim());
    setReportLoading(false);
    setReportSent(true);
    setReportText("");
  };

  const handleSendToLawyer = async () => {
    const user = await getUser();
    if (!user || !user.paidExpert) {
      setUpgradeFeature("lawyer");
      return;
    }
    setSendingToLawyer(true);
    await lawyerSend({ body: `Прошу проверить документ: ${doc.name}`, attachment_type: "document", attachment_name: doc.name, attachment_content: doc.content });
    setSendingToLawyer(false);
    setSentToLawyer(true);
    setShowLawyerSuccess(true);
  };

  const handleAiEditorClick = async () => {
    const user = await getUser();
    const hasAccess = user?.isAdmin || (user?.paidQuestions ?? 0) >= 100 || user?.subscriptionConsultUntil;
    if (!hasAccess) {
      setUpgradeFeature("ai_editor");
      return;
    }
    setShowAiChat(true);
    setShowRecs(false);
    setTimeout(() => { docScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, 100);
  };

  const handleExpertOfferSuccess = async () => { setShowExpertOffer(false); await handleSendToLawyer(); };
  const handleCopy = async () => { await navigator.clipboard.writeText(currentDocContent); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <>
      {/* ── Оверлей + сама модалка ─────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
        onClick={handleClose}
      >
        <div
          className={`bg-white w-full sm:rounded-3xl sm:max-w-2xl flex flex-col shadow-2xl transition-all duration-250 ease-out
            ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-[0.97]"}
            max-h-[95dvh] sm:max-h-[88vh] rounded-t-3xl`}
          onClick={e => e.stopPropagation()}
        >
          {/* Шапка */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="FileText" size={16} className="text-gold-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-800 text-sm truncate">{doc.name}</p>
              <p className="text-[11px] text-muted-foreground">{doc.date} · Предпросмотр</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={handleCopy} className="h-8 px-3 rounded-xl text-xs font-medium text-navy-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-emerald-500" : ""} />
                <span className="hidden sm:inline">{copied ? "Скопировано" : "Копировать"}</span>
              </button>
              <button onClick={() => downloadDoc(doc.name, currentDocContent)} className="h-8 px-3 rounded-xl text-xs font-medium bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center gap-1.5">
                <Icon name="Download" size={13} />
                <span className="hidden sm:inline">Скачать .docx</span>
              </button>
              <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground hover:text-navy-700 transition-colors">
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>

          {/* Контент документа */}
          <ViewDocContent
            docDate={doc.date}
            docFlash={docFlash}
            currentDocContent={currentDocContent}
            prevDocContent={prevDocContent}
            contentRef={contentRef}
            docScrollRef={docScrollRef}
          />

          {/* Нижняя панель + модалка отчёта */}
          <ViewDocFooter
            docName={doc.name}
            currentDocContent={currentDocContent}
            sentToLawyer={sentToLawyer}
            sendingToLawyer={sendingToLawyer}
            showLawyerSuccess={showLawyerSuccess}
            onCloseLawyerSuccess={() => setShowLawyerSuccess(false)}
            recsAnalyzing={recsAnalyzing}
            hasRecs={hasRecs}
            liveRecs={liveRecs}
            showRecs={showRecs}
            reportOpen={reportOpen}
            reportText={reportText}
            reportLoading={reportLoading}
            reportSent={reportSent}
            onSendToLawyer={handleSendToLawyer}
            onAiEditorClick={handleAiEditorClick}
            onToggleRecs={() => setShowRecs(v => !v)}
            onClose={handleClose}
            onOpenReport={() => setReportOpen(true)}
            onCloseReport={handleCloseReport}
            onReportTextChange={setReportText}
            onSendReport={handleSendReport}
          />
        </div>
      </div>

      {/* ── Панель рекомендаций (снаружи оверлея!) ──────────── */}
      {showRecs && (
        <DocRecsPanel
          recommendations={liveRecs}
          docContent={currentDocContent}
          docId={doc.id}
          onClose={() => setShowRecs(false)}
          onPaymentRequired={() => {}}
        />
      )}

      {/* ── AI-чат помощник (снаружи оверлея!) ──────────────── */}
      {showAiChat && (
        <DocAiChatPanel
          doc={{ id: doc.id, name: doc.name, content: doc.content, recommendations: doc.recommendations }}
          onClose={() => setShowAiChat(false)}
          onPaymentRequired={() => {}}
          onDocUpdated={(newContent, prevContent) => {
            setPrevDocContent(prevContent);
            setCurrentDocContent(newContent);
            setDocFlash(true);
            setTimeout(() => setDocFlash(false), 5000);
          }}
          onScrollToChanges={() => {
            setTimeout(() => {
              const scrollContainer = contentRef.current;
              if (!scrollContainer) return;
              const el = scrollContainer.querySelector("[data-changed='1']");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              } else {
                const greenEl = scrollContainer.querySelector(".border-emerald-500");
                if (greenEl) {
                  greenEl.scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
                }
              }
            }, 350);
          }}
        />
      )}

      {/* ExpertMaxOfferModal (для случаев с pending action) */}
      {showExpertOffer && (
        <ExpertMaxOfferModal context="doc" onClose={() => setShowExpertOffer(false)} onSuccess={handleExpertOfferSuccess} />
      )}

      {/* Мягкое уведомление о необходимости повышения тарифа */}
      {upgradeFeature && (
        <UpgradeNoticeModal
          feature={upgradeFeature}
          onClose={() => setUpgradeFeature(null)}
          onViewPlans={() => {
            setUpgradeFeature(null);
            if (onOpenPlanModal) onOpenPlanModal();
            else setShowExpertOffer(true);
          }}
        />
      )}
    </>
  );
}