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
    <footer className="gradient-navy text-white">
      <div className="container mx-auto px-4 py-10 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 mb-8 sm:mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Icon name="Scale" size={18} className="text-gold-400" />
              </div>
              <span className="font-cormorant font-bold text-xl">
                ИИ-Право<span className="text-gradient-gold">.рф</span>
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-5">
              AI-платформа юридической помощи, обученная на реальной судебной практике.
            </p>
            <div className="flex gap-3">
              {["MessageSquare", "Send", "Phone"].map((icon) => (
                <button
                  key={icon}
                  className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <Icon name={icon as any} size={15} className="text-white/70" />
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Навигация</h4>
            <ul className="space-y-3">
              {[
                { id: "home", label: "Главная" },
                { id: "services", label: "Услуги" },
                { id: "pricing", label: "Тарифы" },
                { id: "cabinet", label: "Личный кабинет" },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className="text-white/55 hover:text-white text-sm transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Услуги</h4>
            <ul className="space-y-3">
              {["AI-консультация", "Подготовка документов", "Исковое заявление", "Договор ГПХ", "Претензия"].map((s) => (
                <li key={s}>
                  <span className="text-white/55 text-sm">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Контакты</h4>
            <ul className="space-y-4">
              {[
                { icon: "Mail", text: "povpartner@mail.ru" },
                { icon: "Phone", text: "+7 (978) 456-42-17" },
                { icon: "Clock", text: "Поддержка 24/7" },
              ].map((contact) => (
                <li key={contact.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name={contact.icon as any} size={14} className="text-gold-400" />
                  </div>
                  <span className="text-white/65 text-sm">{contact.text}</span>
                </li>
              ))}
              <li className="pt-2">
                <style>{`
                  @keyframes copy-shine {
                    0% { transform: translateX(-100%) skewX(-15deg); }
                    100% { transform: translateX(250%) skewX(-15deg); }
                  }
                  @keyframes copy-success-ring {
                    0% { transform: scale(0.8); opacity: 1; }
                    100% { transform: scale(1.8); opacity: 0; }
                  }
                  .copy-btn-shine::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0;
                    width: 40%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
                    animation: copy-shine 2.2s ease-in-out infinite;
                  }
                  .copy-btn-success::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 14px;
                    border: 1.5px solid rgba(52,211,153,0.6);
                    animation: copy-success-ring 0.6s ease-out forwards;
                  }
                `}</style>
                <button
                  onClick={handleCopy}
                  className={`relative overflow-hidden flex items-center gap-2.5 w-full px-4 py-2.5 rounded-2xl border transition-all duration-300 group
                    ${copied
                      ? "copy-btn-success bg-emerald-500/15 border-emerald-400/40"
                      : "copy-btn-shine bg-gradient-to-r from-white/8 to-white/5 border-white/15 hover:border-gold-400/50 hover:from-gold-400/10 hover:to-white/8"
                    }`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                    copied ? "bg-emerald-400/20" : "bg-white/10 group-hover:bg-gold-400/15"
                  }`}>
                    <Icon
                      name={copied ? "Check" : "Share2"}
                      size={13}
                      className={`transition-all duration-300 ${copied ? "text-emerald-400" : "text-gold-400"}`}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-semibold tracking-wide transition-colors duration-300 ${
                      copied ? "text-emerald-400" : "text-white/90 group-hover:text-white"
                    }`}>
                      {copied ? "Ссылка скопирована!" : "Поделиться сайтом"}
                    </p>
                    <p className={`text-[10px] transition-colors duration-300 ${
                      copied ? "text-emerald-400/70" : "text-white/35 group-hover:text-white/50"
                    }`}>
                      {copied ? "ии-право.рф" : "Скопировать красивую ссылку"}
                    </p>
                  </div>
                  {!copied && (
                    <Icon name="Copy" size={12} className="text-white/25 group-hover:text-gold-400/60 transition-colors duration-300 shrink-0" />
                  )}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/35 text-xs text-center md:text-left max-w-2xl leading-relaxed">
              © 2026 ИИ-Право.рф. Информация на сайте носит справочный характер и не является юридической офертой. AI не заменяет живого юриста. По сложным делам рекомендуем консультацию у специалиста.
            </p>
            <div className="flex items-center gap-5 shrink-0 flex-wrap justify-center md:justify-end">
              <button onClick={() => navigate("/privacy")} className="text-white/40 text-xs hover:text-white/70 transition-colors whitespace-nowrap">
                Политика конфиденциальности
              </button>
              <button onClick={() => navigate("/terms")} className="text-white/40 text-xs hover:text-white/70 transition-colors whitespace-nowrap">
                Пользовательское соглашение
              </button>
              <button onClick={() => navigate("/offer")} className="text-white/40 text-xs hover:text-white/70 transition-colors whitespace-nowrap">
                Публичная оферта
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}