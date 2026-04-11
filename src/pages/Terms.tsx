import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

export default function Terms() {
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
            Пользовательское соглашение
          </h1>
          <p className="text-muted-foreground text-sm mb-8">Редакция от 11 апреля 2026 г.</p>

          <div className="prose prose-sm max-w-none space-y-6 text-navy-700 leading-relaxed">

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">1. Термины и определения</h2>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Сервис</strong> — информационная платформа «Юрист AI», доступная на данном сайте;</li>
                <li><strong>Исполнитель / Администрация</strong> — самозанятый Кузина Полина Евгеньевна (ИНН 910231739939);</li>
                <li><strong>Пользователь</strong> — дееспособное физическое лицо старше 18 лет, прошедшее регистрацию на Сервисе;</li>
                <li><strong>Услуги</strong> — информационные услуги, оказываемые Сервисом в соответствии с <a href="/offer" className="text-navy-600 underline hover:text-navy-800">Публичной офертой</a>;</li>
                <li><strong>Контент</strong> — тексты, документы и ответы, формируемые AI-системой на основе запросов Пользователя;</li>
                <li><strong>Robokassa</strong> — платёжный агрегатор ООО «РОБОКАССА», используемый для проведения расчётов.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">2. Предмет соглашения</h2>
              <p>2.1. Настоящее Пользовательское соглашение (далее — Соглашение) регулирует отношения между Исполнителем и Пользователем при использовании Сервиса.</p>
              <p className="mt-2">2.2. Регистрируясь на Сервисе, Пользователь выражает полное и безоговорочное согласие с условиями настоящего Соглашения, <a href="/offer" className="text-navy-600 underline hover:text-navy-800">Публичной офертой</a> и <a href="/privacy" className="text-navy-600 underline hover:text-navy-800">Политикой конфиденциальности</a>.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">3. Условия регистрации и доступа</h2>
              <p>3.1. Для использования Сервиса Пользователь обязан пройти регистрацию, указав достоверные: имя, адрес электронной почты, номер телефона и пароль.</p>
              <p className="mt-2">3.2. Пользователь несёт полную ответственность за сохранность логина и пароля и за все действия, совершённые под его аккаунтом.</p>
              <p className="mt-2">3.3. Администрация вправе отказать в регистрации без объяснения причин.</p>
              <p className="mt-2">3.4. Регистрация одного лица под несколькими аккаунтами запрещена.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">4. Оплата услуг</h2>
              <p>4.1. Услуги Сервиса оплачиваются через платёжный агрегатор <strong>Robokassa</strong> (ООО «РОБОКАССА», ОГРН 1107746158393). Доступные способы: банковская карта (Visa, Mastercard, МИР), СБП, электронные кошельки и иные способы на странице оплаты.</p>
              <p className="mt-2">4.2. После успешной оплаты Robokassa формирует и направляет Пользователю электронный фискальный чек на указанный email в соответствии с требованиями 54-ФЗ. Исполнитель является самозанятым и применяет НПД — НДС к стоимости услуг не применяется.</p>
              <p className="mt-2">4.3. Данные банковских карт Пользователей Исполнителем не хранятся и не обрабатываются. Все расчёты осуществляются на защищённой стороне Robokassa в соответствии с требованиями PCI DSS.</p>
              <p className="mt-2">4.4. Условия возврата денежных средств определяются <a href="/offer" className="text-navy-600 underline hover:text-navy-800">Публичной офертой</a> (раздел 5).</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">5. Права и обязанности Пользователя</h2>
              <p><strong>Пользователь вправе:</strong></p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>использовать Сервис в рамках оплаченного тарифа;</li>
                <li>обращаться в службу поддержки по email povpartner@mail.ru;</li>
                <li>требовать возврата средств в порядке, предусмотренном Публичной офертой.</li>
              </ul>
              <p className="mt-3"><strong>Пользователь обязуется:</strong></p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>использовать Сервис исключительно в законных целях;</li>
                <li>не передавать доступ к аккаунту третьим лицам;</li>
                <li>не использовать Сервис для создания контента, нарушающего права третьих лиц;</li>
                <li>не предпринимать попыток получить несанкционированный доступ к системам Сервиса;</li>
                <li>не воспроизводить, не копировать и не распространять функционал Сервиса в коммерческих целях без письменного разрешения Исполнителя.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">6. Права на контент</h2>
              <p>6.1. Контент, сгенерированный AI-системой по запросу Пользователя, передаётся ему в пользование для личных и коммерческих целей.</p>
              <p className="mt-2">6.2. Пользователь самостоятельно несёт ответственность за законность использования сгенерированного контента.</p>
              <p className="mt-2">6.3. Исполнитель вправе использовать обезличенные и агрегированные данные о запросах для улучшения качества Сервиса без возможности идентификации конкретного Пользователя.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">7. Ограничения Сервиса</h2>
              <p>Пользователь понимает и принимает, что:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>ответы AI-системы носят исключительно справочный и информационный характер;</li>
                <li>AI-система может допускать неточности в интерпретации норм права;</li>
                <li>Сервис не заменяет квалифицированную юридическую помощь — для решения сложных правовых ситуаций рекомендуется обратиться к практикующему юристу или адвокату;</li>
                <li>Исполнитель не несёт ответственности за решения, принятые Пользователем на основании полученных ответов.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">8. Приостановка и блокировка аккаунта</h2>
              <p>8.1. Исполнитель вправе без предупреждения приостановить или заблокировать аккаунт Пользователя в случае:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>нарушения настоящего Соглашения или Публичной оферты;</li>
                <li>попытки мошенничества, злоупотребления Сервисом или инициирования необоснованных возвратов через Robokassa (chargeback);</li>
                <li>предоставления заведомо ложных данных при регистрации.</li>
              </ul>
              <p className="mt-2">8.2. При блокировке аккаунта оплаченные, но не использованные услуги возвращаются в соответствии с разделом 5 Публичной оферты.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">9. Изменение Соглашения</h2>
              <p>Исполнитель вправе в одностороннем порядке изменять условия настоящего Соглашения. Новая редакция вступает в силу с момента публикации на сайте. Продолжение использования Сервиса после изменений означает согласие с новой редакцией.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">10. Применимое право и споры</h2>
              <p>Настоящее Соглашение регулируется законодательством Российской Федерации. Все споры разрешаются путём переговоров, а при недостижении согласия — в судебном порядке по месту нахождения Исполнителя.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">11. Контакты</h2>
              <div className="bg-slate-50 rounded-2xl p-5 mt-2 space-y-1.5">
                <p><strong>Исполнитель:</strong> Кузина Полина Евгеньевна</p>
                <p><strong>ИНН:</strong> 910231739939</p>
                <p><strong>Email:</strong> povpartner@mail.ru</p>
                <p><strong>Телефон:</strong> +7 (800) 555-01-20</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}