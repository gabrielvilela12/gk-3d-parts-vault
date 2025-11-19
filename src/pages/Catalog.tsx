import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Box, Plus, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      const isSelling = filterStatus === 'true';
      filtered = filtered.filter(
        (piece) => (piece.is_selling || false) === isSelling
      );
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (piece) => piece.category === filterCategory
      );
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
      
      // Extrair categorias únicas
      const uniqueCategories = [...new Set((data as any)?.map((p: any) => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar peças",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Box className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Catálogo de Peças</h1>
            <p className="text-muted-foreground">
              {filteredPieces.length} {filteredPieces.length === 1 ? "peça" : "peças"} encontradas
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/add">
              <Plus className="h-4 w-4" />
              Adicionar peça
            </Link>
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome, material ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="true">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-green-500" /> No Ar
                  </div>
                </SelectItem>
                <SelectItem value="false">Fora do Ar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* Pieces Grid */}
        {filteredPieces.length === 0 ? (
          <Card className="card-gradient border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Box className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma peça encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterStatus !== 'all'
                  ? "Tente ajustar sua busca ou filtros"
                  : "Comece adicionando sua primeira peça"}
              </p>
              <Button asChild>
                <Link to="/add">Adicionar primeira peça</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPieces.map((piece) => (
              <Link key={piece.id} to={`/piece/${piece.id}`}>
                <Card className="card-gradient border-border/50 hover:border-primary/50 transition-all hover:glow-primary overflow-hidden group relative">
                  {/* CORREÇÃO: Lógica booleana para is_selling */}
                  {piece.is_selling === true && (
                    <Badge className="absolute top-4 right-4 z-10 bg-green-600 shadow-lg">
                      No Ar
                    </Badge>
                  )}
                  
                  {/* Image */}
                  <div className="aspect-video bg-muted/30 overflow-hidden">
                    {piece.image_url ? (
                      <img
                        src={piece.image_url}
                        alt={piece.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Box className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <CardHeader>
                    <CardTitle className="line-clamp-1 pr-16">{piece.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {piece.description || "Sem descrição"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Material:</span>
                        <span className="font-medium text-primary">
                          {piece.material || "Não especificado"}
                        </span>
                      </div>
                      {piece.category && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Categoria:</span>
                          <Badge variant="outline">{piece.category}</Badge>
                        </div>
                      )}
                      {piece.cost !== null && (
                        <div className="pt-2 mt-2 border-t border-border/50">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Custo Base (no zero):</span>
                            <span className="font-semibold text-primary">
                              R$ {((piece.cost + 4) / 0.80).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}