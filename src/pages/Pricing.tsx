import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Tag, Zap, Gift, Target, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Piece {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  cost: number | null;
  preco_venda: number | null;
}

const SHOPEE_COMMISSION = 0.2;
const TAXA_FIXA_PADRAO = 4.0;
const TAXA_FIXA_MINIMA = 2.0;
const LIMITE_PRECO_TAXA_MINIMA = 8.0;

// Shopee fee on a given final consumer price
function shopeeFee(price: number) {
  const taxa = price < LIMITE_PRECO_TAXA_MINIMA ? TAXA_FIXA_MINIMA : TAXA_FIXA_PADRAO;
  return price * SHOPEE_COMMISSION + taxa;
}

// Net profit the seller receives at a given final price
function netProfit(price: number, cost: number) {
  return price - shopeeFee(price) - cost;
}

// Reverse-engineer: which final price yields the target net profit?
// price - 0.2*price - taxa - cost = target  →  price = (cost + taxa + target) / 0.8
function priceForTargetProfit(cost: number, target: number) {
  // try with default fee first
  let price = (cost + TAXA_FIXA_PADRAO + target) / (1 - SHOPEE_COMMISSION);
  if (price < LIMITE_PRECO_TAXA_MINIMA) {
    price = (cost + TAXA_FIXA_MINIMA + target) / (1 - SHOPEE_COMMISSION);
  }
  return price;
}

// Round price up to end in ,90 (e.g. 32.42 → 32.90, 32.95 → 33.90)
function roundTo90(value: number) {
  const floor = Math.floor(value);
  const candidate = floor + 0.9;
  return candidate >= value ? candidate : floor + 1 + 0.9;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ProfitMode = "fixed" | "markup";

export default function Pricing() {
  const { toast } = useToast();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Profit strategy: how much net the seller wants AFTER all discounts
  const [profitMode, setProfitMode] = useState<ProfitMode>("fixed");
  const [targetProfit, setTargetProfit] = useState(0.5); // R$
  const [targetMarkup, setTargetMarkup] = useState(20); // % over cost

  // Discounts
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [flashDiscount, setFlashDiscount] = useState(15); // %
  const [couponEnabled, setCouponEnabled] = useState(true);
  const [couponDiscount, setCouponDiscount] = useState(5); // %

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("pieces")
        .select("id, name, image_url, category, cost, preco_venda")
        .order("name", { ascending: true });

      if (error) {
        toast({
          title: "Erro ao carregar peças",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setPieces((data ?? []) as Piece[]);
      }
      setLoading(false);
    };
    run();
  }, [toast]);

  const filtered = useMemo(
    () =>
      pieces.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [pieces, search],
  );

  const totalDiscount =
    (flashEnabled ? flashDiscount : 0) + (couponEnabled ? couponDiscount : 0);

  const rows = useMemo(() => {
    return filtered.map((p) => {
      const cost = Number(p.cost ?? 0);

      // 1. Preço base (sair no zero) — lucro = R$ 0
      const basePrice = priceForTargetProfit(cost, 0);

      // 2. Lucro alvo desejado
      const desiredProfit =
        profitMode === "fixed"
          ? targetProfit
          : cost * (targetMarkup / 100);

      // 3. Preço FINAL alvo (o que o cliente paga após cupom+relâmpago)
      // ele já contém o lucro alvo após pagar taxas Shopee
      const finalAfterDiscounts = priceForTargetProfit(cost, desiredProfit);

      // 4. Engenharia reversa: descobrir o preço de anunciar
      // finalAfterDiscounts = anuncio * (1 - flash%) * (1 - cupom%)
      const flashFactor = flashEnabled ? 1 - flashDiscount / 100 : 1;
      const couponFactor = couponEnabled ? 1 - couponDiscount / 100 : 1;
      const combinedFactor = flashFactor * couponFactor;

      const rawListed = combinedFactor > 0
        ? finalAfterDiscounts / combinedFactor
        : finalAfterDiscounts;

      // Arredondar preço de anunciar para terminar em ,90
      const listedPrice = roundTo90(rawListed);

      // Recalcular preços derivados a partir do listed arredondado
      const flashPrice = listedPrice * flashFactor;
      const couponPrice = flashPrice * couponFactor;

      return {
        ...p,
        cost,
        basePrice,
        listedPrice,
        flashPrice,
        couponPrice,
        desiredProfit,
        netBase: 0,
        netListed: netProfit(listedPrice, cost),
        netFlash: netProfit(flashPrice, cost),
        netCoupon: netProfit(couponPrice, cost),
      };
    });
  }, [
    filtered,
    profitMode,
    targetProfit,
    targetMarkup,
    flashEnabled,
    flashDiscount,
    couponEnabled,
    couponDiscount,
  ]);

  const summary = useMemo(() => {
    const withCost = rows.filter((r) => r.cost > 0);
    const avgListed =
      withCost.reduce((s, r) => s + r.listedPrice, 0) /
      Math.max(withCost.length, 1);
    const avgFinalProfit =
      withCost.reduce((s, r) => s + r.netCoupon, 0) /
      Math.max(withCost.length, 1);
    return {
      total: rows.length,
      withCost: withCost.length,
      avgListed,
      avgFinalProfit,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="page-header mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Tag className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="page-title">Precificação</h1>
            <p className="page-subtitle">
              Estratégia reversa: defina o lucro alvo após cupom + relâmpago
            </p>
          </div>
        </div>
      </div>

      {/* Strategy controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Estratégia de lucro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Button
              type="button"
              variant={profitMode === "fixed" ? "default" : "outline"}
              onClick={() => setProfitMode("fixed")}
              className="justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="flex items-center gap-2 font-semibold">
                  <Target className="h-4 w-4" /> Lucro fixo em R$
                </div>
                <div className="text-xs opacity-80 mt-1">
                  Mesmo lucro líquido em todas as peças
                </div>
              </div>
            </Button>
            <Button
              type="button"
              variant={profitMode === "markup" ? "default" : "outline"}
              onClick={() => setProfitMode("markup")}
              className="justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="flex items-center gap-2 font-semibold">
                  <Percent className="h-4 w-4" /> Markup % sobre custo
                </div>
                <div className="text-xs opacity-80 mt-1">
                  Lucro proporcional ao custo da peça
                </div>
              </div>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {profitMode === "fixed" ? (
              <div className="space-y-2">
                <Label>Lucro alvo (R$ líquido por peça)</Label>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(Number(e.target.value))}
                />
                <div className="flex flex-wrap gap-1">
                  {[0.5, 1, 2, 3, 5].map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={targetProfit === v ? "default" : "outline"}
                      onClick={() => setTargetProfit(v)}
                      className="h-7 px-2 text-xs"
                    >
                      R$ {v.toFixed(2).replace(".", ",")}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Markup alvo (%)</Label>
                <Input
                  type="number"
                  step="5"
                  min="0"
                  value={targetMarkup}
                  onChange={(e) => setTargetMarkup(Number(e.target.value))}
                />
                <div className="flex flex-wrap gap-1">
                  {[10, 20, 30, 50, 100].map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={targetMarkup === v ? "default" : "outline"}
                      onClick={() => setTargetMarkup(v)}
                      className="h-7 px-2 text-xs"
                    >
                      {v}%
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" /> Oferta Relâmpago
                </Label>
                <Switch checked={flashEnabled} onCheckedChange={setFlashEnabled} />
              </div>
              <Input
                type="number"
                min="0"
                max="90"
                value={flashDiscount}
                disabled={!flashEnabled}
                onChange={(e) => setFlashDiscount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">% de desconto na oferta</p>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-500" /> Cupom 1ª compra
                </Label>
                <Switch checked={couponEnabled} onCheckedChange={setCouponEnabled} />
              </div>
              <Input
                type="number"
                min="0"
                max="50"
                value={couponDiscount}
                disabled={!couponEnabled}
                onChange={(e) => setCouponDiscount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">% de cupom (padrão 5%)</p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
            <strong>Como funciona:</strong> O preço final (após cupom + relâmpago) é
            calculado para gerar exatamente o lucro alvo. O preço de anunciar é
            arredondado para terminar em ,90. Sem desconto, o lucro fica naturalmente
            maior (porque o cliente paga o preço cheio).
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Peças</p>
          <p className="text-2xl font-bold">{summary.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Com custo</p>
          <p className="text-2xl font-bold">{summary.withCost}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Preço médio anunciado</p>
          <p className="text-2xl font-bold">{formatBRL(summary.avgListed)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Lucro médio (final)</p>
          <p className="text-2xl font-bold text-green-500">{formatBRL(summary.avgFinalProfit)}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar peça..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peça</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Preço base (lucro 0)</TableHead>
                <TableHead className="text-right">→ Anunciar</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    → <Zap className="h-3 w-3 text-yellow-500" /> Relâmpago {flashEnabled ? `-${flashDiscount}%` : ""}
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    → <Gift className="h-3 w-3 text-green-500" /> Cupom {couponEnabled ? `-${couponDiscount}%` : ""}
                  </span>
                </TableHead>
                <TableHead className="text-right">Lucro final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma peça encontrada
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/piece/${r.id}`} className="flex items-center gap-3 hover:text-primary">
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <div>
                        <p className="font-medium line-clamp-2">{r.name}</p>
                        {r.category && (
                          <Badge variant="outline" className="text-xs mt-0.5">{r.category}</Badge>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.cost > 0 ? formatBRL(r.cost) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.cost > 0 ? formatBRL(r.basePrice) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatBRL(r.listedPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {flashEnabled ? (
                      <span className="text-yellow-500 font-medium">{formatBRL(r.flashPrice)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {couponEnabled ? (
                      <span className="text-green-500 font-medium">{formatBRL(r.couponPrice)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={r.netCoupon >= 0 ? "text-green-500 font-semibold" : "text-destructive font-semibold"}>
                      {formatBRL(r.netCoupon)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
