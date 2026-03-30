import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Cylinder, Plus, Minus, Trash2, Search, Check, ArrowLeft, Pencil } from "lucide-react";
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

function FilamentRow({ 
  fil, 
  onUpdateStock, 
  onEdit, 
  onDelete 
}: { 
  fil: Filament, 
  onUpdateStock: (id: string, value: number) => void,
  onEdit: (fil: Filament) => void,
  onDelete: (id: string) => void
}) {
  const [localStock, setLocalStock] = useState(fil.stock_kg.toFixed(1));

  useEffect(() => {
    if (parseFloat(localStock) !== fil.stock_kg) {
      setLocalStock(fil.stock_kg.toFixed(1));
    }
  }, [fil.stock_kg]);

  const handleBlur = () => {
    const val = parseFloat(localStock);
    if (!isNaN(val)) {
      onUpdateStock(fil.id, val);
    } else {
      setLocalStock(fil.stock_kg.toFixed(1));
    }
  };

  const handleAdjust = (delta: number) => {
    const newVal = Math.max(0, fil.stock_kg + delta);
    onUpdateStock(fil.id, newVal);
  };

  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 px-5 gap-4">
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
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-end">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAdjust(-0.1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              className="w-20 text-center h-8 text-sm"
              value={localStock}
              onChange={e => setLocalStock(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={e => { if (e.key === 'Enter') handleBlur() }}
            />
            <span className="text-xs text-muted-foreground sm:mr-2">kg</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAdjust(0.1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex gap-1 sm:ml-2 sm:border-l border-border sm:pl-4 mt-2 sm:mt-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(fil)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(fil.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Piece {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
  stock_by_color?: { color: string, quantity: number }[] | null;
  stores: string[] | null;
}

export default function Inventory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");

  const [filamentDialogOpen, setFilamentDialogOpen] = useState(false);
  const [editingFilament, setEditingFilament] = useState<Filament | null>(null);
  const [filName, setFilName] = useState("");
  const [filColor, setFilColor] = useState("");
  const [filCost, setFilCost] = useState("");
  const [filStock, setFilStock] = useState("");

  const [stockEditDialogOpen, setStockEditDialogOpen] = useState(false);
  const [stockEditPiece, setStockEditPiece] = useState<Piece | null>(null);
  const [stockEditInputs, setStockEditInputs] = useState<{color: string, quantity: number}[]>([]);

  async function fetchData() {
    setLoading(true);
    const [filRes, pieceRes] = await Promise.all([
      supabase.from("filaments").select("id, name, color, custo_kg, stock_kg"),
      supabase.from("pieces").select("id, name, image_url, category, stock_quantity, stores, stock_by_color").gt("stock_quantity", 0).order("name"),
    ]);
    if (filRes.data) setFilaments(filRes.data);
    if (pieceRes.data) setPieces(pieceRes.data as any);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function updateFilamentStockDirectly(id: string, newVal: number) {
    const { error } = await supabase.from("filaments").update({ stock_kg: newVal }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setFilaments(prev => prev.map(f => f.id === id ? { ...f, stock_kg: newVal } : f));
  }

  function openAddFilament() {
    setEditingFilament(null);
    setFilName("");
    setFilColor("");
    setFilCost("");
    setFilStock("1.0");
    setFilamentDialogOpen(true);
  }

  function openEditFilament(fil: Filament) {
    setEditingFilament(fil);
    setFilName(fil.name);
    setFilColor(fil.color || "");
    setFilCost(fil.custo_kg.toString());
    setFilStock(fil.stock_kg.toString());
    setFilamentDialogOpen(true);
  }

  async function handleSaveFilament() {
    if (!filName || !filCost) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const cost = parseFloat(filCost) || 0;
    const stock = parseFloat(filStock) || 0;

    if (editingFilament) {
      const { error } = await supabase.from("filaments").update({
        name: filName,
        color: filColor,
        custo_kg: cost,
        stock_kg: stock
      }).eq("id", editingFilament.id);

      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Filamento atualizado!" });
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from("filaments").insert({
        name: filName,
        color: filColor,
        custo_kg: cost,
        stock_kg: stock,
        user_id: session.user.id
      });
      if (error) {
        toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Filamento adicionado!" });
    }
    setFilamentDialogOpen(false);
    fetchData();
  }

  async function handleDeleteFilament(id: string) {
    if (!confirm("Tem certeza que deseja excluir este filamento?")) return;
    const { error } = await supabase.from("filaments").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Filamento excluído" });
    setFilaments(prev => prev.filter(f => f.id !== id));
  }

  async function updatePieceStock(id: string, delta: number) {
    const piece = pieces.find(p => p.id === id);
    if (!piece) return;
    const newVal = Math.max(0, piece.stock_quantity + delta);
    const { error } = await supabase.from("pieces").update({ stock_quantity: newVal, stock_by_color: [] }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (newVal === 0) {
      setPieces(prev => prev.filter(p => p.id !== id));
    } else {
      setPieces(prev => prev.map(p => p.id === id ? { ...p, stock_quantity: newVal, stock_by_color: [] } : p));
    }
  }

  function openStockEdit(piece: Piece) {
    setStockEditPiece(piece);
    if (piece.stock_by_color && Array.isArray(piece.stock_by_color) && piece.stock_by_color.length > 0) {
      // Clona profundamente os objetos para não mutar o array original da peça
      setStockEditInputs(piece.stock_by_color.map(i => ({...i})));
    } else {
      setStockEditInputs([{ color: "", quantity: piece.stock_quantity || 1 }]);
    }
    setStockEditDialogOpen(true);
  }

  async function handleSavePieceStock() {
    if (!stockEditPiece) return;
    
    // Filter out invalid ones, handle edge case if empty
    const validInputs = stockEditInputs.filter(i => i.quantity > 0 && i.color.trim() !== "");
    
    const aggregated: Record<string, number> = {};
    for (const input of validInputs) {
      const key = input.color.trim();
      if (!aggregated[key]) aggregated[key] = 0;
      aggregated[key] += input.quantity;
    }
    
    const finalStockByColor = Object.keys(aggregated).map(k => ({ color: k, quantity: aggregated[k] }));
    const totalQty = finalStockByColor.reduce((acc, curr) => acc + curr.quantity, 0);

    const { error } = await supabase.from("pieces").update({
      stock_quantity: totalQty,
      stock_by_color: finalStockByColor as any
    }).eq("id", stockEditPiece.id);

    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Detalhes do estoque atualizados!" });
    
    setPieces(prev => {
      if (totalQty === 0) return prev.filter(p => p.id !== stockEditPiece.id);
      return prev.map(p => p.id === stockEditPiece.id ? { ...p, stock_quantity: totalQty, stock_by_color: finalStockByColor } : p);
    });
    setStockEditDialogOpen(false);
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
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar filamento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={filamentDialogOpen} onOpenChange={setFilamentDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddFilament} className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" />
                  Novo Filamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingFilament ? "Editar Filamento" : "Adicionar Filamento"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Marca / Nome <span className="text-destructive">*</span></label>
                    <Input placeholder="Ex: eSun PLA+" value={filName} onChange={e => setFilName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cor</label>
                    <Input placeholder="Ex: Preto, Branco, Vermelho" value={filColor} onChange={e => setFilColor(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Custo por Kg (R$) <span className="text-destructive">*</span></label>
                      <Input type="number" step="0.01" value={filCost} onChange={e => setFilCost(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estoque Inicial (Kg)</label>
                      <Input type="number" step="0.1" value={filStock} onChange={e => setFilStock(e.target.value)} />
                    </div>
                  </div>
                  <Button className="w-full mt-4" onClick={handleSaveFilament}>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {filteredFilaments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum filamento encontrado.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredFilaments.map(fil => (
                <FilamentRow
                  key={fil.id}
                  fil={fil}
                  onUpdateStock={updateFilamentStockDirectly}
                  onEdit={openEditFilament}
                  onDelete={handleDeleteFilament}
                />
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
            <Button className="gap-2 shrink-0" onClick={() => navigate("/inventory/add-stock")}>
              <Plus className="h-4 w-4" />
              Adicionar do Catálogo
            </Button>

            <Dialog open={stockEditDialogOpen} onOpenChange={setStockEditDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Estoque Detalhado: {stockEditPiece?.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
                  {stockEditInputs.length === 0 && (
                    <p className="text-sm text-muted-foreground">Adicione as cores com a quantidade disponível no momento.</p>
                  )}
                  {stockEditInputs.map((input, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }} className="w-full">
                      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                        {idx === 0 && <label className="text-[10px] text-muted-foreground block mb-1 font-medium truncate uppercase tracking-wide">Cor <span className="text-destructive">*</span></label>}
                        <Input 
                          placeholder="Ex: Branco" 
                          value={input.color} 
                          onChange={(e) => {
                            const newIns = [...stockEditInputs];
                            newIns[idx].color = e.target.value;
                            setStockEditInputs(newIns);
                          }} 
                        />
                      </div>
                      <div style={{ width: '80px', flexShrink: 0 }}>
                        {idx === 0 && <label className="text-[10px] text-muted-foreground block mb-1 font-medium text-center uppercase tracking-wide">Qtd</label>}
                        <Input 
                          type="number" 
                          min="0"
                          value={input.quantity} 
                          onChange={(e) => {
                            const newIns = [...stockEditInputs];
                            newIns[idx].quantity = parseInt(e.target.value) || 0;
                            setStockEditInputs(newIns);
                          }}
                          className="text-center px-1"
                        />
                      </div>
                      <div style={{ width: '36px', flexShrink: 0, paddingBottom: idx === 0 ? '0' : '0' }}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setStockEditInputs(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="w-full text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-2 border-t flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => {
                      setStockEditInputs([...stockEditInputs, {color: "", quantity: 1}]);
                    }} className="gap-1">
                      <Plus className="h-3 w-3" /> Adicionar Cor
                    </Button>
                    <Button onClick={handleSavePieceStock} className="gap-2">
                      <Check className="h-4 w-4" /> Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    A soma das quantidades destas cores definirá o total do estoque.<br />
                    Para zerar e remover, basta zerar todas ou deletar da lista.
                  </p>
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
              {filteredPieces.map(piece => {
                const isComplex = piece.stock_by_color && Array.isArray(piece.stock_by_color) && piece.stock_by_color.length > 0;
                
                return (
                <Card 
                  key={piece.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openStockEdit(piece)}
                >
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
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isComplex ? piece.stock_by_color!.map((item: any, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-card">
                              {item.color}: <strong className="ml-1">{item.quantity}</strong>
                            </Badge>
                          )) : (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-card text-muted-foreground">
                              Qtd: <strong className="ml-1">{piece.stock_quantity}</strong>
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Botões rápidos apenas aparecem ou fazem sentido se não for estoque por cor. 
                        No entanto, se tiver cores, clicar no lixo deve apenas apagar. E em vez de botões,
                        incentivamos o clique no cartão indicando que é editável. */}
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                       {!isComplex && (
                         <>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePieceStock(piece.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-10 text-center font-semibold text-sm">{piece.stock_quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePieceStock(piece.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                         </>
                       )}
                       {/* O número total foi removido para itens fechados por cor, a pedido do usuário */}
                       <Button variant="ghost" size="icon" className="h-8 w-8 ml-2 hover:bg-muted" onClick={() => openStockEdit(piece)} title="Editar Cores">
                         <Pencil className="h-4 w-4" />
                       </Button>
                       <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/20" onClick={() => {
                         if(confirm("Deseja mesmo remover ("+piece.name+") do estoque?")) {
                           updatePieceStock(piece.id, -piece.stock_quantity);
                         }
                       }}>
                         <Trash2 className="h-3 w-3" />
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
