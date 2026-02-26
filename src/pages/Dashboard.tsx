import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, Package, Layers, Radio, DollarSign, Plus, ArrowRight, Pickaxe, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalPieces: number;
  materialCounts: { [key: string]: number };
  categoryCounts: { [key: string]: number };
  recentPieces: any[];
  totalCost: number;
  sellingPieces: number;
}

const quickActions = [
  { to: "/add", label: "Adicionar Peça", icon: Plus, primary: true },
  { to: "/catalog", label: "Ver Catálogo", icon: ArrowRight, primary: false },
  { to: "/mining", label: "Minerados", icon: Pickaxe, primary: false },
  { to: "/accounts", label: "Contas", icon: KeyRound, primary: false },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPieces: 0,
    materialCounts: {},
    categoryCounts: {},
    recentPieces: [],
    totalCost: 0,
    sellingPieces: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const toggleSaleStatus = async (pieceId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from("pieces")
        .update({ is_selling: newStatus } as any)
        .eq("id", pieceId);

      if (error) throw error;

      toast({
        title: newStatus ? "Peça colocada no ar!" : "Peça retirada do ar",
        description: newStatus ? "Disponível para venda" : "Indisponível",
      });

      fetchStats();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  };

  const fetchStats = async () => {
    try {
      const { data: pieces, error } = await supabase
        .from("pieces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const materialCounts: { [key: string]: number } = {};
      const categoryCounts: { [key: string]: number } = {};
      let totalCost = 0;
      let sellingPieces = 0;

      (pieces as any)?.forEach((piece: any) => {
        if (piece.material) materialCounts[piece.material] = (materialCounts[piece.material] || 0) + 1;
        if (piece.category) categoryCounts[piece.category] = (categoryCounts[piece.category] || 0) + 1;
        totalCost += piece.cost || 0;
        if (piece.is_selling) sellingPieces++;
      });

      setStats({
        totalPieces: pieces?.length || 0,
        materialCounts,
        categoryCounts,
        recentPieces: pieces?.slice(0, 6) || [],
        totalCost,
        sellingPieces,
      });
    } catch (error: any) {
      toast({ title: "Erro ao carregar estatísticas", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const topMaterials = Object.entries(stats.materialCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  const topCategories = Object.entries(stats.categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do inventário de peças 3D</p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link to="/add">
            <Plus className="h-4 w-4" />
            Adicionar Peça
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card glow-primary">
          <div className="flex items-center justify-between">
            <span className="stat-label">Total de Peças</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div>
            <div className="stat-value">{stats.totalPieces}</div>
            <p className="text-xs text-muted-foreground mt-0.5">peças cadastradas</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Custo Total</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <div>
            <div className="stat-value text-green-500">R${stats.totalCost.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground mt-0.5">soma de todas as peças</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Materiais</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Layers className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="stat-value">{Object.keys(stats.materialCounts).length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">tipos diferentes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">No Ar</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Radio className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div>
            <div className="stat-value text-emerald-500">{stats.sellingPieces}</div>
            <p className="text-xs text-muted-foreground mt-0.5">peças à venda</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ações Rápidas</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.to}
                asChild
                variant={action.primary ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Link to={action.to}>
                  <Icon className="h-3.5 w-3.5" />
                  {action.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Pieces - takes 2 cols */}
        {stats.recentPieces.length > 0 && (
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Peças Recentes</h2>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground h-7 px-2">
                <Link to="/catalog">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Card className="card-gradient border-border/50">
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {stats.recentPieces.map((piece) => (
                    <div key={piece.id} className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors group">
                      <Link to={`/piece/${piece.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        {piece.image_url ? (
                          <img
                            src={piece.image_url}
                            alt={piece.name}
                            className="w-10 h-10 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                            <Box className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{piece.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {piece.material || "Sem material"}
                            {piece.cost > 0 && (
                              <> · <span className="text-primary">R$ {piece.cost.toFixed(2)}</span></>
                            )}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        {(piece as any).is_selling && (
                          <Badge className="bg-emerald-600 text-white text-xs py-0">No Ar</Badge>
                        )}
                        <button
                          onClick={() => toggleSaleStatus(piece.id, (piece as any).is_selling || false)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-md border transition-all",
                            (piece as any).is_selling
                              ? "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                          )}
                        >
                          <Radio className="h-3 w-3" />
                        </button>
                        <span className="text-xs text-muted-foreground/60 hidden sm:block">
                          {new Date(piece.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Right Column: Materials + Categories */}
        <div className="space-y-4">
          {topMaterials.length > 0 && (
            <Card className="card-gradient border-border/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  Top Materiais
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {topMaterials.map(([material, count]) => (
                  <div key={material}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{material}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all"
                        style={{ width: `${(count / stats.totalPieces) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {topCategories.length > 0 && (
            <Card className="card-gradient border-border/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Box className="h-3.5 w-3.5 text-primary" />
                  Top Categorias
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {topCategories.map(([category, count]) => (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{category}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(count / stats.totalPieces) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {stats.totalPieces === 0 && (
            <Card className="card-gradient border-border/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Box className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium mb-1">Nenhuma peça ainda</p>
                <p className="text-xs text-muted-foreground mb-4">Comece adicionando sua primeira peça ao catálogo</p>
                <Button asChild size="sm" className="gap-2">
                  <Link to="/add"><Plus className="h-3.5 w-3.5" />Adicionar peça</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}