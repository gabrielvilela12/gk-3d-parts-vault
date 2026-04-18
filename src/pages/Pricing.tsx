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
import { Search, Tag, Zap, Gift, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Piece {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  cost: number | null;
  preco_venda: number | null;
}

const SHOPEE_FIXED_FEE = 7;
const SHOPEE_COMMISSION = 0.2;

// Base Shopee price formula: (cost + fixed) / (1 - commission)
function calcShopeeBase(cost: number) {
  return (cost + SHOPEE_FIXED_FEE) / (1 - SHOPEE_COMMISSION);
}

// Net profit after Shopee fees on a given selling price
function calcNetProfit(price: number, cost: number) {
  return price - price * SHOPEE_COMMISSION - SHOPEE_FIXED_FEE - cost;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Pricing() {
  const { toast } = useToast();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Global controls
  const [markup, setMarkup] = useState(0.5); // 0 = cost, 1 = 100% profit
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [flashDiscount, setFlashDiscount] = useState(15); // %
  const [couponEnabled, setCouponEnabled] = useState(true);
  const [couponDiscount, setCouponDiscount] = useState(5); // %

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, [toast]);

  const filtered = useMemo(
    () =>
      pieces.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [pieces, search],
  );

  // Buffered base price covers worst-case combined discount so net profit stays positive
  const totalDiscount =
    (flashEnabled ? flashDiscount : 0) + (couponEnabled ? couponDiscount : 0);

  const rows = useMemo(() => {
    return filtered.map((p) => {
      const cost = Number(p.cost ?? 0);
      const baseShopee = calcShopeeBase(cost);
      // Apply markup on top of base (markup 0 = base, 1 = +100%)
      const targetWithMargin = baseShopee * (1 + markup);

      // Buffer the listed price so that after applying combined discounts the
      // user still receives at least the base shopee price.
      const buffer = totalDiscount > 0 ? 1 / (1 - totalDiscount / 100) : 1;
      const listedPrice = Math.max(targetWithMargin, baseShopee * buffer);

      const flashPrice = flashEnabled
        ? listedPrice * (1 - flashDiscount / 100)
        : listedPrice;
      const couponPrice = couponEnabled
        ? flashPrice * (1 - couponDiscount / 100)
        : flashPrice;

      return {
        ...p,
        cost,
        baseShopee,
        listedPrice,
        flashPrice,
        couponPrice,
        netListed: calcNetProfit(listedPrice, cost),
        netFlash: calcNetProfit(flashPrice, cost),
        netCoupon: calcNetProfit(couponPrice, cost),
      };
    });
  }, [
    filtered,
    markup,
    flashEnabled,
    flashDiscount,
    couponEnabled,
    couponDiscount,
    totalDiscount,
  ]);

  const summary = useMemo(() => {
    const withCost = rows.filter((r) => r.cost > 0);
    const avgListed =
      withCost.reduce((s, r) => s + r.listedPrice, 0) /
      Math.max(withCost.length, 1);
    const avgNet =
      withCost.reduce((s, r) => s + r.netCoupon, 0) /
      Math.max(withCost.length, 1);
    return {
      total: rows.length,
      withCost: withCost.length,
      avgListed,
      avgNet,
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
              Preços calculados com oferta relâmpago e cupom de primeira compra
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Configurações de preço</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Markup ({(markup * 100).toFixed(0)}% lucro)
            </Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              value={markup}
              onChange={(e) => setMarkup(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              0 = preço de custo Shopee · 1 = +100% sobre custo
            </p>
          </div>

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
          <p className="text-xs text-muted-foreground">Preço médio</p>
          <p className="text-2xl font-bold">{formatBRL(summary.avgListed)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Lucro médio (c/ cupom)</p>
          <p className="text-2xl font-bold text-green-500">{formatBRL(summary.avgNet)}</p>
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peça</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Preço de venda</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" /> Relâmpago
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    <Gift className="h-3 w-3 text-green-500" /> + Cupom 5%
                  </span>
                </TableHead>
                <TableHead className="text-right">Lucro final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                        <p className="font-medium">{r.name}</p>
                        {r.category && (
                          <Badge variant="outline" className="text-xs mt-0.5">{r.category}</Badge>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.cost > 0 ? formatBRL(r.cost) : "—"}
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
                    <span className={r.netCoupon >= 0 ? "text-green-500" : "text-destructive"}>
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
