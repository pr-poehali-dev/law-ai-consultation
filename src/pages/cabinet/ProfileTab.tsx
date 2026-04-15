import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import type { ServiceType } from "@/components/PaymentModal";
import ProfileUserCard from "@/pages/cabinet/ProfileUserCard";
import ProfileReportBlock from "@/pages/cabinet/ProfileReportBlock";
import ProfileAdminPanel from "@/pages/cabinet/ProfileAdminPanel";

function ReferralBlock({ user }: { user: User }) {
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);

  const refCode = user.referralCode || "";
  const refUrl = refCode ? `${window.location.origin}/?ref=${refCode}` : "";

  const handleCopy = () => {
    if (!refUrl) return;
    navigator.clipboard.writeText(refUrl).then(() => {
      setCopied(true);
      setPulse(true);
      setTimeout(() => { setCopied(false); setPulse(false); }, 2500);
    });
  };

  const handleShare = () => {
    if (navigator.share && refUrl) {
      navigator.share({
        title: "ИИ-Право.рф — AI-юрист онлайн",
        text: "Пользуюсь AI-юристом — советую! По моей ссылке получишь 2 бесплатных вопроса:",
        url: refUrl,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  if (!refCode) return null;

  return (
    <div className="bg-gradient-to-br from-gold-400/10 to-amber-50 border border-gold-300 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 bg-gold-400/20 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${pulse ? "scale-125" : "scale-100"}`} style={{transition:"transform 0.3s"}}>
          <Icon name="Gift" size={18} className="text-gold-600" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-800 text-sm">Пригласи друга — получи 2 вопроса</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Вы и ваш друг получат по 2 бесплатных вопроса к AI-юристу после его регистрации</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gold-200 px-3 py-2 flex items-center gap-2 mb-3 group cursor-pointer" onClick={handleCopy}>
        <Icon name="Link" size={13} className="text-gold-500 shrink-0" />
        <span className="text-xs text-navy-700 flex-1 truncate font-mono">{refUrl}</span>
        <button className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${copied ? "bg-emerald-100 text-emerald-700" : "bg-gold-100 text-gold-700 hover:bg-gold-200"}`}>
          {copied ? "✓ Скопировано" : "Копировать"}
        </button>
      </div>

      <button
        onClick={handleShare}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${pulse ? "bg-gold-500 text-white scale-[1.02] shadow-lg shadow-gold-300/50" : "btn-gold"}`}
      >
        <Icon name="Share2" size={15} />
        Поделиться с другом
        {pulse && <span className="text-xs opacity-80">🎉</span>}
      </button>
    </div>
  );
}

interface GenDoc { id: number; name: string; }

interface ProfileTabProps {
  user: User;
  genDocs: GenDoc[];
  onPay: (type: ServiceType, name: string) => void;
  onLogout: () => void;
}

export default function ProfileTab({ user, onPay, onLogout }: ProfileTabProps) {
  return (
    <div className="max-w-xl mx-auto space-y-3 sm:space-y-4">
      <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800 mb-4 sm:mb-6">Профиль</h2>

      <ProfileUserCard user={user} onPay={onPay} />

      {!user.isAdmin && <ReferralBlock user={user} />}

      <ProfileReportBlock userId={user.id} />

      {user.isAdmin && <ProfileAdminPanel />}

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
