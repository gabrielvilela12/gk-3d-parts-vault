import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Trash2, Box, Ruler } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Piece {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  depth: number;
  material: string;
  stl_url: string;
  image_url: string;
  notes: string;
  created_at: string;
  user_id: string;
}

export default function PieceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPiece();
    getCurrentUser();
  }, [id]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchPiece = async () => {
    try {
      const { data, error } = await supabase
        .from("pieces")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPiece(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar peça",
        description: error.message,
        variant: "destructive",
      });
      navigate("/catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!piece) return;

    try {
      const { error } = await supabase.from("pieces").delete().eq("id", piece.id);

      if (error) throw error;

      toast({
        title: "Peça excluída",
        description: "A peça foi removida do catálogo",
      });
      navigate("/catalog");
    } catch (error: any) {
      toast({
        title: "Erro ao excluir peça",
        description: error.message,
        variant: "destructive",
      });
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/catalog" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao catálogo
            </Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image */}
          <Card className="card-gradient border-border/50 overflow-hidden">
            <div className="aspect-square bg-muted/30">
              {piece.image_url ? (
                <img
                  src={piece.image_url}
                  alt={piece.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Box className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
          </Card>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{piece.name}</h1>
              <p className="text-muted-foreground">{piece.description || "Sem descrição"}</p>
            </div>

            <Card className="card-gradient border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-primary" />
                  Dimensões
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Largura:</span>
                  <span className="font-medium">
                    {piece.width ? `${piece.width} mm` : "Não especificado"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Altura:</span>
                  <span className="font-medium">
                    {piece.height ? `${piece.height} mm` : "Não especificado"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profundidade:</span>
                  <span className="font-medium">
                    {piece.depth ? `${piece.depth} mm` : "Não especificado"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient border-border/50">
              <CardHeader>
                <CardTitle>Material</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-primary font-medium">
                  {piece.material || "Não especificado"}
                </p>
              </CardContent>
            </Card>

            {piece.notes && (
              <Card className="card-gradient border-border/50">
                <CardHeader>
                  <CardTitle>Observações Técnicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{piece.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {piece.stl_url && (
                <Button asChild className="flex-1 gap-2">
                  <a href={piece.stl_url} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Baixar STL
                  </a>
                </Button>
              )}
              {isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Excluir
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
    </div>
  );
}
