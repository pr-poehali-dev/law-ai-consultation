import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

export default function Privacy() {
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
            Политика конфиденциальности
          </h1>
          <p className="text-muted-foreground text-sm mb-8">Редакция от 10 апреля 2026 г.</p>

          <div className="prose prose-sm max-w-none space-y-6 text-navy-700 leading-relaxed">
            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">1. Общие положения</h2>
              <p>Настоящая Политика конфиденциальности определяет порядок сбора, хранения, использования и защиты персональных данных пользователей сервиса «Юрист AI» (далее — Сервис).</p>
              <p className="mt-2">Используя Сервис, вы соглашаетесь с условиями настоящей Политики. Если вы не согласны, пожалуйста, не используйте Сервис.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">2. Какие данные мы собираем</h2>
              <p>При использовании Сервиса мы можем собирать следующие данные:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Контактные данные:</strong> email-адрес, указанный при регистрации и оплате;</li>
                <li><strong>Данные аккаунта:</strong> имя пользователя, пароль (в зашифрованном виде);</li>
                <li><strong>Данные использования:</strong> вопросы, заданные AI-юристу, и сгенерированные документы;</li>
                <li><strong>Технические данные:</strong> IP-адрес, тип браузера, операционная система;</li>
                <li><strong>Платёжные данные:</strong> история транзакций (без данных карты — они обрабатываются ЮKassa).</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">3. Как мы используем данные</h2>
              <p>Собранные данные используются для:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>предоставления услуг Сервиса;</li>
                <li>отправки чека об оплате на email;</li>
                <li>улучшения качества AI-ответов;</li>
                <li>технической поддержки пользователей;</li>
                <li>соблюдения требований законодательства РФ.</li>
              </ul>
              <p className="mt-2">Мы <strong>не продаём</strong> и не передаём ваши данные третьим лицам в коммерческих целях.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">4. Передача данных третьим лицам</h2>
              <p>Ваши данные могут быть переданы следующим партнёрам исключительно для обеспечения работы Сервиса:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>ООО НКО «ЮMoney» (ЮKassa)</strong> — для обработки платежей;</li>
                <li><strong>ПАО «Сбербанк» (GigaChat API)</strong> — для обработки запросов к AI;</li>
                <li><strong>ООО «Яндекс» (YandexGPT)</strong> — для обработки запросов к AI.</li>
              </ul>
              <p className="mt-2">Все партнёры обязаны соблюдать конфиденциальность ваших данных в соответствии со своими политиками.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">5. Cookies</h2>
              <p>Сервис использует файлы cookie для корректной работы и улучшения пользовательского опыта. Используя Сервис, вы соглашаетесь с использованием cookie. Вы можете отключить cookie в настройках браузера, однако некоторые функции Сервиса могут работать некорректно.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">6. Хранение и защита данных</h2>
              <p>Данные хранятся на серверах, расположенных на территории Российской Федерации. Мы применяем технические и организационные меры для защиты данных от несанкционированного доступа, включая шифрование при передаче (HTTPS) и хранении паролей.</p>
              <p className="mt-2">Данные хранятся не дольше, чем необходимо для предоставления услуг, или в течение срока, установленного законодательством РФ.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">7. Права пользователя</h2>
              <p>В соответствии с Федеральным законом № 152-ФЗ «О персональных данных» вы вправе:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>получить информацию об обработке ваших данных;</li>
                <li>потребовать исправления неточных данных;</li>
                <li>отозвать согласие на обработку данных;</li>
                <li>потребовать удаления ваших данных.</li>
              </ul>
              <p className="mt-2">Для реализации прав направьте запрос на help@yurist-ai.ru.</p>
            </section>

            <section>
              <h2 className="font-semibold text-navy-800 text-lg mb-3">8. Контакты</h2>
              <p>По вопросам, связанным с обработкой персональных данных, обращайтесь: help@yurist-ai.ru</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
