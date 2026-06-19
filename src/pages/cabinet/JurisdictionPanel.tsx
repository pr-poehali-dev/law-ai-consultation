import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getToken, consumeQuestion } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";
import type { Step1, Step2, CourtInfo, JurisdictionResult } from "./JurisdictionTypes";
import { determineJurisdiction } from "./JurisdictionTypes";
import JurisdictionStep1 from "./JurisdictionStep1";
import JurisdictionStep2 from "./JurisdictionStep2";
import JurisdictionResultView from "./JurisdictionResultView";

const COURT_FINDER_URL = (func2url as Record<string, string>)["court-finder"];

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export default function JurisdictionPanel({ onClose, onSendToChat }: Props) {
  const [step, setStep]           = useState(1);
  const [legalMode, setLegalMode] = useState(false);
  const [copied, setCopied]       = useState(false);

  const [s1, setS1] = useState<Step1>({ plaintiff: "individual", defendant: "individual", isBusiness: false });
  const [s2, setS2] = useState<Step2>({
    caseCategory: "general", defendantAddress: "", plaintiffAddress: "",
    isCyberFraud: false, unknownDefendant: false, hasBranch: false, branchAddress: "",
    hasContractPlace: false, contractPlace: "", hasContractualCourt: false, contractualCourt: "",
    realEstateAddress: "",
  });

  const [result, setResult]       = useState<JurisdictionResult | null>(null);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    consumeQuestion();
    setStep(3);
    const jr = determineJurisdiction(s1, s2);
    if (jr.error) { setResult(jr); return; }

    setSearching(true);
    setResult({ ...jr, court: null });

    const token = getToken();

    try {
      const res = await fetch(COURT_FINDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: JSON.stringify({
          defendant_address:   s2.defendantAddress,
          plaintiff_address:   s2.plaintiffAddress || "",
          court_type:          jr.courtType,
          case_category:       s2.caseCategory,
          jurisdiction_rule:   jr.rule,
          article:             jr.article,
          plaintiff_type:      s1.plaintiff,
          defendant_type:      s1.defendant,
          is_business:         s1.isBusiness,
          real_estate_address: s2.realEstateAddress || "",
        }),
      });

      const data = await res.json();

      const court: CourtInfo = data.name ? {
        name:    data.name,
        address: data.address || "",
        phone:   data.phone   || "",
        website: data.website || (jr.courtType === "arbitration" ? "https://arbitr.ru" : "https://sudrf.ru"),
        source:  data.source  || "DeepSeek",
      } : jr.court || {
        name:    "Уточните суд самостоятельно",
        address: "",
        phone:   "",
        website: jr.courtType === "arbitration" ? "https://arbitr.ru" : "https://sudrf.ru",
        source:  "справочник",
      };

      setResult({ ...jr, court });
    } catch {
      setResult({ ...jr, court: jr.court });
    } finally {
      setSearching(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const text = [
      "ОПРЕДЕЛЕНИЕ СУДА ДЛЯ ПОДАЧИ ИСКА",
      "",
      `Правило: ${result.rule}`,
      `Основание: ${legalMode ? result.articleFull : result.article}`,
      result.court ? [
        `Суд: ${result.court.name}`,
        result.court.address ? `Адрес: ${result.court.address}` : "",
        result.court.phone ? `Телефон: ${result.court.phone}` : "",
        `Сайт: ${result.court.website}`,
      ].filter(Boolean).join("\n") : "",
      "",
      result.alternatives?.length ? `Альтернативы:\n${result.alternatives.map(a => `• ${a}`).join("\n")}` : "",
      `\nДальнейшие шаги:\n${result.nextSteps.map(s => `✅ ${s}`).join("\n")}`,
      "\n⚠️ Носит справочный характер. Рекомендуется консультация с юристом.",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="MapPin" size={12} color="#fff" />
          </div>
          <p className="text-xs font-bold text-slate-800">Территориальная подсудность</p>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)" }}>Тестовый режим</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLegalMode(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all"
            style={legalMode
              ? { background: "rgba(15,76,129,0.1)", color: "#0f4c81", border: "1px solid rgba(15,76,129,0.2)" }
              : { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
            {legalMode ? "⚖️ Юридический" : "👤 Обычный"}
          </button>
          <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <Icon name="X" size={13} />
          </button>
        </div>
      </div>

      {/* Индикатор шагов */}
      <div className="flex items-center gap-0 px-4 pt-2.5 pb-1 shrink-0">
        {[1, 2, 3].map((n, i) => (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{
                  background: step > n ? "#059669" : step === n ? "#0f4c81" : "#e2e8f0",
                  color: step >= n ? "#fff" : "#94a3b8",
                }}>
                {step > n ? "✓" : n}
              </div>
              <p className="text-[8px] text-slate-400">{["Стороны", "Детали", "Результат"][i]}</p>
            </div>
            {i < 2 && <div className="flex-1 h-0.5 mb-3 mx-1" style={{ background: step > n ? "#059669" : "#e2e8f0" }} />}
          </div>
        ))}
      </div>

      {/* Тело */}
      <div className="overflow-y-auto px-4 py-2 space-y-2.5" style={{ maxHeight: "calc(68dvh - 80px)" }}>
        {step === 1 && (
          <JurisdictionStep1
            s1={s1}
            setS1={setS1}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <JurisdictionStep2
            s2={s2}
            setS2={setS2}
            onBack={() => setStep(1)}
            onSearch={runSearch}
          />
        )}

        {step === 3 && (
          <JurisdictionResultView
            result={result}
            searching={searching}
            legalMode={legalMode}
            copied={copied}
            s1={s1}
            onCopy={copyResult}
            onReset={() => { setStep(1); setResult(null); }}
            onSendToChat={onSendToChat}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
