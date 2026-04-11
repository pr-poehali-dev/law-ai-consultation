import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { getFreeLeft } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";

interface GenDoc { id: number; name: string; }

interface ProfileTabProps {
  user: User;
  genDocs: GenDoc[];
  onPay: (type: ServiceType, name: string) => void;
  onLogout: () => void;
}

export default function ProfileTab({ user, genDocs, onPay, onLogout }: ProfileTabProps) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">Профиль</h2>

      <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center text-white text-2xl font-bold uppercase">
            {user.name?.[0] ?? "U"}
          </div>
          <div>
            <div className="font-semibold text-navy-800 text-lg">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Бесплатных вопросов", value: `${getFreeLeft(user)} из 30`, icon: "Gift", color: "text-emerald-600 bg-emerald-50" },
            { label: "Платных вопросов", value: user.paidQuestions ?? 0, icon: "MessageCircle", color: "text-blue-600 bg-blue-50" },
            { label: "Создано документов", value: genDocs.length, icon: "FileText", color: "text-amber-600 bg-amber-50" },
            { label: "Проверок юристом", value: user.paidExpert ? "Активно" : "Нет", icon: "Shield", color: "text-purple-600 bg-purple-50" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border p-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${stat.color}`}>
                <Icon name={stat.icon} size={16} />
              </div>
              <div className="font-bold text-navy-800 text-lg">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy more */}
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
        <h3 className="font-semibold text-navy-800 mb-4">Пополнить баланс</h3>
        <div className="space-y-3">
          {[
            { label: "3 вопроса AI-юристу", price: "100 ₽", type: "consultation" as ServiceType, name: "AI-консультация (3 вопроса)", icon: "MessageCircle" },
            { label: "Подготовка документа", price: "500 ₽", type: "document" as ServiceType, name: "Подготовка документа", icon: "FileText" },
            { label: "Проверка экспертом-юристом", price: "1 500 ₽", type: "expert" as ServiceType, name: "Проверка юристом", icon: "UserCheck" },
            { label: "Договор для бизнеса", price: "1 000 ₽", type: "business" as ServiceType, name: "Договор для бизнеса", icon: "Briefcase" },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => onPay(item.type, item.name)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border hover:border-navy-300 hover:bg-navy-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-navy-50 rounded-xl flex items-center justify-center group-hover:bg-navy-100 transition-colors">
                  <Icon name={item.icon} size={15} className="text-navy-600" />
                </div>
                <span className="text-sm font-medium text-navy-800">{item.label}</span>
              </div>
              <span className="font-semibold text-navy-700 text-sm">{item.price}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full py-3 rounded-2xl border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all text-sm font-medium flex items-center justify-center gap-2"
      >
        <Icon name="LogOut" size={15} />
        Выйти из аккаунта
      </button>
    </div>
  );
}
