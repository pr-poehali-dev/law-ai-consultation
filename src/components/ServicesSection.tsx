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
    price: "100 ₽",
    priceNote: "3 вопроса",
    gradient: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/20 hover:border-blue-400/40",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-300",
    tagStyle: "bg-blue-500/15 text-blue-300 border border-blue-500/20",
  },
  {
    icon: "FileSignature",
    title: "Готовые документы",
    desc: "Исковые заявления, претензии, жалобы — AI генерирует полный документ по вашим данным за минуты.",
    tags: ["Исковое", "Претензия", "Жалоба"],
    price: "500 ₽",
    priceNote: "за документ",
    gradient: "from-gold-500/20 to-amber-600/5",
    border: "border-gold-500/20 hover:border-gold-400/40",
    iconBg: "bg-gold-500/20",
    iconColor: "text-gold-300",
    tagStyle: "bg-gold-500/15 text-gold-300 border border-gold-500/20",
  },
  {
    icon: "UserCheck",
    title: "Проверка юристом",
    desc: "Живой эксперт-юрист проверит ответ AI и выдаст письменное профессиональное заключение по вашему делу.",
    tags: ["Сложные дела", "Заключение"],
    price: "1 500 ₽",
    priceNote: "с заключением",
    gradient: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/20 hover:border-emerald-400/40",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-300",
    tagStyle: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  },
  {
    icon: "Building2",
    title: "Для бизнеса",
    desc: "Корпоративные договоры, трудовые соглашения, защита интеллектуальной собственности.",
    tags: ["Корпоративное", "IP", "HR"],
    price: "1 000 ₽",
    priceNote: "за договор",
    gradient: "from-violet-500/20 to-purple-600/5",
    border: "border-violet-500/20 hover:border-violet-400/40",
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-300",
    tagStyle: "bg-violet-500/15 text-violet-300 border border-violet-500/20",
  },
];

const HOW_IT_WORKS = [
  {
    icon: "ListChecks",
    title: "Выберите услугу",
    desc: "Консультация или готовый документ — выбирайте что нужно",
  },
  {
    icon: "Bot",
    title: "AI формирует ответ",
    desc: "На основе базы знаний реальных юристов и актуального законодательства",
  },
  {
    icon: "CreditCard",
    title: "Оплатите по тарифу",
    desc: "Разово или по подписке — выбирайте удобный формат",
  },
  {
    icon: "Download",
    title: "Получите результат",
    desc: "Документ или консультация в личном кабинете, доступно всегда",
  },
];

export default function ServicesSection({ onSelectService }: ServicesSectionProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="services" className="py-16 sm:py-24 relative overflow-hidden gradient-hero">
      <div className="orb w-[500px] h-[500px] bg-blue-500/5 top-[-100px] left-[-100px] pointer-events-none" />
      <div className="orb w-[400px] h-[400px] bg-gold-500/5 bottom-0 right-[-100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Heading */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-5">
            <Icon name="Sparkles" size={13} className="text-gold-400" />
            <span className="text-[11px] text-white/70 font-medium tracking-wider uppercase">Наши услуги</span>
          </div>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-3 sm:mb-4">
            Всё, что нужно для{" "}
            <span className="text-gradient-gold italic">правовой защиты</span>
          </h2>
          <p className="text-white/70 text-base sm:text-lg max-w-2xl mx-auto px-4 sm:px-0">
            AI-юрист готов помочь в любой ситуации — от простого вопроса до сложного судебного дела
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-16 sm:mb-20">
          {SERVICES.map((service, i) => (
            <div
              key={service.title}
              className={`relative rounded-3xl p-6 border ${service.border} bg-gradient-to-br ${service.gradient} cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectService(service.title)}
            >
              <div className={`w-11 h-11 rounded-2xl ${service.iconBg} flex items-center justify-center mb-5 transition-transform duration-300 ${hovered === i ? "scale-110" : ""}`}>
                <Icon name={service.icon} size={22} className={service.iconColor} />
              </div>
              <h3 className="font-cormorant font-bold text-white text-xl mb-2">{service.title}</h3>
              <p className="text-white/75 text-sm leading-relaxed mb-4">{service.desc}</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {service.tags.map((tag) => (
                  <span key={tag} className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${service.tagStyle}`}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div>
                  <div className="font-bold text-white">{service.price}</div>
                  <div className="text-xs text-white/60">{service.priceNote}</div>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${hovered === i ? "bg-white/20 text-white" : "bg-white/8 text-white/50"}`}>
                  <Icon name="ArrowRight" size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="relative rounded-3xl overflow-hidden border border-white/8 mb-16 sm:mb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-navy-800/80 to-navy-900/90" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="relative p-6 sm:p-10 md:p-14">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="font-cormorant font-bold text-2xl sm:text-3xl md:text-4xl text-white mb-3">
                Как это работает
              </h2>
              <p className="text-white/65 text-sm sm:text-base">Получите юридическую помощь за 4 простых шага</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.title} className="relative text-center group">
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-gold-500/40 to-transparent" />
                  )}
                  <div className="relative inline-flex mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center mx-auto transition-all duration-300 group-hover:bg-gold-500/15 group-hover:border-gold-500/30">
                      <Icon name={step.icon} size={26} className="text-gold-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full text-[10px] font-bold text-navy-900 flex items-center justify-center shadow-lg">
                      {i + 1}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white mb-2 text-sm sm:text-base">{step.title}</h4>
                  <p className="text-white/65 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document samples */}
        <div>
          <div className="text-center mb-8 sm:mb-10">
            <h3 className="font-cormorant font-bold text-2xl sm:text-3xl text-white mb-2">
              Примеры документов
            </h3>
            <p className="text-white/65 text-sm">Нажмите — и получите черновик за 2 минуты</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: "Gavel", title: "Исковое заявление", desc: "В суд общей юрисдикции", color: "text-blue-300", bg: "bg-blue-500/15", border: "hover:border-blue-500/30" },
              { icon: "FileCheck", title: "Договор ГПХ", desc: "Гражданско-правовой договор", color: "text-gold-300", bg: "bg-gold-500/15", border: "hover:border-gold-500/30" },
              { icon: "AlertCircle", title: "Претензия", desc: "К продавцу или подрядчику", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "hover:border-emerald-500/30" },
              { icon: "Building", title: "Жалоба", desc: "В Роспотребнадзор / прокуратуру", color: "text-violet-300", bg: "bg-violet-500/15", border: "hover:border-violet-500/30" },
            ].map((doc) => (
              <button
                key={doc.title}
                onClick={() => onSelectService(doc.title)}
                className={`group p-4 sm:p-5 rounded-2xl border border-white/8 bg-white/4 ${doc.border} hover:bg-white/8 transition-all duration-300 text-left hover:scale-[1.02]`}
              >
                <div className={`w-10 h-10 rounded-xl ${doc.bg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon name={doc.icon} size={20} className={doc.color} />
                </div>
                <h4 className="font-semibold text-white text-sm mb-1">{doc.title}</h4>
                <p className="text-white/65 text-xs">{doc.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}