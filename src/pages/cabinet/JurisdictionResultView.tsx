import Icon from "@/components/ui/icon";
import type { JurisdictionResult, Step1 } from "./JurisdictionTypes";

interface Props {
  result: JurisdictionResult | null;
  searching: boolean;
  legalMode: boolean;
  copied: boolean;
  s1: Step1;
  onCopy: () => void;
  onReset: () => void;
  onSendToChat: (text: string) => void;
  onClose: () => void;
}

export default function JurisdictionResultView({
  result, searching, legalMode, copied, s1, onCopy, onReset, onSendToChat, onClose,
}: Props) {
  return (
    <>
      {result?.error ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] text-red-700"
          style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
          <Icon name="AlertCircle" size={12} color="#ef4444" />{result.error}
        </div>
      ) : (
        <>
          {/* Правило */}
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <div className="px-3 py-2 flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.06),rgba(26,107,181,0.03))", borderBottom: "1px solid #f1f5f9" }}>
              <Icon name="BookOpen" size={11} color="#0f4c81" />
              <p className="text-[11px] font-bold text-slate-700">Правило подсудности</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-800">{result?.rule}</p>
              <p className="text-[11px] text-blue-700 mt-1 font-medium">{result?.article}</p>
              {legalMode && result?.articleFull && (
                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug italic">{result.articleFull}</p>
              )}
            </div>
          </div>

          {/* Альтернативы */}
          {result?.alternatives && result.alternatives.length > 0 && (
            <div className="rounded-xl border border-amber-200 overflow-hidden">
              <div className="px-3 py-1.5 flex items-center gap-1.5" style={{ background: "rgba(245,158,11,0.07)" }}>
                <Icon name="GitBranch" size={10} color="#d97706" />
                <p className="text-[11px] font-bold text-amber-800">Можно выбрать любой из вариантов:</p>
              </div>
              <div className="px-3 py-2 space-y-1">
                {result.alternatives.map((a, i) => (
                  <p key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "#fef3c7", color: "#d97706" }}>{i + 1}</span>
                    {a}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Блок: адрес неизвестен */}
          {result?.unknownAddress && (
            <div className="rounded-xl overflow-hidden border border-amber-200">
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(245,158,11,0.07)", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
                <Icon name="AlertCircle" size={11} color="#d97706" />
                <p className="text-[11px] font-bold text-amber-800">Адрес ответчика неизвестен</p>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {(s1.defendant === "org" || s1.defendant === "ip") ? (
                  <>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Для <strong>{s1.defendant === "org" ? "организации (ООО/АО)" : "ИП"}</strong> адрес регистрации можно найти в реестре ФНС — это бесплатно и занимает 1 минуту.
                    </p>
                    <a href="https://egrul.nalog.ru/index.html" target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg,#1a56db,#1e40af)", color: "#fff" }}>
                      <Icon name="Search" size={11} color="#fff" />
                      Найти адрес на сайте ФНС (egrul.nalog.ru)
                    </a>
                    <p className="text-[9px] text-slate-400 text-center">Введите ИНН, ОГРН или название — адрес будет в карточке</p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Адрес физлица установит суд по запросу в МВД/ФМС. Подайте иск по последнему известному адресу.
                  </p>
                )}
                <div className="h-px bg-slate-100" />
                <p className="text-[11px] font-semibold text-slate-700">Одновременно подайте ходатайство об истребовании сведений:</p>
                <button
                  onClick={() => {
                    const prompt = s1.defendant === "org"
                      ? `Составь ходатайство об истребовании сведений о юридическом адресе и месте нахождения организации-ответчика из ЕГРЮЛ ФНС России. Ответчик — ООО (организация). Ходатайство для приложения к исковому заявлению в районный суд.`
                      : s1.defendant === "ip"
                      ? `Составь ходатайство об истребовании сведений о месте регистрации ответчика-индивидуального предпринимателя из ЕГРИП ФНС России. Ходатайство для приложения к исковому заявлению.`
                      : `Составь ходатайство об истребовании сведений о месте жительства (регистрации) ответчика — физического лица — из органов МВД России (адресное бюро). Ходатайство для приложения к исковому заявлению в районный суд. Основание: ст. 29 ГПК РФ (подсудность по последнему известному месту жительства).`;
                    onSendToChat(prompt);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff" }}>
                  <Icon name="FileText" size={11} color="#fff" />
                  Составить ходатайство через AI-юриста
                </button>
              </div>
            </div>
          )}

          {/* Суд */}
          {!result?.unknownAddress && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <div className="px-3 py-2 flex items-center gap-1.5"
                style={{ background: "linear-gradient(135deg,rgba(5,150,105,0.06),rgba(4,120,87,0.03))", borderBottom: "1px solid #f1f5f9" }}>
                <Icon name="Landmark" size={11} color="#059669" />
                <p className="text-[11px] font-bold text-slate-700 flex-1">Суд</p>
                {searching && <span className="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />}
                {!searching && result?.court && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: "#dcfce7", color: "#166534" }}>
                    {result.court.source === "YandexGPT" ? "🤖 AI" : "📋 справочник"}
                  </span>
                )}
              </div>

              {searching && (
                <div className="px-3 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin shrink-0" />
                    <p className="text-[11px] text-slate-400">AI определяет суд по адресу ответчика...</p>
                  </div>
                  {[70, 50, 85].map((w, i) => (
                    <div key={i} className="h-2 rounded-full animate-pulse" style={{ width: `${w}%`, background: "#f1f5f9" }} />
                  ))}
                </div>
              )}

              {!searching && result?.court && (
                <div className="px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-800">{result.court.name}</p>
                  {result.court.address && (
                    <p className="text-[11px] text-slate-600 flex items-start gap-1">
                      <Icon name="MapPin" size={10} color="#94a3b8" className="shrink-0 mt-0.5" />
                      {result.court.address}
                    </p>
                  )}
                  {result.court.phone && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Icon name="Phone" size={10} color="#94a3b8" />
                      {result.court.phone}
                    </p>
                  )}
                  {result.court.website && (
                    <a href={result.court.website} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 flex items-center gap-1 hover:underline">
                      <Icon name="ExternalLink" size={10} color="#3b82f6" />
                      {result.court.source === "sudrf.ru" && result.court.website.includes("fs_text")
                        ? "Найти суд по адресу на sudrf.ru →"
                        : result.court.website}
                    </a>
                  )}
                </div>
              )}

              {!searching && !result?.court && (
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-slate-400">Уточните суд по адресу ответчика на сайте судебной системы</p>
                  <a href={s1.isBusiness ? "https://arbitr.ru" : "https://sudrf.ru"} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 flex items-center gap-1 mt-1 hover:underline">
                    <Icon name="ExternalLink" size={10} color="#3b82f6" />
                    {s1.isBusiness ? "arbitr.ru" : "sudrf.ru"}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Дальнейшие шаги */}
          {result?.nextSteps && result.nextSteps.length > 0 && (
            <div className="rounded-xl border border-slate-100 px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-bold text-slate-600 mb-1">Что делать дальше:</p>
              {result.nextSteps.map((s, i) => (
                <p key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                  <span className="text-emerald-500 shrink-0">✅</span>{s}
                </p>
              ))}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-1.5 flex-wrap pt-1">
            <button onClick={onCopy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={copied
                ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
              <Icon name={copied ? "CheckCheck" : "Copy"} size={10} color={copied ? "#059669" : "#64748b"} />
              {copied ? "Скопировано" : "Копировать"}
            </button>

            <button onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">
              <Icon name="RotateCcw" size={10} /> Заново
            </button>
          </div>
        </>
      )}

      {/* Дисклеймер */}
      <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
        <Icon name="AlertTriangle" size={11} color="#b45309" className="shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 leading-snug">
          Носит справочный характер. Для точного определения суда рекомендуется консультация с юристом.
        </p>
      </div>
    </>
  );
}
