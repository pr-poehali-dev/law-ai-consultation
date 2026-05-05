import Icon from "@/components/ui/icon";

interface Props {
  serviceName: string;
  email: string;
  regMode: "register" | "login";
  regName: string;
  regPassword: string;
  regPasswordConfirm: string;
  regLoading: boolean;
  regError: string;
  onModeChange: (m: "register" | "login") => void;
  onNameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onPasswordConfirmChange: (v: string) => void;
  onSubmit: () => void;
}

export default function PaymentStepRegister({
  serviceName,
  email,
  regMode,
  regName,
  regPassword,
  regPasswordConfirm,
  regLoading,
  regError,
  onModeChange,
  onNameChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onSubmit,
}: Props) {
  return (
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
          onClick={() => onModeChange("register")}
          className={`flex-1 py-2 text-sm font-semibold transition-all ${regMode === "register" ? "bg-navy-800 text-white" : "bg-white text-navy-600 hover:bg-slate-50"}`}
        >
          Регистрация
        </button>
        <button
          onClick={() => onModeChange("login")}
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
              onChange={e => onNameChange(e.target.value)}
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
            onChange={e => onPasswordChange(e.target.value)}
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
              onChange={e => onPasswordConfirmChange(e.target.value)}
              placeholder="Повторите пароль"
              className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all"
              onKeyDown={e => e.key === "Enter" && onSubmit()}
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
        onClick={onSubmit}
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
  );
}
