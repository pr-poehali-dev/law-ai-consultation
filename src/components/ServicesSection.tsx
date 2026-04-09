import { useState } from "react";
import Icon from "@/components/ui/icon";

interface ServicesSectionProps {
  onSelectService: (service: string) => void;
}

const SERVICES = [
  {
    icon: "MessageCircle",
    title: "AI-консультация",
    desc: "Задайте любой правовой вопрос. AI отвечает мгновенно на основе актуальной судебной практики.",
    tags: ["Трудовое право", "Семейное", "ЖКХ", "Кредиты"],
    price: "от 499 ₽",
    time: "2–3 мин",
    color: "from-blue-500/10 to-blue-600/5",
    accent: "text-blue-600",
    badge: "bg-blue-50 text-blue-700",
  },
  {
    icon: "FileSignature",
    title: "Готовые документы",
    desc: "Исковые заявления, договоры, претензии — AI генерирует документ по вашим данным.",
    tags: ["Исковое", "Договор ГПХ", "Претензия", "Жалоба"],
    price: "от 799 ₽",
    time: "3–5 мин",
    color: "from-amber-500/10 to-amber-600/5",
    accent: "text-amber-600",
    badge: "bg-amber-50 text-amber-700",
  },
  {
    icon: "UserCheck",
    title: "Проверка юристом",
    desc: "Живой юрист проверит ответ AI и даст профессиональное заключение по вашему делу.",
    tags: ["Сложные дела", "Проверка", "Заключение"],
    price: "от 1990 ₽",
    time: "до 24 ч",
    color: "from-emerald-500/10 to-emerald-600/5",
    accent: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: "Building2",
    title: "Для бизнеса",
    desc: "Корпоративные договоры, трудовые споры, защита интеллектуальной собственности.",
    tags: ["Корпоративное", "IP", "HR"],
    price: "от 4990 ₽",
    time: "по запросу",
    color: "from-purple-500/10 to-purple-600/5",
    accent: "text-purple-600",
    badge: "bg-purple-50 text-purple-700",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "ListChecks",
    title: "Выберите услугу",
    desc: "Консультация или готовый документ — выбирайте что нужно",
  },
  {
    step: "02",
    icon: "Bot",
    title: "AI формирует ответ",
    desc: "На основе базы знаний реальных юристов и актуального законодательства",
  },
  {
    step: "03",
    icon: "CreditCard",
    title: "Оплатите по тарифу",
    desc: "Разово или по подписке — выбирайте удобный формат",
  },
  {
    step: "04",
    icon: "Download",
    title: "Получите результат",
    desc: "Документ или консультация в личном кабинете, доступно всегда",
  },
];

export default function ServicesSection({ onSelectService }: ServicesSectionProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="services" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-4">
            Наши услуги
          </span>
          <h2 className="font-cormorant font-bold text-4xl md:text-5xl text-navy-800 mb-4">
            Всё, что нужно для{" "}
            <span className="text-gradient-gold">правовой защиты</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-юрист готов помочь в любой ситуации — от простого вопроса до сложного судебного дела
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {SERVICES.map((service, i) => (
            <div
              key={service.title}
              className={`relative rounded-3xl p-6 border border-border bg-gradient-to-br ${service.color} card-hover cursor-pointer group`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectService(service.title)}
            >
              <div className={`w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-5 transition-transform duration-300 ${hovered === i ? "scale-110" : ""}`}>
                <Icon name={service.icon as any} size={24} className={service.accent} />
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
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <div>
                  <div className="font-semibold text-navy-800">{service.price}</div>
                  <div className="text-xs text-muted-foreground">{service.time}</div>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${hovered === i ? "bg-navy-700 text-white" : "bg-navy-100 text-navy-600"}`}>
                  <Icon name="ArrowRight" size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-gradient-to-br from-navy-800 to-navy-900 rounded-3xl p-10 md:p-14">
          <div className="text-center mb-12">
            <h2 className="font-cormorant font-bold text-3xl md:text-4xl text-white mb-3">
              Как это работает
            </h2>
            <p className="text-white/55 text-base">Получите юридическую помощь за 4 простых шага</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative text-center group">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-[1px] bg-gradient-to-r from-gold-500/50 to-transparent" />
                )}
                <div className="relative inline-flex mb-5">
                  <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto transition-all duration-300 group-hover:bg-gold-500/20">
                    <Icon name={step.icon as any} size={26} className="text-gold-400" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-gold-500 rounded-full text-[10px] font-bold text-navy-900 flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h4 className="font-golos font-semibold text-white mb-2">{step.title}</h4>
                <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Document samples */}
        <div className="mt-16">
          <div className="text-center mb-10">
            <h3 className="font-cormorant font-bold text-3xl text-navy-800 mb-3">
              Примеры документов
            </h3>
            <p className="text-muted-foreground">Нажмите — и получите черновик за 2 минуты</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "Gavel", title: "Исковое заявление", desc: "В суд общей юрисдикции" },
              { icon: "FileCheck", title: "Договор ГПХ", desc: "Гражданско-правовой договор" },
              { icon: "AlertCircle", title: "Претензия", desc: "К продавцу или подрядчику" },
              { icon: "Building", title: "Жалоба", desc: "В Роспотребнадзор / прокуратуру" },
            ].map((doc) => (
              <button
                key={doc.title}
                onClick={() => onSelectService(doc.title)}
                className="group p-5 rounded-2xl border border-border bg-card hover:border-gold-400/40 hover:shadow-lg hover:shadow-gold-500/10 transition-all duration-300 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center mb-4 group-hover:bg-navy-100 transition-colors">
                  <Icon name={doc.icon as any} size={20} className="text-navy-600" />
                </div>
                <div className="font-medium text-navy-800 text-sm mb-1">{doc.title}</div>
                <div className="text-xs text-muted-foreground mb-3">{doc.desc}</div>
                <div className="flex items-center gap-1 text-xs text-gold-600 font-medium">
                  <Icon name="Zap" size={12} />
                  Сгенерировать черновик
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
