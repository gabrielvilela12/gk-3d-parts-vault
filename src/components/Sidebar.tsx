import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, useLocation } from "react-router-dom";
import {
    Box,
    LayoutDashboard,
    Plus,
    Info,
    LogOut,
    Pickaxe,
    KeyRound,
    BotMessageSquare,
    Settings,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Menu,
    ImagePlus,
    Receipt,
    MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
    user: any;
}

const primaryNav = [
    { path: "/catalog", label: "Catálogo", icon: Box },
    { path: "/add", label: "Adicionar Peça", icon: Plus },
    { path: "/mining", label: "Minerados", icon: Pickaxe },
];

const managementNav = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/orders", label: "Pedidos", icon: ClipboardList },
    { path: "/expenses", label: "Despesas", icon: Receipt },
    { path: "/image-generator", label: "Gerador de Imagens", icon: ImagePlus },
    { path: "/accounts", label: "Contas", icon: KeyRound },
    { path: "/gpts", label: "GPTs", icon: BotMessageSquare },
];

const utilityNav = [
    { path: "/settings", label: "Configurações", icon: Settings },
    { path: "/about", label: "Sobre", icon: Info },
];

function NavItem({
    item,
    isActive,
    collapsed,
    onClick,
}: {
    item: { path: string; label: string; icon: any };
    isActive: boolean;
    collapsed: boolean;
    onClick?: () => void;
}) {
    const Icon = item.icon;

    const content = (
        <Link
            to={item.path}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
        >
            {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
            )}
            <Icon
                className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
            />
            {!collapsed && (
                <span className="truncate">{item.label}</span>
            )}
        </Link>
    );

    if (collapsed) {
        return (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                    {item.label}
                </TooltipContent>
            </Tooltip>
        );
    }

    return content;
}

function NavSection({ label, items, isActive, collapsed, onItemClick }: {
    label: string;
    items: typeof primaryNav;
    isActive: (path: string) => boolean;
    collapsed: boolean;
    onItemClick?: () => void;
}) {
    return (
        <div className="space-y-0.5">
            {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {label}
                </p>
            )}
            {items.map((item) => (
                <NavItem
                    key={item.path}
                    item={item}
                    isActive={isActive(item.path)}
                    collapsed={collapsed}
                    onClick={onItemClick}
                />
            ))}
        </div>
    );
}

export function Sidebar({ user }: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [collapsed, setCollapsed] = useState(false);
    const isMobile = useIsMobile();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/auth");
        toast({ title: "Logout realizado", description: "Até logo!" });
        setMobileOpen(false);
    };

    const sidebarContent = (mobile: boolean) => (
        <>
            {/* Logo */}
            <div className="flex h-[60px] items-center px-3 border-b border-border/60">
                <Link to="/" className="flex items-center gap-2.5 min-w-0" onClick={mobile ? () => setMobileOpen(false) : undefined}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/20">
                        <Box className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-sm font-bold tracking-tight">GK</span>
                        <span className="text-[10px] text-muted-foreground">Peças 3D</span>
                    </div>
                </Link>
                {!mobile && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
                    >
                        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                    </button>
                )}
            </div>

            {/* Nav */}
            {user && (
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-5">
                    <NavSection label="Inventário" items={primaryNav} isActive={isActive} collapsed={!mobile && collapsed} onItemClick={mobile ? () => setMobileOpen(false) : undefined} />
                    <NavSection label="Gestão" items={managementNav} isActive={isActive} collapsed={!mobile && collapsed} onItemClick={mobile ? () => setMobileOpen(false) : undefined} />
                    <NavSection label="Sistema" items={utilityNav} isActive={isActive} collapsed={!mobile && collapsed} onItemClick={mobile ? () => setMobileOpen(false) : undefined} />
                </nav>
            )}

            {/* Footer */}
            {user && (
                <div className="border-t border-border/60 p-2 space-y-1">
                    <div className="flex items-center justify-between px-1">
                        <ThemeToggle />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>Sair</span>
                    </button>
                </div>
            )}
        </>
    );

    // Mobile: hamburger button + sheet drawer
    if (isMobile) {
        return (
            <>
                <button
                    onClick={() => setMobileOpen(true)}
                    className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-card/90 backdrop-blur-lg border border-border/60 text-foreground shadow-lg"
                    aria-label="Abrir menu"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetContent side="left" className="w-[260px] p-0 bg-card/95 backdrop-blur-xl border-border/60">
                        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                        <div className="flex flex-col h-full">
                            {sidebarContent(true)}
                        </div>
                    </SheetContent>
                </Sheet>
            </>
        );
    }

    // Desktop: fixed sidebar
    return (
        <aside
            className={cn(
                "fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl transition-all duration-300",
                collapsed ? "w-[60px]" : "w-[220px]"
            )}
        >
            {sidebarContent(false)}
        </aside>
    );
}
