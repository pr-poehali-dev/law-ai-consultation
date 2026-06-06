import { useState } from "react";
import Icon from "@/components/ui/icon";

interface ServicesSectionProps {
  onSelectService: (service: string) => void;
}

const SERVICES = [
  {
    icon: "MessageCircle",
    title: "AI-консультация",
    desc: "Задайте любой правовой вопрос. AI отвечает мгновенно на основе актуальной судебной практики. При покупке консультации вы можете задать 3 вопроса — AI расширенно поможет разобраться в вашей ситуации.",
    tags: ["Трудовое право", "Семейное", "ЖКХ", "Кредиты"],
    price: "1 490 ₽",
    priceNote: "пакет Старт · 30 вопросов",
    color: "from-blue-500/10 to-blue-600/5",
    accent: "text-blue-600",
    iconBg: "bg-blue-50",
    badge: "bg-blue-50 text-blue-700",
    arrow: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
  },
  {
    icon: "FileSignature",
    title: "Готовые документы",
    desc: "Исковые заявления, претензии, жалобы — AI генерирует полный документ по вашим данным за минуты.",
    tags: ["Исковое", "Претензия", "Жалоба"],
    price: "990 ₽",
    priceNote: "за документ",
    color: "from-amber-500/10 to-amber-600/5",
    accent: "text-amber-600",
    iconBg: "bg-amber-50",
    badge: "bg-amber-50 text-amber-700",
    arrow: "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
  },
  {
    icon: "UserCheck",
    title: "Консультация юриста",
    desc: "Живой юрист разберёт вашу ситуацию, ответит на вопросы и подскажет стратегию действий.",
    tags: ["Сложные дела", "Личная консультация"],
    price: "990 ₽",
    priceNote: "консультация",
    color: "from-emerald-500/10 to-emerald-600/5",
    accent: "text-emerald-600",
    iconBg: "bg-emerald-50",
    badge: "bg-emerald-50 text-emerald-700",
    arrow: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
  },
  {
    icon: "Building2",
    title: "Для бизнеса",
    desc: "Корпоративные договоры, трудовые соглашения, защита интеллектуальной собственности.",
    tags: ["Корпоративное", "IP", "HR"],
    price: "1 000 ₽",
    priceNote: "за договор",
    color: "from-purple-500/10 to-purple-600/5",
    accent: "text-purple-600",
    iconBg: "bg-purple-50",
    badge: "bg-purple-50 text-purple-700",
    arrow: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white",
  },
];

const FEATURES = [
  {
    icon: "Zap",
    title: "Мгновенный ответ",
    desc: "AI анализирует ситуацию и даёт развёрнутый ответ за секунды — без очередей и ожидания.",
    color: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    icon: "BookOpen",
    title: "Актуальная база законов",
    desc: "Судебная практика, ГК, ТК, ЖК РФ и сотни нормативных актов — всегда в актуальном состоянии.",
    color: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    icon: "FileCheck",
    title: "Готовые документы",
    desc: "Исковые заявления, претензии, жалобы — документы генерируются под вашу конкретную ситуацию.",
    color: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
  {
    icon: "Shield",
    title: "Конфиденциально",
    desc: "Ваши данные защищены. Мы не передаём персональную информацию третьим лицам.",
    color: "bg-purple-50",
    iconColor: "text-purple-500",
  },
  {
    icon: "Users",
    title: "Живой юрист на связи",
    desc: "С пакета «Старт» — отправка документа на проверку и личный чат с практикующим юристом.",
    color: "bg-rose-50",
    iconColor: "text-rose-500",
  },
  {
    icon: "Smartphone",
    title: "Всегда под рукой",
    desc: "Работает как мобильное приложение. Доступно 24/7 — с телефона, планшета или компьютера.",
    color: "bg-sky-50",
    iconColor: "text-sky-500",
  },
];

const STATS = [
  { value: "50 000+", label: "пользователей" },
  { value: "120+", label: "типов документов" },
  { value: "24/7", label: "доступность" },
  { value: "99%", label: "довольных клиентов" },
];

export default function ServicesSection({ onSelectService }: ServicesSectionProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="services" className="bg-white">

      {/* ── Услуги ── */}
      <div className="py-16 sm:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-16">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-3 sm:mb-4">
              Наши услуги
            </span>
            <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 mb-3 sm:mb-4">
              Всё, что нужно для{" "}
              <span className="text-gradient-gold">правовой защиты</span>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto px-4 sm:px-0">
              AI-юрист готов помочь в любой ситуации — от простого вопроса до сложного судебного дела
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {SERVICES.map((service, i) => (
              <div
                key={service.title}
                className={`relative rounded-3xl p-6 border border-border bg-gradient-to-br ${service.color} shadow-sm hover:shadow-xl hover:shadow-navy-900/8 card-hover cursor-pointer group`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectService(service.title)}
              >
                <div className={`w-12 h-12 rounded-2xl ${service.iconBg} shadow-sm flex items-center justify-center mb-5 transition-transform duration-300 ${hovered === i ? "scale-110" : ""}`}>
                  <Icon name={service.icon} size={24} className={service.accent} />
                </div>
                <h3 className="font-golos font-semibold text-navy-800 text-lg mb-2">{service.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{service.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {service.tags.map((tag) => (
                    <span key={tag} className={`text-xs px-2 py-0.5 rounded-full font-medium ${service.badge}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <div className="font-semibold text-navy-800">{service.price}</div>
                    <div className="text-xs text-muted-foreground">{service.priceNote}</div>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${service.arrow}`}>
                    <Icon name="ArrowRight" size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Возможности ── */}
      <div className="py-16 sm:py-24 bg-white">
        <div className="container mx-auto px-4">

          {/* Заголовок */}
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-3 sm:mb-4">
              Возможности
            </span>
            <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 mb-3 sm:mb-4">
              Почему выбирают нас
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
              Технологии на стороне закона — быстро, надёжно, конфиденциально
            </p>
          </div>

          {/* Карточки возможностей */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-16 sm:mb-20">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 p-6 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className={`w-11 h-11 rounded-xl ${f.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon name={f.icon} size={20} className={f.iconColor} />
                </div>
                <div>
                  <h4 className="font-golos font-semibold text-navy-800 text-base mb-1">{f.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Статистика */}
          <div className="rounded-3xl bg-gradient-to-br from-navy-800 to-navy-900 px-6 py-10 sm:px-12 sm:py-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-cormorant font-bold text-3xl sm:text-4xl text-gold-400 mb-1">{s.value}</div>
                  <div className="text-white/60 text-sm">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </section>
  );
}
