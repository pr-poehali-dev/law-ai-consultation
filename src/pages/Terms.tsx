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
          <p className="text-muted-foreground text-sm mb-8">Редакция от 10 апреля 2026 г.</p>

          <div className="prose prose-sm max-w-none space-y-6 text-navy-700 leading-relaxed">
            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">1. Термины и определения</h2>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Сервис</strong> — платформа «Юрист AI», доступная на данном сайте;</li>
                <li><strong>Пользователь</strong> — физическое лицо, зарегистрировавшееся на Сервисе;</li>
                <li><strong>Исполнитель</strong> — ИП / ООО «Юрист AI», владелец Сервиса;</li>
                <li><strong>Контент</strong> — тексты, документы и ответы, генерируемые AI.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">2. Условия использования</h2>
              <p>Для использования Сервиса Пользователь обязан:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>быть дееспособным физическим лицом старше 18 лет;</li>
                <li>предоставить достоверные регистрационные данные;</li>
                <li>соблюдать настоящее Соглашение и действующее законодательство РФ.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">3. Права и обязанности Пользователя</h2>
              <p>Пользователь вправе:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>использовать Сервис в соответствии с выбранным тарифом;</li>
                <li>обращаться в службу поддержки по вопросам работы Сервиса;</li>
                <li>получать возврат средств в порядке, предусмотренном <a href="/offer" className="text-navy-600 underline hover:text-navy-800">Публичной офертой</a>.</li>
              </ul>
              <p className="mt-3">Пользователь обязуется:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>не использовать Сервис для незаконной деятельности;</li>
                <li>не передавать доступ к аккаунту третьим лицам;</li>
                <li>не пытаться получить несанкционированный доступ к системам Сервиса;</li>
                <li>не использовать Сервис для создания контента, нарушающего права третьих лиц.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">4. Права на контент</h2>
              <p>Контент, сгенерированный AI на основе запроса Пользователя, передаётся в пользование Пользователю в некоммерческих и коммерческих целях. Пользователь самостоятельно несёт ответственность за использование сгенерированного контента.</p>
              <p className="mt-2">Исполнитель вправе использовать обезличенные данные о запросах для улучшения качества AI-модели.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">5. Ограничения Сервиса</h2>
              <p>Пользователь понимает и принимает, что:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>ответы AI носят справочный характер и не являются юридической консультацией;</li>
                <li>AI может допускать ошибки в трактовке норм права;</li>
                <li>для решения сложных правовых ситуаций рекомендуется обратиться к лицензированному юристу;</li>
                <li>Исполнитель не несёт ответственности за решения, принятые на основании ответов AI.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">6. Блокировка аккаунта</h2>
              <p>Исполнитель вправе заблокировать аккаунт Пользователя без предупреждения в случае:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>нарушения настоящего Соглашения;</li>
                <li>попытки мошенничества или злоупотребления Сервисом;</li>
                <li>предоставления заведомо ложных данных при регистрации.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">7. Изменение Соглашения</h2>
              <p>Исполнитель вправе в одностороннем порядке изменять условия настоящего Соглашения. Новая редакция вступает в силу с момента публикации на сайте. Продолжение использования Сервиса после изменений означает согласие с новой редакцией.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">8. Применимое право</h2>
              <p>Настоящее Соглашение регулируется законодательством Российской Федерации. Все споры разрешаются в судебном порядке по месту нахождения Исполнителя.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">9. Контакты</h2>
              <p>Email: help@yurist-ai.ru</p>
              <p>Телефон: +7 (800) 555-01-20</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
