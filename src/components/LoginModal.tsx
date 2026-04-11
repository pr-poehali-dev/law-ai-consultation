import { useState } from "react";
import Icon from "@/components/ui/icon";
import { login, register } from "@/lib/auth";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = "login" | "register";

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setPassword("");
    setPasswordConfirm("");
  };

  const handleLogin = async () => {
    if (!email || !password) { setError("Заполните все поля"); return; }
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onSuccess();
  };

  const handleRegister = async () => {
    if (!name.trim()) { setError("Введите имя"); return; }
    if (!email || !email.includes("@")) { setError("Некорректный email"); return; }
    if (!phone || phone.length < 7) { setError("Введите корректный телефон"); return; }
    if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
    if (password !== passwordConfirm) { setError("Пароли не совпадают"); return; }
    if (!agreed) { setError("Необходимо согласие на обработку персональных данных"); return; }

    setLoading(true);
    setError("");
    const res = await register({ name, email, phone, password, agreed_to_terms: true });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onSuccess();
  };

  const inputClass = "w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm animate-scale-in max-h-[95vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors z-10"
        >
          <Icon name="X" size={15} className="text-navy-600" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 gradient-navy rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="Scale" size={24} className="text-gold-400" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800">
              {mode === "login" ? "Вход в кабинет" : "Регистрация"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "login" ? "Введите email и пароль для входа" : "Создайте аккаунт бесплатно"}
            </p>
          </div>

          {/* Mode switcher */}
          <div className="flex rounded-xl border border-border overflow-hidden mb-5">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-navy-800 text-white" : "text-muted-foreground hover:text-navy-700"
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-navy-800 text-white" : "text-muted-foreground hover:text-navy-700"
              }`}
            >
              Регистрация
            </button>
          </div>

          <div className="space-y-3">
            {/* Name — register only */}
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                  Имя и фамилия <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  className={inputClass}
                  autoFocus
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                Электронная почта <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.ru"
                className={inputClass}
                autoFocus={mode === "login"}
              />
            </div>

            {/* Phone — register only */}
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className={inputClass}
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                Пароль <span className="text-red-500">*</span>
                {mode === "register" && (
                  <span className="text-muted-foreground font-normal"> (минимум 6 символов)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && mode === "login" && handleLogin()}
                  placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy-600"
                >
                  <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                </button>
              </div>
            </div>

            {/* Confirm password — register only */}
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                  Подтверждение пароля <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassConfirm ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10 ${
                      passwordConfirm && password !== passwordConfirm
                        ? "border-red-300 focus:border-red-400"
                        : passwordConfirm && password === passwordConfirm
                        ? "border-emerald-300 focus:border-emerald-400"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassConfirm(!showPassConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy-600"
                  >
                    <Icon name={showPassConfirm ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
                )}
                {passwordConfirm && password === passwordConfirm && (
                  <p className="text-xs text-emerald-600 mt-1">Пароли совпадают ✓</p>
                )}
              </div>
            )}

            {/* Agreement — register only */}
            {mode === "register" && (
              <label className="flex items-start gap-3 cursor-pointer group mt-1">
                <div
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    agreed ? "bg-navy-700 border-navy-700" : "border-border group-hover:border-navy-300"
                  }`}
                >
                  {agreed && <Icon name="Check" size={12} className="text-white" />}
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed select-none">
                  Я соглашаюсь с{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="text-navy-600 underline hover:text-navy-800"
                  >
                    политикой конфиденциальности
                  </a>{" "}
                  и даю согласие на обработку персональных данных
                </span>
              </label>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <Icon name="AlertCircle" size={14} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={mode === "login" ? handleLogin : handleRegister}
              disabled={loading}
              className="btn-gold w-full py-3.5 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                </>
              ) : (
                <>
                  <Icon name={mode === "login" ? "LogIn" : "UserPlus"} size={16} />
                  {mode === "login" ? "Войти" : "Создать аккаунт"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
