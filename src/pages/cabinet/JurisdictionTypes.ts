export type PlaintiffType = "individual" | "ip" | "org";
export type DefendantType = "individual" | "ip" | "org";
export type CaseCategory =
  | "consumer"     | "labor"        | "children"    | "divorce"
  | "harm"         | "realestate"   | "inheritance"  | "ip_rights"
  | "general"      | "unknown";

export interface Step1 { plaintiff: PlaintiffType; defendant: DefendantType; isBusiness: boolean; }
export interface Step2 {
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

export interface CourtInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
  source: string;
}

export interface JurisdictionResult {
  rule: string;
  article: string;
  articleFull: string;
  courtType: string;
  searchQuery: string;
  court: CourtInfo | null;
  alternatives?: string[];
  nextSteps: string[];
  error?: string;
  unknownAddress?: boolean;
}

export const FALLBACK: Record<string, CourtInfo> = {
  "Арбитражный суд г. Москвы": { name: "Арбитражный суд г. Москвы", address: "115225, г. Москва, ул. Большая Тульская, д. 17", phone: "+7 (495) 600-97-00", website: "https://www.mos.arbitr.ru", source: "справочник" },
  "Арбитражный суд Московской области": { name: "Арбитражный суд Московской области", address: "107053, г. Москва, пр. Академика Сахарова, д. 18", phone: "+7 (495) 609-18-66", website: "https://mo.arbitr.ru", source: "справочник" },
  "Арбитражный суд г. Санкт-Петербурга и Ленинградской области": { name: "Арбитражный суд г. Санкт-Петербурга и Ленинградской области", address: "191015, г. Санкт-Петербург, Суворовский пр., д. 50/52", phone: "+7 (812) 274-72-57", website: "https://spb.arbitr.ru", source: "справочник" },
  "Суд по интеллектуальным правам": { name: "Суд по интеллектуальным правам", address: "127254, г. Москва, Огородный пр., д. 4, стр. 2", phone: "+7 (495) 982-62-93", website: "https://ipc.arbitr.ru", source: "справочник" },
  "Верховный Суд РФ": { name: "Верховный Суд Российской Федерации", address: "121260, г. Москва, ул. Поварская, д. 15", phone: "+7 (495) 690-42-11", website: "https://vsrf.ru", source: "справочник" },
};

export const CASE_CATEGORIES: { id: CaseCategory; label: string; icon: string }[] = [
  { id: "consumer",    label: "Купил некачественный товар/услугу",             icon: "ShoppingCart" },
  { id: "labor",       label: "Незаконное увольнение / невыплата зарплаты",    icon: "Briefcase" },
  { id: "children",    label: "Алименты, отцовство, место жительства ребёнка", icon: "Baby" },
  { id: "divorce",     label: "Развод (расторжение брака)",                    icon: "HeartCrack" },
  { id: "harm",        label: "Меня травмировали / причинили вред",            icon: "AlertTriangle" },
  { id: "realestate",  label: "Спор о квартире, доме, земле",                 icon: "Home" },
  { id: "inheritance", label: "Спор о наследстве",                             icon: "Scroll" },
  { id: "ip_rights",   label: "Патент, товарный знак, программа для ЭВМ",     icon: "Lightbulb" },
  { id: "general",     label: "Другое / общий спор",                           icon: "Scale" },
];

export function extractRegion(address: string): string {
  if (!address) return "";
  const m = address.match(/г\.?\s*([\wА-Яа-я-]+)|([А-Яа-я]+(?:ская|ский|ская|ное|ная)\s+(?:область|край|республика))/i);
  if (m) return (m[1] || m[2] || "").trim();
  const parts = address.split(",");
  return parts[0]?.trim() || address.substring(0, 30);
}

export function getCourtType(s1: Step1, caseCategory: CaseCategory): "arbitration" | "general" | "ip" {
  if (caseCategory === "ip_rights") return "ip";
  if (s1.plaintiff === "individual") return "general";
  if (s1.isBusiness && s1.plaintiff !== "individual" && s1.defendant !== "individual") return "arbitration";
  if (s1.plaintiff === "org" || (s1.plaintiff === "ip" && s1.isBusiness)) return "arbitration";
  return "general";
}

export function buildSearchQuery(courtName: string, courtType: string): string {
  const site = courtType === "arbitration" ? "site:arbitr.ru"
    : courtType === "ip" ? "site:ipc.arbitr.ru"
    : "site:sudrf.ru";
  return `${site} "${courtName}" адрес официальный сайт`;
}

export function parseCourtFromSearch(results: {title: string; url: string; snippet: string; source: string}[]): CourtInfo | null {
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

export function determineJurisdiction(s1: Step1, s2: Step2): JurisdictionResult {
  const ct = getCourtType(s1, s2.caseCategory);
  const region = extractRegion(s2.defendantAddress);

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
        `По адресу продавца/исполнителя: ${s2.defendantAddress || "—"}`,
        "По месту заключения/исполнения договора",
      ],
      nextSteps: ["Госпошлина не уплачивается при цене иска до 1 млн руб.", "Можно подать в суд по месту покупки (исполнения услуги)"],
    };
  }

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

  const addr = s2.defendantAddress;
  if (!addr.trim() || s2.unknownDefendant) {
    const isOrg = s1.defendant === "org" || s1.defendant === "ip";
    return {
      rule: "Адрес ответчика неизвестен",
      article: isOrg ? "ч. 2 ст. 29 ГПК РФ / ЕГРЮЛ / ЕГРИП" : "ст. 29 ГПК РФ",
      articleFull: isOrg
        ? "Адрес организации или ИП можно найти в ЕГРЮЛ/ЕГРИП на сайте ФНС. Иск подаётся по юридическому адресу из реестра."
        : "При неизвестности места жительства ответчика иск предъявляется по последнему известному месту его жительства или месту нахождения его имущества.",
      courtType: ct,
      searchQuery: "",
      court: null,
      unknownAddress: true,
      nextSteps: isOrg
        ? [
            "Найдите юридический адрес на сайте ФНС: egrul.nalog.ru",
            "Введите ИНН или название организации — адрес будет в карточке",
            "После получения адреса вернитесь и определите суд",
          ]
        : [
            "Подайте иск по последнему известному адресу ответчика",
            "Одновременно заявите ходатайство об истребовании сведений о месте регистрации",
            "Суд сделает запрос в органы МВД/ФМС и установит адрес ответчика",
          ],
    };
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
    courtName = region ? `районный суд ${region}` : "районный суд";
    article = "ст. 28 ГПК РФ";
    articleFull = "Статья 28 ГПК РФ: иск предъявляется в суд по месту жительства ответчика или по месту нахождения организации-ответчика.";
  }

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
