import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import PricingSection from "@/components/PricingSection";
import CabinetSection from "@/components/CabinetSection";
import FooterSection from "@/components/FooterSection";
import PaymentModal from "@/components/PaymentModal";
import LoginModal from "@/components/LoginModal";
import CookieBanner from "@/components/CookieBanner";

export default function Index() {
  const [activeSection, setActiveSection] = useState("home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ name: "", price: "" });

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    const el = document.getElementById(section === "home" ? "hero" : section);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSelectPlan = (name: string, price: string) => {
    setSelectedPlan({ name, price });
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setTimeout(() => {
      setShowPayment(false);
      setIsLoggedIn(true);
      handleNavigate("cabinet");
    }, 2500);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setIsLoggedIn(true);
    handleNavigate("cabinet");
  };

  return (
    <div className="min-h-screen font-golos">
      <Header
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onLoginClick={() => {
          if (isLoggedIn) {
            handleNavigate("cabinet");
          } else {
            setShowLogin(true);
          }
        }}
      />

      <div id="hero">
        <HeroSection
          onConsult={() => {
            if (isLoggedIn) handleNavigate("cabinet");
            else setShowLogin(true);
          }}
          onDocument={() => handleNavigate("services")}
        />
      </div>

      <ServicesSection
        onSelectService={(service) => {
          if (isLoggedIn) {
            handleNavigate("cabinet");
          } else {
            setSelectedPlan({ name: service, price: "499" });
            setShowPayment(true);
          }
        }}
      />

      <PricingSection onSelectPlan={handleSelectPlan} />

      <CabinetSection
        isLoggedIn={isLoggedIn}
        onLogin={() => setShowLogin(true)}
      />

      <FooterSection onNavigate={handleNavigate} />

      {showPayment && (
        <PaymentModal
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={handleLoginSuccess}
        />
      )}

      <CookieBanner />
    </div>
  );
}
