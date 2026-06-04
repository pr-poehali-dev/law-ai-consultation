import type { ServiceType } from "@/components/PaymentModal";

export interface DocType {
  id: string;
  label: string;
  icon: string;
  price: number;
  serviceType: ServiceType;
  blockId: string;
}

export interface DocBlock {
  id: string;
  label: string;
  icon: string;
  color: string; // tailwind bg класс для иконки блока
  types: DocType[];
}

export const DOC_BLOCKS: DocBlock[] = [
  {
    id: "b1", label: "Исковые заявления", icon: "Gavel", color: "bg-blue-100 text-blue-700",
    types: [
      { id: "claim", label: "Исковое заявление (общее)", icon: "Gavel", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_debt", label: "О взыскании долга", icon: "Banknote", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_divorce", label: "О расторжении брака", icon: "Heart", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_property", label: "О разделе имущества", icon: "Home", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_consumer", label: "О защите прав потребителей", icon: "ShoppingCart", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_damage", label: "О возмещении ущерба", icon: "AlertTriangle", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_ownership", label: "О признании права собственности", icon: "Key", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_paternity", label: "Об установлении отцовства", icon: "Users", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_eviction", label: "О выселении", icon: "DoorOpen", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_alimony", label: "О взыскании алиментов", icon: "Baby", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_admin", label: "Административное исковое (КАС РФ)", icon: "Building2", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_order", label: "Заявление о судебном приказе", icon: "FileCheck2", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_counter", label: "Встречное исковое заявление", icon: "ArrowLeftRight", price: 490, serviceType: "document", blockId: "b1" },
      { id: "claim_interim", label: "Заявление об обеспечении иска", icon: "Shield", price: 490, serviceType: "document", blockId: "b1" },
    ],
  },
  {
    id: "b2", label: "Ходатайства и заявления", icon: "ClipboardList", color: "bg-violet-100 text-violet-700",
    types: [
      { id: "petition_evidence", label: "Об истребовании доказательств", icon: "Search", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_expertise", label: "О назначении экспертизы", icon: "FlaskConical", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_postpone", label: "Об отложении заседания", icon: "Clock", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_attach", label: "О приобщении документов", icon: "Paperclip", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_deadline", label: "О восстановлении срока", icon: "RotateCcw", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_absence", label: "О рассмотрении в отсутствие", icon: "UserX", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_witness", label: "О вызове свидетелей", icon: "Users", price: 490, serviceType: "document", blockId: "b2" },
      { id: "petition_exclude", label: "Об исключении доказательств", icon: "MinusCircle", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_defendant", label: "О замене ненадлежащего ответчика", icon: "RefreshCw", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_third", label: "О привлечении третьего лица", icon: "UserPlus", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_recusal", label: "Об отводе судьи", icon: "UserMinus", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_review", label: "О пересмотре по новым обстоятельствам", icon: "FileSearch", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_clarify", label: "О разъяснении решения суда", icon: "HelpCircle", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_writ", label: "О выдаче исполнительного листа", icon: "Scroll", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_reversal", label: "О повороте исполнения решения", icon: "ArrowLeftRight", price: 490, serviceType: "document", blockId: "b2" },
      { id: "application_settlement", label: "Об утверждении мирового соглашения", icon: "Handshake", price: 490, serviceType: "document", blockId: "b2" },
    ],
  },
  {
    id: "b3", label: "Жалобы судебные", icon: "ArrowUpCircle", color: "bg-orange-100 text-orange-700",
    types: [
      { id: "appeal", label: "Апелляционная жалоба", icon: "ArrowUpCircle", price: 490, serviceType: "document", blockId: "b3" },
      { id: "cassation", label: "Кассационная жалоба", icon: "RefreshCcw", price: 490, serviceType: "document", blockId: "b3" },
      { id: "supervisory", label: "Надзорная жалоба (Верховный Суд)", icon: "Eye", price: 490, serviceType: "document", blockId: "b3" },
      { id: "partial_appeal", label: "Частная жалоба (на определение)", icon: "FileWarning", price: 490, serviceType: "document", blockId: "b3" },
    ],
  },
  {
    id: "b4", label: "Отзывы и возражения", icon: "ShieldAlert", color: "bg-red-100 text-red-700",
    types: [
      { id: "response_to_claim", label: "Отзыв на исковое заявление", icon: "FileSearch", price: 490, serviceType: "document", blockId: "b4" },
      { id: "objection_appeal", label: "Возражение на апелляционную жалобу", icon: "ShieldAlert", price: 490, serviceType: "document", blockId: "b4" },
      { id: "objection_cassation", label: "Возражение на кассационную жалобу", icon: "ShieldOff", price: 490, serviceType: "document", blockId: "b4" },
      { id: "objection_costs", label: "Возражения по судебным расходам", icon: "CircleDollarSign", price: 490, serviceType: "document", blockId: "b4" },
      { id: "written_explanations", label: "Письменные объяснения по делу", icon: "FileText", price: 490, serviceType: "document", blockId: "b4" },
    ],
  },
  {
    id: "b5", label: "Досудебные документы", icon: "AlertCircle", color: "bg-yellow-100 text-yellow-700",
    types: [
      { id: "pretension", label: "Претензия (общая)", icon: "AlertCircle", price: 490, serviceType: "document", blockId: "b5" },
      { id: "pretension_contract", label: "Претензия по договору", icon: "FileSignature", price: 490, serviceType: "document", blockId: "b5" },
      { id: "pretension_consumer", label: "Претензия потребителя", icon: "ShoppingBag", price: 490, serviceType: "document", blockId: "b5" },
      { id: "pretension_response", label: "Ответ на претензию", icon: "Reply", price: 490, serviceType: "document", blockId: "b5" },
      { id: "pretension_warning", label: "Досудебное предупреждение", icon: "TriangleAlert", price: 490, serviceType: "document", blockId: "b5" },
      { id: "notification_termination", label: "Уведомление о расторжении договора", icon: "XCircle", price: 490, serviceType: "document", blockId: "b5" },
      { id: "notification_offset", label: "Уведомление о зачёте требований", icon: "ArrowLeftRight", price: 490, serviceType: "document", blockId: "b5" },
      { id: "notification_debt", label: "Требование об уплате задолженности", icon: "Banknote", price: 490, serviceType: "document", blockId: "b5" },
    ],
  },
  {
    id: "b6", label: "Договоры и сделки", icon: "FileCheck", color: "bg-green-100 text-green-700",
    types: [
      { id: "contract_sale", label: "Купли-продажи", icon: "ShoppingCart", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_rent", label: "Аренды", icon: "Home", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_work", label: "Подряда", icon: "Hammer", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_services", label: "Оказания услуг", icon: "Briefcase", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_loan", label: "Займа", icon: "PiggyBank", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_receipt", label: "Долговая расписка", icon: "Receipt", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract", label: "ГПХ", icon: "FileCheck", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_license", label: "Лицензионный", icon: "Key", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_cession", label: "Цессии (уступка права)", icon: "ArrowRightLeft", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_partnership", label: "Простого товарищества", icon: "Users", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_gov", label: "Государственный контракт (44-ФЗ)", icon: "Landmark", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_marriage", label: "Брачный договор", icon: "Heart", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_children", label: "Соглашение о детях и алиментах", icon: "Baby", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_property_split", label: "Соглашение о разделе имущества", icon: "SplitSquareHorizontal", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_mediation", label: "Медиативное соглашение", icon: "Handshake", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_preliminary", label: "Предварительный договор", icon: "FileClock", price: 490, serviceType: "document", blockId: "b6" },
      { id: "contract_service_state", label: "Служебный контракт (госслужащие)", icon: "Shield", price: 490, serviceType: "document", blockId: "b6" },
    ],
  },
  {
    id: "b7", label: "Корпоративные документы", icon: "Building2", color: "bg-slate-100 text-slate-700",
    types: [
      { id: "corporate_charter", label: "Устав ООО/АО/НКО", icon: "BookOpen", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_sole_decision", label: "Решение единственного участника", icon: "User", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_meeting", label: "Протокол общего собрания", icon: "Users", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_board", label: "Протокол совета директоров", icon: "UserCheck", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_salary", label: "Положение об оплате труда", icon: "DollarSign", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_bonus", label: "Положение о премировании", icon: "Star", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_pd", label: "Положение о персональных данных", icon: "Lock", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_secret", label: "Положение о коммерческой тайне", icon: "EyeOff", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_rules", label: "ПВТР", icon: "ClipboardList", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_collective", label: "Коллективный договор", icon: "Handshake", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_job_desc", label: "Должностная инструкция", icon: "FileText", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_founding", label: "Учредительный договор", icon: "FileText", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_branch", label: "Положение о филиале", icon: "Building", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_staffing", label: "Штатное расписание", icon: "Table", price: 490, serviceType: "document", blockId: "b7" },
      { id: "corporate_accounting", label: "Учётная политика", icon: "BookOpen", price: 490, serviceType: "document", blockId: "b7" },
    ],
  },
  {
    id: "b8", label: "Трудовые документы", icon: "Briefcase", color: "bg-cyan-100 text-cyan-700",
    types: [
      { id: "labor_contract", label: "Трудовой договор", icon: "FileCheck", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_addendum", label: "Доп. соглашение к ТД", icon: "FilePlus", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_termination", label: "Соглашение о расторжении (ст.78 ТК)", icon: "FileX", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_hire_app", label: "Заявление о приёме на работу", icon: "UserPlus", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_quit_app", label: "Заявление об увольнении", icon: "LogOut", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_vacation_app", label: "Заявление на отпуск", icon: "Palmtree", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_vacation_exit", label: "Заявление о выходе из отпуска", icon: "LogIn", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_quit_withdraw", label: "Заявление об отзыве заявления об увольнении", icon: "Undo2", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_downtime_notice", label: "Уведомление о простое", icon: "PauseCircle", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_dismiss_notice", label: "Уведомление о предстоящем увольнении", icon: "BellOff", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_layoff_notice", label: "Уведомление о сокращении", icon: "UserMinus", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_order_hire", label: "Приказ о приёме (Т-1)", icon: "ClipboardCheck", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_order_dismiss", label: "Приказ об увольнении (Т-8)", icon: "ClipboardX", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_order_bonus", label: "Приказ о премировании", icon: "Award", price: 490, serviceType: "document", blockId: "b8" },
      { id: "labor_order_discipline", label: "Приказ о дисципл. взыскании", icon: "AlertOctagon", price: 490, serviceType: "document", blockId: "b8" },
    ],
  },
  {
    id: "b9", label: "Документы с госорганами", icon: "Building", color: "bg-indigo-100 text-indigo-700",
    types: [
      { id: "gov_prosecutor", label: "Жалоба в прокуратуру", icon: "Shield", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_rospotreb", label: "Жалоба в Роспотребнадзор", icon: "ShoppingBag", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_fas", label: "Жалоба в ФАС", icon: "BarChart", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_housing", label: "Жалоба в ГЖИ", icon: "Home", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_labor_insp", label: "Жалоба в трудовую инспекцию", icon: "Briefcase", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_police", label: "Заявление в полицию", icon: "CircleAlert", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_fraud", label: "Заявление о мошенничестве", icon: "AlertTriangle", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_tax_deduction", label: "Заявление на налоговый вычет", icon: "Percent", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_explanation", label: "Объяснительная записка", icon: "FileEdit", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_judge_complaint", label: "Жалоба на судью (в ККС)", icon: "AlertOctagon", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_tax_3ndfl", label: "Налоговая декларация (3-НДФЛ)", icon: "Receipt", price: 490, serviceType: "document", blockId: "b9" },
      { id: "gov_official_appeal", label: "Рапорт / докладная записка", icon: "FileEdit", price: 490, serviceType: "document", blockId: "b9" },
    ],
  },
  {
    id: "b10", label: "Уголовно-процессуальные", icon: "Scale", color: "bg-rose-100 text-rose-700",
    types: [
      { id: "criminal_exclude_evidence", label: "Ходатайство об исключении доказательства (ст.235)", icon: "MinusCircle", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_125", label: "Жалоба по ст.125 УПК (на следователя)", icon: "AlertOctagon", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_terminate", label: "Ходатайство о прекращении дела", icon: "XOctagon", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_measure", label: "Ходатайство об изменении меры пресечения", icon: "Unlock", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_attach_evidence", label: "Ходатайство о приобщении доказательств", icon: "Paperclip", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_statement", label: "Заявление о преступлении (ст.141 УПК)", icon: "FileWarning", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_appeal", label: "Апелляционная жалоба по УД", icon: "ArrowUpCircle", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_cassation", label: "Кассационная жалоба по УД", icon: "RefreshCcw", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_witness", label: "Ходатайство о вызове свидетелей", icon: "Users", price: 490, serviceType: "document", blockId: "b10" },
      { id: "criminal_special_order", label: "Ходатайство об особом порядке (гл.40 УПК)", icon: "FileCheck2", price: 490, serviceType: "document", blockId: "b10" },
    ],
  },
  {
    id: "b11", label: "Документы для сайта", icon: "Globe", color: "bg-teal-100 text-teal-700",
    types: [
      { id: "website_privacy", label: "Политика конфиденциальности", icon: "Lock", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_terms", label: "Пользовательское соглашение", icon: "FileText", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_offer", label: "Публичная оферта", icon: "FileCheck", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_cookies", label: "Политика cookies", icon: "Cookie", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_return", label: "Политика возврата товара", icon: "RotateCcw", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_eula", label: "Лицензионное соглашение (EULA)", icon: "Key", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_consent", label: "Согласие на обработку ПДн", icon: "UserCheck", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_disclaimer", label: "Отказ от ответственности", icon: "ShieldOff", price: 490, serviceType: "document", blockId: "b11" },
      { id: "website_aup", label: "Правила использования сайта (AUP)", icon: "ShieldCheck", price: 490, serviceType: "document", blockId: "b11" },
    ],
  },
  {
    id: "b12", label: "Особые документы (нотариат)", icon: "Stamp", color: "bg-amber-100 text-amber-700",
    types: [
      { id: "special_will", label: "Завещание", icon: "ScrollText", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_power_of_attorney", label: "Доверенность", icon: "UserCheck", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_spouse_consent", label: "Согласие супруга на сделку", icon: "Heart", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_child_travel", label: "Согласие на выезд ребёнка", icon: "Plane", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_marriage_contract", label: "Брачный договор", icon: "Rings", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_mediation", label: "Медиативное соглашение", icon: "Handshake", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_guarantee_letter", label: "Гарантийное письмо", icon: "BadgeCheck", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_reconciliation", label: "Акт сверки расчётов", icon: "BarChart2", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_medical_consent", label: "Согласие на медицинское вмешательство", icon: "Heart", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_pd_consent", label: "Согласие на обработку ПДн", icon: "Lock", price: 490, serviceType: "document", blockId: "b12" },
      { id: "special_inheritance_contract", label: "Наследственный договор", icon: "ScrollText", price: 490, serviceType: "document", blockId: "b12" },
    ],
  },
  {
    id: "b13", label: "Проекты решений", icon: "Vote", color: "bg-purple-100 text-purple-700",
    types: [
      { id: "decision_court", label: "Проект решения суда", icon: "Gavel", price: 490, serviceType: "document", blockId: "b13" },
      { id: "decision_sole", label: "Решение единственного участника", icon: "User", price: 490, serviceType: "document", blockId: "b13" },
      { id: "decision_meeting", label: "Решение общего собрания", icon: "Users", price: 490, serviceType: "document", blockId: "b13" },
      { id: "decision_board", label: "Решение совета директоров", icon: "UserCheck", price: 490, serviceType: "document", blockId: "b13" },
      { id: "decision_liquidation", label: "Решение о ликвидации ЮЛ", icon: "Trash2", price: 490, serviceType: "document", blockId: "b13" },
    ],
  },
  {
    id: "b14", label: "Судебная речь", icon: "Mic", color: "bg-pink-100 text-pink-700",
    types: [
      { id: "court_speech", label: "Речь для суда", icon: "Mic", price: 490, serviceType: "document", blockId: "b14" },
    ],
  },
];

// Плоский массив для совместимости с существующим кодом
export const DOC_TYPES = DOC_BLOCKS.flatMap(b => b.types);

// Поиск типа по id
export function findDocType(id: string): DocType {
  return DOC_TYPES.find(d => d.id === id) ?? DOC_TYPES[0];
}