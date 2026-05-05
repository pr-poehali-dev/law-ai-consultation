
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Component, ReactNode, lazy, Suspense } from "react";
import Index from "./pages/Index";

// Тяжёлые страницы грузим лениво — не нужны при первом рендере лендинга
const Cabinet  = lazy(() => import("./pages/Cabinet"));
const Offer    = lazy(() => import("./pages/Offer"));
const Privacy  = lazy(() => import("./pages/Privacy"));
const Terms    = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

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

// Минимальный fallback без белой вспышки
const PageFallback = () => (
  <div
    className="fixed inset-0 flex items-center justify-center"
    style={{ background: "linear-gradient(135deg, #060d18 0%, #0a1628 50%, #0d1e38 100%)" }}
  >
    <div className="flex gap-1.5">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: "#e8a820", animationDelay: `${d}ms` }} />
      ))}
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/cabinet" element={<Cabinet />} />
              <Route path="/offer" element={<Offer />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
