import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AppProvider, useApp } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext.tsx";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import PerfumesVendas from "@/pages/perfumes/PerfumesVendas";
import NovaPerfumeVenda from "@/pages/perfumes/NovaPerfumeVenda";
import PerfumesCatalogo from "@/pages/perfumes/PerfumesCatalogo";
import EletronicosVendas from "@/pages/eletronicos/EletronicosVendas";
import NovaEletronicoVenda from "@/pages/eletronicos/NovaEletronicoVenda";
import EletronicosCatalogo from "@/pages/eletronicos/EletronicosCatalogo";
import Cobrancas from "@/pages/Cobrancas";
import Configuracoes from "@/pages/Configuracoes";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { state } = useApp();

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SV</span>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!state.session) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                       element={<Dashboard />} />
          <Route path="/clientes"               element={<Clientes />} />
          <Route path="/perfumes/vendas"        element={<PerfumesVendas />} />
          <Route path="/perfumes/nova-venda"    element={<NovaPerfumeVenda />} />
          <Route path="/perfumes/catalogo"      element={<PerfumesCatalogo />} />
          <Route path="/eletronicos/vendas"     element={<EletronicosVendas />} />
          <Route path="/eletronicos/nova-venda" element={<NovaEletronicoVenda />} />
          <Route path="/eletronicos/catalogo"   element={<EletronicosCatalogo />} />
          <Route path="/cobrancas"              element={<Cobrancas />} />
          <Route path="/configuracoes"          element={<Configuracoes />} />
          <Route path="/admin"                  element={<Admin />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;