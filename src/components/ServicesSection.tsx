
import Icon from "@/components/ui/icon";

interface ServicesSectionProps {
  onSelectService: (service: string) => void;
}


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
  { value: "12 000+", label: "пользователей" },
  { value: "120+", label: "типов документов" },
  { value: "24/7", label: "доступность" },
  { value: "99%", label: "довольных клиентов" },
];

export default function ServicesSection({ onSelectService: _onSelectService }: ServicesSectionProps) {

  return (
    <section id="services" className="bg-white">

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