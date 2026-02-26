import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Sidebar } from "@/components/Sidebar";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Catalog from "./pages/Catalog";
import PieceDetail from "./pages/PieceDetail";
import AddPiece from "./pages/AddPiece";
import MiningProducts from "./pages/MiningProducts";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import About from "./pages/About";
import GptLinks from "./pages/GptLinks";
import SettingsPage from "./pages/Settings";
import Rankings from "./pages/Rankings";
import NotFound from "./pages/NotFound";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient();

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {user && <Sidebar user={user} />}
      <main
        className={cn(
          "flex-1 min-h-screen transition-all duration-300",
          user ? "ml-[220px]" : ""
        )}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/about" element={<About />} />
          <Route
            path="/catalog"
            element={user ? <Catalog /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/piece/:id"
            element={user ? <PieceDetail /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/add"
            element={user ? <AddPiece /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/piece/:id/edit"
            element={user ? <AddPiece isEditMode={true} /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/mining"
            element={user ? <MiningProducts /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/accounts"
            element={user ? <Accounts /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/dashboard"
            element={user ? <Dashboard /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/gpts"
            element={user ? <GptLinks /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/settings"
            element={user ? <SettingsPage /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/rankings"
            element={user ? <Rankings /> : <Navigate to="/auth" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;