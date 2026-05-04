import { useState } from "react";
import Icon from "@/components/ui/icon";
import { login, register, forgotPassword } from "@/lib/auth";
import { ymGoal } from "@/lib/metrika";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
  freeTrial?: boolean;
  initialMode?: "login" | "register";
}

type Mode = "login" | "register" | "forgot";

export default function LoginModal({ onClose, onSuccess, freeTrial = false, initialMode }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (freeTrial ? "register" : "login"));

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [trialGranted, setTrialGranted] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(""); setForgotSent(false); };

  // ── Забыл пароль ──
  const handleForgot = async () => {
    if (!forgotEmail || !forgotEmail.includes("@")) { setError("Введите корректный email"); return; }
    setLoading(true); setError("");
    const res = await forgotPassword(forgotEmail);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setForgotSent(true);
  };

  // ── Вход ──
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { setError("Заполните email и пароль"); return; }
    setLoading(true); setLoadingSlow(false); setError("");
    const slowTimer = setTimeout(() => setLoadingSlow(true), 6000);
    const res = await login(loginEmail, loginPassword);
    clearTimeout(slowTimer);
    setLoading(false); setLoadingSlow(false);
    if (res.error) { setError(res.error); return; }
    ymGoal("login");
    onSuccess();
  };

  // ── Регистрация ──
  const handleRegister = async () => {
    if (!regEmail || !regEmail.includes("@")) { setError("Введите корректный email"); return; }
    if (regPassword.length < 6) { setError("Пароль — не менее 6 символов"); return; }
    if (regPassword !== regPasswordConfirm) { setError("Пароли не совпадают"); return; }
    if (!agreed) { setError("Необходимо согласие на обработку персональных данных"); return; }

    setLoading(true); setError("");
    const savedRefCode = localStorage.getItem("ref_code") || "";
    const res = await register({
      name: regName.trim() || "Пользователь",
      email: regEmail,
      phone: regPhone || "",
      password: regPassword,
      agreed_to_terms: true,
      free_trial: freeTrial,
      ref_code: savedRefCode || undefined,
    });
    if (savedRefCode) localStorage.removeItem("ref_code");
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    if (freeTrial && (res as { free_trial_granted?: boolean }).free_trial_granted) setTrialGranted(true);
    ymGoal("register");
    setSuccess(true);
  };

  const inputCls = "w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 transition-all";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}>
      <div className="absolute inset-0 bg-navy-900/75" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm animate-scale-in overflow-y-auto" style={{ maxHeight: "calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors z-10">
          <Icon name="X" size={15} className="text-navy-600" />
        </button>

        <div className="p-8">

          {/* Успешная регистрация */}
          {success && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Icon name="CheckCircle" size={36} className="text-emerald-500" />
              </div>
              <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Добро пожаловать!</h3>
              <p className="text-sm text-muted-foreground mb-1">Аккаунт успешно создан</p>
              {regName && <p className="font-semibold text-navy-800 mb-3">{regName}</p>}
              <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <Icon name="Gift" size={20} className="text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-800 text-left"><strong>1 бесплатный вопрос</strong> уже добавлен на ваш счёт — задайте его прямо сейчас!</p>
              </div>
              <button onClick={onSuccess} className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm">
                Задать вопрос AI-юристу
              </button>
            </div>
          )}

          {!success && (
            <>
              {/* Логотип */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 gradient-navy rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Icon name="Scale" size={24} className="text-gold-400" />
                </div>
                <h3 className="font-cormorant font-bold text-2xl text-navy-800">
                  {mode === "login" ? "Вход в кабинет" : "Регистрация"}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {mode === "login" ? "Введите email и пароль" : showRegisterAfterPay ? "Оплата прошла! Зарегистрируйтесь, чтобы получить доступ к услуге" : freeTrial ? "Зарегистрируйтесь и получите 1 вопрос бесплатно" : "Создайте аккаунт — 1 вопрос бесплатно"}
                </p>
              </div>

              {/* Переключатель */}
              <div className="flex rounded-xl border border-border overflow-hidden mb-6 bg-slate-50">
                <button
                  onClick={() => switchMode("login")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${mode === "login" ? "bg-navy-800 text-white shadow-sm" : "text-muted-foreground hover:text-navy-700"}`}
                >
                  Вход
                </button>
                <button
                  onClick={() => switchMode("register")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${mode === "register" ? "bg-navy-800 text-white shadow-sm" : "text-muted-foreground hover:text-navy-700"}`}
                >
                  Регистрация
                </button>
              </div>

              {/* ── ВХОД ── */}
              {mode === "login" && (
                <div className="space-y-4 animate-modal-section">
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Email <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ivan@example.ru"
                      className={inputCls}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Пароль <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input
                        type={showLoginPass ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputCls} pr-11`}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass(!showLoginPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy-600"
                      >
                        <Icon name={showLoginPass ? "EyeOff" : "Eye"} size={16} />
                      </button>
                    </div>
                  </div>
                  {error && (
                    <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                      <Icon name="AlertCircle" size={13} />{error}
                    </div>
                  )}
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading
                      ? <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
                      : <><Icon name="LogIn" size={16} />Войти</>
                    }
                  </button>
                  {loadingSlow && (
                    <p className="text-xs text-center text-muted-foreground animate-fade-in">
                      Сервер просыпается, подождите несколько секунд...
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="w-full text-xs text-muted-foreground hover:text-navy-700 transition-colors text-center mt-1"
                  >
                    Забыли пароль?
                  </button>
                </div>
              )}

              {/* ── ЗАБЫЛ ПАРОЛЬ ── */}
              {mode === "forgot" && (
                <div className="space-y-4 animate-modal-section">
                  {forgotSent ? (
                    <div className="text-center py-4 animate-fade-in">
                      <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Icon name="Mail" size={28} className="text-blue-500" />
                      </div>
                      <h4 className="font-semibold text-navy-800 mb-2">Письмо отправлено</h4>
                      <p className="text-sm text-muted-foreground mb-5">Проверьте почту {forgotEmail} — там новый пароль для входа.</p>
                      <button
                        onClick={() => { switchMode("login"); setLoginEmail(forgotEmail); }}
                        className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm"
                      >
                        Войти с новым паролем
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Введите email, указанный при регистрации — мы отправим новый пароль.
                      </p>
                      <div>
                        <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Email <span className="text-red-400">*</span></label>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="ivan@example.ru"
                          className={inputCls}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                        />
                      </div>
                      {error && (
                        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                          <Icon name="AlertCircle" size={13} />{error}
                        </div>
                      )}
                      <button
                        onClick={handleForgot}
                        disabled={loading}
                        className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {loading
                          ? <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
                          : <><Icon name="Send" size={16} />Отправить новый пароль</>
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="w-full text-xs text-muted-foreground hover:text-navy-700 transition-colors text-center"
                      >
                        Вернуться ко входу
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── РЕГИСТРАЦИЯ ── */}
              {mode === "register" && (
                <div className="space-y-3 animate-modal-section">
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">
                      ФИО <span className="text-muted-foreground font-normal">(необязательно)</span>
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Иван Иванов"
                      className={inputCls}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Email <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ivan@example.ru"
                      className={inputCls}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">
                      Телефон <span className="text-muted-foreground font-normal">(необязательно)</span>
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Пароль <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input
                        type={showRegPass ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Не менее 6 символов"
                        className={`${inputCls} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass(!showRegPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy-600"
                      >
                        <Icon name={showRegPass ? "EyeOff" : "Eye"} size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Повторите пароль <span className="text-red-400">*</span></label>
                    <input
                      type="password"
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className={inputCls}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    />
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-1">
                    <div
                      className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${agreed ? "bg-navy-700 border-navy-700" : "border-border group-hover:border-navy-300"}`}
                      onClick={() => setAgreed(!agreed)}
                    >
                      {agreed && <Icon name="Check" size={10} className="text-white" />}
                    </div>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Я согласен(а) с{" "}
                      <a href="/offer" target="_blank" className="text-navy-600 underline hover:text-navy-800">офертой</a>{" "}и{" "}
                      <a href="/privacy" target="_blank" className="text-navy-600 underline hover:text-navy-800">политикой обработки данных</a>
                    </span>
                  </label>
                  {error && (
                    <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                      <Icon name="AlertCircle" size={13} />{error}
                    </div>
                  )}
                  <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                  >
                    {loading
                      ? <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
                      : <><Icon name="UserPlus" size={16} />Создать аккаунт</>
                    }
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}