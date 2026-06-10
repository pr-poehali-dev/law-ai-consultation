import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const COURT_FINDER_URL = (func2url as Record<string, string>)["court-finder"];

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type PlaintiffType = "individual" | "ip" | "org";
type DefendantType = "individual" | "ip" | "org";
type CaseCategory =
  | "consumer"     | "labor"        | "children"    | "divorce"
  | "harm"         | "realestate"   | "inheritance"  | "ip_rights"
  | "general"      | "unknown";

interface Step1 { plaintiff: PlaintiffType; defendant: DefendantType; isBusiness: boolean; }
interface Step2 {
  caseCategory: CaseCategory;
  defendantAddress: string;
  plaintiffAddress: string;
  isCyberFraud: boolean;
  unknownDefendant: boolean;
  hasBranch: boolean;
  branchAddress: string;
  hasContractPlace: boolean;
  contractPlace: string;
  hasContractualCourt: boolean;
  contractualCourt: string;
  realEstateAddress: string;
}

interface CourtInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
  source: string;
}

interface JurisdictionResult {
  rule: string;
  article: string;
  articleFull: string;
  courtType: string;
  searchQuery: string;
  court: CourtInfo | null;
  alternatives?: string[];
  nextSteps: string[];
  error?: string;
}

// ── Fallback-справочник судов ────────────────────────────────────
const FALLBACK: Record<string, CourtInfo> = {
  "Арбитражный суд г. Москвы": { name: "Арбитражный суд г. Москвы", address: "115225, г. Москва, ул. Большая Тульская, д. 17", phone: "+7 (495) 600-97-00", website: "https://www.mos.arbitr.ru", source: "справочник" },
  "Арбитражный суд Московской области": { name: "Арбитражный суд Московской области", address: "107053, г. Москва, пр. Академика Сахарова, д. 18", phone: "+7 (495) 609-18-66", website: "https://mo.arbitr.ru", source: "справочник" },
  "Арбитражный суд г. Санкт-Петербурга и Ленинградской области": { name: "Арбитражный суд г. Санкт-Петербурга и Ленинградской области", address: "191015, г. Санкт-Петербург, Суворовский пр., д. 50/52", phone: "+7 (812) 274-72-57", website: "https://spb.arbitr.ru", source: "справочник" },
  "Суд по интеллектуальным правам": { name: "Суд по интеллектуальным правам", address: "127254, г. Москва, Огородный пр., д. 4, стр. 2", phone: "+7 (495) 982-62-93", website: "https://ipc.arbitr.ru", source: "справочник" },
  "Верховный Суд РФ": { name: "Верховный Суд Российской Федерации", address: "121260, г. Москва, ул. Поварская, д. 15", phone: "+7 (495) 690-42-11", website: "https://vsrf.ru", source: "справочник" },
};

// ── Вспомогательные функции ─────────────────────────────────────
function extractRegion(address: string): string {
  if (!address) return "";
  const m = address.match(/г\.?\s*([\wА-Яа-я-]+)|([А-Яа-я]+(?:ская|ский|ская|ное|ная)\s+(?:область|край|республика))/i);
  if (m) return (m[1] || m[2] || "").trim();
  const parts = address.split(",");
  return parts[0]?.trim() || address.substring(0, 30);
}

function getCourtType(s1: Step1, caseCategory: CaseCategory): "arbitration" | "general" | "ip" {
  if (caseCategory === "ip_rights") return "ip";
  if (s1.isBusiness && (s1.plaintiff !== "individual" || s1.defendant !== "individual")) return "arbitration";
  if (s1.plaintiff === "org" && s1.defendant === "org") return "arbitration";
  if ((s1.plaintiff === "ip" || s1.defendant === "ip") && s1.isBusiness) return "arbitration";
  return "general";
}

function buildSearchQuery(courtName: string, courtType: string): string {
  const site = courtType === "arbitration" ? "site:arbitr.ru"
    : courtType === "ip" ? "site:ipc.arbitr.ru"
    : "site:sudrf.ru";
  return `${site} "${courtName}" адрес официальный сайт`;
}

function parseCourtFromSearch(results: {title: string; url: string; snippet: string; source: string}[]): CourtInfo | null {
  if (!results?.length) return null;
  const r = results[0];
  const text = r.snippet || "";
  const addrM = text.match(/\d{6},?\s*[^\n,]{5,80}(?:,\s*д\.\s*\d+[^\n,]{0,30})?/i);
  const phoneM = text.match(/[+7(]\s*[\d()\\-\s]{10,}/);
  return {
    name: r.title || "",
    address: addrM?.[0]?.trim() || "",
    phone: phoneM?.[0]?.trim() || "",
    website: r.url || "",
    source: "Яндекс",
  };
}

// ── Логика подсудности ──────────────────────────────────────────
function determineJurisdiction(s1: Step1, s2: Step2): JurisdictionResult {
  const ct = getCourtType(s1, s2.caseCategory);
  const region = extractRegion(s2.defendantAddress);

  // Исключительная — недвижимость
  if (s2.caseCategory === "realestate") {
    const addr = s2.realEstateAddress || s2.defendantAddress;
    const r2 = extractRegion(addr);
    return {
      rule: "Исключительная подсудность — по адресу недвижимости",
      article: "ст. 30 ГПК РФ",
      articleFull: "Статья 30 ГПК РФ: иски о правах на недвижимость предъявляются по месту нахождения этого объекта.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${r2}`, "general"),
      court: null,
      nextSteps: ["Подайте иск в районный суд по адресу недвижимости", "Уточните конкретный суд по адресу объекта на сайте sudrf.ru"],
    };
  }

  // Исключительная — наследство
  if (s2.caseCategory === "inheritance") {
    return {
      rule: "Исключительная подсудность — по месту открытия наследства",
      article: "ст. 30 ГПК РФ",
      articleFull: "Статья 30 ГПК РФ: кредиторы наследодателя вправе предъявить иски по месту открытия наследства.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${region}`, "general"),
      court: null,
      nextSteps: ["Подайте иск по месту открытия наследства (последнее место жительства наследодателя)"],
    };
  }

  // ИС — Суд по интеллектуальным правам
  if (s2.caseCategory === "ip_rights") {
    return {
      rule: "Специальная подсудность — Суд по интеллектуальным правам",
      article: "ч. 4 ст. 34 АПК РФ",
      articleFull: "Суд по интеллектуальным правам рассматривает споры о патентах, товарных знаках, программах для ЭВМ.",
      courtType: "ip",
      searchQuery: `site:ipc.arbitr.ru Суд по интеллектуальным правам адрес`,
      court: FALLBACK["Суд по интеллектуальным правам"],
      nextSteps: ["Подайте иск в Суд по интеллектуальным правам (г. Москва)", "Уточните требования к форме искового заявления на ipc.arbitr.ru"],
    };
  }

  // Договорная подсудность
  if (s2.hasContractualCourt && s2.contractualCourt) {
    return {
      rule: `Договорная подсудность — по условию договора: ${s2.contractualCourt}`,
      article: "ст. 32 ГПК РФ / ст. 37 АПК РФ",
      articleFull: "Стороны вправе по соглашению изменить территориальную подсудность до принятия дела к производству судом.",
      courtType: ct,
      searchQuery: buildSearchQuery(s2.contractualCourt, ct),
      court: null,
      nextSteps: ["Подайте иск в суд, указанный в договоре", "Проверьте, что договорная подсудность не противоречит исключительной"],
    };
  }

  // Кибермошенничество
  if (s2.isCyberFraud) {
    return {
      rule: "Альтернативная подсудность — по выбору истца (кибермошенничество)",
      article: "ч. 6.1 ст. 29 ГПК РФ",
      articleFull: "По делам о мошенничестве с использованием интернета/телефона истец вправе подать иск по своему месту жительства.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${extractRegion(s2.plaintiffAddress)}`, "general"),
      court: null,
      alternatives: ["По вашему адресу", "По адресу ответчика", "По месту расследования уголовного дела"],
      nextSteps: ["Выберите удобный для вас суд из перечисленных вариантов", "Подайте заявление вместе с заявлением о возбуждении уголовного дела"],
    };
  }

  // Альтернативная — потребитель
  if (s2.caseCategory === "consumer") {
    return {
      rule: "Альтернативная подсудность — потребитель выбирает суд",
      article: "ч. 7 ст. 29 ГПК РФ / ст. 17 ЗоЗПП",
      articleFull: "Иски о защите прав потребителей предъявляются по месту жительства истца, по месту нахождения ответчика или по месту заключения/исполнения договора.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${extractRegion(s2.plaintiffAddress || s2.defendantAddress)}`, "general"),
      court: null,
      alternatives: [
        `По вашему адресу: ${s2.plaintiffAddress || "укажите адрес"}`,
        `По адресу ответчика: ${s2.defendantAddress || "укажите адрес"}`,
        `По месту покупки/исполнения договора`,
      ],
      nextSteps: ["Выберите любой из трёх вариантов суда", "Госпошлина для потребителей до 1 млн руб. — 0 рублей"],
    };
  }

  // Альтернативная — трудовые споры
  if (s2.caseCategory === "labor") {
    return {
      rule: "Альтернативная подсудность — трудовые споры",
      article: "ч. 6 ст. 29 ГПК РФ",
      articleFull: "Иски, вытекающие из трудовых правоотношений, могут предъявляться по месту жительства истца.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${extractRegion(s2.plaintiffAddress || s2.defendantAddress)}`, "general"),
      court: null,
      alternatives: [`По вашему адресу: ${s2.plaintiffAddress || "—"}`, `По адресу работодателя: ${s2.defendantAddress || "—"}`],
      nextSteps: ["Госпошлина по трудовым спорам — 0 рублей", "Срок обращения в суд — 1 месяц (увольнение), 1 год (зарплата)"],
    };
  }

  // Альтернативная — дети / алименты
  if (s2.caseCategory === "children") {
    return {
      rule: "Альтернативная подсудность — споры о детях и алиментах",
      article: "ч. 3–4 ст. 29 ГПК РФ",
      articleFull: "Иски о взыскании алиментов и установлении отцовства могут предъявляться по месту жительства истца.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${extractRegion(s2.plaintiffAddress || s2.defendantAddress)}`, "general"),
      court: null,
      alternatives: [`По вашему адресу: ${s2.plaintiffAddress || "—"}`, `По адресу ответчика: ${s2.defendantAddress || "—"}`],
      nextSteps: ["Госпошлина по алиментам — 0 рублей", "Иск об определении места жительства ребёнка — по адресу ребёнка"],
    };
  }

  // Альтернативная — развод
  if (s2.caseCategory === "divorce") {
    return {
      rule: "Альтернативная подсудность — расторжение брака",
      article: "ч. 4 ст. 29 ГПК РФ",
      articleFull: "Иски о расторжении брака могут предъявляться по месту жительства истца при наличии несовершеннолетних детей или по состоянию здоровья.",
      courtType: "general",
      searchQuery: buildSearchQuery(`мировой суд ${extractRegion(s2.plaintiffAddress || s2.defendantAddress)}`, "general"),
      court: null,
      alternatives: [`По вашему адресу: ${s2.plaintiffAddress || "—"}`, `По адресу ответчика: ${s2.defendantAddress || "—"}`],
      nextSteps: ["Без детей и имущества — мировой судья", "С детьми или разделом имущества от 50 тыс. руб. — районный суд"],
    };
  }

  // Альтернативная — причинение вреда
  if (s2.caseCategory === "harm") {
    return {
      rule: "Альтернативная подсудность — возмещение вреда",
      article: "ч. 5 ст. 29 ГПК РФ",
      articleFull: "Иски о возмещении вреда, причинённого жизни или здоровью, могут предъявляться по месту жительства истца или по месту причинения вреда.",
      courtType: "general",
      searchQuery: buildSearchQuery(`районный суд ${extractRegion(s2.plaintiffAddress || s2.defendantAddress)}`, "general"),
      court: null,
      alternatives: [`По вашему адресу: ${s2.plaintiffAddress || "—"}`, `По адресу ответчика: ${s2.defendantAddress || "—"}`, "По месту причинения вреда"],
      nextSteps: ["Исковое заявление о возмещении вреда здоровью — районный суд", "Госпошлина не уплачивается при вреде жизни/здоровью"],
    };
  }

  // Общее правило
  const addr = s2.defendantAddress;
  if (!addr.trim()) {
    return { rule: "", article: "", articleFull: "", courtType: ct, searchQuery: "", court: null, nextSteps: [], error: "Укажите адрес ответчика для определения суда" };
  }

  let courtName: string;
  let article: string;
  let articleFull: string;

  if (ct === "arbitration") {
    const isRegionMoscow = /москв/i.test(region);
    courtName = isRegionMoscow ? "Арбитражный суд г. Москвы" : `Арбитражный суд ${region}`;
    article = "ст. 35 АПК РФ";
    articleFull = "Статья 35 АПК РФ: иск предъявляется в арбитражный суд субъекта РФ по месту нахождения или месту жительства ответчика.";
  } else {
    // Для судов общей юрисдикции — строим запрос по полному адресу ответчика
    // чтобы Яндекс нашёл конкретный районный/городской суд
    courtName = region ? `районный суд ${region}` : "районный суд";
    article = "ст. 28 ГПК РФ";
    articleFull = "Статья 28 ГПК РФ: иск предъявляется в суд по месту жительства ответчика или по месту нахождения организации-ответчика.";
  }

  // Для судов общей юрисдикции используем полный адрес для точного поиска
  const searchQuery = ct === "general"
    ? `site:sudrf.ru районный суд "${addr}" адрес официальный сайт`
    : buildSearchQuery(courtName, ct);

  return {
    rule: "Общее правило — по адресу ответчика",
    article,
    articleFull,
    courtType: ct,
    searchQuery,
    court: FALLBACK[courtName] || null,
    nextSteps: ct === "arbitration"
      ? ["Подайте иск в арбитражный суд субъекта РФ по адресу ответчика", "Найдите конкретный суд на сайте arbitr.ru"]
      : [
          `Найдите суд по адресу ответчика: ${addr}`,
          "Определите конкретный районный/городской суд на сайте sudrf.ru",
          "Введите адрес в строку поиска на сайте вашего региона",
        ],
  };
}

// ── Компонент ───────────────────────────────────────────────────
export default function JurisdictionPanel({ onClose, onSendToChat }: Props) {
  const [step, setStep]       = useState(1);
  const [legalMode, setLegalMode] = useState(false);
  const [copied, setCopied]   = useState(false);

  const [s1, setS1] = useState<Step1>({ plaintiff: "individual", defendant: "individual", isBusiness: false });
  const [s2, setS2] = useState<Step2>({
    caseCategory: "general", defendantAddress: "", plaintiffAddress: "",
    isCyberFraud: false, unknownDefendant: false, hasBranch: false, branchAddress: "",
    hasContractPlace: false, contractPlace: "", hasContractualCourt: false, contractualCourt: "",
    realEstateAddress: "",
  });

  const [result, setResult]   = useState<JurisdictionResult | null>(null);
  const [searching, setSearching] = useState(false);

  const CASE_CATEGORIES: { id: CaseCategory; label: string; icon: string }[] = [
    { id: "consumer",   label: "Купил некачественный товар/услугу",    icon: "ShoppingCart" },
    { id: "labor",      label: "Незаконное увольнение / невыплата зарплаты", icon: "Briefcase" },
    { id: "children",   label: "Алименты, отцовство, место жительства ребёнка", icon: "Baby" },
    { id: "divorce",    label: "Развод (расторжение брака)",            icon: "HeartCrack" },
    { id: "harm",       label: "Меня травмировали / причинили вред",    icon: "AlertTriangle" },
    { id: "realestate", label: "Спор о квартире, доме, земле",          icon: "Home" },
    { id: "inheritance",label: "Спор о наследстве",                     icon: "Scroll" },
    { id: "ip_rights",  label: "Патент, товарный знак, программа для ЭВМ", icon: "Lightbulb" },
    { id: "general",    label: "Другое / общий спор",                   icon: "Scale" },
  ];

  const runSearch = async () => {
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
          defendant_address: s2.defendantAddress,
          plaintiff_address: s2.plaintiffAddress || "",
          court_type:        jr.courtType,
          case_category:     s2.caseCategory,
          jurisdiction_rule: jr.rule,
          article:           jr.article,
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

  const sendToChat = () => {
    if (!result) return;
    const parts = [`📍 Территориальная подсудность по моему делу:\n`];
    parts.push(`• Правило: ${result.rule}`);
    parts.push(`• Основание: ${result.article}`);
    if (result.court) {
      parts.push(`• Суд: ${result.court.name}`);
      if (result.court.address) parts.push(`• Адрес: ${result.court.address}`);
    }
    if (result.alternatives?.length) parts.push(`\nМожно также подать:\n${result.alternatives.map(a => `• ${a}`).join("\n")}`);
    parts.push(`\nПрокомментируй и уточни детали по моей ситуации.`);
    onSendToChat(parts.join("\n"));
    onClose();
  };

  // ── Render helpers ──────────────────────────────────────────
  const RadioGroup = ({ options, value, onChange }: { options: {id: string; label: string}[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex flex-col gap-2 mt-1">
      {options.map(o => (
        <label key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-[11px]"
          style={value === o.id ? { background: "rgba(15,76,129,0.08)", border: "1px solid rgba(15,76,129,0.25)", color: "#0f4c81", fontWeight: 600 } : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>
          <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
            style={{ borderColor: value === o.id ? "#0f4c81" : "#cbd5e1" }}>
            {value === o.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-800" />}
          </span>
          {o.label}
        </label>
      ))}
    </div>
  );

  const CheckRow = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none">
      <span className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
        style={{ borderColor: checked ? "#0f4c81" : "#cbd5e1", background: checked ? "#0f4c81" : "white" }}
        onClick={() => onChange(!checked)}>
        {checked && <Icon name="Check" size={9} color="#fff" />}
      </span>
      {label}
    </label>
  );

  const stepColors = ["#0f4c81", "#1a6bb5", "#059669"];

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
        </div>
        <div className="flex items-center gap-2">
          {/* Переключатель режима */}
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

        {/* ── ШАГ 1 ── */}
        {step === 1 && (
          <>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(15,76,129,0.04)" }}>
                <Icon name="User" size={11} color="#0f4c81" />
                <p className="text-[10px] font-bold text-slate-700">Кто подаёт иск (истец)?</p>
              </div>
              <div className="px-3 py-2">
                <RadioGroup value={s1.plaintiff} onChange={v => setS1(p => ({ ...p, plaintiff: v as PlaintiffType }))} options={[
                  { id: "individual", label: "Физическое лицо (обычный человек)" },
                  { id: "ip",         label: "ИП или самозанятый" },
                  { id: "org",        label: "Организация (ООО, АО и т.д.)" },
                ]} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(15,76,129,0.04)" }}>
                <Icon name="UserX" size={11} color="#0f4c81" />
                <p className="text-[10px] font-bold text-slate-700">На кого подаётся иск (ответчик)?</p>
              </div>
              <div className="px-3 py-2">
                <RadioGroup value={s1.defendant} onChange={v => setS1(p => ({ ...p, defendant: v as DefendantType }))} options={[
                  { id: "individual", label: "Физическое лицо (обычный человек)" },
                  { id: "ip",         label: "ИП или самозанятый" },
                  { id: "org",        label: "Организация (ООО, АО и т.д.)" },
                ]} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(15,76,129,0.04)" }}>
                <Icon name="Briefcase" size={11} color="#0f4c81" />
                <p className="text-[10px] font-bold text-slate-700">Это предпринимательский/бизнес-спор?</p>
                <span className="text-[9px] text-slate-400 ml-1">(определяет суд: арбитражный или общей юрисдикции)</span>
              </div>
              <div className="px-3 py-2">
                <RadioGroup value={s1.isBusiness ? "yes" : "no"} onChange={v => setS1(p => ({ ...p, isBusiness: v === "yes" }))} options={[
                  { id: "no",  label: "Нет — личный, бытовой, семейный спор" },
                  { id: "yes", label: "Да — связан с предпринимательской деятельностью" },
                ]} />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white active:scale-95"
                style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                Далее <Icon name="ChevronRight" size={13} color="#fff" />
              </button>
            </div>
          </>
        )}

        {/* ── ШАГ 2 ── */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                <Icon name="Home" size={10} color="#64748b" /> Адрес ответчика
                <span className="text-[9px] text-slate-400 font-normal">(где живёт или находится организация)</span>
              </p>
              <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all"
                placeholder="г. Москва, ул. Тверская, д. 1"
                value={s2.defendantAddress}
                onChange={e => setS2(p => ({ ...p, defendantAddress: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                <Icon name="MapPin" size={10} color="#64748b" /> Ваш адрес (истца)
                <span className="text-[9px] text-slate-400 font-normal">(для льготных категорий)</span>
              </p>
              <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all"
                placeholder="г. Санкт-Петербург, Невский пр., д. 10"
                value={s2.plaintiffAddress}
                onChange={e => setS2(p => ({ ...p, plaintiffAddress: e.target.value }))} />
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-3 py-2" style={{ background: "rgba(15,76,129,0.04)" }}>
                <p className="text-[10px] font-bold text-slate-700">О чём спор?</p>
              </div>
              <div className="px-3 py-2 grid grid-cols-1 gap-1.5">
                {CASE_CATEGORIES.map(c => (
                  <label key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all text-[10px]"
                    style={s2.caseCategory === c.id
                      ? { background: "rgba(15,76,129,0.08)", border: "1px solid rgba(15,76,129,0.25)", color: "#0f4c81", fontWeight: 600 }
                      : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>
                    <span className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: s2.caseCategory === c.id ? "#0f4c81" : "#cbd5e1" }}>
                      {s2.caseCategory === c.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-800" />}
                    </span>
                    <Icon name={c.icon as Parameters<typeof Icon>[0]["name"]} size={10} color={s2.caseCategory === c.id ? "#0f4c81" : "#94a3b8"} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Особые условия */}
            <div className="rounded-xl border border-slate-100 px-3 py-2.5 space-y-2">
              <p className="text-[10px] font-bold text-slate-600 mb-1">Дополнительные условия:</p>
              <CheckRow checked={s2.isCyberFraud} onChange={v => setS2(p => ({ ...p, isCyberFraud: v }))}
                label="Пострадал от телефонных/интернет-мошенников" />
              <CheckRow checked={s2.unknownDefendant} onChange={v => setS2(p => ({ ...p, unknownDefendant: v }))}
                label="Не знаю точный адрес ответчика" />
              <CheckRow checked={s2.hasContractualCourt} onChange={v => setS2(p => ({ ...p, hasContractualCourt: v }))}
                label="В договоре указан конкретный суд для споров" />
              {s2.hasContractualCourt && (
                <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 mt-1"
                  placeholder="Название суда из договора"
                  value={s2.contractualCourt}
                  onChange={e => setS2(p => ({ ...p, contractualCourt: e.target.value }))} />
              )}
              {s2.caseCategory === "realestate" && (
                <div className="mt-1">
                  <p className="text-[10px] text-slate-500 mb-1">Адрес спорной недвижимости:</p>
                  <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400"
                    placeholder="г. Краснодар, ул. Красная, д. 10, кв. 5"
                    value={s2.realEstateAddress}
                    onChange={e => setS2(p => ({ ...p, realEstateAddress: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
                <Icon name="ChevronLeft" size={13} /> Назад
              </button>
              <button onClick={runSearch}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white active:scale-95"
                style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                <Icon name="Search" size={13} color="#fff" /> Определить суд
              </button>
            </div>
          </>
        )}

        {/* ── ШАГ 3: РЕЗУЛЬТАТ ── */}
        {step === 3 && (
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
                    <p className="text-[10px] font-bold text-slate-700">Правило подсудности</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-800">{result?.rule}</p>
                    <p className="text-[10px] text-blue-700 mt-1 font-medium">{result?.article}</p>
                    {legalMode && result?.articleFull && (
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-snug italic">{result.articleFull}</p>
                    )}
                  </div>
                </div>

                {/* Альтернативы */}
                {result?.alternatives && result.alternatives.length > 0 && (
                  <div className="rounded-xl border border-amber-200 overflow-hidden">
                    <div className="px-3 py-1.5 flex items-center gap-1.5" style={{ background: "rgba(245,158,11,0.07)" }}>
                      <Icon name="GitBranch" size={10} color="#d97706" />
                      <p className="text-[10px] font-bold text-amber-800">Можно выбрать любой из вариантов:</p>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {result.alternatives.map((a, i) => (
                        <p key={i} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                          <span className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "#fef3c7", color: "#d97706" }}>{i + 1}</span>
                          {a}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Суд */}
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <div className="px-3 py-2 flex items-center gap-1.5"
                    style={{ background: "linear-gradient(135deg,rgba(5,150,105,0.06),rgba(4,120,87,0.03))", borderBottom: "1px solid #f1f5f9" }}>
                    <Icon name="Landmark" size={11} color="#059669" />
                    <p className="text-[10px] font-bold text-slate-700 flex-1">Суд</p>
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
                        <p className="text-[10px] text-slate-600 flex items-start gap-1">
                          <Icon name="MapPin" size={10} color="#94a3b8" className="shrink-0 mt-0.5" />
                          {result.court.address}
                        </p>
                      )}
                      {result.court.phone && (
                        <p className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Icon name="Phone" size={10} color="#94a3b8" />
                          {result.court.phone}
                        </p>
                      )}
                      {result.court.website && (
                        <a href={result.court.website} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-600 flex items-center gap-1 hover:underline">
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
                      <p className="text-[10px] text-slate-400">Уточните суд по адресу ответчика на сайте судебной системы</p>
                      <a href={s1.isBusiness ? "https://arbitr.ru" : "https://sudrf.ru"} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 flex items-center gap-1 mt-1 hover:underline">
                        <Icon name="ExternalLink" size={10} color="#3b82f6" />
                        {s1.isBusiness ? "arbitr.ru" : "sudrf.ru"}
                      </a>
                    </div>
                  )}
                </div>

                {/* Дальнейшие шаги */}
                {result?.nextSteps && result.nextSteps.length > 0 && (
                  <div className="rounded-xl border border-slate-100 px-3 py-2.5 space-y-1">
                    <p className="text-[10px] font-bold text-slate-600 mb-1">Что делать дальше:</p>
                    {result.nextSteps.map((s, i) => (
                      <p key={i} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                        <span className="text-emerald-500 shrink-0">✅</span>{s}
                      </p>
                    ))}
                  </div>
                )}

                {/* Кнопки */}
                <div className="flex gap-1.5 flex-wrap pt-1">
                  <button onClick={copyResult}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
                    style={copied
                      ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }
                      : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                    <Icon name={copied ? "CheckCheck" : "Copy"} size={10} color={copied ? "#059669" : "#64748b"} />
                    {copied ? "Скопировано" : "Копировать"}
                  </button>
                  <button onClick={sendToChat}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-white transition-all"
                    style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                    <Icon name="Send" size={10} color="#fff" /> В чат AI-юристу
                  </button>
                  <button onClick={() => { setStep(1); setResult(null); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <Icon name="RotateCcw" size={10} /> Заново
                  </button>
                </div>
              </>
            )}

            {/* Дисклеймер */}
            <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <Icon name="AlertTriangle" size={11} color="#b45309" className="shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-snug">
                Носит справочный характер. Для точного определения суда рекомендуется консультация с юристом.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}