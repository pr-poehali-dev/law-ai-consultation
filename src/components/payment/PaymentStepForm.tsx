import Icon from "@/components/ui/icon";
import { ServiceType } from "@/components/PaymentModal";

const SERVICE_PRICES: Record<ServiceType, number> = {
  consultation: 990,
  document: 600,
  expert: 990,
  business: 1000,
  subscription_consult: 1990,
  subscription_docs: 4990,
  plan_starter: 990,
  plan_starter_discount: 495,
  plan_pro: 3990,
  plan_max: 5990,
  plan_max_expert: 5990,
  business_subscription: 4990,
  business_actions_10: 1000,
  business_actions_30: 3000,
  business_actions_50: 3500,
  business_actions_60: 6000,
  business_actions_150: 9000,
};

const SERVICE_DETAILS: Record<ServiceType, string> = {
  consultation: "Консультация живого юриста по вашей ситуации",
  document: "Один юридический документ (исковое, претензия или жалоба)",
  expert: "Консультация живого юриста — разбор ситуации и стратегия действий",
  business: "Подготовка договора и юридических документов для бизнеса",
  subscription_consult: "Безлимитные консультации AI-юриста — 1 месяц",
  subscription_docs: "Безлимитная подготовка документов — 1 месяц",
  plan_starter: "30 вопросов AI-юристу + 5 документов · Генерация .doc · Скачивание в .doc",
  plan_starter_discount: "30 вопросов AI-юристу + 5 документов · Генерация .doc · Скидка 50%",
  plan_pro: "100 вопросов + 20 документов · Загрузка файлов для анализа в чате · Определение перспективы дела · Генерация .doc",
  plan_max: "до 300 вопросов + 50 документов · Консультация юриста · 2 документа от юриста · Приоритетный доступ",
  plan_max_expert: "до 300 вопросов + 50 документов · Консультация юриста · 2 документа от юриста · Приоритетный доступ",
  business_subscription: "150 действий/мес · Приказы, договоры, анализ PDF/DOC · Сравнение · Due diligence · Скачивание .doc · История 24 ч",
  business_actions_10: "Дополнительно 10 действий к текущему пакету",
  business_actions_30: "Дополнительно 30 действий к текущему пакету",
  business_actions_50: "Дополнительно 50 действий к текущему пакету",
  business_actions_60: "Дополнительно 60 действий к текущему пакету",
  business_actions_150: "Дополнительно 150 действий к текущему пакету",
};

const SERVICE_BADGE: Partial<Record<ServiceType, string>> = {
  subscription_consult: "Выгодно",
  plan_starter: "Старт",
  plan_starter_discount: "−50%",
  plan_pro: "Хит",
  plan_max: "Рекомендуем",
  plan_max_expert: "Рекомендуем",
  business_subscription: "Бизнес",
  business_actions_150: "Выгодно",
  subscription_docs: "Выгодно",
};

interface Props {
  serviceType: ServiceType;
  serviceName: string;
  email: string;
  onEmailChange: (v: string) => void;
  loading: boolean;
  errorMsg: string;
  onPay: () => void;
}

export default function PaymentStepForm({
  serviceType,
  serviceName,
  email,
  onEmailChange,
  loading,
  errorMsg,
  onPay,
}: Props) {
  const price = SERVICE_PRICES[serviceType];

  return (
    <div className="px-5 py-4 sm:p-8">
      <div className="mb-5">
        <div className="inline-flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-1.5 mb-4">
          <Icon name="ShieldCheck" size={14} className="text-emerald-600" />
          <span className="text-xs text-emerald-700 font-medium">Защищённая оплата · ЮКасса</span>
        </div>
        <h3 className="font-cormorant font-bold text-2xl text-navy-800">Оплата услуги</h3>
        <p className="text-muted-foreground text-sm mt-1">{serviceName}</p>
      </div>

      {/* Итог */}
      <div className="bg-navy-50 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-navy-700 font-medium">{serviceName}</span>
            {SERVICE_BADGE[serviceType] && (
              <span className="text-[10px] font-bold bg-gold-400/20 text-gold-700 px-2 py-0.5 rounded-full">
                {SERVICE_BADGE[serviceType]}
              </span>
            )}
          </div>
          <span className="font-cormorant font-bold text-xl text-navy-800">{price} ₽</span>
        </div>
        <p className="text-xs text-muted-foreground">{SERVICE_DETAILS[serviceType]}</p>
        {(serviceType === "subscription_consult" || serviceType === "subscription_docs" || serviceType === "business_subscription") && (
          <p className="text-xs text-navy-500 mt-1.5 font-medium">Списывается ежемесячно · Неиспользованные действия сгорают</p>
        )}
      </div>

      {/* Email */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-navy-700 mb-1.5 block">
          Email для чека <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="ivan@example.ru"
          className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all"
          onKeyDown={(e) => e.key === "Enter" && onPay()}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          ЮКасса автоматически пришлёт кассовый чек на этот адрес
        </p>
      </div>

      {errorMsg && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 mb-4">
          <Icon name="AlertCircle" size={13} />{errorMsg}
        </div>
      )}

      <button
        onClick={onPay}
        disabled={loading}
        className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading
          ? <><Icon name="Loader" size={16} className="animate-spin" />Создаём платёж...</>
          : <><Icon name="CreditCard" size={16} />Перейти к оплате · {price} ₽</>
        }
      </button>

      {/* Способы оплаты */}
      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
        {["Visa", "МИР", "MC", "СБП", "SberPay"].map((m) => (
          <span key={m} className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-1 rounded-lg font-medium">{m}</span>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
        Оплата через ЮКасса. Нажимая «Перейти к оплате», вы соглашаетесь с{" "}
        <a href="/offer" target="_blank" className="underline hover:text-navy-600">офертой</a>.
      </p>
    </div>
  );
}
