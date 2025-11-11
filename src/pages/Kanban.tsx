import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Clock, CheckCircle2 } from "lucide-react";

interface Piece {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  print_status: string;
}

const columns = [
  { id: "pending", title: "A Fazer", icon: ClipboardList, color: "text-muted-foreground" },
  { id: "in_progress", title: "Em Progresso", icon: Clock, color: "text-yellow-500" },
  { id: "completed", title: "Concluído", icon: CheckCircle2, color: "text-green-500" },
];

export default function Kanban() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPieces();
  }, []);

  const fetchPieces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("pieces")
        .select("id, name, image_url, category, print_status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPieces(data || []);
    } catch (error) {
      console.error("Error fetching pieces:", error);
      toast({
        title: "Erro ao carregar peças",
        description: "Não foi possível carregar as peças.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (pieceId: string) => {
    setDraggedPiece(pieceId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedPiece) return;

    try {
      const { error } = await supabase
        .from("pieces")
        .update({ print_status: newStatus })
        .eq("id", draggedPiece);

      if (error) throw error;

      setPieces(pieces.map(piece =>
        piece.id === draggedPiece
          ? { ...piece, print_status: newStatus }
          : piece
      ));

      toast({
        title: "Status atualizado",
        description: "O status da peça foi alterado com sucesso.",
      });
    } catch (error) {
      console.error("Error updating piece:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status da peça.",
        variant: "destructive",
      });
    } finally {
      setDraggedPiece(null);
    }
  };

  const getPiecesByStatus = (status: string) => {
    return pieces.filter(piece => piece.print_status === status);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Kanban de Impressão</h1>
        <p className="text-muted-foreground">Arraste as peças entre as colunas para atualizar o status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(column => {
          const Icon = column.icon;
          const columnPieces = getPiecesByStatus(column.id);

          return (
            <div
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              className="flex flex-col"
            >
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${column.color}`} />
                    {column.title}
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {columnPieces.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {columnPieces.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhuma peça nesta coluna
                    </div>
                  ) : (
                    columnPieces.map(piece => (
                      <Card
                        key={piece.id}
                        draggable
                        onDragStart={() => handleDragStart(piece.id)}
                        className="cursor-move hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {piece.image_url && (
                              <img
                                src={piece.image_url}
                                alt={piece.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{piece.name}</h3>
                              {piece.category && (
                                <p className="text-sm text-muted-foreground">{piece.category}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
