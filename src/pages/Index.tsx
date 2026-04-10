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
  "AI-консультация": "consultation",
  "Готовые документы": "document",
  "Исковое заявление": "document",
  "Претензия": "document",
  "Жалоба в Роспотребнадзор": "document",
  "Договор ГПХ": "document",
  "Проверка юристом": "expert",
  "Для бизнеса": "business",
};

export default function Index() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const [showPayment, setShowPayment] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
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

  const handlePaymentSuccess = async (svcType: ServiceType) => {
    await addPaidService(svcType);
    setShowPayment(false);
    navigate("/cabinet");
  };

  return (
    <div className="min-h-screen font-golos">
      <Header
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onLoginClick={() => isLoggedIn ? handleNavigate("cabinet") : setShowLogin(true)}
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
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
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