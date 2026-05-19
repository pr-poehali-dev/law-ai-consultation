import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";
import { getUser, addPaidService, fetchSafe, register, login } from "@/lib/auth";
import { ymGoal } from "@/lib/metrika";
import PaymentStepForm from "@/components/payment/PaymentStepForm";
import PaymentStepStatus from "@/components/payment/PaymentStepStatus";
import PaymentStepRegister from "@/components/payment/PaymentStepRegister";

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

type Step = "form" | "redirected" | "polling" | "success" | "register" | "error";

export default function PaymentModal({
  serviceType,
  serviceName,
  onClose,
  onSuccess,
  onRegisterAfterPay: _onRegisterAfterPay,
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

      // Поллинг только для незалогиненных: залогиненных после редиректа
      // обработает useCabinetPayment.pollPaymentStatus в Cabinet — двойной поллинг не нужен
      if (!user) {
        setTimeout(() => startPolling(data.inv_id), 6000);
      }
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
    const maxAttempts = 300; // 300 × 3с = 15 минут (Robokassa может задержать вебхук)

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
        setTimeout(poll, 3000);
      } else {
        setErrorMsg("Оплата не подтверждена автоматически. Если вы оплатили — обновите страницу, ресурсы появятся.");
        setStep("error");
      }
    };

    setTimeout(poll, 3000);
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
    } else {
      const res = await login(email, regPassword);
      authError = res.error;
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

        {step === "form" && (
          <PaymentStepForm
            serviceType={serviceType}
            serviceName={serviceName}
            email={email}
            onEmailChange={setEmail}
            loading={loading}
            errorMsg={errorMsg}
            onPay={handlePay}
          />
        )}

        {(step === "redirected" || step === "polling" || step === "success" || step === "error") && (
          <PaymentStepStatus
            step={step}
            payUrl={payUrl}
            errorMsg={errorMsg}
            onRetry={() => { setStep("form"); setErrorMsg(""); }}
            onClose={onClose}
          />
        )}

        {step === "register" && (
          <PaymentStepRegister
            serviceName={serviceName}
            email={email}
            regMode={regMode}
            regName={regName}
            regPassword={regPassword}
            regPasswordConfirm={regPasswordConfirm}
            regLoading={regLoading}
            regError={regError}
            onModeChange={(m) => { setRegMode(m); setRegError(""); }}
            onNameChange={setRegName}
            onPasswordChange={setRegPassword}
            onPasswordConfirmChange={setRegPasswordConfirm}
            onSubmit={handleSubmitAfterPay}
          />
        )}

      </div>
    </div>
  );
}