import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Cylinder, Plus, Minus, Trash2, Search, Check, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Filament {
  id: string;
  name: string;
  color: string | null;
  custo_kg: number;
  stock_kg: number;
}

const COLOR_HEX_MAP: Record<string, string> = {
  "branco": "#FFFFFF",
  "preto": "#1a1a1a",
  "vermelho": "#DC2626",
  "azul": "#2563EB",
  "rosa": "#EC4899",
  "marrom escuro": "#5C3317",
  "marrom claro": "#C4A35A",
  "amarelo": "#EAB308",
  "verde": "#16A34A",
  "cinza": "#6B7280",
  "laranja": "#EA580C",
  "roxo": "#7C3AED",
  "dourado": "#D4A017",
  "prata": "#C0C0C0",
  "transparente": "#E5E7EB",
  "bege": "#D2B48C",
};

function getColorHex(colorName: string | null): string {
  if (!colorName) return "#888";
  return COLOR_HEX_MAP[colorName.toLowerCase()] || "#888";
}

interface Piece {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
  stores: string[] | null;
}

export default function Inventory() {
  const { toast } = useToast();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [catalogPieces, setCatalogPieces] = useState<Piece[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [addQty, setAddQty] = useState("1");

  async function fetchData() {
    setLoading(true);
    const [filRes, pieceRes] = await Promise.all([
      supabase.from("filaments").select("id, name, color, custo_kg, stock_kg"),
      supabase.from("pieces").select("id, name, image_url, category, stock_quantity, stores").gt("stock_quantity", 0).order("name"),
    ]);
    if (filRes.data) setFilaments(filRes.data);
    if (pieceRes.data) setPieces(pieceRes.data);
    setLoading(false);
  }

  async function fetchCatalogPieces() {
    const { data } = await supabase.from("pieces").select("id, name, image_url, category, stock_quantity, stores").order("name");
    if (data) setCatalogPieces(data);
  }

  useEffect(() => { fetchData(); }, []);

  async function updateFilamentStock(id: string, delta: number) {
    const fil = filaments.find(f => f.id === id);
    if (!fil) return;
    const newVal = Math.max(0, fil.stock_kg + delta);
    const { error } = await supabase.from("filaments").update({ stock_kg: newVal }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setFilaments(prev => prev.map(f => f.id === id ? { ...f, stock_kg: newVal } : f));
  }

  async function updatePieceStock(id: string, delta: number) {
    const piece = pieces.find(p => p.id === id);
    if (!piece) return;
    const newVal = Math.max(0, piece.stock_quantity + delta);
    const { error } = await supabase.from("pieces").update({ stock_quantity: newVal }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (newVal === 0) {
      setPieces(prev => prev.filter(p => p.id !== id));
    } else {
      setPieces(prev => prev.map(p => p.id === id ? { ...p, stock_quantity: newVal } : p));
    }
  }

  async function handleAddFromCatalog() {
    if (!selectedPiece) return;
    const qty = parseInt(addQty) || 1;
    const newQty = (selectedPiece.stock_quantity || 0) + qty;
    const { error } = await supabase.from("pieces").update({ stock_quantity: newQty }).eq("id", selectedPiece.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Estoque atualizado", description: `${selectedPiece.name}: ${newQty} unidades` });
    setAddStockOpen(false);
    setSelectedPiece(null);
    setCatalogSearch("");
    setAddQty("1");
    fetchData();
  }

  const filteredCatalog = catalogPieces.filter(p =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(catalogSearch.toLowerCase())
  );

  async function setFilamentStockDirect(id: string, value: string) {
    const newVal = Math.max(0, parseFloat(value) || 0);
    const { error } = await supabase.from("filaments").update({ stock_kg: newVal }).eq("id", id);
    if (error) return;
    setFilaments(prev => prev.map(f => f.id === id ? { ...f, stock_kg: newVal } : f));
  }

  const filteredFilaments = filaments.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.color || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredPieces = pieces.filter(p =>
    p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(stockSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Estoque & Inventário</h1>
        <p className="text-sm text-muted-foreground">Controle de filamentos e peças em estoque</p>
      </div>

      <Tabs defaultValue="filaments" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="filaments" className="gap-2">
            <Cylinder className="h-4 w-4" />
            Filamentos
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Package className="h-4 w-4" />
            Estoque de Peças
          </TabsTrigger>
        </TabsList>

        {/* FILAMENTS TAB */}
        <TabsContent value="filaments" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar filamento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredFilaments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum filamento cadastrado. Adicione em Configurações.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredFilaments.map(fil => (
                <Card key={fil.id}>
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-8 w-8 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: getColorHex(fil.color) }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{fil.color || "Sem cor"} <span className="text-muted-foreground font-normal">— {fil.name}</span></p>
                        <p className="text-xs text-muted-foreground">R$ {fil.custo_kg.toFixed(2)}/kg</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilamentStock(fil.id, -0.1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        className="w-20 text-center h-8 text-sm"
                        value={fil.stock_kg.toFixed(1)}
                        onBlur={e => setFilamentStockDirect(fil.id, e.target.value)}
                        onChange={() => {}}
                      />
                      <span className="text-xs text-muted-foreground">kg</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilamentStock(fil.id, 0.1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* STOCK TAB */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar peça no estoque..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={addStockOpen} onOpenChange={(open) => { setAddStockOpen(open); if (open) { fetchCatalogPieces(); setSelectedPiece(null); setCatalogSearch(""); setAddQty("1"); } }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" />
                  Adicionar do Catálogo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-0">
                  <DialogTitle>
                    {selectedPiece ? (
                      <button onClick={() => setSelectedPiece(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar à lista
                      </button>
                    ) : "Adicionar Peça ao Estoque"}
                  </DialogTitle>
                </DialogHeader>

                {!selectedPiece ? (
                  <div className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                    <div className="relative mt-3 mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar peça por nome ou categoria..."
                        value={catalogSearch}
                        onChange={e => setCatalogSearch(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                    <ScrollArea className="flex-1 max-h-[55vh]">
                      {filteredCatalog.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Nenhuma peça encontrada.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-3">
                          {filteredCatalog.map(piece => (
                            <button
                              key={piece.id}
                              onClick={() => setSelectedPiece(piece)}
                              className="group relative flex flex-col rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all overflow-hidden text-left"
                            >
                              <div className="aspect-square bg-muted relative overflow-hidden">
                                {piece.image_url ? (
                                  <img src={piece.image_url} alt={piece.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="h-8 w-8 text-muted-foreground/40" />
                                  </div>
                                )}
                                {piece.stock_quantity > 0 && (
                                  <Badge className="absolute top-1.5 right-1.5 text-[10px]">{piece.stock_quantity} em estoque</Badge>
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="text-sm font-medium truncate">{piece.name}</p>
                                {piece.category && <Badge variant="secondary" className="text-[10px] mt-1">{piece.category}</Badge>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="px-6 pb-6 space-y-4">
                    <div className="flex gap-4 items-start mt-2">
                      <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                        {selectedPiece.image_url ? (
                          <img src={selectedPiece.image_url} alt={selectedPiece.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedPiece.name}</p>
                        {selectedPiece.category && <Badge variant="secondary" className="mt-1">{selectedPiece.category}</Badge>}
                        {selectedPiece.stock_quantity > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Atualmente: {selectedPiece.stock_quantity} un. em estoque</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Quantidade a adicionar</label>
                      <Input
                        type="number"
                        min="1"
                        value={addQty}
                        onChange={e => setAddQty(e.target.value)}
                        className="mt-1"
                        autoFocus
                      />
                    </div>
                    <Button className="w-full gap-2" onClick={handleAddFromCatalog}>
                      <Check className="h-4 w-4" />
                      Confirmar ({parseInt(addQty) || 1} un.)
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {filteredPieces.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma peça em estoque. Use "Adicionar do Catálogo" para começar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredPieces.map(piece => (
                <Card key={piece.id}>
                  <CardContent className="flex items-center justify-between py-3 px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      {piece.image_url ? (
                        <img src={piece.image_url} alt={piece.name} className="h-10 w-10 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{piece.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {piece.category && <Badge variant="secondary" className="text-[10px]">{piece.category}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePieceStock(piece.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-10 text-center font-semibold text-sm">{piece.stock_quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePieceStock(piece.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => updatePieceStock(piece.id, -piece.stock_quantity)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
