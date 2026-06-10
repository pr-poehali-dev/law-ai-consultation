import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Ставки имущественных требований ─────────────────────────────────────────

interface RateRow {
  min: number;
  max: number;
  base: number;
  percent: number;
  percentOf: number;
  maxFee?: number;
}

const GP_PROPERTY_RATES: RateRow[] = [
  { min: 0,         max: 100000,    base: 4000,   percent: 0,    percentOf: 0 },
  { min: 100001,    max: 300000,    base: 4000,   percent: 3,    percentOf: 100000 },
  { min: 300001,    max: 500000,    base: 10000,  percent: 2.5,  percentOf: 300000 },
  { min: 500001,    max: 1000000,   base: 15000,  percent: 2,    percentOf: 500000 },
  { min: 1000001,   max: 3000000,   base: 25000,  percent: 1,    percentOf: 1000000 },
  { min: 3000001,   max: 8000000,   base: 45000,  percent: 0.7,  percentOf: 3000000 },
  { min: 8000001,   max: 24000000,  base: 80000,  percent: 0.35, percentOf: 8000000 },
  { min: 24000001,  max: 50000000,  base: 136000, percent: 0.3,  percentOf: 24000000 },
  { min: 50000001,  max: 100000000, base: 214000, percent: 0.2,  percentOf: 50000000 },
  { min: 100000001, max: Infinity,  base: 314000, percent: 0.15, percentOf: 100000000, maxFee: 900000 },
];

const AP_PROPERTY_RATES: RateRow[] = [
  { min: 0,        max: 100000,   base: 10000,  percent: 0,   percentOf: 0 },
  { min: 100001,   max: 1000000,  base: 10000,  percent: 5,   percentOf: 100000 },
  { min: 1000001,  max: 10000000, base: 55000,  percent: 3,   percentOf: 1000000 },
  { min: 10000001, max: 50000000, base: 325000, percent: 1,   percentOf: 10000000 },
  { min: 50000001, max: Infinity, base: 725000, percent: 0.5, percentOf: 50000000, maxFee: 10000000 },
];

// ─── Категории неимущественных требований ────────────────────────────────────

interface NonpropItem {
  key: string;
  label: string;
  fee: number | "order" | "order_min8000";
}

// GP + individual
const GP_IND_CATS: NonpropItem[] = [
  { key: "order",               label: "Заявление о выдаче судебного приказа (50% от имущественной пошлины)", fee: "order" },
  { key: "nonproperty_claim",   label: "Исковое заявление неимущественного характера / имущественного, не подлежащего оценке", fee: 3000 },
  { key: "void_deal",           label: "Исковое заявление о признании сделки недействительной (без реституции)", fee: 3000 },
  { key: "divorce",             label: "Исковое заявление о расторжении брака", fee: 5000 },
  { key: "normative_act",       label: "Оспаривание нормативных/ненормативных актов Президента, Правительства, нормативных актов госорганов", fee: 4000 },
  { key: "nonnormative_act",    label: "Признание ненормативного акта недействительным, действий незаконными", fee: 3000 },
  { key: "special_prod",        label: "Заявление по делам особого производства", fee: 3000 },
  { key: "succession",          label: "Заявление о правопреемстве", fee: 2000 },
  { key: "il_duplicate",        label: "Выдача дубликата ИЛ, пересмотр заочного решения", fee: 1500 },
  { key: "enforcement",         label: "Восстановление срока для ИЛ, отсрочка/рассрочка, поворот, разъяснение", fee: 3000 },
  { key: "new_circumstances",   label: "Пересмотр по новым/вновь открывшимся обстоятельствам", fee: 10000 },
  { key: "interim",             label: "Заявление об обеспечении иска", fee: 10000 },
  { key: "alimony_child",       label: "Взыскание алиментов на детей (+ на содержание истца — опционально)", fee: 150 },
  { key: "compensation_delay",  label: "Компенсация за нарушение права на судопроизводство в разумный срок", fee: 300 },
  { key: "compensation_detention", label: "Компенсация за нарушение условий содержания под стражей", fee: 300 },
  { key: "appeal",              label: "Апелляционная жалоба, частная жалоба, кассационная жалоба на судебный приказ", fee: 3000 },
  { key: "cassation",           label: "Кассационная жалоба (кроме ВС РФ)", fee: 5000 },
  { key: "cassation_vs",        label: "Кассационная/надзорная жалоба в ВС РФ, жалоба на отказ", fee: 7000 },
];

// GP + org
const GP_ORG_CATS: NonpropItem[] = [
  { key: "order",              label: "Заявление о выдаче судебного приказа (50% от имущественной пошлины)", fee: "order" },
  { key: "nonproperty_claim",  label: "Исковое заявление неимущественного характера / имущественного, не подлежащего оценке", fee: 20000 },
  { key: "void_deal",          label: "Исковое заявление о признании сделки недействительной (без реституции)", fee: 20000 },
  { key: "normative_act",      label: "Оспаривание нормативных/ненормативных актов Президента, Правительства, нормативных актов госорганов", fee: 20000 },
  { key: "nonnormative_act",   label: "Признание ненормативного акта недействительным, действий незаконными", fee: 15000 },
  { key: "succession",         label: "Заявление о правопреемстве", fee: 15000 },
  { key: "compensation_delay", label: "Компенсация за нарушение права на судопроизводство в разумный срок", fee: 6000 },
  { key: "appeal",             label: "Апелляционная жалоба, частная жалоба, кассационная жалоба на судебный приказ", fee: 15000 },
  { key: "cassation",          label: "Кассационная жалоба (кроме ВС РФ)", fee: 20000 },
  { key: "cassation_vs",       label: "Кассационная/надзорная жалоба в ВС РФ, жалоба на отказ", fee: 25000 },
];

// AP + individual
const AP_IND_CATS: NonpropItem[] = [
  { key: "order",                label: "Заявление о выдаче судебного приказа (50% от имущественной пошлины, мин. 8 000 руб.)", fee: "order_min8000" },
  { key: "nonproperty_claim",    label: "Исковое заявление неимущественного характера / имущественного, не подлежащего оценке", fee: 15000 },
  { key: "void_deal",            label: "Исковое заявление о признании сделки недействительной (без реституции)", fee: 15000 },
  { key: "ip_normative",         label: "Оспаривание нормативных/разъяснительных актов в сфере ИС", fee: 10000 },
  { key: "nonnormative_act",     label: "Признание ненормативного акта недействительным, действий незаконными", fee: 10000 },
  { key: "bankruptcy_creditor",  label: "Банкротство — кредитор", fee: 10000 },
  { key: "bankruptcy_debtor",    label: "Банкротство — должник", fee: 0 },
  { key: "facts",                label: "Установление фактов", fee: 30000 },
  { key: "succession",           label: "Заявление о правопреемстве", fee: 5000 },
  { key: "il_duplicate",         label: "Выдача дубликата ИЛ, пересмотр заочного решения", fee: 10000 },
  { key: "new_circumstances",    label: "Пересмотр по новым/вновь открывшимся обстоятельствам", fee: 30000 },
  { key: "interim",              label: "Заявление об обеспечении иска", fee: 30000 },
  { key: "compensation_delay",   label: "Компенсация за нарушение права на судопроизводство в разумный срок", fee: 300 },
  { key: "appeal",               label: "Апелляционная жалоба", fee: 10000 },
  { key: "cassation",            label: "Кассационная жалоба (кроме ВС РФ)", fee: 20000 },
  { key: "cassation_vs",         label: "Кассационная/надзорная жалоба в ВС РФ", fee: 30000 },
];

// AP + org
const AP_ORG_CATS: NonpropItem[] = [
  { key: "order",               label: "Заявление о выдаче судебного приказа (50% от имущественной пошлины, мин. 8 000 руб.)", fee: "order_min8000" },
  { key: "nonproperty_claim",   label: "Исковое заявление неимущественного характера / имущественного, не подлежащего оценке", fee: 50000 },
  { key: "void_deal",           label: "Исковое заявление о признании сделки недействительной (без реституции)", fee: 50000 },
  { key: "ip_normative",        label: "Оспаривание нормативных/разъяснительных актов в сфере ИС", fee: 60000 },
  { key: "nonnormative_act",    label: "Признание ненормативного акта недействительным, действий незаконными", fee: 50000 },
  { key: "bankruptcy_creditor", label: "Банкротство — кредитор", fee: 100000 },
  { key: "bankruptcy_debtor",   label: "Банкротство — должник", fee: 0 },
  { key: "succession",          label: "Заявление о правопреемстве", fee: 25000 },
  { key: "compensation_delay",  label: "Компенсация за нарушение права на судопроизводство в разумный срок", fee: 6000 },
  { key: "appeal",              label: "Апелляционная жалоба", fee: 30000 },
  { key: "cassation",           label: "Кассационная жалоба (кроме ВС РФ)", fee: 50000 },
  { key: "cassation_vs",        label: "Кассационная/надзорная жалоба в ВС РФ", fee: 80000 },
];

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function parseAmount(input: string): number | null {
  if (!input.trim()) return null;
  let expr = input.trim();
  // Суффиксы
  expr = expr.replace(/\s*млрд/gi, "*1000000000");
  expr = expr.replace(/\s*млн/gi, "*1000000");
  expr = expr.replace(/\s*(тыс|к)\b/gi, "*1000");
  // Убираем пробелы внутри числа (разделители тысяч)
  expr = expr.replace(/\s/g, "");
  // Запятая → точка
  expr = expr.replace(/,/g, ".");
  // Проверка допустимых символов
  if (!/^[0-9+\-*/().]+$/.test(expr)) return null;
  try {
     
    const result = new Function("return " + expr)() as number;
    if (typeof result !== "number" || !isFinite(result) || result < 0) return null;
    return result;
  } catch {
    return null;
  }
}

function calcPropertyFee(amount: number, rates: RateRow[], minFee: number): number {
  const row = rates.find(r => amount >= r.min && amount <= r.max);
  if (!row) return minFee;
  let fee = row.base + (amount - row.percentOf) * (row.percent / 100);
  if (row.maxFee !== undefined && fee > row.maxFee) fee = row.maxFee;
  return Math.max(fee, minFee);
}

function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCats(payer: "individual" | "org", courtType: "gp" | "ap"): NonpropItem[] {
  if (courtType === "gp" && payer === "individual") return GP_IND_CATS;
  if (courtType === "gp" && payer === "org") return GP_ORG_CATS;
  if (courtType === "ap" && payer === "individual") return AP_IND_CATS;
  return AP_ORG_CATS;
}

// ─── Льготы ст. 333.36 НК РФ ─────────────────────────────────────────────────

interface BenefitItem {
  id: string;
  label: string;
  type: "full" | "partial70";  // full = 0%, partial70 = платят 30%
  note?: string;
  forCourt?: "gp";              // только для GP
}

// Льготы, применимые к физическим лицам (п.1 и п.2 ст.333.36 НК РФ)
const BENEFITS_INDIVIDUAL: BenefitItem[] = [
  { id: "labor", label: "Иски о взыскании заработной платы и иные требования из трудовых правоотношений, взыскание пособий (пп.1 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "alimony_exempt", label: "Иски о взыскании алиментов (пп.2 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "health_damage", label: "Иски о возмещении вреда жизни/здоровью, смерти кормильца (пп.3 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "crime_damage", label: "Иски о возмещении вреда, причинённого преступлением (пп.4 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "criminal_pursuit", label: "Иски о возмещении вреда в результате уголовного преследования (пп.10 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "child_rights", label: "Иски о защите прав и законных интересов ребёнка (пп.15 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "consumer", label: "Иски, связанные с нарушением прав потребителей (пп.4 п.2 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "disability12", label: "Инвалиды I или II группы, дети-инвалиды, инвалиды с детства (пп.2 п.2 ст.333.36)", type: "full", note: "При цене иска > 1 000 000 руб. платят пошлину сверх 1 млн", forCourt: "gp" },
  { id: "veteran", label: "Ветераны боевых действий и военной службы — по защите своих прав (пп.3 п.2 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "pensioner", label: "Пенсионеры — по имущественным искам к ПФР/НПФ/органам пенсионного обеспечения (пп.5 п.2 ст.333.36)", type: "full", note: "При цене иска > 1 000 000 руб. платят пошлину сверх 1 млн", forCourt: "gp" },
  { id: "housing_only", label: "Иски о защите права на единственное жильё (пп.23 п.1 ст.333.36 ФЗ № 259-ФЗ)", type: "partial70", note: "Платят 30% от пошлины", forCourt: "gp" },
  { id: "svo_participant", label: "Участники СВО, мобилизованные, члены их семей (пп.24, 26 п.1 ст.333.36 ФЗ № 230-ФЗ 2025)", type: "full", forCourt: "gp" },
  { id: "adoption", label: "Заявления об усыновлении/удочерении ребёнка (пп.14 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "orphans", label: "Иски по защите прав детей-сирот и лиц, потерявших родителей в период обучения (пп.22 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "disability_neimush", label: "Иски неимущественного характера по защите прав инвалидов (пп.17 п.1 ст.333.36)", type: "full", forCourt: "gp" },
];

// Льготы для организаций
const BENEFITS_ORG: BenefitItem[] = [
  { id: "consumer_org", label: "Иски в защиту потребителей, предъявляемые общественными объединениями потребителей (пп.13 п.1 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "disability_org", label: "Общественные организации инвалидов — как истцы или ответчики (пп.1 п.2 ст.333.36)", type: "full", forCourt: "gp" },
  { id: "state_body", label: "Государственные органы, органы МСУ — как истцы или ответчики (пп.19 п.1 ст.333.36)", type: "full", forCourt: "gp" },
];

// ─── Интерфейс ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export default function DutyCalculatorPanel({ onClose, onSendToChat }: Props) {
  const [payer, setPayer] = useState<"individual" | "org">("individual");
  const [courtType, setCourtType] = useState<"gp" | "ap">("gp");
  const [claimType, setClaimType] = useState<"property" | "nonproperty">("property");
  const [claimAmount, setClaimAmount] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [nonpropCategory, setNonpropCategory] = useState("");
  const [exempt, setExempt] = useState(false);
  const [discount, setDiscount] = useState<"none" | "30" | "50">("none");
  const [alimonyWithSpouse, setAlimonyWithSpouse] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<string>("");
  const [showBenefits, setShowBenefits] = useState(false);
  const [amountError, setAmountError] = useState("");
  const [result, setResult] = useState<{ fee: number; percentOfClaim?: number; note?: string } | null>(null);
  const [showRatesModal, setShowRatesModal] = useState(false);

  // Сбрасываем категорию при смене payer/courtType
  useEffect(() => {
    setNonpropCategory("");
    setAlimonyWithSpouse(false);
    setSelectedBenefit("");
    setShowBenefits(false);
  }, [payer, courtType]);

  // Применяем льготу ст. 333.36 к рассчитанной пошлине
  const applyBenefit = (fee: number, amount?: number): { fee: number; benefitNote?: string } => {
    if (!selectedBenefit) return { fee };
    const allBenefits = payer === "individual" ? BENEFITS_INDIVIDUAL : BENEFITS_ORG;
    const benefit = allBenefits.find(b => b.id === selectedBenefit);
    if (!benefit) return { fee };

    if (benefit.type === "full") {
      // Инвалиды I/II гр. и пенсионеры: до 1 млн — 0, сверх 1 млн — пошлина минус пошлина по 1 млн
      if ((benefit.id === "disability12" || benefit.id === "pensioner") && amount !== undefined) {
        if (amount <= 1_000_000) return { fee: 0, benefitNote: `Льгота: ${benefit.label}` };
        const rates = courtType === "gp" ? GP_PROPERTY_RATES : AP_PROPERTY_RATES;
        const minFee = courtType === "gp" ? 4000 : 10000;
        const feeAt1m = calcPropertyFee(1_000_000, rates, minFee);
        const reduced = Math.max(0, Math.round((fee - feeAt1m) * 100) / 100);
        return { fee: reduced, benefitNote: `Льгота (п.3 ст.333.36): пошлина уменьшена на ставку по 1 млн руб.` };
      }
      return { fee: 0, benefitNote: `Льгота: ${benefit.label}` };
    }

    if (benefit.type === "partial70") {
      const reduced = Math.round(fee * 0.3 * 100) / 100;
      return { fee: reduced, benefitNote: `Льгота (30% от пошлины): ${benefit.label}` };
    }

    return { fee };
  };

  const calcFee = useCallback((): { fee: number; percentOfClaim?: number; note?: string } | null => {
    if (claimType === "property") {
      const amount = parseAmount(claimAmount);
      if (amount === null) return null;
      const rates = courtType === "gp" ? GP_PROPERTY_RATES : AP_PROPERTY_RATES;
      const minFee = courtType === "gp" ? 4000 : 10000;
      let fee = calcPropertyFee(amount, rates, minFee);
      const percentOfClaim = amount > 0 ? (fee / amount) * 100 : 0;

      if (exempt) return { fee: 0, note: "Освобождён от уплаты госпошлины (ст. 333.36 НК РФ)" };

      if (discount === "30") fee = Math.round(fee * 0.7 * 100) / 100;
      else if (discount === "50") fee = Math.round(fee * 0.5 * 100) / 100;
      else fee = Math.round(fee * 100) / 100;

      const { fee: finalFee, benefitNote } = applyBenefit(fee, amount);
      return { fee: finalFee, percentOfClaim: Math.round(percentOfClaim * 100) / 100, note: benefitNote };
    }

    if (!nonpropCategory) return null;
    const cats = getCats(payer, courtType);
    const cat = cats.find(c => c.key === nonpropCategory);
    if (!cat) return null;

    if (cat.fee === "order" || cat.fee === "order_min8000") {
      const amount = parseAmount(orderAmount);
      if (amount === null) return null;
      const rates = courtType === "gp" ? GP_PROPERTY_RATES : AP_PROPERTY_RATES;
      const minFee = courtType === "gp" ? 4000 : 10000;
      const base = calcPropertyFee(amount, rates, minFee);
      let fee = base * 0.5;
      if (cat.fee === "order_min8000" && fee < 8000) fee = 8000;
      fee = Math.round(fee * 100) / 100;
      if (exempt) return { fee: 0, note: "Освобождён от уплаты госпошлины" };
      const { fee: finalFee, benefitNote } = applyBenefit(fee, amount);
      return { fee: finalFee, note: benefitNote ?? ("50% от ставки имущественного иска" + (cat.fee === "order_min8000" ? ", минимум 8 000 руб." : "")) };
    }

    if (cat.key === "alimony_child") {
      let fee = alimonyWithSpouse ? 150 + 300 : 150;
      if (exempt) fee = 0;
      else if (discount === "30") fee = Math.round(fee * 0.7 * 100) / 100;
      else if (discount === "50") fee = Math.round(fee * 0.5 * 100) / 100;
      return {
        fee,
        note: alimonyWithSpouse ? "150 руб. (на детей) + 300 руб. (на содержание истца)" : "150 руб. — только на детей",
      };
    }

    if (exempt) return { fee: 0, note: "Освобождён от уплаты госпошлины" };

    let fee = cat.fee as number;
    if (discount === "30") fee = Math.round(fee * 0.7 * 100) / 100;
    else if (discount === "50") fee = Math.round(fee * 0.5 * 100) / 100;

    const { fee: finalFee, benefitNote } = applyBenefit(fee);
    return { fee: finalFee, note: benefitNote };
  }, [claimType, claimAmount, orderAmount, nonpropCategory, payer, courtType, exempt, discount, alimonyWithSpouse, selectedBenefit]);

  useEffect(() => {
    setAmountError("");
    if (claimType === "property") {
      if (claimAmount && parseAmount(claimAmount) === null) {
        setAmountError("Некорректная сумма. Используйте числа, операторы (+−*/) или суффиксы: тыс, млн, млрд");
        setResult(null);
        return;
      }
    }
    if (claimType === "nonproperty" && (nonpropCategory === "order" || nonpropCategory === "order_min8000")) {
      if (orderAmount && parseAmount(orderAmount) === null) {
        setAmountError("Некорректная сумма заявления");
        setResult(null);
        return;
      }
    }
    const r = calcFee();
    setResult(r);
  }, [claimType, claimAmount, orderAmount, nonpropCategory, payer, courtType, exempt, discount, alimonyWithSpouse, selectedBenefit, calcFee]);

  const handleSendToChat = () => {
    if (!result) return;
    const courtLabel = courtType === "gp" ? "Суд общей юрисдикции (ГПК/КАС РФ)" : "Арбитражный суд (АПК РФ)";
    const payerLabel = payer === "individual" ? "Физическое лицо" : "Организация";
    const typeLabel = claimType === "property" ? "Имущественное требование" : "Неимущественное требование";
    const articleRef = courtType === "gp" ? "333.19" : "333.21";

    let claimLine = "";
    if (claimType === "property") {
      const amount = parseAmount(claimAmount);
      claimLine = `• Сумма иска: ${amount !== null ? fmtRub(amount) + " руб." : claimAmount}`;
    } else {
      const cats = getCats(payer, courtType);
      const cat = cats.find(c => c.key === nonpropCategory);
      claimLine = `• Категория: ${cat?.label ?? nonpropCategory}`;
      if ((nonpropCategory === "order" || nonpropCategory === "order_min8000") && orderAmount) {
        const oa = parseAmount(orderAmount);
        claimLine += `\n• Сумма заявления: ${oa !== null ? fmtRub(oa) + " руб." : orderAmount}`;
      }
    }

    let discountLine = "";
    const allBenefits = payer === "individual" ? BENEFITS_INDIVIDUAL : BENEFITS_ORG;
    const activeBenefit = allBenefits.find(b => b.id === selectedBenefit);
    if (activeBenefit) discountLine = `• Льгота ст. 333.36 НК РФ: ${activeBenefit.label}`;
    else if (exempt) discountLine = "• Льгота: освобождение от уплаты";
    else if (discount === "30") discountLine = "• Льгота: скидка 30%";
    else if (discount === "50") discountLine = "• Льгота: скидка 50%";

    const text =
      `⚖️ Расчёт госпошлины по ст. ${articleRef} НК РФ:\n` +
      `• Суд: ${courtLabel}\n` +
      `• Плательщик: ${payerLabel}\n` +
      `• Тип: ${typeLabel}\n` +
      `${claimLine}\n` +
      `${discountLine ? discountLine + "\n" : ""}` +
      `• Размер госпошлины: ${fmtRub(result.fee)} руб.\n` +
      `${result.note ? "• Примечание: " + result.note + "\n" : ""}` +
      `\nПроверь корректность этой госпошлины по ст. ${articleRef} НК РФ, сверив с документами из правовой базы по госпошлинам. Укажи, правильно ли определена ставка, и нет ли применимых льгот.`;

    onSendToChat(text);
    onClose();
  };

  const cats = getCats(payer, courtType);
  const selectedCat = cats.find(c => c.key === nonpropCategory);
  const needOrderAmount = nonpropCategory === "order" || nonpropCategory === "order_min8000";
  const isAlimony = nonpropCategory === "alimony_child";

  const inp = "w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 transition-all placeholder:text-slate-400";

  const activeBtn = { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "#fff", border: "1.5px solid #0f4c81" };
  const inactiveBtn = { background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0" };

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
          >
            <Icon name="Landmark" size={12} color="#fff" />
          </div>
          <p className="text-xs font-bold text-slate-800">Калькулятор госпошлины</p>
          <span className="text-[10px] text-slate-400">· НК РФ</span>
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            тест
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Тело */}
      <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "calc(68dvh - 44px)" }}>

        {/* Шаг 1: Тип плательщика */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">1. Тип плательщика</p>
          <div className="grid grid-cols-2 gap-1.5">
            {([ ["individual", "Физическое лицо"], ["org", "Организация"] ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setPayer(v)}
                className="py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                style={payer === v ? activeBtn : inactiveBtn}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Шаг 2: Тип суда */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">2. Вид судопроизводства</p>
          <div className="grid grid-cols-2 gap-1.5">
            {([ ["gp", "Суд общей юрисдикции", "ГПК / КАС РФ"], ["ap", "Арбитражный суд", "АПК РФ"] ] as const).map(([v, label, sub]) => (
              <button
                key={v}
                onClick={() => setCourtType(v)}
                className="py-1.5 px-2 rounded-lg text-left border transition-all"
                style={courtType === v ? activeBtn : inactiveBtn}
              >
                <p className="text-[11px] font-semibold leading-tight">{label}</p>
                <p className="text-[10px] opacity-75">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Шаг 3: Характер требования */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">3. Характер требования</p>
          <div className="grid grid-cols-2 gap-1.5">
            {([ ["property", "Имущественное"], ["nonproperty", "Неимущественное"] ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setClaimType(v)}
                className="py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                style={claimType === v ? activeBtn : inactiveBtn}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Шаг 4A: Имущественное — сумма иска */}
        {claimType === "property" && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">4. Сумма иска</p>
            <input
              className={inp + (amountError ? " border-red-400" : "")}
              placeholder="например: 500000 или 1.5 млн или 200 тыс * 3"
              value={claimAmount}
              onChange={e => setClaimAmount(e.target.value)}
            />
            {amountError && (
              <p className="text-[10px] text-red-500 mt-1">{amountError}</p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Поддерживаются суффиксы: тыс, млн, млрд; арифметика: +, −, *, /
            </p>
          </div>
        )}

        {/* Шаг 4B: Неимущественное — категория */}
        {claimType === "nonproperty" && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">4. Вид заявления</p>
            <select
              className={inp + " cursor-pointer"}
              value={nonpropCategory}
              onChange={e => setNonpropCategory(e.target.value)}
            >
              <option value="">— Выберите категорию —</option>
              {cats.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>

            {/* Для судебного приказа — поле суммы */}
            {needOrderAmount && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">Сумма заявления (для расчёта 50%)</p>
                <input
                  className={inp + (amountError ? " border-red-400" : "")}
                  placeholder="например: 300000 или 1.2 млн"
                  value={orderAmount}
                  onChange={e => setOrderAmount(e.target.value)}
                />
                {amountError && (
                  <p className="text-[10px] text-red-500 mt-1">{amountError}</p>
                )}
              </div>
            )}

            {/* Алименты — доп. чекбокс */}
            {isAlimony && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                <div
                  onClick={() => setAlimonyWithSpouse(v => !v)}
                  className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer"
                  style={alimonyWithSpouse
                    ? { background: "#0f4c81", borderColor: "#0f4c81" }
                    : { background: "#fff", borderColor: "#cbd5e1" }}
                >
                  {alimonyWithSpouse && <Icon name="Check" size={10} color="#fff" />}
                </div>
                <span className="text-[11px] text-slate-600">
                  +300 руб. — также на содержание истца (супруга/супруги)
                </span>
              </label>
            )}
          </div>
        )}

        {/* Льготы */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Льготы</p>
          <div className="space-y-2">
            {/* Льготы ст. 333.36 — раскрывающийся список */}
            {courtType === "gp" && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowBenefits(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon name="ShieldCheck" size={12} color="#0f4c81" />
                    <span className="text-[11px] font-semibold text-slate-700">Льготы ст. 333.36 НК РФ</span>
                    {selectedBenefit && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">применена</span>
                    )}
                  </div>
                  <Icon name={showBenefits ? "ChevronUp" : "ChevronDown"} size={12} color="#94a3b8" />
                </button>
                {showBenefits && (
                  <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => setSelectedBenefit("")}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-all"
                      style={!selectedBenefit ? { background: "rgba(15,76,129,0.08)", color: "#0f4c81", fontWeight: 600 } : { color: "#64748b" }}
                    >
                      Нет льготы
                    </button>
                    {(payer === "individual" ? BENEFITS_INDIVIDUAL : BENEFITS_ORG).map(b => (
                      <button
                        key={b.id}
                        onClick={() => { setSelectedBenefit(b.id); setExempt(false); setDiscount("none"); }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] leading-snug transition-all"
                        style={selectedBenefit === b.id
                          ? { background: "rgba(15,76,129,0.08)", color: "#0f4c81", fontWeight: 600 }
                          : { color: "#475569" }}
                      >
                        {b.label}
                        {b.note && <span className="block text-[10px] text-amber-600 mt-0.5">{b.note}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Освобождение вручную */}
            {!selectedBenefit && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => { setExempt(v => !v); if (!exempt) setDiscount("none"); }}
                    className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer"
                    style={exempt ? { background: "#0f4c81", borderColor: "#0f4c81" } : { background: "#fff", borderColor: "#cbd5e1" }}
                  >
                    {exempt && <Icon name="Check" size={10} color="#fff" />}
                  </div>
                  <span className="text-[11px] text-slate-600">Иное освобождение от уплаты пошлины</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([ ["none", "Без скидки"], ["30", "−30%"], ["50", "−50%"] ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      disabled={exempt}
                      onClick={() => setDiscount(v)}
                      className="py-1 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40"
                      style={discount === v && !exempt ? activeBtn : inactiveBtn}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Результат */}
        {result !== null && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "linear-gradient(135deg, rgba(15,76,129,0.08) 0%, rgba(26,107,181,0.06) 100%)", border: "1.5px solid rgba(15,76,129,0.18)" }}
          >
            <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Размер госпошлины</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold" style={{ color: "#0f4c81" }}>
                {fmtRub(result.fee)}
              </span>
              <span className="text-xs font-semibold text-slate-500">руб.</span>
            </div>
            {result.percentOfClaim !== undefined && result.percentOfClaim > 0 && (
              <p className="text-[11px] text-slate-500">
                {result.percentOfClaim.toFixed(2)}% от суммы иска
              </p>
            )}
            {result.note && (
              <p className="text-[10px] text-amber-700 mt-1.5 flex items-start gap-1">
                <Icon name="Info" size={10} className="mt-0.5 shrink-0" />
                {result.note}
              </p>
            )}
            {result.fee === 0 && !exempt && (
              <p className="text-[11px] text-emerald-700 mt-1">Пошлина не взимается</p>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSendToChat}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
              >
                <Icon name="Send" size={11} color="#fff" />
                Отправить в чат AI-юристу
              </button>
              <button
                onClick={() => setShowRatesModal(true)}
                className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Icon name="Table" size={11} />
                Таблица
              </button>
            </div>
          </div>
        )}

        {/* Нет результата — подсказка */}
        {result === null && !amountError && (
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "#f8fafc", border: "1.5px dashed #e2e8f0" }}>
            <Icon name="Calculator" size={20} className="mx-auto mb-1 text-slate-300" />
            <p className="text-[11px] text-slate-400">
              {claimType === "property"
                ? "Введите сумму иска для расчёта"
                : "Выберите категорию заявления"}
            </p>
          </div>
        )}

        {/* Предупреждение */}
        <div
          className="rounded-lg px-3 py-2 flex items-start gap-2"
          style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <Icon name="AlertTriangle" size={12} color="#b45309" className="shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 leading-snug">
            Расчёт носит справочный характер. Ставки актуальны по состоянию на дату принятия Федерального закона № 259-ФЗ.
            Окончательный размер пошлины определяется судом на основании ст.{" "}
            {courtType === "gp" ? "333.19" : "333.21"} НК РФ.
          </p>
        </div>

      </div>

      {/* Модальное окно: таблица ставок */}
      {showRatesModal && (
        <div
          className="absolute inset-0 z-50 flex flex-col bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 8px 32px rgba(15,76,129,0.18)" }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <Icon name="Table" size={13} color="#0f4c81" />
              <p className="text-xs font-bold text-slate-800">Таблица ставок госпошлины</p>
            </div>
            <button
              onClick={() => setShowRatesModal(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <Icon name="X" size={13} />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-3 space-y-4" style={{ maxHeight: "calc(68dvh - 44px)" }}>

            {/* СОЮ имущественные */}
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                СОЮ (ГПК/КАС) — имущественные иски (ст. 333.19 НК РФ)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left py-1 px-2 border border-slate-200 font-semibold text-slate-600">Сумма иска</th>
                      <th className="text-left py-1 px-2 border border-slate-200 font-semibold text-slate-600">База, руб.</th>
                      <th className="text-left py-1 px-2 border border-slate-200 font-semibold text-slate-600">+ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GP_PROPERTY_RATES.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-1 px-2 border border-slate-200 text-slate-700">
                          {r.max === Infinity
                            ? `от ${r.min.toLocaleString("ru-RU")} руб.`
                            : `${r.min.toLocaleString("ru-RU")} – ${r.max.toLocaleString("ru-RU")} руб.`}
                        </td>
                        <td className="py-1 px-2 border border-slate-200 text-slate-700">{r.base.toLocaleString("ru-RU")}</td>
                        <td className="py-1 px-2 border border-slate-200 text-slate-700">
                          {r.percent > 0
                            ? `${r.percent}% с суммы свыше ${r.percentOf.toLocaleString("ru-RU")} руб.`
                            : "—"}
                          {r.maxFee ? `, макс. ${r.maxFee.toLocaleString("ru-RU")} руб.` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* АС имущественные */}
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                Арбитражный суд (АПК) — имущественные иски (ст. 333.21 НК РФ)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left py-1 px-2 border border-slate-200 font-semibold text-slate-600">Сумма иска</th>
                      <th className="text-left py-1 px-2 border border-slate-200 font-semibold text-slate-600">База, руб.</th>
                      <th className="text-left py-1 px-2 border border-slate-200 font-semibold text-slate-600">+ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AP_PROPERTY_RATES.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-1 px-2 border border-slate-200 text-slate-700">
                          {r.max === Infinity
                            ? `от ${r.min.toLocaleString("ru-RU")} руб.`
                            : `${r.min.toLocaleString("ru-RU")} – ${r.max.toLocaleString("ru-RU")} руб.`}
                        </td>
                        <td className="py-1 px-2 border border-slate-200 text-slate-700">{r.base.toLocaleString("ru-RU")}</td>
                        <td className="py-1 px-2 border border-slate-200 text-slate-700">
                          {r.percent > 0
                            ? `${r.percent}% с суммы свыше ${r.percentOf.toLocaleString("ru-RU")} руб.`
                            : "—"}
                          {r.maxFee ? `, макс. ${r.maxFee.toLocaleString("ru-RU")} руб.` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Неимущественные — сводная */}
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                Неимущественные требования — фиксированные ставки
              </p>
              <div className="grid grid-cols-2 gap-3">
                {([ ["gp", "individual", "СОЮ · Физ. лица"], ["gp", "org", "СОЮ · Организации"], ["ap", "individual", "АС · Физ. лица"], ["ap", "org", "АС · Организации"] ] as const).map(([ct, py, title]) => (
                  <div key={ct + py}>
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">{title}</p>
                    <div className="space-y-0.5">
                      {getCats(py, ct).filter(c => typeof c.fee === "number").map(c => (
                        <div key={c.key} className="flex justify-between gap-1 text-[10px] py-0.5 border-b border-slate-100">
                          <span className="text-slate-600 leading-snug flex-1">{c.label.split("(")[0].trim()}</span>
                          <span className="font-semibold text-slate-800 shrink-0 ml-1">
                            {(c.fee as number) === 0 ? "0" : (c.fee as number).toLocaleString("ru-RU")} руб.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}