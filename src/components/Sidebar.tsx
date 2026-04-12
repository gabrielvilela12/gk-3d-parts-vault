import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    BotMessageSquare,
    Box,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    ImagePlus,
    Info,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Menu,
    MessageCircle,
    Pickaxe,
    Plus,
    Receipt,
    Settings,
    Warehouse,
    X,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SidebarProps {
    user: any;
}

const primaryNav = [
    { path: "/catalog", label: "Catalogo", icon: Box },
    { path: "/add", label: "Adicionar peca", icon: Plus },
    { path: "/mining", label: "Minerados", icon: Pickaxe },
];

const managementNav = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/inventory", label: "Estoque", icon: Warehouse },
    { path: "/orders", label: "Pedidos", icon: ClipboardList },
    { path: "/expenses", label: "Despesas", icon: Receipt },
    { path: "/assistant", label: "Assistente IA", icon: MessageCircle },
    { path: "/image-generator", label: "Gerador de imagens", icon: ImagePlus },
    { path: "/accounts", label: "Contas", icon: KeyRound },
    { path: "/gpts", label: "GPTs", icon: BotMessageSquare },
];

const utilityNav = [
    { path: "/settings", label: "Configuracoes", icon: Settings },
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
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
        >
            {isActive ? (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
            ) : null}
            <Icon
                className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
            />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
        </Link>
    );

    if (!collapsed) {
        return content;
    }

    return (
        <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
                {item.label}
            </TooltipContent>
        </Tooltip>
    );
}

function NavSection({
    label,
    items,
    isActive,
    collapsed,
    onItemClick,
}: {
    label: string;
    items: typeof primaryNav;
    isActive: (path: string) => boolean;
    collapsed: boolean;
    onItemClick?: () => void;
}) {
    return (
        <div className="space-y-0.5">
            {!collapsed ? (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {label}
                </p>
            ) : null}
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
    const isMobile = useIsMobile();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!isMobile) {
            setMobileOpen(false);
            return;
        }

        const originalOverflow = document.body.style.overflow;

        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isMobile, mobileOpen]);

    useEffect(() => {
        if (!mobileOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMobileOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mobileOpen]);

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(path + "/");

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/auth");
        toast({ title: "Logout realizado", description: "Ate logo!" });
        setMobileOpen(false);
    };

    const closeMobileDrawer = () => setMobileOpen(false);

    const sidebarContent = (mobile: boolean) => (
        <>
            <div className="flex h-[60px] items-center border-b border-border/60 px-3">
                <Link
                    to="/"
                    className="flex min-w-0 items-center gap-2.5"
                    onClick={mobile ? closeMobileDrawer : undefined}
                >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/20">
                        <Box className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-sm font-bold tracking-tight">GK</span>
                        <span className="text-[10px] text-muted-foreground">Pecas 3D</span>
                    </div>
                </Link>

                {mobile ? (
                    <button
                        onClick={closeMobileDrawer}
                        className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        aria-label="Fechar menu"
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : (
                    <button
                        onClick={() => setCollapsed((value) => !value)}
                        className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronLeft className="h-3.5 w-3.5" />
                        )}
                    </button>
                )}
            </div>

            {user ? (
                <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-2 py-3">
                    <NavSection
                        label="Inventario"
                        items={primaryNav}
                        isActive={isActive}
                        collapsed={!mobile && collapsed}
                        onItemClick={mobile ? closeMobileDrawer : undefined}
                    />
                    <NavSection
                        label="Gestao"
                        items={managementNav}
                        isActive={isActive}
                        collapsed={!mobile && collapsed}
                        onItemClick={mobile ? closeMobileDrawer : undefined}
                    />
                    <NavSection
                        label="Sistema"
                        items={utilityNav}
                        isActive={isActive}
                        collapsed={!mobile && collapsed}
                        onItemClick={mobile ? closeMobileDrawer : undefined}
                    />
                </nav>
            ) : null}

            {user ? (
                <div className="space-y-1 border-t border-border/60 p-2">
                    <div className="flex items-center justify-between px-1">
                        <ThemeToggle />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>Sair</span>
                    </button>
                </div>
            ) : null}
        </>
    );

    if (isMobile) {
        return (
            <>
                <button
                    onClick={() => setMobileOpen(true)}
                    className="fixed left-[calc(env(safe-area-inset-left)+0.75rem)] top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card/90 text-foreground shadow-lg backdrop-blur-lg"
                    aria-label="Abrir menu"
                    aria-expanded={mobileOpen}
                    aria-controls="mobile-sidebar"
                >
                    <Menu className="h-5 w-5" />
                </button>

                <div
                    className={cn(
                        "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300",
                        mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                    )}
                    onClick={closeMobileDrawer}
                    aria-hidden="true"
                />

                <aside
                    id="mobile-sidebar"
                    role="dialog"
                    aria-modal="true"
                    className={cn(
                        "fixed inset-y-0 left-0 z-50 flex h-full w-[min(82vw,280px)] max-w-[280px] flex-col border-r border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out",
                        mobileOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                >
                    {sidebarContent(true)}
                </aside>
            </>
        );
    }

    return (
        <aside
            className={cn(
                "fixed bottom-0 left-0 top-0 z-50 flex flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl transition-all duration-300",
                collapsed ? "w-[60px]" : "w-[220px]"
            )}
        >
            {sidebarContent(false)}
        </aside>
    );
}
