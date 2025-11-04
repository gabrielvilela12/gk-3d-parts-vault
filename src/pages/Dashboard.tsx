import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Box, Package, Layers, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalPieces: number;
  materialCounts: { [key: string]: number };
  recentPieces: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPieces: 0,
    materialCounts: {},
    recentPieces: [],
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const togglePrintStatus = async (pieceId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'live' ? 'pending' : 'live';
    try {
      const { error } = await supabase
        .from("pieces")
        .update({ print_status: newStatus } as any)
        .eq("id", pieceId);

      if (error) throw error;

      toast({
        title: newStatus === 'live' ? "Peça colocada no ar!" : "Peça retirada do ar",
        description: newStatus === 'live' ? "A peça agora está disponível" : "A peça não está mais disponível",
      });

      fetchStats();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStats = async () => {
    try {
      const { data: pieces, error } = await supabase
        .from("pieces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate stats
      const materialCounts: { [key: string]: number } = {};
      pieces?.forEach((piece) => {
        if (piece.material) {
          materialCounts[piece.material] = (materialCounts[piece.material] || 0) + 1;
        }
      });

      setStats({
        totalPieces: pieces?.length || 0,
        materialCounts,
        recentPieces: pieces?.slice(0, 5) || [],
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estatísticas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const topMaterials = Object.entries(stats.materialCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Box className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu catálogo de peças 3D</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="card-gradient border-border/50 glow-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Peças</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalPieces}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalPieces === 1 ? "peça cadastrada" : "peças cadastradas"}
              </p>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Materiais Diferentes</CardTitle>
              <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {Object.keys(stats.materialCounts).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">tipos de materiais</p>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peças Recentes</CardTitle>
              <Box className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.recentPieces.length}</div>
              <p className="text-xs text-muted-foreground mt-1">últimas adições</p>
            </CardContent>
          </Card>
        </div>

        {/* Material Usage */}
        {topMaterials.length > 0 && (
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle>Materiais Mais Usados</CardTitle>
              <CardDescription>Top 3 materiais do seu catálogo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topMaterials.map(([material, count]) => (
                  <div key={material}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{material}</span>
                      <span className="text-sm text-muted-foreground">
                        {count} {count === 1 ? "peça" : "peças"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(count / stats.totalPieces) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Pieces */}
        {stats.recentPieces.length > 0 && (
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle>Peças Adicionadas Recentemente</CardTitle>
              <CardDescription>Últimas 5 peças cadastradas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentPieces.map((piece) => (
                  <div
                    key={piece.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <Link
                      to={`/piece/${piece.id}`}
                      className="flex items-center gap-3 flex-1"
                    >
                      {piece.image_url ? (
                        <img
                          src={piece.image_url}
                          alt={piece.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted/30 flex items-center justify-center">
                          <Box className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{piece.name}</p>
                        <p className="text-sm text-muted-foreground">{piece.material || "Sem material"}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={piece.print_status === 'live' ? 'default' : 'outline'}
                        onClick={(e) => {
                          e.preventDefault();
                          togglePrintStatus(piece.id, piece.print_status || 'pending');
                        }}
                        className="gap-2"
                      >
                        <Radio className="h-4 w-4" />
                        {piece.print_status === 'live' ? 'No Ar' : 'Colocar no Ar'}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {new Date(piece.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
