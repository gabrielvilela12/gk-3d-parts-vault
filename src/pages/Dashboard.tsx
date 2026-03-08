import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Box, Package, Layers, Radio, DollarSign, Plus, ArrowRight,
  Pickaxe, KeyRound, Clock, CheckCircle2, Timer, TrendingUp,
  BarChart3, ListOrdered, Printer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from "recharts";

interface DashboardStats {
  totalPieces: number;
  materialCounts: { [key: string]: number };
  categoryCounts: { [key: string]: number };
  recentPieces: any[];
  totalCost: number;
  sellingPieces: number;
}

interface QueueOrder {
  id: string;
  piece_name: string;
  image_url: string | null;
  color: string | null;
  quantity: number;
  tempo_min: number | null;
  created_at: string;
  is_printed: boolean;
  printed_at: string | null;
  variation_name: string | null;
}

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(140, 70%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 70%, 55%)",
  "hsl(190, 80%, 50%)",
];

const quickActions = [
  { to: "/add", label: "Nova Peça", icon: Plus, primary: true },
  { to: "/catalog", label: "Catálogo", icon: Package, primary: false },
  { to: "/orders", label: "Pedidos", icon: ListOrdered, primary: false },
  { to: "/mining", label: "Minerados", icon: Pickaxe, primary: false },
  { to: "/accounts", label: "Contas", icon: KeyRound, primary: false },
];

function formatTime(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPieces: 0,
    materialCounts: {},
    categoryCounts: {},
    recentPieces: [],
    totalCost: 0,
    sellingPieces: 0,
  });
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [piecesRes, ordersRes] = await Promise.all([
        supabase.from("pieces").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*, pieces(name, tempo_impressao_min, image_url), piece_price_variations(variation_name, tempo_impressao_min)").order("created_at", { ascending: true }),
      ]);

      if (piecesRes.error) throw piecesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const pieces = piecesRes.data || [];
      const materialCounts: { [key: string]: number } = {};
      const categoryCounts: { [key: string]: number } = {};
      let totalCost = 0;
      let sellingPieces = 0;

      pieces.forEach((piece: any) => {
        if (piece.material) materialCounts[piece.material] = (materialCounts[piece.material] || 0) + 1;
        if (piece.category) categoryCounts[piece.category] = (categoryCounts[piece.category] || 0) + 1;
        totalCost += piece.cost || 0;
        if (piece.is_selling) sellingPieces++;
      });

      setStats({
        totalPieces: pieces.length,
        materialCounts,
        categoryCounts,
        recentPieces: pieces.slice(0, 5),
        totalCost,
        sellingPieces,
      });

      const mapped: QueueOrder[] = (ordersRes.data || []).map((o: any) => ({
        id: o.id,
        piece_name: o.pieces?.name || "—",
        image_url: o.pieces?.image_url || null,
        color: o.color,
        quantity: o.quantity,
        tempo_min: o.piece_price_variations?.tempo_impressao_min ?? o.pieces?.tempo_impressao_min ?? null,
        created_at: o.created_at,
        is_printed: o.is_printed,
        printed_at: o.printed_at,
        variation_name: o.piece_price_variations?.variation_name || null,
      }));

      setOrders(mapped);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSaleStatus = async (pieceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("pieces")
        .update({ is_selling: !currentStatus } as any)
        .eq("id", pieceId);
      if (error) throw error;
      toast({ title: !currentStatus ? "Peça no ar!" : "Peça retirada" });
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // Derived data
  const queueOrders = useMemo(() => orders.filter(o => !o.is_printed), [orders]);
  const doneOrders = useMemo(() => orders.filter(o => o.is_printed), [orders]);
  const totalQueueMinutes = useMemo(() => queueOrders.reduce((acc, o) => acc + (o.tempo_min || 0) * o.quantity, 0), [queueOrders]);

  const topMaterials = Object.entries(stats.materialCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  const topCategories = Object.entries(stats.categoryCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  // Chart data
  const materialChartData = topMaterials.map(([name, value]) => ({ name, value }));
  const categoryChartData = topCategories.map(([name, value]) => ({ name, value }));

  // Weekly production (last 7 days)
  const weeklyData = useMemo(() => {
    const days: { day: string; impressos: number; pedidos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const dateStr = d.toISOString().slice(0, 10);

      const impressos = orders.filter(o =>
        o.is_printed && o.printed_at && o.printed_at.slice(0, 10) === dateStr
      ).length;

      const pedidos = orders.filter(o =>
        o.created_at.slice(0, 10) === dateStr
      ).length;

      days.push({ day: dayStr, impressos, pedidos });
    }
    return days;
  }, [orders]);

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
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do inventário e produção</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickActions.slice(0, isMobile ? 3 : 5).map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.to}
                asChild
                variant={action.primary ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8 text-xs"
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total de Peças"
          value={stats.totalPieces.toString()}
          sub="cadastradas"
          icon={Package}
          colorClass="text-primary bg-primary/15"
          glow
        />
        <StatCard
          label="Custo Total"
          value={`R$${stats.totalCost.toFixed(0)}`}
          sub="investimento"
          icon={DollarSign}
          colorClass="text-emerald-400 bg-emerald-500/15"
          valueColor="text-emerald-400"
        />
        <StatCard
          label="Fila de Produção"
          value={queueOrders.length.toString()}
          sub={totalQueueMinutes > 0 ? formatTime(totalQueueMinutes) + " restantes" : "nenhum na fila"}
          icon={Timer}
          colorClass="text-amber-400 bg-amber-500/15"
          valueColor="text-amber-400"
        />
        <StatCard
          label="No Ar"
          value={stats.sellingPieces.toString()}
          sub="peças à venda"
          icon={Radio}
          colorClass="text-emerald-400 bg-emerald-500/15"
          valueColor="text-emerald-400"
        />
      </div>

      {/* Queue Progress Bar */}
      {queueOrders.length > 0 && (
        <Card className="card-gradient border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Progresso da Fila</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {doneOrders.length} de {orders.length} concluídos
              </span>
            </div>
            <Progress
              value={orders.length > 0 ? (doneOrders.length / orders.length) * 100 : 0}
              className="h-2"
            />
            <div className="flex gap-4 mt-3 flex-wrap">
              {queueOrders.slice(0, isMobile ? 2 : 4).map((o, i) => (
                <div key={o.id} className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-primary">{i + 1}º</span>
                  {o.image_url ? (
                    <img src={o.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-muted/50 flex items-center justify-center">
                      <Box className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs truncate max-w-[100px]">{o.piece_name}</span>
                  {o.tempo_min && (
                    <span className="text-xs text-muted-foreground">{formatTime(o.tempo_min)}</span>
                  )}
                </div>
              ))}
              {queueOrders.length > (isMobile ? 2 : 4) && (
                <Link to="/orders" className="text-xs text-primary hover:underline self-center">
                  +{queueOrders.length - (isMobile ? 2 : 4)} mais
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly production chart */}
        <Card className="card-gradient border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Produção Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-[180px] md:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorImpressos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(140, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(140, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 15%)" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(215, 15%, 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(215, 15%, 60%)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0, 0%, 7%)",
                      border: "1px solid hsl(215, 20%, 15%)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="impressos" stroke="hsl(217, 91%, 60%)" fill="url(#colorImpressos)" strokeWidth={2} name="Impressos" />
                  <Area type="monotone" dataKey="pedidos" stroke="hsl(140, 70%, 45%)" fill="url(#colorPedidos)" strokeWidth={2} name="Pedidos" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Materials donut */}
        <Card className="card-gradient border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Materiais & Categorias
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {materialChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-[160px] w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={materialChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {materialChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(0, 0%, 7%)",
                          border: "1px solid hsl(215, 20%, 15%)",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {materialChartData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs truncate flex-1">{item.name}</span>
                      <span className="text-xs font-medium text-muted-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                Sem dados de materiais
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Recent Pieces + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Pieces */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Peças Recentes</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground h-7 px-2 text-xs">
              <Link to="/catalog">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          {stats.recentPieces.length > 0 ? (
            <Card className="card-gradient border-border/50">
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {stats.recentPieces.map((piece) => (
                    <div key={piece.id} className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors group">
                      <Link to={`/piece/${piece.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        {piece.image_url ? (
                          <img src={piece.image_url} alt={piece.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                            <Box className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{piece.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {piece.material || "Sem material"}
                            {piece.cost > 0 && <> · <span className="text-primary">R${piece.cost.toFixed(2)}</span></>}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        {(piece as any).is_selling && (
                          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">No Ar</Badge>
                        )}
                        <button
                          onClick={() => toggleSaleStatus(piece.id, (piece as any).is_selling || false)}
                          className={cn(
                            "p-1.5 rounded-md border transition-all",
                            (piece as any).is_selling
                              ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                          )}
                        >
                          <Radio className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-gradient border-border/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Box className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium mb-1">Nenhuma peça ainda</p>
                <p className="text-xs text-muted-foreground mb-4">Comece adicionando sua primeira peça</p>
                <Button asChild size="sm" className="gap-2">
                  <Link to="/add"><Plus className="h-3.5 w-3.5" />Adicionar peça</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Queue Summary */}
        <div className="space-y-4">
          <Card className="card-gradient border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                Fila de Impressão
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {queueOrders.length > 0 ? (
                <div className="space-y-2.5">
                  {queueOrders.slice(0, 5).map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2.5">
                      <span className="text-xs font-bold w-4 text-center text-muted-foreground">{i + 1}</span>
                      {o.image_url ? (
                        <img src={o.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted/40 flex items-center justify-center shrink-0">
                          <Box className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{o.piece_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {o.variation_name && <>{o.variation_name} · </>}
                          {o.color && <>{o.color} · </>}
                          {o.quantity > 1 && <>x{o.quantity} · </>}
                          {formatTime(o.tempo_min)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {queueOrders.length > 5 && (
                    <Button asChild variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground">
                      <Link to="/orders">Ver todos ({queueOrders.length})</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400/50 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Fila vazia</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Bars */}
          {topCategories.length > 0 && (
            <Card className="card-gradient border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Categorias
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2.5">
                {topCategories.map(([cat, count]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{cat}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{count}</span>
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
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label, value, sub, icon: Icon, colorClass, glow, valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  colorClass: string;
  glow?: boolean;
  valueColor?: string;
}) {
  return (
    <div className={cn("stat-card", glow && "glow-primary")}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className={cn("text-2xl md:text-3xl font-bold tracking-tight", valueColor)}>{value}</div>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
