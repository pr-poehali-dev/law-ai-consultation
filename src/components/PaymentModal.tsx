import { useState } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const CREATE_URL = func2url["payment-create"];
const CHECK_URL = func2url["payment-check"];

export type ServiceType =
  | "consultation"
  | "trial"
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
  trial: 50,
  document: 500,
  expert: 1500,
  business: 1000,
  subscription_consult: 1990,
  subscription_docs: 4990,
};

const SERVICE_DETAILS: Record<ServiceType, string> = {
  consultation: "3 юридических вопроса AI-юристу",
  trial: "1 юридический вопрос AI-юристу — вводный тариф",
  document: "Один юридический документ (исковое, претензия или жалоба)",
  expert: "Живой юрист проанализирует ответ AI или документ и даст заключение. Включает 3 вопроса к AI, если консультация не куплена отдельно",
  business: "Подготовка договора и юридических документов для бизнеса",
  subscription_consult: "Безлимитные консультации AI-юриста — 1 месяц",
  subscription_docs: "Безлимитная подготовка документов — 1 месяц",
};

const SERVICE_BADGE: Partial<Record<ServiceType, string>> = {
  subscription_consult: "Выгодно",
  subscription_docs: "Выгодно",
  trial: "−50%",
};

type Step = "method" | "waiting" | "polling" | "success" | "error";
type Method = "bank_card" | "sbp";

export default function PaymentModal({ serviceType, serviceName, onClose, onSuccess, showRegisterPrompt, onRegisterAfterPay }: PaymentModalProps) {
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Method>("bank_card");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");

  const price = SERVICE_PRICES[serviceType];

  const handlePay = async () => {
    if (!email.includes("@")) {
      setErrorMsg("Введите корректный email — на него придёт чек");
      return;
    }
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(CREATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: serviceType,
          payment_method: method,
          email,
          return_url: window.location.href,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания платежа");

      setPaymentId(data.payment_id);
      setConfirmationUrl(data.confirmation_url);
      setStep("waiting");

      // Открываем ЮKassa в новой вкладке
      window.open(data.confirmation_url, "_blank");

      // Начинаем поллинг статуса
      startPolling(data.payment_id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Ошибка оплаты");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (pid: string) => {
    setStep("polling");
    let attempts = 0;
    const maxAttempts = 24; // 2 минуты (каждые 5 сек)

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`${CHECK_URL}?payment_id=${pid}`);
        const data = await res.json();
        if (data.paid || data.status === "succeeded") {
          setStep("success");
          setTimeout(() => onSuccess(serviceType), 2000);
          return;
        }
        if (data.status === "canceled") {
          setErrorMsg("Платёж отменён. Попробуйте ещё раз.");
          setStep("error");
          return;
        }
      } catch {
        // продолжаем поллинг
      }
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        setErrorMsg("Время ожидания истекло. Если вы оплатили — обновите страницу.");
        setStep("error");
      }
    };

    setTimeout(poll, 5000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={step !== "polling" && step !== "waiting" ? onClose : undefined} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md animate-scale-in">

        {/* Close */}
        {step !== "success" && step !== "polling" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors z-10"
          >
            <Icon name="X" size={15} className="text-navy-600" />
          </button>
        )}

        {/* === STEP: METHOD === */}
        {step === "method" && (
          <div className="p-8">
            <div className="mb-5">
              <div className="inline-flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-1.5 mb-4">
                <Icon name="ShieldCheck" size={14} className="text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">Защищённая оплата · ЮKassa</span>
              </div>
              <h3 className="font-cormorant font-bold text-2xl text-navy-800">Оплата услуги</h3>
              <p className="text-muted-foreground text-sm mt-1">{serviceName}</p>
            </div>

            {/* Summary */}
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

            {/* Method selector */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-navy-700 uppercase tracking-wider mb-3">Способ оплаты</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod("bank_card")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    method === "bank_card"
                      ? "border-navy-600 bg-navy-50"
                      : "border-border hover:border-navy-200"
                  }`}
                >
                  <Icon name="CreditCard" size={24} className={method === "bank_card" ? "text-navy-700" : "text-muted-foreground"} />
                  <span className={`text-sm font-medium ${method === "bank_card" ? "text-navy-800" : "text-muted-foreground"}`}>
                    Банковская карта
                  </span>
                  <span className="text-xs text-muted-foreground">Visa, МИР, MC</span>
                </button>
                <button
                  onClick={() => setMethod("sbp")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    method === "sbp"
                      ? "border-navy-600 bg-navy-50"
                      : "border-border hover:border-navy-200"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${method === "sbp" ? "bg-navy-700 text-white" : "bg-slate-200 text-navy-600"}`}>
                    СБП
                  </div>
                  <span className={`text-sm font-medium ${method === "sbp" ? "text-navy-800" : "text-muted-foreground"}`}>
                    СБП
                  </span>
                  <span className="text-xs text-muted-foreground">Быстрые платежи</span>
                </button>
              </div>
            </div>

            {/* Email */}
            <div className="mb-5">
              <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                Email для чека <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.ru"
                className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors"
              />
            </div>

            {errorMsg && (
              <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={loading || !email}
              className="btn-gold w-full py-4 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                </>
              ) : (
                <>
                  <Icon name="Lock" size={16} />
                  Оплатить {price} ₽
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-3">
              Нажимая «Оплатить», вы соглашаетесь с{" "}
              <a href="/offer" target="_blank" className="underline hover:text-navy-700 transition-colors">публичной офертой</a>
              {" "}и{" "}
              <a href="/privacy" target="_blank" className="underline hover:text-navy-700 transition-colors">политикой конфиденциальности</a>
            </p>
          </div>
        )}

        {/* === STEP: WAITING / POLLING === */}
        {(step === "waiting" || step === "polling") && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Icon name="Loader" size={28} className="text-gold-400" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-3">
              {step === "waiting" ? "Открываем страницу оплаты..." : "Ожидаем подтверждения..."}
            </h3>
            <p className="text-muted-foreground text-sm mb-2">
              {step === "waiting"
                ? "Страница ЮKassa открылась в новой вкладке. Завершите оплату там."
                : "Проверяем статус платежа каждые 5 секунд"}
            </p>
            <div className="flex justify-center gap-2 mt-4 mb-6">
              <span className="typing-dot w-2.5 h-2.5 bg-navy-400 rounded-full inline-block" />
              <span className="typing-dot w-2.5 h-2.5 bg-navy-400 rounded-full inline-block" />
              <span className="typing-dot w-2.5 h-2.5 bg-navy-400 rounded-full inline-block" />
            </div>
            {confirmationUrl && (
              <a
                href={confirmationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 font-medium underline"
              >
                <Icon name="ExternalLink" size={14} />
                Открыть страницу оплаты снова
              </a>
            )}
          </div>
        )}

        {/* === STEP: SUCCESS === */}
        {step === "success" && (
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
              <Icon name="CheckCircle" size={40} className="text-emerald-500" />
            </div>
            <h3 className="font-cormorant font-bold text-3xl text-navy-800 mb-3">Оплачено!</h3>
            <p className="text-navy-700 font-medium mb-1">{serviceName}</p>
            <p className="text-sm text-muted-foreground mb-5">Чек отправлен на {email}</p>

            {showRegisterPrompt && onRegisterAfterPay ? (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="UserPlus" size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-800 mb-1">Зарегистрируйтесь, чтобы не потерять доступ</p>
                    <p className="text-xs text-blue-700 mb-3">
                      Без регистрации ваши консультации и документы не сохранятся. Регистрация занимает 30 секунд.
                    </p>
                    <button
                      onClick={onRegisterAfterPay}
                      className="btn-gold px-5 py-2 rounded-xl text-sm font-semibold w-full"
                    >
                      Зарегистрироваться
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={onClose} className="btn-gold px-8 py-3 rounded-xl font-semibold text-sm">
                Перейти в кабинет
              </button>
            )}
          </div>
        )}

        {/* === STEP: ERROR === */}
        {step === "error" && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Icon name="AlertCircle" size={32} className="text-red-500" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-3">Что-то пошло не так</h3>
            <p className="text-muted-foreground text-sm mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={() => setStep("method")} className="flex-1 btn-gold py-3 rounded-xl font-semibold text-sm">
                Попробовать снова
              </button>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-navy-600 hover:bg-slate-50 transition-colors text-sm font-medium">
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}