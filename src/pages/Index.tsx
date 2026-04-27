import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { getUser } from "@/lib/auth";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import ServicesSection from "@/components/ServicesSection";
import PricingSection from "@/components/PricingSection";
import ReviewsSection from "@/components/ReviewsSection";
import FooterSection from "@/components/FooterSection";
import LoginModal from "@/components/LoginModal";
import PaymentModal, { ServiceType } from "@/components/PaymentModal";
import ExpertOfferModal from "@/components/ExpertOfferModal";
import CookieBanner from "@/components/CookieBanner";

const SERVICE_TAB_MAP: Record<string, "docs" | "chat" | "expert" | "business"> = {
  "Готовые документы": "docs",
  "Исковое заявление": "docs",
  "Претензия": "docs",
  "Жалоба": "docs",
  "Договор ГПХ": "docs",
  "Для бизнеса": "business",
  "AI-консультация": "chat",
  "Консультация юриста": "expert",
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
  "Консультация юриста": "expert",
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
    type: "plan_starter",
    name: "Пакет «Старт»",
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showExpertOffer, setShowExpertOffer] = useState(false);
  // Если токен есть — сразу редиректим в кабинет, не показываем главную
  const [checking, setChecking] = useState(!!localStorage.getItem("yurist_ai_token"));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const needLogin = params.get("login") === "1";
    const paymentSuccess = params.get("payment") === "success";

    if (ref) localStorage.setItem("ref_code", ref);
    if (needLogin) window.history.replaceState({}, "", "/");

    getUser().then((u) => {
      setIsLoggedIn(!!u);
      setChecking(false);

      if (u && !paymentSuccess && !needLogin) {
        // Залогинен — сразу в кабинет
        navigate("/cabinet", { replace: true });
        return;
      }

      if (!u && (needLogin || ref)) {
        setFreeTrial(!!ref);
        setShowLogin(true);
      }

      if (paymentSuccess && !u) {
        // inv_id может прийти через URL-параметр или уже сохранён в pending_payment
        let invId = params.get("inv_id");
        if (!invId) {
          // Пробуем восстановить из pending_payment (если ЮКасса вернула без параметра)
          try {
            const pp = localStorage.getItem("pending_payment");
            if (pp) {
              const parsed = JSON.parse(pp);
              // Не старше 2 часов
              if (Date.now() - (parsed.created_at || 0) < 2 * 60 * 60 * 1000) {
                invId = String(parsed.inv_id);
              }
            }
          } catch { /* ignore */ }
        }
        if (invId) localStorage.setItem("pending_inv_id", invId);
        window.history.replaceState({}, "", "/");
        setShowRegisterAfterPay(true);
        setShowLogin(true);
      }

      // Восстановление: если пользователь не залогинен, но в localStorage есть pending_payment
      // (оплатил, закрыл вкладку, вернулся позже)
      if (!u && !paymentSuccess) {
        try {
          const pp = localStorage.getItem("pending_payment");
          if (pp) {
            const parsed = JSON.parse(pp);
            if (Date.now() - (parsed.created_at || 0) < 2 * 60 * 60 * 1000) {
              localStorage.setItem("pending_inv_id", String(parsed.inv_id));
              setShowRegisterAfterPay(true);
              setShowLogin(true);
            } else {
              localStorage.removeItem("pending_payment");
            }
          }
        } catch { /* ignore */ }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (isLoggedIn) {
      // Для залогиненных — сразу в кабинет с нужным табом
      if (opts?.pendingTab) navigate(`/cabinet?tab=${opts.pendingTab}`);
      else navigate("/cabinet");
      return;
    }
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

  // Пока проверяем токен — показываем тёмный экран в цвет hero, без белой вспышки
  if (checking) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #060d18 0%, #0a1628 50%, #0d1e38 100%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e8a820" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="flex gap-1.5">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#e8a820", animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

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

      <FeaturesSection />
      <ServicesSection
        onSelectService={(service) => {
          if (service === "Консультация юриста") {
            // Специальная модалка с выбором: Максимум+Юрист или просто юрист
            setShowExpertOffer(true);
            return;
          }
          const tab = SERVICE_TAB_MAP[service] || "chat";
          if (isLoggedIn) navigate(`/cabinet?tab=${tab}`);
          else { setPendingTab(tab); setFreeTrial(true); setShowLogin(true); }
        }}
      />
      <PricingSection
        onSelectPlan={(name, _price, serviceTypeId) => openPayment(name, serviceTypeId)}
        onSelectMax={() => setShowExpertOffer(true)}
      />
      <ReviewsSection />
      <FooterSection onNavigate={handleNavigate} />

      {showExpertOffer && (
        <ExpertOfferModal
          onClose={() => setShowExpertOffer(false)}
          onSelectOffer={(type, name) => {
            setShowExpertOffer(false);
            setSelectedService({ type, name });
            setShowPayment(true);
          }}
        />
      )}

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