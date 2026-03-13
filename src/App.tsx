import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import FormulasPage from "./pages/FormulasPage";
import FormulaEditorPage from "./pages/FormulaEditorPage";
import IngredientsPage from "./pages/IngredientsPage";
import MarketChannelsPage from "./pages/MarketChannelsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<FormulasPage />} />
              <Route path="/editor" element={<FormulaEditorPage />} />
              <Route path="/ingredients" element={<IngredientsPage />} />
              <Route path="/channels" element={<MarketChannelsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
