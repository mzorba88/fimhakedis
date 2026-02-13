import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import WorkEntries from "./pages/WorkEntries";
import SubcontractorHakedis from "./pages/SubcontractorHakedis";
import Approvals from "./pages/Approvals";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import ActivityHistory from "./pages/ActivityHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projeler" element={<Projects />} />
          <Route path="/yapilanisler" element={<WorkEntries />} />
          <Route path="/hakedisler" element={<SubcontractorHakedis />} />
          <Route path="/onaylar" element={<Approvals />} />
          <Route path="/odemeler" element={<Payments />} />
          <Route path="/raporlar" element={<Reports />} />
          <Route path="/islem-gecmisi" element={<ActivityHistory />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
