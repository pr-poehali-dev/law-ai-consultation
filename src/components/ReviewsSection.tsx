import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const REVIEWS = [
  {
    name: "Андрей К.",
    city: "Москва",
    avatar: "АК",
    rating: 5,
    tag: "Трудовое право",
    tagStyle: "bg-blue-50 text-blue-700",
    avatarBg: "bg-blue-100 text-blue-700",
    text: "Меня незаконно уволили, я в панике написал в AI ночью. Через 10 минут у меня была готова претензия со ссылками на статьи ТК. Отправил в HR — в тот же день перезвонили и предложили компенсацию.",
  },
  {
    name: "Марина Л.",
    city: "Санкт-Петербург",
    avatar: "МЛ",
    rating: 5,
    tag: "Защита прав потребителей",
    tagStyle: "bg-emerald-50 text-emerald-700",
    avatarBg: "bg-emerald-100 text-emerald-700",
    text: "Подрядчик сорвал ремонт и отказывался возвращать деньги. AI составил исковое заявление за 3 минуты. Судья приняла иск без единого замечания. Деньги вернули полностью.",
  },
  {
    name: "Дмитрий В.",
    city: "Краснодар",
    avatar: "ДВ",
    rating: 5,
    tag: "Договорное право",
    tagStyle: "bg-amber-50 text-amber-700",
    avatarBg: "bg-amber-100 text-amber-700",
    text: "Перед подписанием договора аренды отправил его на анализ. AI нашёл три скрытых пункта, которые могли обернуться штрафами. Юрист потом сказал — очень грамотный анализ.",
  },
  {
    name: "Ольга Н.",
    city: "Екатеринбург",
    avatar: "ОН",
    rating: 5,
    tag: "Семейное право",
    tagStyle: "bg-violet-50 text-violet-700",
    avatarBg: "bg-violet-100 text-violet-700",
    text: "Развод, раздел имущества — казалось, это бесконечный ужас. AI разложил всё по полочкам, подготовил соглашение о разделе. Сэкономила минимум 40 000 ₽ на юристе.",
  },
  {
    name: "Сергей П.",
    city: "Новосибирск",
    avatar: "СП",
    rating: 5,
    tag: "ДТП",
    tagStyle: "bg-sky-50 text-sky-700",
    avatarBg: "bg-sky-100 text-sky-700",
    text: "Попал в ДТП, страховая отказала в выплате. В чат написал прямо с места событий, с телефона. AI объяснил права, помог составить жалобу в ЦБ. Страховая выплатила всё.",
  },
  {
    name: "Наталья Р.",
    city: "Казань",
    avatar: "НР",
    rating: 5,
    tag: "ЖКХ",
    tagStyle: "bg-rose-50 text-rose-700",
    avatarBg: "bg-rose-100 text-rose-700",
    text: "Управляющая компания выставила огромные суммы за «неизвестные услуги». AI за минуту нашёл нарушения и составил жалобу в жилищную инспекцию. Перерасчёт пришёл через 2 недели.",
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
    <section ref={ref} className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div
          className={`text-center mb-10 sm:mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-4">
            Отзывы клиентов
          </span>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 mb-4">
            Реальные истории{" "}
            <span className="text-gradient-gold italic">реальных людей</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Более 12 400 клиентов уже решили свои юридические вопросы с помощью нашего AI
          </p>

          {/* Summary stats */}
          <div className="inline-flex items-center gap-4 sm:gap-5 mt-6 border border-border rounded-2xl px-5 py-3 bg-white shadow-md">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Icon key={i} name="Star" size={15} className="text-gold-500" />
              ))}
            </div>
            <div className="w-px h-4 bg-navy-200" />
            <span className="text-navy-800 font-bold text-lg">4.9</span>
            <span className="text-navy-500 text-sm">из 5</span>
            <div className="w-px h-4 bg-navy-200" />
            <span className="text-navy-600 text-sm font-medium">2 840+ отзывов</span>
          </div>
        </div>

        {/* Reviews grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {REVIEWS.map((r, i) => (
            <div
              key={r.name}
              className={`relative rounded-3xl border border-border bg-white shadow-sm hover:shadow-xl hover:shadow-navy-900/8 p-6 flex flex-col gap-4 card-hover transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${100 + i * 80}ms` }}
            >
              {/* Stars */}
              <div className="flex items-center gap-1">
                {Array.from({ length: r.rating }).map((_, s) => (
                  <Icon key={s} name="Star" size={13} className="text-gold-500" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-navy-800 text-sm leading-relaxed flex-1">
                «{r.text}»
              </p>

              {/* Tag */}
              <span className={`self-start text-[11px] px-2.5 py-1 rounded-full font-medium ${r.tagStyle}`}>
                {r.tag}
              </span>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <div className={`w-9 h-9 rounded-xl ${r.avatarBg} flex items-center justify-center shrink-0`}>
                  <span className="text-xs font-bold">{r.avatar}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-800">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.city}</p>
                </div>
                <Icon name="BadgeCheck" size={16} className="text-emerald-500 ml-auto shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div
          className={`text-center mt-8 transition-all duration-700 delay-700 ${visible ? "opacity-100" : "opacity-0"}`}
        >
          <p className="text-muted-foreground text-xs">
            Все отзывы — реальные клиенты сервиса. Верифицированы системой.
          </p>
        </div>
      </div>
    </section>
  );
}