import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Box, Plus, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
}

export default function Catalog() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [filteredPieces, setFilteredPieces] = useState<Piece[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [categories, setCategories] = useState<string[]>([]);

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
    setFilteredPieces(filtered);
  }, [searchTerm, filterStatus, filterCategory, pieces]);

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
      setCategories(uniqueCategories);
    } catch (error: any) {
      toast({ title: "Erro ao carregar peças", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

      {/* Search & Filters: compact row */}
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
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
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
      </div>

      {/* Pieces Grid */}
      {filteredPieces.length === 0 ? (
        <Card className="card-gradient border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Box className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-semibold mb-1">Nenhuma peça encontrada</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchTerm || filterStatus !== "all"
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
            <Link key={piece.id} to={`/piece/${piece.id}`}>
              <div
                className={cn(
                  "group card-gradient rounded-xl border border-border/50 hover:border-primary/40 transition-all duration-200 overflow-hidden",
                  "hover:shadow-[0_0_20px_hsl(217_91%_60%/0.15)]"
                )}
              >
                {/* Image */}
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

                {/* Info */}
                <div className="p-3">
                  <p className="font-semibold text-sm leading-tight line-clamp-1 mb-1">
                    {piece.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-primary font-medium">
                      {piece.material || "—"}
                    </span>
                    {piece.category && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {piece.category}
                      </Badge>
                    )}
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}