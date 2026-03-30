import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search, Check, ChevronLeft, Trash2, Plus, Type } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface Piece {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
  stock_by_color?: { color: string, quantity: number }[] | null;
  stores: string[] | null;
}

export default function BulkAddStock() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Catalog states
  const [catalogPieces, setCatalogPieces] = useState<Piece[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  
  // Selection & Input states
  const [selectedPieces, setSelectedPieces] = useState<Piece[]>([]);
  const [stockInputByPiece, setStockInputByPiece] = useState<Record<string, {color: string, quantity: number}[]>>({});

  useEffect(() => {
    fetchCatalogPieces();
  }, []);

  async function fetchCatalogPieces() {
    setLoading(true);
    const { data } = await supabase.from("pieces").select("id, name, image_url, category, stock_quantity, stores, stock_by_color").order("name");
    
    if (data) {
      setCatalogPieces(data as any);
      
      const uniqueCats = new Set<string>();
      data.forEach(p => { if (p.category) uniqueCats.add(p.category); });
      setCategories(Array.from(uniqueCats).sort());
    }
    setLoading(false);
  }

  const togglePieceSelection = (piece: Piece) => {
    const isSelected = selectedPieces.some(p => p.id === piece.id);
    if (isSelected) {
      setSelectedPieces(prev => prev.filter(p => p.id !== piece.id));
    } else {
      setSelectedPieces(prev => [...prev, piece]);
      // Initialize inputs if they don't exist
      if (!stockInputByPiece[piece.id]) {
        setStockInputByPiece(prev => ({
          ...prev, 
          [piece.id]: [{color: "", quantity: 1}]
        }));
      }
    }
  };

  async function handleConfirmBulkStock() {
    setIsSaving(true);
    let hasError = false;
    let addedCount = 0;
    
    for (const piece of selectedPieces) {
      const inputs = stockInputByPiece[piece.id] || [];
      const validInputs = inputs.filter(i => i.quantity > 0 && i.color.trim() !== "");
      if (validInputs.length === 0) continue;
      
      const currentStockByColor = piece.stock_by_color || [];
      const newStockByColor = [...currentStockByColor];
      
      let totalAdded = 0;
      
      for (const input of validInputs) {
        const existingColorIdx = newStockByColor.findIndex((c: any) => c.color.toLowerCase() === input.color.toLowerCase());
        if (existingColorIdx >= 0) {
          newStockByColor[existingColorIdx].quantity += input.quantity;
        } else {
          newStockByColor.push({ color: input.color, quantity: input.quantity });
        }
        totalAdded += input.quantity;
      }
      
      const newQty = (piece.stock_quantity || 0) + totalAdded;
      
      const { error } = await supabase.from("pieces").update({ 
        stock_quantity: newQty,
        stock_by_color: newStockByColor as any
      }).eq("id", piece.id);
      
      if (error) { 
        toast({ title: "Erro na peça " + piece.name, description: error.message, variant: "destructive" }); 
        hasError = true; 
      }
      else addedCount++;
    }
    
    setIsSaving(false);

    if (!hasError && addedCount > 0) {
      toast({ title: "Estoque atualizado", description: `${addedCount} peças foram atualizadas com sucesso.` });
      navigate("/inventory");
    } else if (addedCount === 0) {
      toast({ title: "Aviso", description: "Obrigatório preencher a cor e a quantidade (maior que 0) das peças selecionadas.", variant: "destructive"});
    }
  }

  const filteredCatalog = catalogPieces.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                       (p.category || "").toLowerCase().includes(catalogSearch.toLowerCase());
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1400px] h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Adicionar do Catálogo</h1>
          <p className="text-sm text-muted-foreground">Selecione peças e especifique suas cores para adicionar ao estoque</p>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-6">
        {/* Left Pane: Catalog selection */}
        <div className="flex flex-col flex-1 border rounded-lg bg-card/50 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-card space-y-3">
            <h2 className="font-semibold px-1">1. Escolha as peças</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar catálogo..."
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">Nenhuma peça encontrada.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCatalog.map(piece => {
                  const isSelected = selectedPieces.some(p => p.id === piece.id);
                  return (
                    <button
                      key={piece.id}
                      onClick={() => togglePieceSelection(piece)}
                      className={`group relative flex flex-col rounded-lg border bg-card transition-all overflow-hidden text-left ${
                        isSelected ? 'border-primary shadow-sm ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {piece.image_url ? (
                          <img src={piece.image_url} alt={piece.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        {piece.stock_quantity > 0 && !isSelected && (
                          <Badge className="absolute top-1.5 right-1.5 text-[10px] bg-background/80 text-foreground backdrop-blur-sm border-0">
                            {piece.stock_quantity} un
                          </Badge>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium leading-tight line-clamp-2">{piece.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
        
        {/* Right Pane: Selected Pieces configuration */}
        <div className="flex flex-col w-full lg:w-[450px] xl:w-[500px] border rounded-lg bg-card/50 overflow-hidden shadow-sm shrink-0">
          <div className="p-4 border-b bg-card flex items-center justify-between">
            <h2 className="font-semibold px-1">2. Configurar Entrada</h2>
            <Badge variant="secondary">{selectedPieces.length} selecionadas</Badge>
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {selectedPieces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground px-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 opacity-50" />
                </div>
                <p>Nenhuma peça selecionada ainda.<br/>Clique nas peças na lista ao lado.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {selectedPieces.map(piece => {
                  const inputs = stockInputByPiece[piece.id] || [];
                  return (
                    <Card key={piece.id} className="overflow-hidden shadow-none border-border">
                      <div className="bg-muted/40 p-3 border-b flex items-center gap-3">
                        <div className="h-10 w-10 rounded overflow-hidden bg-background shrink-0 border">
                          {piece.image_url ? (
                            <img src={piece.image_url} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 m-auto mt-2 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate pr-2">{piece.name}</p>
                          {piece.stock_quantity > 0 && (
                            <p className="text-[10px] text-muted-foreground">Em estoque: {piece.stock_quantity}</p>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-3 space-y-3">
                        {inputs.map((input, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%' }} className="bg-background/50 p-2 rounded-md border border-border/50">
                            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block ml-1 truncate">Cor</label>
                              <Input 
                                placeholder="Ex: Preto, Branco..." 
                                value={input.color}
                                onChange={e => {
                                  const newInputs = [...inputs];
                                  newInputs[idx].color = e.target.value;
                                  setStockInputByPiece(prev => ({...prev, [piece.id]: newInputs}));
                                }}
                                className="h-8 text-sm w-full"
                              />
                            </div>
                            <div style={{ width: '70px', flexShrink: 0 }}>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block ml-1 truncate">Qtd</label>
                              <Input 
                                type="number" 
                                min="1" 
                                value={input.quantity}
                                onChange={e => {
                                  const newInputs = [...inputs];
                                  newInputs[idx].quantity = parseInt(e.target.value) || 0;
                                  setStockInputByPiece(prev => ({...prev, [piece.id]: newInputs}));
                                }}
                                className="h-8 text-sm w-full text-center px-1"
                              />
                            </div>
                            <div style={{ width: '36px', flexShrink: 0 }}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                                onClick={() => {
                                  const newInputs = inputs.filter((_, i) => i !== idx);
                                  if (newInputs.length === 0) newInputs.push({color: "", quantity: 1});
                                  setStockInputByPiece(prev => ({...prev, [piece.id]: newInputs}));
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        <div className="pt-1">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="text-xs h-7 gap-1"
                            onClick={() => {
                              setStockInputByPiece(prev => ({
                                ...prev, 
                                [piece.id]: [...(prev[piece.id] || []), {color: "", quantity: 1}]
                              }));
                            }}
                          >
                            <Plus className="h-3 w-3" />
                            Mais uma Cor
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t bg-card">
            <Button 
              className="w-full text-base font-semibold py-6 h-auto shadow-sm"
              size="lg"
              disabled={selectedPieces.length === 0 || isSaving}
              onClick={handleConfirmBulkStock}
            >
              {isSaving ? "Salvando..." : "Salvar Estoque"}
            </Button>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              Itens com quantidade vazia ou sem cor preenchida não serão adicionados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
