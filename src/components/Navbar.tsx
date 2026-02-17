import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, LayoutDashboard, Plus, Info, LogOut, Pickaxe, KeyRound, BotMessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface NavbarProps {
  user: any;
}

export function Navbar({ user }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
  };

  const navItems = [
    { path: "/catalog", label: "Catálogo", icon: Box },
    { path: "/add", label: "Adicionar", icon: Plus },
    { path: "/mining", label: "Minerados", icon: Pickaxe },
    { path: "/accounts", label: "Contas", icon: KeyRound },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/gpts", label: "GPTs", icon: BotMessageSquare },
    { path: "/about", label: "Sobre", icon: Info },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Box className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight">GK</span>
              <span className="text-xs text-muted-foreground">Gestão de Peças 3D</span>
            </div>
          </Link>

          {/* Navigation Links */}
          {user && (
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    asChild
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Link to={item.path}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          )}

          {!user && (
            <Button asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
