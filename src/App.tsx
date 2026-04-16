
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Component, ReactNode } from "react";
import Index from "./pages/Index";
import Cabinet from "./pages/Cabinet";
import Offer from "./pages/Offer";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-navy-800">Что-то пошло не так</p>
          <p className="text-sm text-muted-foreground">Попробуйте обновить страницу</p>
          <button
            className="px-6 py-2 bg-navy-800 text-white rounded-xl text-sm"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >Обновить</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/cabinet" element={<Cabinet />} />
            <Route path="/offer" element={<Offer />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;