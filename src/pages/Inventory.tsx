import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Cylinder, Plus, Minus, Trash2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Filament {
  id: string;
  name: string;
  color: string | null;
  custo_kg: number;
  stock_kg: number;
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
  const [selectedPieceId, setSelectedPieceId] = useState("");
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
    if (!selectedPieceId) return;
    const qty = parseInt(addQty) || 1;
    const existing = catalogPieces.find(p => p.id === selectedPieceId);
    const newQty = (existing?.stock_quantity || 0) + qty;
    const { error } = await supabase.from("pieces").update({ stock_quantity: newQty }).eq("id", selectedPieceId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Estoque atualizado", description: `${existing?.name}: ${newQty} unidades` });
    setAddStockOpen(false);
    setSelectedPieceId("");
    setAddQty("1");
    fetchData();
  }

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
                        style={{ backgroundColor: fil.color || "#888" }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{fil.name}</p>
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
            <Dialog open={addStockOpen} onOpenChange={(open) => { setAddStockOpen(open); if (open) fetchCatalogPieces(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" />
                  Adicionar do Catálogo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Peça ao Estoque</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={selectedPieceId} onValueChange={setSelectedPieceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma peça" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogPieces.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.category ? `(${p.category})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <label className="text-sm font-medium">Quantidade</label>
                    <Input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={e => setAddQty(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleAddFromCatalog} disabled={!selectedPieceId}>
                    Adicionar
                  </Button>
                </div>
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
