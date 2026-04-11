import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { getUser, addPaidService } from "@/lib/auth";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import PricingSection from "@/components/PricingSection";
import FooterSection from "@/components/FooterSection";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import LoginModal from "@/components/LoginModal";
import CookieBanner from "@/components/CookieBanner";

const SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  consultation: "consultation",
  document: "document",
  business: "business",
  expert: "expert",
  subscription_consult: "subscription_consult",
  subscription_docs: "subscription_docs",
  "AI-консультация": "consultation",
  "Готовые документы": "document",
  "Исковое заявление": "document",
  "Претензия": "document",
  "Жалоба в Роспотребнадзор": "document",
  "Договор ГПХ": "document",
  "Проверка юристом": "expert",
  "Для бизнеса": "business",
  "Безлимитные консультации": "subscription_consult",
  "Безлимитные документы": "subscription_docs",
};

export default function Index() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const [showPayment, setShowPayment] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  // После trial-оплаты предлагаем регистрацию
  const [pendingTrialPaid, setPendingTrialPaid] = useState(false);
  const [selectedService, setSelectedService] = useState<{ type: ServiceType; name: string }>({
    type: "consultation",
    name: "AI-консультация",
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { getUser().then((u) => setIsLoggedIn(!!u)); }, []);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    if (section === "cabinet") { navigate("/cabinet"); return; }
    const el = document.getElementById(section === "home" ? "hero" : section);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openPayment = (name: string, serviceTypeId?: string) => {
    const type = (serviceTypeId && SERVICE_TYPE_MAP[serviceTypeId])
      || SERVICE_TYPE_MAP[name]
      || "consultation";
    setSelectedService({ type, name });
    setShowPayment(true);
  };

  // Кнопка «Попробовать сейчас» — trial 1 вопрос за 50 ₽
  const handleTryClick = () => {
    if (isLoggedIn) {
      navigate("/cabinet");
      return;
    }
    setSelectedService({ type: "trial", name: "1 вопрос AI-юристу — вводный тариф" });
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (svcType: ServiceType) => {
    await addPaidService(svcType);
    if (svcType === "trial" && !isLoggedIn) {
      // Показываем предложение зарегистрироваться внутри модала
      setPendingTrialPaid(true);
      return; // модал остаётся открытым — там покажем блок регистрации
    }
    setShowPayment(false);
    navigate("/cabinet");
  };

  return (
    <div className="min-h-screen font-golos">
      <Header
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onLoginClick={() => isLoggedIn ? handleNavigate("cabinet") : setShowLogin(true)}
        onTryClick={handleTryClick}
      />

      <div id="hero">
        <HeroSection
          onConsult={() => isLoggedIn ? handleNavigate("cabinet") : setShowLogin(true)}
          onDocument={() => handleNavigate("services")}
        />
      </div>

      <ServicesSection
        onSelectService={(service) => {
          if (isLoggedIn) handleNavigate("cabinet");
          else openPayment(service);
        }}
      />

      <PricingSection
        onSelectPlan={(name, _price, serviceTypeId) => openPayment(name, serviceTypeId)}
      />

      <FooterSection onNavigate={handleNavigate} />

      {showPayment && (
        <PaymentModal
          serviceType={selectedService.type}
          serviceName={selectedService.name}
          onClose={() => { setShowPayment(false); setPendingTrialPaid(false); }}
          onSuccess={handlePaymentSuccess}
          showRegisterPrompt={pendingTrialPaid}
          onRegisterAfterPay={() => {
            setShowPayment(false);
            setPendingTrialPaid(false);
            setShowLogin(true);
          }}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            navigate("/cabinet");
          }}
        />
      )}

      <CookieBanner />
    </div>
  );
}