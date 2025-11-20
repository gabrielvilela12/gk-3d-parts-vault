import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Trash2, Box, DollarSign, Radio, TrendingUp, Edit, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator"; // Importado

interface Piece {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  depth: number;
  material: string;
  stl_url: string;
  image_url: string;
  notes: string;
  created_at: string;
  user_id: string;
  cost: number | null;
  is_selling: boolean | null;
  preco_venda: number | null;
  lucro_liquido: number | null;
}

interface PriceVariation {
  id: string;
  variation_name: string;
  custo_kg_filamento: number;
  calculated_cost: number;
  calculated_price: number;
  peso_g: number | null;
  tempo_impressao_min: number | null;
}

export default function PieceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [priceVariations, setPriceVariations] = useState<PriceVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // --- Estados para o Simulador de Preço ---
  const [simulatedMarkup, setSimulatedMarkup] = useState("2.0");
  const [simulatedTax, setSimulatedTax] = useState("0");
  const [simulatedPrice, setSimulatedPrice] = useState(0);
  const [simulatedProfit, setSimulatedProfit] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);

  useEffect(() => {
    fetchPiece();
    getCurrentUser();
  }, [id]);

  useEffect(() => {
    if (piece) {
      // Tenta extrair o markup das notas para o simulador
      let initialMarkup = "2.0";
      if (piece.notes) {
        const markupMatch = piece.notes.match(/Markup:\s*([0-9.]+)/i);
        if (markupMatch && markupMatch[1]) {
          initialMarkup = markupMatch[1];
        }
      }
      setSimulatedMarkup(initialMarkup);

      // Recalcula o simulador com base no custo da peça
      if (piece.cost != null) {
        updateSimulation(initialMarkup, simulatedTax, piece.cost);
      }
    }
  }, [piece]);

  // Efeito para RECALCULAR o simulador
  useEffect(() => {
    if (piece && piece.cost != null) {
      updateSimulation(simulatedMarkup, simulatedTax, piece.cost);
    }
  }, [piece, simulatedMarkup, simulatedTax]);
  
  // Função helper para centralizar o cálculo da simulação
  const updateSimulation = (markupStr: string, taxStr: string, cost: number) => {
    const markup = parseFloat(markupStr) || 1;
    const taxPercent = parseFloat(taxStr) || 0;

    const precoBase = cost * markup;
    const divisor = 1 - (taxPercent / 100);
    const precoFinal = divisor > 0 ? precoBase / divisor : precoBase;
    
    const impostoPago = precoFinal * (taxPercent / 100);
    const lucroLiquido = precoFinal - cost - impostoPago;
    
    const margemDeLucro = precoFinal > 0 ? (lucroLiquido / precoFinal) * 100 : 0;

    setSimulatedPrice(precoFinal);
    setSimulatedProfit(lucroLiquido);
    setProfitMargin(margemDeLucro);
  };


  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchPiece = async () => {
    try {
      const { data, error } = await supabase
        .from("pieces")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPiece(data as any);

      // Buscar variações de preço
      const { data: variations } = await supabase
        .from("piece_price_variations" as any)
        .select("*")
        .eq("piece_id", id);
      
      if (variations) {
        setPriceVariations(variations as any);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar peça",
        description: error.message,
        variant: "destructive",
      });
      navigate("/catalog");
    } finally {
      setLoading(false);
    }
  };

  const toggleSaleStatus = async () => {
    if (!piece) return;
    const newStatus = !(piece.is_selling || false);
    try {
      const { error } = await supabase
        .from("pieces")
        .update({ is_selling: newStatus } as any)
        .eq("id", piece.id);

      if (error) throw error;
      
      setPiece(prev => prev ? { ...prev, is_selling: newStatus } : null);
      
      toast({
        title: newStatus ? "Peça colocada no ar!" : "Peça retirada do ar",
      });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  };


  const handleDelete = async () => {
    if (!piece) return;

    try {
      const { error } = await supabase.from("pieces").delete().eq("id", piece.id);

      if (error) throw error;

      toast({
        title: "Peça excluída",
        description: "A peça foi removida do catálogo",
      });
      navigate("/catalog");
    } catch (error: any) {
      toast({
        title: "Erro ao excluir peça",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Box className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando peça...</p>
        </div>
      </div>
    );
  }

  if (!piece) return null;

  const isOwner = currentUserId === piece.user_id;
  const isLive = piece.is_selling === true;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/catalog" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao catálogo
            </Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image */}
          <Card className="card-gradient border-border/50 overflow-hidden relative">
            {isLive && (
              <Badge className="absolute top-4 right-4 z-10 bg-green-600 shadow-lg">
                No Ar
              </Badge>
            )}
            <div className="aspect-square bg-muted/30">
              {piece.image_url ? (
                <img
                  src={piece.image_url}
                  alt={piece.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Box className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
          </Card>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{piece.name}</h1>
              <p className="text-muted-foreground">{piece.description || "Sem descrição"}</p>
            </div>

            <Card className="card-gradient border-border/50">
              <CardHeader>
                <CardTitle>Material</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-primary font-medium">
                  {piece.material || "Não especificado"}
                </p>
              </CardContent>
            </Card>

            {/* --- Card de Precificação ATUALIZADO --- */}
            <Card className="card-gradient border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Precificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* --- 1. Valores Salvos (Padrão) --- */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Valores Padrão</Label>
                  {(piece.cost != null || piece.preco_venda != null) ? (
                    <>
                      {piece.cost != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Custo de Produção:</span>
                          <span className="font-medium text-lg">
                            R$ {piece.cost.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {piece.preco_venda != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Preço de Venda:</span>
                          <span className="font-medium text-lg text-primary">
                            R$ {piece.preco_venda.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {piece.lucro_liquido != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            Lucro Líquido:
                          </span>
                          <span className="font-bold text-lg text-green-500">
                            R$ {piece.lucro_liquido.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum dado de precificação salvo. Edite a peça para calculá-los.
                    </p>
                  )}
                </div>

                {/* --- Variações de Preço --- */}
                {priceVariations.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <Label className="text-base font-medium">Variações de Preço</Label>
                    <div className="space-y-2">
                      {priceVariations.map((variation) => {
                        // Calcula o custo base mínimo: (custo + 4) / 0.8
                        const custoBaseMinimo = (variation.calculated_cost + 4) / 0.8;
                        
                        return (
                          <Card key={variation.id} className="border-border/50 bg-muted/20">
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="font-medium">
                                    {variation.variation_name}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    R$ {variation.custo_kg_filamento.toFixed(2)}/kg
                                  </span>
                                </div>
                                {variation.peso_g && (
                                  <div className="text-xs text-muted-foreground">
                                    {variation.peso_g}g • {variation.tempo_impressao_min ? `${Math.floor(variation.tempo_impressao_min / 60)}h ${variation.tempo_impressao_min % 60}min` : ''}
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Custo:</span>
                                    <p className="font-semibold">R$ {variation.calculated_cost.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Custo Base (no zero):</span>
                                    <p className="font-semibold text-primary">R$ {custoBaseMinimo.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* --- 2. Simulador --- */}
                {piece.cost != null && ( // Só mostra o simulador se o custo existir
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex justify-between items-center">
                       <Label className="text-base font-medium">Simular Novo Preço</Label>
                       <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Apenas para visualização
                       </p>
                    </div>

                    {/* Inputs do Simulador */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="sim-markup" className="text-xs">Margem (Markup)</Label>
                        <Input
                          id="sim-markup"
                          type="number"
                          step="0.1"
                          value={simulatedMarkup}
                          onChange={(e) => setSimulatedMarkup(e.target.value)}
                          className="h-9"
                          placeholder="ex: 2.0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sim-tax" className="text-xs">Taxas / Impostos (%)</Label>
                        <Input
                          id="sim-tax"
                          type="number"
                          step="0.5"
                          value={simulatedTax}
                          onChange={(e) => setSimulatedTax(e.target.value)}
                          className="h-9"
                          placeholder="ex: 5"
                        />
                      </div>
                    </div>

                    {/* Resultados da Simulação */}
                    <div className="space-y-3 pt-3 border-t border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Preço de Venda (Simulado):</span>
                        <span className="font-medium text-lg text-primary">
                          R$ {simulatedPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          Lucro Líquido (Simulado):
                        </span>
                        <span className="font-bold text-lg text-green-500">
                          R$ {simulatedProfit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Margem de Lucro:</span>
                        <span className="font-medium text-green-500">
                          {profitMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>


            {piece.notes && (
              <Card className="card-gradient border-border/50">
                <CardHeader>
                  <CardTitle>Observações Técnicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{piece.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isOwner && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button asChild className="gap-2 flex-1">
                    <Link to={`/piece/${piece.id}/edit`}>
                      <Edit className="h-4 w-4" />
                      Editar Peça (Salvar)
                    </Link>
                  </Button>
                  <Button
                    variant={isLive ? 'default' : 'outline'}
                    onClick={toggleSaleStatus}
                    className="gap-2 flex-1"
                  >
                    <Radio className="h-4 w-4" />
                    {isLive ? 'No Ar' : 'Colocar no Ar'}
                  </Button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                {piece.stl_url && (
                  <Button asChild variant="outline" className="flex-1 gap-2">
                    <a href={piece.stl_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                      Baixar STL
                    </a>
                  </Button>
                )}
                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2 flex-1">
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir esta peça? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}