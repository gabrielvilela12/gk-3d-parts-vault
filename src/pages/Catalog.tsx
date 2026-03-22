import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Box, Plus, Radio, Store, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Piece {
  id: string;
  name: string;
  description: string;
  material: string;
  category: string | null;
  image_url: string;
  created_at: string;
  is_selling: boolean | null;
  cost: number | null;
  preco_venda: number | null;
  stores?: string[];
}

const STORES = ["Loja 1", "Loja 2", "Loja 3"];

export default function Catalog() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [filteredPieces, setFilteredPieces] = useState<Piece[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStore, setFilterStore] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  useEffect(() => {
    fetchPieces();
  }, []);

  useEffect(() => {
    let filtered = [...pieces];
    if (searchTerm) {
      filtered = filtered.filter(
        (piece) =>
          piece.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          piece.material?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          piece.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterStatus !== "all") {
      const isSelling = filterStatus === "true";
      filtered = filtered.filter((piece) => (piece.is_selling || false) === isSelling);
    }
    if (filterCategory !== "all") {
      filtered = filtered.filter((piece) => piece.category === filterCategory);
    }
    if (filterStore !== "all") {
      if (filterStore === "none") {
        filtered = filtered.filter((piece) => !piece.stores || piece.stores.length === 0);
      } else {
        filtered = filtered.filter((piece) => piece.stores?.includes(filterStore));
      }
    }
    filtered.sort((a, b) => {
      const catA = (a.category || "zzz").toLowerCase();
      const catB = (b.category || "zzz").toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB, "pt-BR");
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "pt-BR");
    });
    setFilteredPieces(filtered);
  }, [searchTerm, filterStatus, filterCategory, filterStore, pieces]);

  const fetchPieces = async () => {
    try {
      const { data, error } = await supabase
        .from("pieces")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPieces((data as any) || []);
      setFilteredPieces((data as any) || []);
      const uniqueCategories = [
        ...new Set((data as any)?.map((p: any) => p.category).filter(Boolean)),
      ] as string[];
      setCategories(uniqueCategories.sort());

      const uniqueStores = [
        ...new Set((data as any)?.flatMap((p: any) => p.stores || []).filter(Boolean)),
      ] as string[];
      setStores(uniqueStores);
    } catch (error: any) {
      toast({ title: "Erro ao carregar peças", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleStore = async (pieceId: string, store: string) => {
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece) return;
    const currentStores = piece.stores || [];
    const newStores = currentStores.includes(store)
      ? currentStores.filter((s) => s !== store)
      : [...currentStores, store];

    const { error } = await supabase
      .from("pieces")
      .update({ stores: newStores })
      .eq("id", pieceId);
    if (error) {
      toast({ title: "Erro ao atualizar loja", description: error.message, variant: "destructive" });
      return;
    }
    setPieces((prev) =>
      prev.map((p) => (p.id === pieceId ? { ...p, stores: newStores } : p))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Peças</h1>
          <p className="page-subtitle">
            {filteredPieces.length} {filteredPieces.length === 1 ? "peça encontrada" : "peças encontradas"}
            {pieces.length !== filteredPieces.length && ` de ${pieces.length}`}
          </p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link to="/add">
            <Plus className="h-4 w-4" />
            Adicionar peça
          </Link>
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nome, material ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm">
            <Store className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Loja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas lojas</SelectItem>
            {STORES.map((store) => (
              <SelectItem key={store} value={store}>{store}</SelectItem>
            ))}
            <SelectItem value="none">Sem loja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="true">
              <div className="flex items-center gap-2">
                <Radio className="h-3 w-3 text-emerald-500" /> No Ar
              </div>
            </SelectItem>
            <SelectItem value="false">Fora do Ar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm">
            <SelectValue placeholder="Loja / Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store} value={store}>
                {store}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pieces Grid */}
      {filteredPieces.length === 0 ? (
        <Card className="card-gradient border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Box className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-semibold mb-1">Nenhuma peça encontrada</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchTerm || filterStatus !== "all" || filterStore !== "all"
                ? "Tente ajustar sua busca ou filtros"
                : "Comece adicionando sua primeira peça ao catálogo"}
            </p>
            <Button asChild size="sm" className="gap-2">
              <Link to="/add">
                <Plus className="h-4 w-4" />
                Adicionar peça
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPieces.map((piece) => (
            <div
              key={piece.id}
              className={cn(
                "group card-gradient rounded-xl border border-border/50 hover:border-primary/40 transition-all duration-200 overflow-hidden",
                "hover:shadow-[0_0_20px_hsl(217_91%_60%/0.15)]"
              )}
            >
              {/* Image - clickable */}
              <Link to={`/piece/${piece.id}`}>
                <div className="relative aspect-[4/3] bg-muted/30 overflow-hidden">
                  {piece.image_url ? (
                    <img
                      src={piece.image_url}
                      alt={piece.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Box className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {piece.is_selling === true && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5">
                        <Radio className="h-2.5 w-2.5 mr-1" />
                        No Ar
                      </Badge>
                    </div>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="p-3">
                <Link to={`/piece/${piece.id}`}>
                  <p className="font-semibold text-sm leading-tight line-clamp-1 mb-1 hover:text-primary transition-colors">
                    {piece.name}
                  </p>
                </Link>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-primary font-medium">
                    {piece.material || "—"}
                  </span>
                  {piece.category && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {piece.category}
                    </Badge>
                  )}
                </div>

                {/* Store badges + assign */}
                <div className="flex items-center gap-1 flex-wrap">
                  {piece.stores && piece.stores.length > 0 ? (
                    piece.stores.map((store) => (
                      <Badge
                        key={store}
                        className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20"
                        onClick={() => toggleStore(piece.id, store)}
                      >
                        {store} ×
                      </Badge>
                    ))
                  ) : null}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors px-1 py-0.5 rounded border border-dashed border-border/50 hover:border-primary/40">
                        <Store className="h-2.5 w-2.5" />
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-36 p-1.5" align="start">
                      {STORES.map((store) => {
                        const isActive = piece.stores?.includes(store);
                        return (
                          <button
                            key={store}
                            onClick={() => toggleStore(piece.id, store)}
                            className={cn(
                              "flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors",
                              isActive && "text-primary font-medium"
                            )}
                          >
                            <div className={cn(
                              "h-3.5 w-3.5 rounded border flex items-center justify-center",
                              isActive ? "bg-primary border-primary" : "border-border"
                            )}>
                              {isActive && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            {store}
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                </div>

                {piece.cost !== null && (
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Preço no zero</span>
                    <span className="text-sm font-bold text-primary">
                      R$ {((piece.cost + 7) / 0.8).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
