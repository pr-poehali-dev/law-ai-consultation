import Icon from "@/components/ui/icon";
import type { ServiceType } from "@/components/PaymentModal";

const TOOLS = [
  { id: "chat", icon: "Bot", label: "AI-консультант", desc: "Юридические вопросы для бизнеса" },
  { id: "counterparty", icon: "Search", label: "Проверка контрагента", desc: "Due diligence по ИНН" },
  { id: "contract", icon: "FileSignature", label: "Сложный договор", desc: "Лицензионный, опционный и др." },
  { id: "doc_analyze", icon: "FileSearch", label: "Анализ договора", desc: "PDF/DOC до 20 страниц" },
  { id: "doc_compare", icon: "GitCompare", label: "Сравнение договоров", desc: "Две версии PDF/DOC" },
  { id: "orders", icon: "Stamp", label: "Приказы и документы", desc: "Скачивание в .doc · кадровые" },
  { id: "pretension", icon: "FileWarning", label: "Претензионная работа", desc: "Претензии и ответы · скачивание .doc" },
];

interface BusinessPaywallProps {
  onPayClick: (type: ServiceType, name: string) => void;
}

export default function BusinessPaywall({ onPayClick }: BusinessPaywallProps) {
  return (
    <div className="max-w-3xl mx-auto px-1">
      <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 rounded-3xl p-6 sm:p-8 mb-4 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/10 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gold-400/20 rounded-2xl flex items-center justify-center">
              <Icon name="Briefcase" size={24} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-cormorant font-bold text-2xl sm:text-3xl">Для бизнеса</h2>
              <p className="text-white/60 text-sm">Профессиональные юридические инструменты</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[{n:"150",l:"действий/мес"},{n:"6",l:"инструментов"},{n:"PDF/DOC",l:"анализ"},{n:"24ч",l:"хранение"}].map((s,i)=>(
              <div key={i} className="bg-white/10 rounded-2xl p-3 text-center">
                <p className="font-cormorant font-bold text-2xl text-gold-400">{s.n}</p>
                <p className="text-xs text-white/60 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <button onClick={() => onPayClick("business_subscription", "Бизнес-тариф")} className="btn-gold px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 text-sm">
            <Icon name="Zap" size={16} />Подключить за 4 990 ₽/мес
          </button>
          <p className="text-white/40 text-xs mt-2">Оплата ежемесячно · 150 действий · PDF/DOC анализ · История 24 часа · Скачивание .doc</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOOLS.map(t=>(
          <div key={t.id} className="flex items-start gap-3 bg-white rounded-2xl border border-border p-4 opacity-60">
            <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon name={t.icon} size={16} className="text-navy-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy-800">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </div>
            <Icon name="Lock" size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
