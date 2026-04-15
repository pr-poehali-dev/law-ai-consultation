import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { getUser } from "@/lib/auth";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import FooterSection from "@/components/FooterSection";
import ReviewsSection from "@/components/ReviewsSection";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import LoginModal from "@/components/LoginModal";
import CookieBanner from "@/components/CookieBanner";

const SERVICE_TAB_MAP: Record<string, "docs" | "chat" | "expert" | "business"> = {
  "Готовые документы": "docs",
  "Исковое заявление": "docs",
  "Претензия": "docs",
  "Жалоба": "docs",
  "Жалоба в Роспотребнадзор": "docs",
  "Договор ГПХ": "docs",
  "Договор для бизнеса": "docs",
  "Заявления / Ходатайства": "docs",
  "Уведомления": "docs",
  "AI-консультация": "chat",
  "Проверка юристом": "expert",
  "Для бизнеса": "business",
};

const SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  consultation: "consultation",
  document: "document",
  business: "business",
  expert: "expert",
  subscription_consult: "subscription_consult",
  subscription_docs: "subscription_docs",
  plan_starter: "plan_starter",
  plan_pro: "plan_pro",
  plan_max: "plan_max",
  business_subscription: "business_subscription",
  business_actions_10: "business_actions_10",
  business_actions_30: "business_actions_30",
  business_actions_50: "business_actions_50",
  business_actions_150: "business_actions_150",
  "AI-консультация": "consultation",
  "Старт": "plan_starter",
  "Профи": "plan_pro",
  "Максимум": "plan_max",
  "Бизнес-тариф": "business_subscription",
  "Готовые документы": "document",
  "Исковое заявление": "document",
  "Претензия": "document",
  "Жалоба": "document",
  "Жалоба в Роспотребнадзор": "document",
  "Договор ГПХ": "document",
  "Договор для бизнеса": "document",
  "Заявления / Ходатайства": "document",
  "Уведомления": "document",
  "Проверка юристом": "expert",
  "Для бизнеса": "business_subscription",
  "Безлимитные консультации": "subscription_consult",
  "Безлимитные документы": "subscription_docs",
};

export default function Index() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const [showPayment, setShowPayment] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterAfterPay, setShowRegisterAfterPay] = useState(false);
  const [freeTrial, setFreeTrial] = useState(false);
  const [selectedService, setSelectedService] = useState<{ type: ServiceType; name: string }>({
    type: "consultation",
    name: "AI-консультация",
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  useEffect(() => {
    getUser().then((u) => setIsLoggedIn(!!u));
    // Читаем реферальный код из URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setRefCode(ref);
      localStorage.setItem("ref_code", ref);
      // Если не авторизован — открываем регистрацию
      getUser().then(u => { if (!u) { setFreeTrial(true); setShowLogin(true); } });
    }
  }, []);

  // Проверяем возврат с ЮКасса для незарегистрированного пользователя
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && !isLoggedIn) {
      const invId = params.get("inv_id");
      if (invId) localStorage.setItem("pending_inv_id", invId);
      window.history.replaceState({}, "", "/");
      setShowRegisterAfterPay(true);
      setShowLogin(true);
    }
  }, [isLoggedIn]);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    if (section === "cabinet") {
      if (isLoggedIn) { navigate("/cabinet"); }
      else { setShowLogin(true); }
      return;
    }
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

  // Кнопка «Попробовать бесплатно» — регистрация с 1 бесплатным вопросом
  const handleTryClick = () => {
    if (isLoggedIn) { navigate("/cabinet"); return; }
    setFreeTrial(true);
    setShowLogin(true);
  };

  const handlePaymentSuccess = async (_svcType: ServiceType) => {
    if (!isLoggedIn) {
      setShowRegisterAfterPay(true);
      return;
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
          onDocument={() => {
            if (isLoggedIn) { navigate("/cabinet?tab=docs"); }
            else { setPendingTab("docs"); setFreeTrial(true); setShowLogin(true); }
          }}
          onRegister={handleTryClick}
        />
      </div>

      <FeaturesSection />

      <ServicesSection
        onSelectService={(service) => {
          const tab = SERVICE_TAB_MAP[service] || "chat";
          if (isLoggedIn) {
            navigate(`/cabinet?tab=${tab}`);
          } else {
            setPendingTab(tab);
            setFreeTrial(true);
            setShowLogin(true);
          }
        }}
      />

      <PricingSection
        onSelectPlan={(name, _price, serviceTypeId) => openPayment(name, serviceTypeId)}
      />

      <ReviewsSection />

      <FooterSection onNavigate={handleNavigate} />

      {showPayment && (
        <PaymentModal
          serviceType={selectedService.type}
          serviceName={selectedService.name}
          onClose={() => { setShowPayment(false); setShowRegisterAfterPay(false); }}
          onSuccess={handlePaymentSuccess}
          showRegisterPrompt={showRegisterAfterPay}
          onRegisterAfterPay={() => {
            setShowPayment(false);
            setShowRegisterAfterPay(false);
            setShowLogin(true);
          }}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => { setShowLogin(false); setFreeTrial(false); setShowRegisterAfterPay(false); setPendingTab(null); }}
          onSuccess={() => {
            setShowLogin(false);
            setFreeTrial(false);
            setShowRegisterAfterPay(false);
            const pendingInvId = localStorage.getItem("pending_inv_id");
            if (pendingInvId) {
              localStorage.removeItem("pending_inv_id");
              navigate(`/cabinet?payment=success&inv_id=${pendingInvId}`);
            } else if (pendingTab) {
              const tab = pendingTab;
              setPendingTab(null);
              navigate(`/cabinet?tab=${tab}`);
            } else {
              navigate("/cabinet");
            }
          }}
          freeTrial={freeTrial}
          showRegisterAfterPay={showRegisterAfterPay}
        />
      )}

      <CookieBanner />
    </div>
  );
}