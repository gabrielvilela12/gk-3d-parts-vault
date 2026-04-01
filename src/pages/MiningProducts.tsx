import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pickaxe, Plus, Trash2, ExternalLink, Search, MoreVertical, Check, FolderArchive, AlertTriangle, FileQuestion } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MiningProduct {
  id: string;
  name: string;
  source_url: string | null;
  user_id: string;
  created_at: string;
  status?: string | null;
  notes?: string | null;
}

export default function MiningProducts() {
  const [products, setProducts] = useState<MiningProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  const [formData, setFormData] = useState({ name: "", source_url: "" });

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedProductForStatus, setSelectedProductForStatus] = useState<string | null>(null);
  const [statusToSet, setStatusToSet] = useState<string>("");
  const [statusNotes, setStatusNotes] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mining_products")
        .select("id, name, source_url, user_id, created_at, status, notes")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts((data || []) as MiningProduct[]);
    } catch (error: any) {
      toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("mining_products").insert({
        user_id: user.id,
        name: formData.name,
        source_url: formData.source_url || null,
        status: "pending"
      } as any);

      if (error) throw error;
      toast({ title: "Produto adicionado!" });
      setFormData({ name: "", source_url: "" });
      setDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir?")) return;
    try {
      const { error } = await supabase.from("mining_products").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Produto removido" });
      fetchProducts();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const handleOpenStatusDialog = (id: string, newStatus: string) => {
    setSelectedProductForStatus(id);
    setStatusToSet(newStatus);
    setStatusNotes("");
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStatus) return;

    try {
      const { error } = await supabase.from("mining_products")
        .update({ status: statusToSet, notes: statusNotes } as any)
        .eq("id", selectedProductForStatus);

      if (error) throw error;
      toast({ title: "Status atualizado!" });
      setStatusDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(filterSearch.toLowerCase());
    const productStatus = p.status || 'pending';
    const matchesStatus = filterStatus === 'all' || productStatus === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusDetails = (status: string | null | undefined) => {
    switch(status) {
      case 'approved': return { label: 'Fazer / Salvo', color: 'bg-green-500 hover:bg-green-600', icon: Check };
      case 'not_found': return { label: 'Não achei arquivo', color: 'bg-red-500 hover:bg-red-600', icon: FileQuestion };
      case 'problems': return { label: 'Problemas', color: 'bg-yellow-500 hover:bg-yellow-600', icon: AlertTriangle };
      case 'archived': return { label: 'Arquivado', color: 'bg-slate-500 hover:bg-slate-600', icon: FolderArchive };
      default: return { label: 'Pendente', color: 'bg-primary hover:bg-primary/80', icon: Pickaxe };
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Pickaxe className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Produtos Minerados</h1>
            <p className="page-subtitle">{filtered.length} produto(s) encontrado(s)</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Produto Minerado</DialogTitle>
                  <DialogDescription>Adicione o nome e o link do produto</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Nome do produto..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source_url">Link</Label>
                    <Input
                      id="source_url"
                      type="url"
                      value={formData.source_url}
                      onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <Button type="submit" className="w-full">Adicionar</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Status Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atualizar Status</DialogTitle>
              <DialogDescription>
                Adicione uma anotação visível no card para justificar esta decisão.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="statusNotes">Descrição / Notas</Label>
                <Input
                  id="statusNotes"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Ex: Arquivo é pago, STL com malha ruim..."
                />
              </div>
              <Button type="submit" className="w-full">Salvar Status e Notas</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Fazer / Salvo</SelectItem>
              <SelectItem value="not_found">Não achei arquivo</SelectItem>
              <SelectItem value="problems">Problema c/ arquivo</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card className="card-gradient border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Pickaxe className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((product) => (
              <Card key={product.id} className="card-gradient border-border/50 flex flex-col pt-1">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-2 flex-1 pt-1">
                    <CardTitle className="text-lg leading-tight pr-2">{product.name}</CardTitle>
                    {(() => {
                      const details = getStatusDetails(product.status);
                      const Icon = details.icon;
                      return (
                        <Badge className={`${details.color} flex items-center gap-1 w-fit`}>
                          <Icon className="h-3 w-3" /> {details.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenStatusDialog(product.id, 'approved')}>
                          <Check className="h-4 w-4 mr-2 text-green-500" /> Fazer / Salvo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenStatusDialog(product.id, 'not_found')}>
                          <FileQuestion className="h-4 w-4 mr-2 text-red-500" /> Não achei arquivo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenStatusDialog(product.id, 'problems')}>
                          <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" /> Problema c/ arquivo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenStatusDialog(product.id, 'archived')}>
                          <FolderArchive className="h-4 w-4 mr-2 text-slate-500" /> Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product.id)}
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto flex-1 flex flex-col justify-end pt-1">
                  {product.source_url ? (
                    <a
                      href={product.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 mb-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver link
                    </a>
                  ) : (
                    <div className="text-sm text-muted-foreground mb-2 italic">Sem link arquivado</div>
                  )}
                  {product.notes && (
                    <div className="mt-1 text-sm bg-muted/30 p-2.5 rounded-md border border-border/50">
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-1">Nota</p>
                      <p className="text-sm">{product.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
