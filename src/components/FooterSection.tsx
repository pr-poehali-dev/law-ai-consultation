import Icon from "@/components/ui/icon";

interface FooterSectionProps {
  onNavigate: (section: string) => void;
}

export default function FooterSection({ onNavigate }: FooterSectionProps) {
  return (
    <footer className="gradient-navy text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Icon name="Scale" size={18} className="text-gold-400" />
              </div>
              <span className="font-cormorant font-bold text-xl">
                Юрист<span className="text-gradient-gold"> AI</span>
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
                { icon: "Mail", text: "help@yurist-ai.ru" },
                { icon: "Phone", text: "+7 (800) 555-01-20" },
                { icon: "Clock", text: "Поддержка 24/7" },
              ].map((contact) => (
                <li key={contact.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name={contact.icon as any} size={14} className="text-gold-400" />
                  </div>
                  <span className="text-white/65 text-sm">{contact.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/35 text-xs text-center md:text-left max-w-2xl leading-relaxed">
              © 2026 Юрист AI. Информация на сайте носит справочный характер и не является юридической офертой. AI не заменяет живого юриста. По сложным делам рекомендуем консультацию у специалиста.
            </p>
            <div className="flex items-center gap-5 shrink-0">
              {["Политика конфиденциальности", "Пользовательское соглашение"].map((link) => (
                <button key={link} className="text-white/40 text-xs hover:text-white/70 transition-colors whitespace-nowrap">
                  {link}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
