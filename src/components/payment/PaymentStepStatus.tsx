import Icon from "@/components/ui/icon";

type StatusStep = "redirected" | "polling" | "success" | "error";

interface Props {
  step: StatusStep;
  payUrl: string;
  errorMsg: string;
  onRetry: () => void;
  onClose: () => void;
}

export default function PaymentStepStatus({ step, payUrl, errorMsg, onRetry, onClose }: Props) {
  if (step === "redirected") {
    return (
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
    );
  }

  if (step === "polling") {
    return (
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
    );
  }

  if (step === "success") {
    return (
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
    );
  }

  // error
  return (
    <div className="px-5 py-6 sm:p-8 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
        <Icon name="XCircle" size={36} className="text-red-500" />
      </div>
      <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Что-то пошло не так</h3>
      <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 btn-gold py-3 rounded-2xl text-sm font-semibold"
        >
          Попробовать снова
        </button>
        <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-border text-sm text-navy-600 hover:bg-slate-50">
          Закрыть
        </button>
      </div>
    </div>
  );
}
