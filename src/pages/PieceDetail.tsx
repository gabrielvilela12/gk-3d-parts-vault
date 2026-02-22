import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Trash2, Box, DollarSign, Radio,
  TrendingUp, Edit, Palette, Package, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── Types ──────────────────────────────────────────────
interface Piece {
  id: string; name: string; description: string;
  material: string; stl_url: string; image_url: string;
  notes: string; created_at: string; user_id: string;
  cost: number | null; is_selling: boolean | null;
  preco_venda: number | null; lucro_liquido: number | null;
  peso_g: number | null; tempo_impressao_min: number | null;
  custo_material: number | null; custo_energia: number | null;
  custo_acessorios: number | null;
}

interface Filament {
  id: string; name: string; color: string | null; custo_kg: number;
}

interface CostDefaults {
  potenciaImpressoraW: number; custoKWh: number;
  custoFixoMes: number; unidadesMes: number;
  valorImpressora: number; vidaUtilHoras: number;
  percentualFalhas: number; custoAcessorios: number;
  markup: number;
}

interface PriceVariation {
  id: string; variation_name: string; custo_kg_filamento: number;
  calculated_cost: number; calculated_price: number;
  peso_g: number | null; tempo_impressao_min: number | null;
}

// ── Shopee Price Calculator ────────────────────────────
function calcShopeePrice(custoUnitario: number, markup: number, quantidade = 1) {
  const COMISSAO = 0.20;
  const TAXA_FIXA_PADRAO = 7.00;
  const TAXA_FIXA_MINIMA = 2.00;
  const LIMITE_PRECO_TAXA_MINIMA = 8.00;
  const LIMITE_COMISSAO_REAIS = 100.00;

  const precoBase = (custoUnitario * markup) * quantidade;
  let taxaFixa = TAXA_FIXA_PADRAO;
  let precoConsumidor = (precoBase + taxaFixa) / (1 - COMISSAO);

  if (precoConsumidor < LIMITE_PRECO_TAXA_MINIMA) {
    taxaFixa = TAXA_FIXA_MINIMA;
    precoConsumidor = (precoBase + taxaFixa) / (1 - COMISSAO);
  }

  let comissaoEmReais = precoConsumidor * COMISSAO;
  if (comissaoEmReais > LIMITE_COMISSAO_REAIS) {
    comissaoEmReais = LIMITE_COMISSAO_REAIS;
    precoConsumidor = (custoUnitario * quantidade) + comissaoEmReais + taxaFixa;
  }

  const lucroLiquido = precoConsumidor - (custoUnitario * quantidade) - comissaoEmReais - taxaFixa;
  return { precoConsumidor, comissaoEmReais, taxaFixa, lucroLiquido };
}

// ── Cost calculator per filament ───────────────────────
function calcCostForFilament(
  filament: Filament, pesoG: number, tempoMin: number, d: CostDefaults, markup: number
) {
  const tempoH = tempoMin / 60;
  const custoMaterial = (pesoG / 1000) * filament.custo_kg;
  const custoEnergia = (d.potenciaImpressoraW / 1000) * tempoH * d.custoKWh;
  const custoFixoUnit = d.unidadesMes > 0 ? d.custoFixoMes / d.unidadesMes : 0;
  const custoAmortizacao = d.vidaUtilHoras > 0 ? (d.valorImpressora / d.vidaUtilHoras) * tempoH : 0;
  const custoVariavel = custoMaterial + custoEnergia;
  const custoFalhas = custoVariavel * (d.percentualFalhas / 100);
  const custoUnitario = custoMaterial + custoEnergia + custoFixoUnit + custoAmortizacao + d.custoAcessorios + custoFalhas;

  const shopeeZero = calcShopeePrice(custoUnitario, 1);
  const shopeeMarkup = calcShopeePrice(custoUnitario, markup);

  return {
    filament,
    custoMaterial,
    custoEnergia,
    custoAmortizacao,
    custoFalhas,
    custoUnitario,
    precoBaseShopee: shopeeZero.precoConsumidor,
    precoComMarkup: shopeeMarkup.precoConsumidor,
    lucroLiquido: shopeeMarkup.lucroLiquido,
    comissao: shopeeMarkup.comissaoEmReais,
    taxaFixa: shopeeMarkup.taxaFixa,
  };
}

// ── Component ──────────────────────────────────────────
export default function PieceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [piece, setPiece] = useState<Piece | null>(null);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [defaults, setDefaults] = useState<CostDefaults>({
    potenciaImpressoraW: 1300, custoKWh: 0.5, custoFixoMes: 0,
    unidadesMes: 0, valorImpressora: 5000, vidaUtilHoras: 15000,
    percentualFalhas: 2, custoAcessorios: 2, markup: 1.5,
  });
  const [priceVariations, setPriceVariations] = useState<PriceVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [markup, setMarkup] = useState("1.5");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);

        const [pieceRes, filRes, presetRes, varRes] = await Promise.all([
          supabase.from("pieces").select("*").eq("id", id).single(),
          supabase.from("filaments").select("*").order("name"),
          supabase.from("calculation_presets").select("*").eq("preset_name", "default").maybeSingle(),
          supabase.from("piece_price_variations" as any).select("*").eq("piece_id", id),
        ]);

        if (pieceRes.error) throw pieceRes.error;
        setPiece(pieceRes.data as any);
        setFilaments((filRes.data as any[]) || []);
        if (varRes.data) setPriceVariations(varRes.data as any);

        if (presetRes.data) {
          const d = presetRes.data;
          const loadedDefaults = {
            potenciaImpressoraW: d.potencia_impressora_w || 1300,
            custoKWh: d.custo_kwh || 0.5,
            custoFixoMes: d.custo_fixo_mes || 0,
            unidadesMes: d.unidades_mes || 0,
            valorImpressora: d.valor_impressora || 5000,
            vidaUtilHoras: d.vida_util_horas || 15000,
            percentualFalhas: d.percentual_falhas || 2,
            custoAcessorios: d.custo_acessorios || 2,
            markup: d.markup || 1.5,
          };
          setDefaults(loadedDefaults);
          setMarkup(loadedDefaults.markup.toString());
        }
      } catch (error: any) {
        toast({ title: "Erro ao carregar peça", description: error.message, variant: "destructive" });
        navigate("/catalog");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const toggleSaleStatus = async () => {
    if (!piece) return;
    const newStatus = !(piece.is_selling || false);
    try {
      const { error } = await supabase.from("pieces").update({ is_selling: newStatus } as any).eq("id", piece.id);
      if (error) throw error;
      setPiece(prev => prev ? { ...prev, is_selling: newStatus } : null);
      toast({ title: newStatus ? "Peça colocada no ar!" : "Peça retirada do ar" });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!piece) return;
    try {
      const { error } = await supabase.from("pieces").delete().eq("id", piece.id);
      if (error) throw error;
      toast({ title: "Peça excluída", description: "A peça foi removida do catálogo" });
      navigate("/catalog");
    } catch (error: any) {
      toast({ title: "Erro ao excluir peça", description: error.message, variant: "destructive" });
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
  const pesoG = piece.peso_g || 0;
  const tempoMin = piece.tempo_impressao_min || 0;
  const tempoH = Math.floor(tempoMin / 60);
  const tempoM = Math.round(tempoMin % 60);
  const mkValue = parseFloat(markup) || 1;

  // Calculate costs for all filaments
  const filamentCosts = (pesoG > 0 || tempoMin > 0)
    ? filaments.map(f => calcCostForFilament(f, pesoG, tempoMin, defaults, mkValue))
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <Button asChild variant="ghost">
          <Link to="/catalog" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </Link>
        </Button>

        {/* ── Top: Image + Info ── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image */}
          <Card className="card-gradient border-border/50 overflow-hidden relative">
            {isLive && (
              <Badge className="absolute top-4 right-4 z-10 bg-green-600 shadow-lg">No Ar</Badge>
            )}
            <div className="aspect-square bg-muted/30">
              {piece.image_url ? (
                <img src={piece.image_url} alt={piece.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Box className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
          </Card>

          {/* Info + Actions */}
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold">{piece.name}</h1>
              <p className="text-muted-foreground mt-1">{piece.description || "Sem descrição"}</p>
            </div>

            {/* Quick info badges */}
            <div className="flex flex-wrap gap-2">
              {piece.material && <Badge variant="secondary">{piece.material}</Badge>}
              {pesoG > 0 && <Badge variant="outline">{pesoG}g</Badge>}
              {tempoMin > 0 && <Badge variant="outline">{tempoH}h {tempoM}min</Badge>}
            </div>

            {/* Custo de Fabricação salvo */}
            {piece.cost != null && (
              <Card className="card-gradient border-border/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Custo de Fabricação (salvo):</span>
                    <span className="font-semibold text-lg">R$ {piece.cost.toFixed(2)}</span>
                  </div>
                  {piece.preco_venda != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Preço de Venda (salvo):</span>
                      <span className="font-semibold text-lg text-primary">R$ {piece.preco_venda.toFixed(2)}</span>
                    </div>
                  )}
                  {piece.lucro_liquido != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Lucro Líquido (salvo):</span>
                      <span className="font-bold text-lg text-green-500">R$ {piece.lucro_liquido.toFixed(2)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {piece.notes && (
              <Card className="card-gradient border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{piece.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isOwner && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button asChild className="gap-2 flex-1">
                    <Link to={`/piece/${piece.id}/edit`}>
                      <Edit className="h-4 w-4" /> Editar Peça
                    </Link>
                  </Button>
                  <Button variant={isLive ? "default" : "outline"} onClick={toggleSaleStatus} className="gap-2 flex-1">
                    <Radio className="h-4 w-4" /> {isLive ? "No Ar" : "Colocar no Ar"}
                  </Button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                {piece.stl_url && (
                  <Button asChild variant="outline" className="flex-1 gap-2">
                    <a href={piece.stl_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" /> Baixar STL
                    </a>
                  </Button>
                )}
                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2 flex-1">
                        <Trash2 className="h-4 w-4" /> Excluir
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

        {/* ── Markup Control ── */}
        {(pesoG > 0 || tempoMin > 0) && filaments.length > 0 && (
          <Card className="card-gradient border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Markup do Produto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="markup-input" className="text-sm text-muted-foreground whitespace-nowrap">
                  Multiplicador de Markup:
                </Label>
                <Input
                  id="markup-input"
                  type="number"
                  step="0.1"
                  min="1"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  className="w-28 h-9"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Simulação em tempo real — não salva automaticamente
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Relatório de Preços por Filamento ── */}
        {filamentCosts.length > 0 && (
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Preço por Filamento / Cor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Cálculo automático com Shopee (20% comissão + R$ 7,00 taxa fixa) • Markup: {mkValue}x
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {filamentCosts.map((fc) => (
                  <Card key={fc.filament.id} className="border-border/50 bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-semibold">
                            {fc.filament.name}
                          </Badge>
                          {fc.filament.color && (
                            <span className="text-xs text-muted-foreground">{fc.filament.color}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          R$ {fc.filament.custo_kg.toFixed(2)}/kg
                        </span>
                      </div>

                      <Separator />

                      {/* Cost breakdown */}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Material:</span>
                          <span>R$ {fc.custoMaterial.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Energia:</span>
                          <span>R$ {fc.custoEnergia.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amortização:</span>
                          <span>R$ {fc.custoAmortizacao.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Falhas ({defaults.percentualFalhas}%):</span>
                          <span>R$ {fc.custoFalhas.toFixed(2)}</span>
                        </div>

                        <Separator className="my-1" />

                        <div className="flex justify-between font-medium">
                          <span>Custo Fabricação:</span>
                          <span>R$ {fc.custoUnitario.toFixed(2)}</span>
                        </div>
                      </div>

                      <Separator />

                      {/* Shopee prices */}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Preço Base Shopee (zero):</span>
                          <span className="text-yellow-500 font-medium">R$ {fc.precoBaseShopee.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center bg-primary/10 -mx-4 px-4 py-2 rounded">
                          <span className="font-semibold text-primary">Preço Consumidor ({mkValue}x):</span>
                          <span className="font-bold text-lg text-primary">R$ {fc.precoComMarkup.toFixed(2)}</span>
                        </div>
                      </div>

                      <Separator />

                      {/* Profit */}
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>- Comissão Shopee (20%):</span>
                          <span className="text-red-500">-R$ {fc.comissao.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>- Taxa Fixa:</span>
                          <span className="text-red-500">-R$ {fc.taxaFixa.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>- Custo Produção:</span>
                          <span className="text-red-500">-R$ {fc.custoUnitario.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-border/30 pt-1.5 mt-1">
                          <span className="font-semibold text-sm flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Lucro Líquido:
                          </span>
                          <span className={`font-bold text-sm ${fc.lucroLiquido >= 0 ? "text-green-500" : "text-red-500"}`}>
                            R$ {fc.lucroLiquido.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Variações Salvas ── */}
        {priceVariations.length > 0 && (
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Variações Salvas
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Variações de preço salvas durante a edição da peça
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {priceVariations.map((v) => {
                  const custoBase = v.calculated_cost;
                  const shopee = calcShopeePrice(custoBase, 1);
                  const shopeeMarkup = calcShopeePrice(custoBase, mkValue);

                  return (
                    <Card key={v.id} className="border-border/50 bg-muted/10">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="font-medium">{v.variation_name}</Badge>
                          <span className="text-xs text-muted-foreground">R$ {v.custo_kg_filamento.toFixed(2)}/kg</span>
                        </div>
                        {v.peso_g && (
                          <p className="text-xs text-muted-foreground">
                            {v.peso_g}g • {v.tempo_impressao_min ? `${Math.floor(v.tempo_impressao_min / 60)}h ${v.tempo_impressao_min % 60}min` : ""}
                          </p>
                        )}
                        <Separator />
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo Fabricação:</span>
                            <span className="font-medium">R$ {custoBase.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preço Base (zero):</span>
                            <span className="text-yellow-500 font-medium">R$ {shopee.precoConsumidor.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center bg-primary/10 -mx-4 px-4 py-2 rounded">
                            <span className="font-semibold text-primary">Preço ({mkValue}x):</span>
                            <span className="font-bold text-lg text-primary">R$ {shopeeMarkup.precoConsumidor.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="font-semibold text-sm flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" /> Lucro:
                            </span>
                            <span className={`font-bold text-sm ${shopeeMarkup.lucroLiquido >= 0 ? "text-green-500" : "text-red-500"}`}>
                              R$ {shopeeMarkup.lucroLiquido.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aviso se não tem filamentos */}
        {filaments.length === 0 && (pesoG > 0 || tempoMin > 0) && (
          <Card className="border-border/50 border-dashed">
            <CardContent className="py-8 text-center">
              <Palette className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-3">
                Cadastre filamentos em <strong>Configurações</strong> para ver o relatório de preços por cor.
              </p>
              <Button asChild variant="outline">
                <Link to="/settings">Ir para Configurações</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Aviso se peça sem peso/tempo */}
        {pesoG === 0 && tempoMin === 0 && (
          <Card className="border-border/50 border-dashed">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Esta peça não tem peso e tempo de impressão cadastrados. Edite a peça para calcular os custos automaticamente.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
