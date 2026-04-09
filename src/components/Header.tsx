import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface HeaderProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onLoginClick: () => void;
}

export default function Header({ activeSection, onNavigate, onLoginClick }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { id: "home", label: "Главная" },
    { id: "services", label: "Услуги" },
    { id: "pricing", label: "Тарифы" },
    { id: "cabinet", label: "Кабинет" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "py-3 glass-light shadow-lg shadow-navy-900/10"
          : "py-5 bg-navy-900/30 backdrop-blur-sm"
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shadow-lg group-hover:shadow-navy-700/40 transition-all duration-300 border border-white/20">
            <Icon name="Scale" size={18} className="text-gold-400" />
          </div>
          <div className="flex flex-col leading-none">
            <span className={`font-cormorant font-bold text-xl tracking-tight transition-colors ${scrolled ? "text-navy-700" : "text-white"}`}>
              Юрист<span className="text-gradient-gold"> AI</span>
            </span>
            <span className={`text-[10px] font-golos uppercase tracking-widest transition-colors ${scrolled ? "text-muted-foreground" : "text-white/60"}`}>
              Правовая помощь
            </span>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                scrolled
                  ? activeSection === item.id
                    ? "text-navy-700 bg-navy-100"
                    : "text-navy-600 hover:text-navy-800 hover:bg-navy-50"
                  : activeSection === item.id
                  ? "text-white bg-white/15"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {item.label}
              {activeSection === item.id && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-gold-400 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onLoginClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${scrolled ? "text-navy-700 hover:text-navy-900" : "text-white/80 hover:text-white"}`}
          >
            <Icon name="User" size={16} />
            Войти
          </button>
          <button
            onClick={() => onNavigate("cabinet")}
            className="btn-gold px-5 py-2 rounded-xl text-sm"
          >
            Попробовать бесплатно
          </button>
        </div>

        {/* Mobile burger */}
        <button
          className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? "hover:bg-navy-50" : "hover:bg-white/10"}`}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Icon name={mobileOpen ? "X" : "Menu"} size={22} className={scrolled ? "text-navy-700" : "text-white"} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass-light border-t border-border mt-1 animate-fade-in">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeSection === item.id
                    ? "bg-navy-100 text-navy-800"
                    : "text-navy-600 hover:bg-navy-50"
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-border mt-2 pt-3 flex flex-col gap-2">
              <button
                onClick={() => { onLoginClick(); setMobileOpen(false); }}
                className="px-4 py-3 text-sm text-navy-700 font-medium text-left"
              >
                Войти в кабинет
              </button>
              <button
                onClick={() => { onNavigate("cabinet"); setMobileOpen(false); }}
                className="btn-gold px-5 py-3 rounded-xl text-sm text-center"
              >
                Попробовать бесплатно
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}