import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import { getUser, addPaidService } from "@/lib/auth";

const CREATE_URL = (func2url as Record<string, string>)["payment-create"];
const CHECK_URL = (func2url as Record<string, string>)["payment-check"];

export type ServiceType =
  | "consultation"
  | "document"
  | "expert"
  | "business"
  | "subscription_consult"
  | "subscription_docs";

interface PaymentModalProps {
  serviceType: ServiceType;
  serviceName: string;
  onClose: () => void;
  onSuccess: (serviceType: ServiceType) => void;
  showRegisterPrompt?: boolean;
  onRegisterAfterPay?: () => void;
}

const SERVICE_PRICES: Record<ServiceType, number> = {
  consultation: 100,
  document: 500,
  expert: 1500,
  business: 1000,
  subscription_consult: 1990,
  subscription_docs: 4990,
};

const SERVICE_DETAILS: Record<ServiceType, string> = {
  consultation: "3 юридических вопроса AI-юристу",
  document: "Один юридический документ (исковое, претензия или жалоба)",
  expert: "Живой юрист проанализирует ответ AI и даст заключение. Включает 3 вопроса к AI",
  business: "Подготовка договора и юридических документов для бизнеса",
  subscription_consult: "Безлимитные консультации AI-юриста — 1 месяц",
  subscription_docs: "Безлимитная подготовка документов — 1 месяц",
};

const SERVICE_BADGE: Partial<Record<ServiceType, string>> = {
  subscription_consult: "Выгодно",
  subscription_docs: "Выгодно",
};

type Step = "form" | "redirected" | "polling" | "success" | "error";

export default function PaymentModal({
  serviceType,
  serviceName,
  onClose,
  onSuccess,
  showRegisterPrompt,
  onRegisterAfterPay,
}: PaymentModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [invId, setInvId] = useState<number | null>(null);
  const [payUrl, setPayUrl] = useState<string>("");

  const price = SERVICE_PRICES[serviceType];

  // Загружаем email из профиля если пользователь авторизован
  useEffect(() => {
    getUser().then((u) => { if (u?.email) setEmail(u.email); });
  }, []);

  const handlePay = async () => {
    if (!email.includes("@")) {
      setErrorMsg("Введите корректный email — на него придёт чек");
      return;
    }
    setLoading(true);
    setErrorMsg("");

    try {
      const user = await getUser();
      const res = await fetch(CREATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: serviceType,
          email,
          user_id: user?.id ?? null,
          return_url: `${window.location.origin}/cabinet?payment=success`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания платежа");

      setInvId(data.inv_id);
      setPayUrl(data.pay_url);
      setStep("redirected");

      // Открываем страницу оплаты ЮКасса
      window.open(data.pay_url, "_blank");

      // Начинаем поллинг после небольшой паузы
      setTimeout(() => startPolling(data.inv_id), 6000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Ошибка создания платежа");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: number) => {
    setStep("polling");
    let attempts = 0;
    const maxAttempts = 36; // 3 минуты (каждые 5 сек)

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`${CHECK_URL}?inv_id=${id}`);
        const data = await res.json();
        if (data.paid || data.status === "paid") {
          // Начисляем услугу (fallback на случай если webhook не успел)
          await addPaidService(serviceType);
          setStep("success");
          setTimeout(() => onSuccess(serviceType), 2000);
          return;
        }
      } catch {
        // продолжаем поллинг
      }
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        setErrorMsg("Оплата не подтверждена в течение 3 минут. Если вы оплатили — обновите страницу.");
        setStep("error");
      }
    };

    setTimeout(poll, 5000);
  };

  const canClose = step !== "polling" && step !== "redirected";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
      />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md animate-scale-in">

        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors z-10"
          >
            <Icon name="X" size={15} className="text-navy-600" />
          </button>
        )}

        {/* === ФОРМА ВВОДА EMAIL === */}
        {step === "form" && (
          <div className="p-8">
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
              {(serviceType === "subscription_consult" || serviceType === "subscription_docs") && (
                <p className="text-xs text-navy-500 mt-1.5 font-medium">Списывается ежемесячно · Отмена в любой момент</p>
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.ru"
                className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all"
                onKeyDown={(e) => e.key === "Enter" && handlePay()}
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
              onClick={handlePay}
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
        )}

        {/* === ОЖИДАНИЕ ПЕРЕХОДА === */}
        {step === "redirected" && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <Icon name="ExternalLink" size={36} className="text-blue-500" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Страница оплаты открыта</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Оплатите в открывшейся вкладке. Если вкладка не открылась — нажмите кнопку ниже.
            </p>
            <button
              onClick={() => { if (payUrl) window.open(payUrl, "_blank"); }}
              className="text-sm text-navy-600 underline hover:text-navy-800"
            >
              Открыть страницу оплаты повторно
            </button>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Icon name="Loader" size={14} className="animate-spin" />
              Ожидаем подтверждения оплаты...
            </div>
          </div>
        )}

        {/* === ПОЛЛИНГ (ОЖИДАНИЕ) === */}
        {step === "polling" && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <Icon name="Clock" size={36} className="text-amber-500" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Проверяем оплату</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Ждём подтверждения от ЮКасса. Это обычно занимает до 30 секунд.
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-navy-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Не закрывайте это окно</p>
          </div>
        )}

        {/* === УСПЕХ === */}
        {step === "success" && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <Icon name="CheckCircle" size={36} className="text-emerald-500" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Оплата прошла!</h3>
            <p className="text-sm text-muted-foreground mb-1">Услуга активирована.</p>
            <p className="text-xs text-muted-foreground">Чек придёт на email от ЮКасса</p>

            {showRegisterPrompt && (
              <div className="mt-5 p-4 bg-navy-50 rounded-2xl text-left">
                <p className="text-sm font-semibold text-navy-800 mb-1">Зарегистрируйтесь, чтобы сохранить доступ</p>
                <p className="text-xs text-muted-foreground mb-3">История консультаций и документов останется в личном кабинете</p>
                <button
                  onClick={onRegisterAfterPay}
                  className="w-full btn-gold py-2.5 rounded-xl text-sm font-semibold"
                >
                  Создать аккаунт
                </button>
              </div>
            )}
          </div>
        )}

        {/* === ОШИБКА === */}
        {step === "error" && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <Icon name="XCircle" size={36} className="text-red-500" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Что-то пошло не так</h3>
            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setStep("form"); setErrorMsg(""); }}
                className="flex-1 btn-gold py-3 rounded-2xl text-sm font-semibold"
              >
                Попробовать снова
              </button>
              <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-border text-sm text-navy-600 hover:bg-slate-50">
                Закрыть
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}