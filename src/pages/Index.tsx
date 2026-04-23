import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { getUser } from "@/lib/auth";
import HeroSection from "@/components/HeroSection";
import LoginModal from "@/components/LoginModal";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import CookieBanner from "@/components/CookieBanner";

// Ленивая загрузка тяжёлых секций
const FeaturesSection = lazy(() => import("@/components/FeaturesSection"));
const ServicesSection = lazy(() => import("@/components/ServicesSection"));
const PricingSection = lazy(() => import("@/components/PricingSection"));
const ReviewsSection = lazy(() => import("@/components/ReviewsSection"));
const FooterSection = lazy(() => import("@/components/FooterSection"));

const SERVICE_TAB_MAP: Record<string, "docs" | "chat" | "expert" | "business"> = {
  "Готовые документы": "docs",
  "Исковое заявление": "docs",
  "Претензия": "docs",
  "Жалоба": "docs",
  "Договор ГПХ": "docs",
  "Для бизнеса": "business",
  "AI-консультация": "chat",
  "Проверка юристом": "expert",
};

const SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  consultation: "plan_starter",
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
  "AI-консультация": "plan_starter",
  "Старт": "plan_starter",
  "Профи": "plan_pro",
  "Максимум": "plan_max",
  "Бизнес-тариф": "business_subscription",
  "Готовые документы": "document",
  "Проверка юристом": "expert",
  "Для бизнеса": "business_subscription",
  "Безлимитные консультации": "subscription_consult",
  "Безлимитные документы": "subscription_docs",
};

const SectionLoader = () => (
  <div className="py-16 flex justify-center">
    <div className="w-6 h-6 border-2 border-navy-300 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function Index() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const [showPayment, setShowPayment] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterAfterPay, setShowRegisterAfterPay] = useState(false);
  const [freeTrial, setFreeTrial] = useState(false);
  const [selectedService, setSelectedService] = useState<{ type: ServiceType; name: string }>({
    type: "plan_starter",
    name: "Пакет «Старт»",
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  useEffect(() => {
    getUser().then((u) => {
      setIsLoggedIn(!!u);
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      const needLogin = params.get("login") === "1";
      if (ref) localStorage.setItem("ref_code", ref);
      if (!u && (needLogin || ref)) {
        setFreeTrial(!!ref);
        setShowLogin(true);
      }
      if (needLogin) window.history.replaceState({}, "", "/");
    });
  }, []);

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

  const handleNavigate = useCallback((section: string) => {
    setActiveSection(section);
    if (section === "cabinet") {
      if (isLoggedIn) navigate("/cabinet");
      else setShowLogin(true);
      return;
    }
    const el = document.getElementById(section === "home" ? "hero" : section);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoggedIn, navigate]);

  const openPayment = useCallback((name: string, serviceTypeId?: string) => {
    const type = (serviceTypeId && SERVICE_TYPE_MAP[serviceTypeId])
      || SERVICE_TYPE_MAP[name]
      || "plan_starter";
    setSelectedService({ type, name });
    setShowPayment(true);
  }, []);

  const handleTryClick = useCallback(() => {
    if (isLoggedIn) { navigate("/cabinet"); return; }
    setFreeTrial(true);
    setShowLogin(true);
  }, [isLoggedIn, navigate]);

  const handleOpenLogin = useCallback((opts?: { freeTrial?: boolean; pendingTab?: string }) => {
    if (isLoggedIn) { navigate("/cabinet"); return; }
    if (opts?.pendingTab) setPendingTab(opts.pendingTab);
    setFreeTrial(opts?.freeTrial ?? false);
    setShowLogin(true);
  }, [isLoggedIn, navigate]);

  const handleLoginSuccess = useCallback(() => {
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
  }, [navigate, pendingTab]);

  const handlePaymentSuccess = useCallback(async (_svcType: ServiceType) => {
    if (!isLoggedIn) {
      setShowRegisterAfterPay(true);
      return;
    }
    setShowPayment(false);
    navigate("/cabinet");
  }, [isLoggedIn, navigate]);

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
            if (isLoggedIn) navigate("/cabinet?tab=docs");
            else { setPendingTab("docs"); setFreeTrial(true); setShowLogin(true); }
          }}
          onRegister={handleTryClick}
          onOpenLogin={handleOpenLogin}
        />
      </div>

      <Suspense fallback={<SectionLoader />}>
        <FeaturesSection />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <ServicesSection
          onSelectService={(service) => {
            const tab = SERVICE_TAB_MAP[service] || "chat";
            if (isLoggedIn) navigate(`/cabinet?tab=${tab}`);
            else { setPendingTab(tab); setFreeTrial(true); setShowLogin(true); }
          }}
        />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <PricingSection
          onSelectPlan={(name, _price, serviceTypeId) => openPayment(name, serviceTypeId)}
        />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <ReviewsSection />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <FooterSection onNavigate={handleNavigate} />
      </Suspense>

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
          onSuccess={handleLoginSuccess}
          freeTrial={freeTrial}
          showRegisterAfterPay={showRegisterAfterPay}
        />
      )}

      <CookieBanner />
    </div>
  );
}
