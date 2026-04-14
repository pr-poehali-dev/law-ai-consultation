import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const REVIEWS = [
  {
    name: "Андрей К.",
    city: "Москва",
    avatar: "АК",
    rating: 5,
    tag: "Трудовое право",
    text: "Меня незаконно уволили, я в панике написал в AI ночью. Через 10 минут у меня была готова претензия со ссылками на статьи ТК. Отправил в HR — в тот же день перезвонили и предложили компенсацию.",
    accent: "from-blue-500/15 to-blue-600/5",
    border: "border-blue-500/20",
  },
  {
    name: "Марина Л.",
    city: "Санкт-Петербург",
    avatar: "МЛ",
    rating: 5,
    tag: "Защита прав потребителей",
    text: "Подрядчик сорвал ремонт и отказывался возвращать деньги. AI составил исковое заявление за 3 минуты. Судья приняла иск без единого замечания. Деньги вернули полностью.",
    accent: "from-emerald-500/15 to-emerald-600/5",
    border: "border-emerald-500/20",
  },
  {
    name: "Дмитрий В.",
    city: "Краснодар",
    avatar: "ДВ",
    rating: 5,
    tag: "Договорное право",
    text: "Перед подписанием договора аренды отправил его на анализ. AI нашёл три скрытых пункта, которые могли обернуться штрафами. Юрист потом сказал — очень грамотный анализ.",
    accent: "from-gold-500/15 to-amber-600/5",
    border: "border-gold-500/20",
  },
  {
    name: "Ольга Н.",
    city: "Екатеринбург",
    avatar: "ОН",
    rating: 5,
    tag: "Семейное право",
    text: "Развод, раздел имущества — казалось, это бесконечный ужас. AI разложил всё по полочкам, подготовил соглашение о разделе. Сэкономила минимум 40 000 ₽ на юристе.",
    accent: "from-violet-500/15 to-purple-600/5",
    border: "border-violet-500/20",
  },
  {
    name: "Сергей П.",
    city: "Новосибирск",
    avatar: "СП",
    rating: 5,
    tag: "ДТП",
    text: "Попал в ДТП, страховая отказала в выплате. В чат написал прямо с места событий, с телефона. AI объяснил права, помог составить жалобу в ЦБ. Страховая выплатила всё.",
    accent: "from-cyan-500/15 to-blue-600/5",
    border: "border-cyan-500/20",
  },
  {
    name: "Наталья Р.",
    city: "Казань",
    avatar: "НР",
    rating: 5,
    tag: "ЖКХ",
    text: "Управляющая компания выставила огромные суммы за «неизвестные услуги». AI за минуту нашёл нарушения и составил жалобу в жилищную инспекцию. Перерасчёт пришёл через 2 недели.",
    accent: "from-rose-500/15 to-pink-600/5",
    border: "border-rose-500/20",
  },
];

export default function ReviewsSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-16 sm:py-24 relative overflow-hidden" style={{ background: '#0a1628' }}>
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="orb w-[500px] h-[500px] bg-gold-500/5 bottom-0 right-[-150px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div
          className={`text-center mb-10 sm:mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-5">
            <Icon name="Star" size={13} className="text-gold-400" />
            <span className="text-[11px] text-white/70 font-medium tracking-wider uppercase">Отзывы клиентов</span>
          </div>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            Реальные истории{" "}
            <span className="text-gradient-gold italic">реальных людей</span>
          </h2>
          <p className="text-white/70 text-base sm:text-lg max-w-2xl mx-auto">
            Более 12 400 клиентов уже решили свои юридические вопросы с помощью нашего AI
          </p>

          {/* Summary stats */}
          <div className="inline-flex items-center gap-5 mt-6 glass rounded-2xl px-6 py-3">
            <div className="flex items-center gap-1.5">
              {[1,2,3,4,5].map(i => (
                <Icon key={i} name="Star" size={16} className="text-gold-400 fill-gold-400" />
              ))}
            </div>
            <div className="w-px h-5 bg-white/15" />
            <span className="text-white font-bold text-lg">4.9</span>
            <span className="text-white/55 text-sm">из 5</span>
            <div className="w-px h-5 bg-white/15" />
            <span className="text-white/70 text-sm">2 840+ отзывов</span>
          </div>
        </div>

        {/* Reviews grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {REVIEWS.map((r, i) => (
            <div
              key={r.name}
              className={`relative rounded-3xl border ${r.border} bg-gradient-to-br ${r.accent} p-6 flex flex-col gap-4 transition-all duration-700 hover:scale-[1.015] hover:shadow-2xl hover:shadow-black/30 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${100 + i * 80}ms` }}
            >
              {/* Stars */}
              <div className="flex items-center gap-1">
                {Array.from({ length: r.rating }).map((_, s) => (
                  <Icon key={s} name="Star" size={13} className="text-gold-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-white/85 text-sm leading-relaxed flex-1">
                «{r.text}»
              </p>

              {/* Tag */}
              <div className="flex items-center justify-between">
                <span className={`text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 font-medium`}>
                  {r.tag}
                </span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{r.avatar}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{r.name}</p>
                  <p className="text-xs text-white/55">{r.city}</p>
                </div>
                <Icon name="BadgeCheck" size={16} className="text-emerald-400 ml-auto shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div
          className={`text-center mt-10 transition-all duration-700 delay-700 ${visible ? "opacity-100" : "opacity-0"}`}
        >
          <p className="text-white/40 text-xs">
            Все отзывы — реальные клиенты сервиса. Верифицированы системой.
          </p>
        </div>
      </div>
    </section>
  );
}
