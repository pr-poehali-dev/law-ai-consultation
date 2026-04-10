import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

export default function Offer() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-navy-600 hover:text-navy-800 transition-colors text-sm"
          >
            <Icon name="ArrowLeft" size={16} />
            На главную
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-navy-100 rounded-lg flex items-center justify-center">
              <Icon name="Scale" size={14} className="text-navy-600" />
            </div>
            <span className="font-cormorant font-bold text-navy-800">Юрист AI</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="bg-white rounded-3xl border border-border shadow-sm p-8 md:p-12">
          <h1 className="font-cormorant font-bold text-3xl md:text-4xl text-navy-800 mb-2">
            Публичная оферта
          </h1>
          <p className="text-muted-foreground text-sm mb-8">Редакция от 10 апреля 2026 г.</p>

          <div className="prose prose-sm max-w-none space-y-6 text-navy-700 leading-relaxed">
            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">1. Общие положения</h2>
              <p>Настоящий документ является публичной офертой ИП / ООО «Юрист AI» (далее — Исполнитель) и содержит все существенные условия договора об оказании информационных услуг.</p>
              <p className="mt-2">Акцептом оферты считается совершение оплаты на сайте. С момента оплаты договор считается заключённым на условиях настоящей оферты.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">2. Предмет договора</h2>
              <p>Исполнитель обязуется предоставить Пользователю доступ к следующим услугам:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>AI-консультация</strong> — 3 юридических вопроса к AI-юристу (100 ₽);</li>
                <li><strong>Подготовка документа</strong> — генерация одного юридического документа (500 ₽);</li>
                <li><strong>Экспертная проверка</strong> — проверка ответа AI экспертом-юристом с письменным заключением (1 500 ₽);</li>
                <li><strong>Бизнес-пакет</strong> — подготовка договора и юридических документов для бизнеса (1 000 ₽).</li>
              </ul>
              <p className="mt-2">Все услуги оказываются исключительно в информационных целях. Оказываемые услуги не являются юридической помощью в смысле Федерального закона № 63-ФЗ «Об адвокатской деятельности».</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">3. Порядок оплаты</h2>
              <p>Оплата производится на сайте через сервис ЮKassa (ООО НКО «ЮMoney»). Доступны следующие способы оплаты:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>банковская карта (Visa, Mastercard, МИР);</li>
                <li>Система быстрых платежей (СБП).</li>
              </ul>
              <p className="mt-2">После успешной оплаты чек направляется на email, указанный при оформлении заказа.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">4. Возврат денежных средств</h2>
              <p>Возврат возможен в течение 14 (четырнадцати) календарных дней с момента оплаты при условии, что услуга не была использована (вопросы не были заданы, документ не был сгенерирован).</p>
              <p className="mt-2">Для оформления возврата направьте запрос на help@yurist-ai.ru с указанием номера платежа и причины отказа от услуги.</p>
              <p className="mt-2">Если услуга частично исполнена (например, задан 1 из 3 вопросов), возврат производится пропорционально неиспользованной части.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">5. Ограничение ответственности</h2>
              <p>Информация, предоставляемая сервисом, носит справочный характер и не заменяет профессиональную юридическую консультацию. Исполнитель не несёт ответственности за последствия принятых Пользователем решений на основании полученной информации.</p>
              <p className="mt-2">Исполнитель не гарантирует непрерывную работу сервиса и вправе проводить технические работы с предварительным уведомлением.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">6. Персональные данные</h2>
              <p>Принимая настоящую оферту, Пользователь даёт согласие на обработку персональных данных в соответствии с <a href="/privacy" className="text-navy-600 underline hover:text-navy-800">Политикой конфиденциальности</a>.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">7. Срок действия оферты</h2>
              <p>Оферта вступает в силу с момента публикации на сайте и действует до её отзыва Исполнителем. Исполнитель оставляет за собой право вносить изменения в условия оферты, уведомляя об этом на сайте.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">8. Реквизиты</h2>
              <p>Контактный email: help@yurist-ai.ru</p>
              <p>Телефон поддержки: +7 (800) 555-01-20</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
