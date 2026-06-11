import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

interface FooterSectionProps {
  onNavigate: (section: string) => void;
}

export default function FooterSection({ onNavigate }: FooterSectionProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("https://ии-право.рф").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <footer style={{ background: "linear-gradient(160deg,#070f1f 0%,#0a1628 50%,#06111e 100%)" }}>

      {/* ── Верхняя полоса ── */}
      <div className="w-full h-px" style={{ background: "linear-gradient(to right,transparent,rgba(232,168,32,0.3),transparent)" }} />

      {/* ── CTA-строка ── */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="container mx-auto px-5 sm:px-8 max-w-6xl py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div>
            <p className="font-cormorant font-bold text-2xl sm:text-3xl text-white leading-tight">
              Готовы решить правовой вопрос?
            </p>
            <p className="text-white/40 text-sm mt-1">Попробуйте бесплатно — первые вопросы уже включены</p>
          </div>
          <button
            onClick={() => onNavigate("cabinet")}
            className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-[13px] transition-all active:scale-95 hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#e8a820,#d4920a)", color: "#0a1628", boxShadow: "0 4px 20px rgba(232,168,32,0.35)" }}
          >
            <Icon name="Sparkles" size={15} color="#0a1628" />
            Начать бесплатно
          </button>
        </div>
      </div>

      {/* ── Основной блок ── */}
      <div className="container mx-auto px-5 sm:px-8 max-w-6xl py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-12 sm:mb-16">

          {/* Бренд */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(232,168,32,0.2),rgba(232,168,32,0.08))", border: "1px solid rgba(232,168,32,0.25)" }}>
                <Icon name="Scale" size={18} color="#e8a820" />
              </div>
              <span className="font-cormorant font-bold text-xl text-white">
                ИИ-Право<span style={{ color: "#e8a820" }}>.рф</span>
              </span>
            </div>
            <p className="text-white/40 text-[13px] leading-relaxed mb-6 max-w-[200px]">
              AI-платформа юридической помощи, обученная на реальной судебной практике РФ.
            </p>
            {/* Значки качества */}
            <div className="flex flex-col gap-2">
              {[
                { icon: "ShieldCheck", text: "Данные защищены" },
                { icon: "Zap",         text: "Ответ за секунды" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={12} color="rgba(232,168,32,0.7)" />
                  <span className="text-white/35 text-[12px]">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Навигация */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase mb-5"
              style={{ color: "#e8a820" }}>
              Навигация
            </h4>
            <ul className="space-y-3.5">
              {[
                { id: "home",    label: "Главная" },
                { id: "services",label: "Услуги" },
                { id: "pricing", label: "Тарифы" },
                { id: "cabinet", label: "Личный кабинет" },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className="text-white/45 hover:text-white text-[13px] transition-colors duration-200 hover:translate-x-0.5 transform"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Услуги */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase mb-5"
              style={{ color: "#e8a820" }}>
              Услуги
            </h4>
            <ul className="space-y-3.5">
              {["AI-консультация", "Подготовка документов", "Исковое заявление", "Договор ГПХ", "Претензия"].map((s) => (
                <li key={s}>
                  <span className="text-white/40 text-[13px] leading-snug">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Контакты */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase mb-5"
              style={{ color: "#e8a820" }}>
              Контакты
            </h4>
            <ul className="space-y-4 mb-5">
              {[
                { icon: "Mail",  text: "povpartner@mail.ru" },
                { icon: "Phone", text: "+7 (978) 456-42-17" },
                { icon: "Clock", text: "Поддержка 24/7" },
              ].map((c) => (
                <li key={c.text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,32,0.1)", border: "1px solid rgba(232,168,32,0.15)" }}>
                    <Icon name={c.icon as Parameters<typeof Icon>[0]["name"]} size={13} color="#e8a820" />
                  </div>
                  <span className="text-white/50 text-[13px]">{c.text}</span>
                </li>
              ))}
            </ul>

            {/* Кнопка поделиться */}
            <style>{`
              @keyframes footer-shine {
                0% { transform: translateX(-100%) skewX(-15deg); }
                100% { transform: translateX(260%) skewX(-15deg); }
              }
              .footer-share-btn::after {
                content: '';
                position: absolute;
                top: 0; left: 0;
                width: 35%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
                animation: footer-shine 2.5s ease-in-out infinite;
              }
            `}</style>
            <button
              onClick={handleCopy}
              className={`footer-share-btn relative overflow-hidden flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl border transition-all duration-300`}
              style={{
                background: copied ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${copied ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <Icon
                name={copied ? "Check" : "Share2"}
                size={13}
                color={copied ? "#34d399" : "#e8a820"}
              />
              <div className="flex-1 text-left">
                <p className="text-[12px] font-semibold"
                  style={{ color: copied ? "#34d399" : "rgba(255,255,255,0.8)" }}>
                  {copied ? "Скопировано!" : "Поделиться сайтом"}
                </p>
                <p className="text-[10px]"
                  style={{ color: copied ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.25)" }}>
                  ии-право.рф
                </p>
              </div>
            </button>
          </div>

        </div>

        {/* ── Нижняя строка ── */}
        <div className="pt-8 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-white/25 text-[11px] leading-relaxed max-w-2xl">
              © 2026 ИИ-Право.рф · Информация носит справочный характер и не является юридической офертой.
              AI не заменяет живого юриста. По сложным делам рекомендуем консультацию специалиста.
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { path: "/privacy", label: "Конфиденциальность" },
                { path: "/terms",   label: "Соглашение" },
                { path: "/offer",   label: "Оферта" },
              ].map(({ path, label }, i) => (
                <span key={path} className="flex items-center gap-1">
                  {i > 0 && <span className="text-white/15 text-[10px]">·</span>}
                  <button
                    onClick={() => navigate(path)}
                    className="text-white/30 text-[11px] hover:text-white/60 transition-colors whitespace-nowrap px-1"
                  >
                    {label}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
