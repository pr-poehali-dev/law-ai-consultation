import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import { getUser, addPaidService, fetchSafe, register, login } from "@/lib/auth";
import { ymGoal } from "@/lib/metrika";

const CREATE_URL = (func2url as Record<string, string>)["payment-create"];
const CHECK_URL = (func2url as Record<string, string>)["payment-check"];

export type ServiceType =
  | "consultation"
  | "document"
  | "expert"
  | "business"
  | "subscription_consult"
  | "subscription_docs"
  | "plan_starter"
  | "plan_starter_discount"
  | "plan_pro"
  | "plan_max"
  | "plan_max_expert"
  | "business_subscription"
  | "business_actions_10"
  | "business_actions_30"
  | "business_actions_50"
  | "business_actions_60"
  | "business_actions_150";

interface PaymentModalProps {
  serviceType: ServiceType;
  serviceName: string;
  onClose: () => void;
  onSuccess: (serviceType: ServiceType) => void;
  onRegisterAfterPay?: () => void;
}

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

type Step = "form" | "redirected" | "polling" | "success" | "register" | "error";

export default function PaymentModal({
  serviceType,
  serviceName,
  onClose,
  onSuccess,
  onRegisterAfterPay,
}: PaymentModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [invId, setInvId] = useState<number | null>(null);
  const [payUrl, setPayUrl] = useState<string>("");

  // Регистрация / вход после оплаты
  const [regMode, setRegMode] = useState<"register" | "login">("register");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  const price = SERVICE_PRICES[serviceType];

  // Блокируем скролл страницы пока модал открыт
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Если пользователь уже залогинен — подставляем email
  useEffect(() => {
    getUser().then((u) => {
      if (u?.email) setEmail(u.email);
    });
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
      const res = await fetchSafe(CREATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: serviceType,
          email,
          user_id: user?.id ?? null,
          return_url: user
            ? `${window.location.origin}/cabinet?payment=success`
            : `${window.location.origin}/?payment=success`,
        }),
      }, 30_000, 1);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания платежа");

      setInvId(data.inv_id);
      setPayUrl(data.pay_url);
      setStep("redirected");

      // КРИТИЧНО: сохраняем inv_id, service_type и email в localStorage немедленно.
      // Это гарантирует что оплата не потеряется если:
      //  - пользователь закрыл вкладку после оплаты
      //  - ЮКасса вернула на другой URL
      //  - браузер не вернулся на return_url автоматически
      const pendingPayload = {
        inv_id: data.inv_id,
        service_type: serviceType,
        email,
        created_at: Date.now(),
      };
      localStorage.setItem("pending_payment", JSON.stringify(pendingPayload));
      // Для незарегистрированных — также сохраняем inv_id отдельно
      if (!user) {
        localStorage.setItem("pending_inv_id", String(data.inv_id));
      }

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
    const maxAttempts = 36;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetchSafe(`${CHECK_URL}?inv_id=${id}`, { method: "GET" }, 15_000, 0);
        const data = await res.json();
        if (data.paid || data.status === "paid") {
          await addPaidService(serviceType, id);
          localStorage.removeItem("pending_payment");
          ymGoal("payment_success", { service: serviceType });
          const user = await getUser();
          if (!user) {
            // Незарегистрированный — показываем форму регистрации
            setStep("register");
          } else {
            setStep("success");
            setTimeout(() => onSuccess(serviceType), 2000);
          }
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

  const handleSubmitAfterPay = useCallback(async () => {
    if (!regPassword || regPassword.length < 6) { setRegError("Пароль — минимум 6 символов"); return; }
    if (regMode === "register" && regPassword !== regPasswordConfirm) { setRegError("Пароли не совпадают"); return; }
    setRegLoading(true);
    setRegError("");

    let authError: string | undefined;
    if (regMode === "register") {
      const res = await register({
        name: regName.trim() || "Пользователь",
        email,
        phone: "",
        password: regPassword,
        agreed_to_terms: true,
      });
      authError = res.error;
      if (!authError) ymGoal("register");
    } else {
      const res = await login(email, regPassword);
      authError = res.error;
      if (!authError) ymGoal("login");
    }

    setRegLoading(false);
    if (authError) { setRegError(authError); return; }

    // Начисляем услугу теперь, когда пользователь авторизован
    if (invId) {
      await addPaidService(serviceType, invId);
      localStorage.removeItem("pending_inv_id");
    }
    setStep("success");
    setTimeout(() => onSuccess(serviceType), 1500);
  }, [regMode, regName, email, regPassword, regPasswordConfirm, serviceType, invId, onSuccess]);

  const canClose = step !== "polling" && step !== "redirected";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
      />
      <div
        className="relative bg-card w-full sm:max-w-md sm:mx-4 sm:rounded-3xl rounded-t-3xl border border-border shadow-2xl animate-scale-in overflow-y-auto"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 16px)" }}
      >

        {/* Свайп-индикатор на мобиле */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

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
          <div className="px-5 py-6 sm:p-8 text-center">
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
          <div className="px-5 py-6 sm:p-8 text-center">
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

        {/* === РЕГИСТРАЦИЯ / ВХОД ПОСЛЕ ОПЛАТЫ === */}
        {step === "register" && (
          <div className="px-5 py-5 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                <Icon name="CheckCircle" size={24} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-cormorant font-bold text-xl text-navy-800 leading-tight">Оплата прошла!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Войдите или зарегистрируйтесь для доступа к кабинету</p>
              </div>
            </div>

            <div className="bg-navy-50 rounded-2xl p-3 mb-4">
              <p className="text-xs text-navy-600 font-medium">Куплено: <span className="text-navy-800">{serviceName}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">Услуга появится в кабинете сразу после входа</p>
            </div>

            {/* Переключатель регистрация / вход */}
            <div className="flex rounded-xl border border-border overflow-hidden mb-4">
              <button
                onClick={() => { setRegMode("register"); setRegError(""); }}
                className={`flex-1 py-2 text-sm font-semibold transition-all ${regMode === "register" ? "bg-navy-800 text-white" : "bg-white text-navy-600 hover:bg-slate-50"}`}
              >
                Регистрация
              </button>
              <button
                onClick={() => { setRegMode("login"); setRegError(""); }}
                className={`flex-1 py-2 text-sm font-semibold transition-all ${regMode === "login" ? "bg-navy-800 text-white" : "bg-white text-navy-600 hover:bg-slate-50"}`}
              >
                Уже есть аккаунт
              </button>
            </div>

            <div className="space-y-3">
              {regMode === "register" && (
                <div>
                  <label className="text-xs font-semibold text-navy-700 mb-1 block">Имя (необязательно)</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Иван"
                    className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Email</label>
                <input type="email" value={email} readOnly
                  className="w-full bg-slate-100 border border-border rounded-xl px-4 py-3 text-sm text-navy-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Пароль <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all"
                />
              </div>
              {regMode === "register" && (
                <div>
                  <label className="text-xs font-semibold text-navy-700 mb-1 block">Повторите пароль <span className="text-red-400">*</span></label>
                  <input
                    type="password"
                    value={regPasswordConfirm}
                    onChange={e => setRegPasswordConfirm(e.target.value)}
                    placeholder="Повторите пароль"
                    className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all"
                    onKeyDown={e => e.key === "Enter" && handleSubmitAfterPay()}
                  />
                </div>
              )}
            </div>

            {regError && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 mt-3">
                <Icon name="AlertCircle" size={13} />{regError}
              </div>
            )}

            <button
              onClick={handleSubmitAfterPay}
              disabled={regLoading}
              className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm mt-4 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {regLoading
                ? <><Icon name="Loader" size={16} className="animate-spin" />{regMode === "register" ? "Создаём аккаунт..." : "Входим..."}</>
                : regMode === "register"
                  ? <><Icon name="UserPlus" size={16} />Зарегистрироваться и войти</>
                  : <><Icon name="LogIn" size={16} />Войти в кабинет</>
              }
            </button>
            {regMode === "register" && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Регистрируясь, вы соглашаетесь с <a href="/offer" target="_blank" className="underline">офертой</a>
              </p>
            )}
          </div>
        )}

        {/* === УСПЕХ === */}
        {step === "success" && (
          <div className="px-5 py-6 sm:p-8 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <Icon name="CheckCircle" size={36} className="text-emerald-500" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Оплата прошла!</h3>
            <p className="text-sm text-muted-foreground mb-1">Услуга активирована.</p>
            <p className="text-xs text-muted-foreground">Переходим в кабинет...</p>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* === ОШИБКА === */}
        {step === "error" && (
          <div className="px-5 py-6 sm:p-8 text-center">
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