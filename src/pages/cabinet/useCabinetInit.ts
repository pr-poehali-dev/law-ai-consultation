import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getUserWithStatus,
  getUser,
  type User,
  startKeepAlive,
  invalidateUserCache,
  hasActiveSubscription,
} from "@/lib/auth";
import { PENDING_FILE_KEY } from "@/components/landingChatUtils";
import { findDocType } from "@/pages/cabinet/docBlocks";
import { savePendingAction, loadPendingAction, clearPendingAction } from "@/pages/cabinet/useCabinetPayment";

type Tab = "chat" | "docs" | "expert" | "business" | "history" | "profile" | "admin";

interface UseCabinetInitOptions {
  hasToken: boolean;
  setUser: (u: User) => void;
  setAuthChecked: (v: boolean) => void;
  setAuthTimeout: (v: boolean) => void;
  setTab: (t: Tab) => void;
  analyzeFileDirectly: (file: { name: string; b64: string }, comment: string) => void;
  setDocDetails: (v: string) => void;
  setDocPhase: (v: string) => void;
  docsGenerateRef: React.MutableRefObject<((dt: ReturnType<typeof findDocType>, details: string, files?: { name: string; b64: string }[]) => void) | null>;
  pollPaymentStatus: (invId: string, action: ReturnType<typeof loadPendingAction>) => void;
}

export function useCabinetInit({
  hasToken,
  setUser,
  setAuthChecked,
  setAuthTimeout,
  setTab,
  analyzeFileDirectly,
  setDocDetails,
  setDocPhase,
  docsGenerateRef,
  pollPaymentStatus,
}: UseCabinetInitOptions) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Poll payment on return from payment gateway
  useEffect(() => {
    const isSuccess = searchParams.get("payment") === "success";
    const invId = searchParams.get("inv_id");
    if (!isSuccess || !invId) return;
    setSearchParams({});
    const action = loadPendingAction();
    clearPendingAction();
    pollPaymentStatus(invId, action);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main auth + init effect
  useEffect(() => {
    if (!hasToken) {
      window.location.replace("/");
      return;
    }

    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("ref_code", ref);
    const tabParam = searchParams.get("tab") as Tab | null;
    if (tabParam && ["chat", "docs", "expert", "business", "history", "profile"].includes(tabParam)) {
      setTab(tabParam);
    }

    const timeoutId = setTimeout(() => setAuthTimeout(true), 20000);

    getUserWithStatus().then(({ user: u, unauthorized }) => {
      clearTimeout(timeoutId);
      setAuthChecked(true);
      if (!u) {
        if (unauthorized) {
          window.location.href = "/?login=1";
        } else {
          setAuthTimeout(true);
        }
        return;
      }
      setUser(u);

      // Подхватываем pending-файл с лендинга (анализ документа 99₽)
      const pendingFileRaw = localStorage.getItem(PENDING_FILE_KEY);
      if (pendingFileRaw) {
        localStorage.removeItem(PENDING_FILE_KEY);
        localStorage.removeItem("landing_pending_service");
        try {
          const { name, b64, comment } = JSON.parse(pendingFileRaw) as { name: string; b64: string; comment: string };
          if (name && b64) {
            setTab("chat");
            // Ждём начисления от вебхука ЮКассы — делаем ретраи до 35 сек
            const waitAndAnalyze = async () => {
              const MAX_WAIT_MS = 35_000;
              const RETRY_INTERVAL_MS = 2_000;
              const started = Date.now();
              while (Date.now() - started < MAX_WAIT_MS) {
                invalidateUserCache();
                const freshUser = await getUser();
                const canRun = freshUser && (
                  freshUser.isAdmin ||
                  hasActiveSubscription(freshUser, "consult") ||
                  freshUser.hasFileAnalysis ||
                  (freshUser.paidQuestions ?? 0) > 0
                );
                if (canRun) {
                  analyzeFileDirectly({ name, b64 }, comment || "");
                  return;
                }
                await new Promise(res => setTimeout(res, RETRY_INTERVAL_MS));
              }
              analyzeFileDirectly({ name, b64 }, comment || "");
            };
            setTimeout(waitAndAnalyze, 800);
          }
        } catch { /* ignore */ }
      }

      // Подхватываем контекст диалога с лендинга
      const pendingDocType = localStorage.getItem("landing_pending_doc");
      const pendingServiceType = localStorage.getItem("landing_pending_service");
      const pendingDocDetails = localStorage.getItem("landing_pending_doc_details");
      const pendingDocFilesRaw = localStorage.getItem("landing_pending_doc_files");
      const rawHist = localStorage.getItem("landing_chat_history");
      localStorage.removeItem("landing_chat_history");
      localStorage.removeItem("landing_pending_doc");
      localStorage.removeItem("landing_pending_service");
      localStorage.removeItem("landing_pending_doc_details");
      localStorage.removeItem("landing_pending_doc_files");

      if (pendingServiceType === "quick_questions") {
        setTab("chat");
      } else if (pendingDocType || rawHist) {
        try {
          // Приоритет: явные детали из DocDetailsModal, иначе — история чата
          let details: string;
          if (pendingDocDetails) {
            details = pendingDocDetails.slice(0, 3000);
          } else {
            const hist: { role: string; content: string }[] = rawHist ? JSON.parse(rawHist) : [];
            const userMsgs = hist.filter(m => m.role === "user").map(m => m.content).join("\n");
            details = userMsgs.slice(0, 2000);
          }

          // Файлы из DocDetailsModal
          let pendingFiles: { name: string; b64: string }[] | undefined;
          if (pendingDocFilesRaw) {
            try {
              pendingFiles = JSON.parse(pendingDocFilesRaw);
            } catch { /* ignore */ }
          }

          if (pendingDocType) {
            const dt = findDocType(pendingDocType);
            setTab("docs");
            setTimeout(() => {
              savePendingAction({ tab: "docs", docTypeId: dt.id, docDetails: details });
              docsGenerateRef.current?.(dt, details, pendingFiles);
            }, 800);
          } else if (details.trim()) {
            setTab("docs");
            setTimeout(() => {
              setDocDetails(details);
              setDocPhase("form");
            }, 600);
          }
        } catch { /* ignore */ }
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      invalidateUserCache();
      getUserWithStatus().then(({ user: u, unauthorized }) => {
        if (!u && unauthorized) {
          window.location.href = "/?login=1";
        } else if (u) {
          setUser(u);
        }
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const stopKeepAlive = startKeepAlive();
    return () => {
      stopKeepAlive();
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);
}