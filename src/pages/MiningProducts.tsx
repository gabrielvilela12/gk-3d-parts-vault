import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pickaxe, Plus, Trash2, Link as LinkIcon, ExternalLink, User, Search, Edit, Save, XCircle } from "lucide-react"; // Adicionar Edit, Save, XCircle
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Interface MiningProduct (como definida anteriormente)
interface MiningProduct {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  acquisition_date: string;
  cost: number | null;
  notes: string | null;
  source_url: string | null;
  makerworld_checked: 'pending' | 'checked_not_found' | 'checked_found' | null;
  added_by: string | null;
  user_id: string;
  profiles?: { full_name: string | null } | null;
}

// Mapas (como definidos anteriormente)
const makerworldStatusMap = {
    pending: "Precisa Procurar",
    checked_not_found: "Procurado (Não Achou)",
    checked_found: "Procurado (Achou)",
};
const addedByBorderColorMap: { [key: string]: string } = {
    Gabriel: "border-blue-500",
    Kaique: "border-green-500",
};

// Interface para o estado de edição
interface EditState {
    source_url: string | null;
    added_by: string | null;
    makerworld_checked: 'pending' | 'checked_not_found' | 'checked_found' | null;
}

export default function MiningProducts() {
  const [products, setProducts] = useState<MiningProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Estados para edição rápida
  const [editingProductId, setEditingProductId] = useState<string | null>(null); // ID do produto sendo editado
  const [editFormData, setEditFormData] = useState<EditState>({ // Dados do formulário de edição
      source_url: '',
      added_by: '',
      makerworld_checked: 'pending',
  });

  // Estado para o formulário de adição (mantido)
  const [addFormData, setAddFormData] = useState({
    name: "", description: "", quantity: "", unit: "", cost: "",
    notes: "", source_url: "", makerworld_checked: 'pending' as MiningProduct['makerworld_checked'], added_by: "",
  });

  // Funções fetchUserProfile, getCurrentUser, fetchProducts, handleSubmit (para adicionar), handleDelete (como antes)
  // ... (Colar as funções da resposta anterior aqui, ajustando 'formData' para 'addFormData' no handleSubmit e no reset)
  const fetchUserProfile = async (userId: string) => {
    try {
        const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        if (error) { console.error("Erro ao buscar perfil:", error); return; }
        const fullNameLower = data?.full_name?.toLowerCase();
        // Pré-seleciona SÓ o formulário de ADIÇÃO
        if (fullNameLower?.includes('gabriel')) {
            setAddFormData(prev => ({ ...prev, added_by: 'Gabriel' }));
        } else if (fullNameLower?.includes('kaique')) {
            setAddFormData(prev => ({ ...prev, added_by: 'Kaique' }));
        }
    } catch (profileError) { console.error("Erro inesperado ao buscar perfil:", profileError); }
  };
  useEffect(() => { fetchProducts(); getCurrentUser(); }, []);
  const getCurrentUser = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) { console.error("Erro ao obter usuário:", userError); toast({ title: "Erro de autenticação", variant: "destructive" }); setLoading(false); return; }
    if (user) { setCurrentUserId(user.id); await fetchUserProfile(user.id); }
    else { setCurrentUserId(null); setLoading(false); }
  };
  const fetchProducts = async () => { setLoading(true); try { const { data, error } = await supabase.from("mining_products").select("*, profiles ( full_name )").order("created_at", { ascending: false }); if (error) throw error; setProducts(data || []); } catch (error: any) { toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive", }); } finally { setLoading(false); } };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) { toast({ title: "Erro", description: "Usuário não identificado.", variant: "destructive" }); return; }
    if (!addFormData.added_by) { toast({ title: "Campo obrigatório", description: "Selecione quem adicionou o produto.", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from("mining_products").insert({
        user_id: currentUserId, name: addFormData.name, description: addFormData.description || null,
        quantity: parseFloat(addFormData.quantity) || 0, unit: addFormData.unit || null,
        cost: addFormData.cost ? parseFloat(addFormData.cost) : null, notes: addFormData.notes || null,
        source_url: addFormData.source_url || null, makerworld_checked: addFormData.makerworld_checked,
        added_by: addFormData.added_by,
      });
      if (error) throw error;
      toast({ title: "Produto adicionado!", description: "O produto foi registrado com sucesso." });
      setAddFormData({ name: "", description: "", quantity: "", unit: "", cost: "", notes: "", source_url: "", makerworld_checked: 'pending', added_by: "", });
      if (currentUserId) await fetchUserProfile(currentUserId);
      setDialogOpen(false);
      fetchProducts();
    } catch (error: any) { toast({ title: "Erro ao adicionar produto", description: error.message, variant: "destructive" }); }
  };
  const handleDelete = async (id: string) => { if (!confirm("Tem certeza?")) { return; } try { const { error } = await supabase.from("mining_products").delete().eq("id", id); if (error) throw error; toast({ title: "Produto removido" }); fetchProducts(); } catch (error: any) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); } };


  // --- Funções para Edição Rápida ---

  const handleEditClick = (product: MiningProduct) => {
    setEditingProductId(product.id);
    setEditFormData({
        source_url: product.source_url,
        added_by: product.added_by,
        makerworld_checked: product.makerworld_checked ?? 'pending' // Default para 'pending' se for null
    });
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    // Não precisa resetar editFormData, será preenchido ao clicar em editar novamente
  };

  const handleUpdate = async () => {
    if (!editingProductId || !currentUserId) return; // Precisa saber qual produto e quem está editando

     // Validação simples para 'added_by' na edição
     if (!editFormData.added_by) {
        toast({ title: "Campo obrigatório", description: "Selecione quem adicionou o produto.", variant: "destructive" });
        return;
    }

    try {
       const { error } = await supabase
         .from("mining_products")
         .update({
             source_url: editFormData.source_url || null, // Garantir null se vazio
             added_by: editFormData.added_by,
             makerworld_checked: editFormData.makerworld_checked,
             // updated_at será atualizado pelo trigger do banco
         })
         .eq('id', editingProductId)
         // Opcional: Adicionar .eq('user_id', currentUserId) se só o criador pode editar
         // .eq('user_id', currentUserId)

       if (error) throw error;

       toast({ title: "Produto atualizado!" });
       setEditingProductId(null); // Sair do modo de edição
       fetchProducts(); // Re-buscar para mostrar dados atualizados

    } catch (error: any) {
         toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  // ----- Renderização -----

  if (loading) { /* ... Indicador de Loading ... */ }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header e Botão Adicionar (usando addFormData) */}
        {/* ... (Como antes, mas o form onSubmit chama handleSubmit e usa addFormData) ... */}
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <h1 className="text-4xl font-bold mb-2">Produtos Minerados</h1>
                <p className="text-muted-foreground">Controle seu estoque de materiais minerados</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="gap-2 w-full md:w-auto"> <Plus className="h-4 w-4" /> Adicionar Produto </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader> <DialogTitle>Novo Produto Minerado</DialogTitle> <DialogDescription> Registre um novo produto minerado </DialogDescription> </DialogHeader>
                    {/* Formulário de ADIÇÃO usa addFormData e handleSubmit */}
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {/* Campos completos do formulário de adição (Nome, Qtd, Unidade, Custo, Link, AddBy, MW Status, Desc, Notes) */}
                        {/* ... Usar addFormData.campo e setAddFormData ... */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"> <Label htmlFor="add-name">Nome *</Label> <Input id="add-name" value={addFormData.name} onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })} required placeholder="Ex: Filamento PLA Azul..." /> </div>
                        </div>
                        <div className="space-y-2"> <Label htmlFor="add-source_url">Link do Produto/Modelo</Label> <Input id="add-source_url" type="url" value={addFormData.source_url} onChange={(e) => setAddFormData({ ...addFormData, source_url: e.target.value })} placeholder="https://..." /> </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"> <Label htmlFor="add-added_by">Adicionado Por *</Label> <Select value={addFormData.added_by} onValueChange={(value) => setAddFormData({ ...addFormData, added_by: value })} > <SelectTrigger id="add-added_by"> <SelectValue placeholder="Selecione..." /> </SelectTrigger> <SelectContent> <SelectItem value="Gabriel">Gabriel</SelectItem> <SelectItem value="Kaique">Kaique</SelectItem> <SelectItem value="Outro">Outro</SelectItem> </SelectContent> </Select> </div>
                            <div className="space-y-2"> <Label htmlFor="add-makerworld_checked">Status MakerWorld</Label> <Select value={addFormData.makerworld_checked ?? 'pending'} onValueChange={(value) => setAddFormData({ ...addFormData, makerworld_checked: value as MiningProduct['makerworld_checked'] })} > <SelectTrigger id="add-makerworld_checked"> <SelectValue placeholder="Status..." /> </SelectTrigger> <SelectContent> <SelectItem value="pending">{makerworldStatusMap.pending}</SelectItem> <SelectItem value="checked_not_found">{makerworldStatusMap.checked_not_found}</SelectItem> <SelectItem value="checked_found">{makerworldStatusMap.checked_found}</SelectItem> </SelectContent> </Select> </div>
                        </div>
                        <div className="space-y-2"> <Label htmlFor="add-notes">Observações</Label> <Textarea id="add-notes" value={addFormData.notes} onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })} placeholder="Localização, fornecedor..." rows={3} /> </div>
                        <Button type="submit" className="w-full mt-4"> Adicionar Produto </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>


        {/* Lista de Produtos com Edição */}
        {products.length === 0 ? (
           <Card className="card-gradient border-border/50"> {/* ... Mensagem "Nenhum produto" ... */} </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const isEditing = editingProductId === product.id;
              const canEdit = currentUserId === product.user_id; // Só o criador pode editar/deletar

              const borderColorClass = product.added_by && addedByBorderColorMap[product.added_by]
                  ? `${addedByBorderColorMap[product.added_by]} border-2`
                  : "border-border/50";

              let badgeVariant: "secondary" | "destructive" | "outline" = "outline";
              let badgeText = makerworldStatusMap.pending;
              if (product.makerworld_checked === 'checked_found') { badgeVariant = "secondary"; badgeText = makerworldStatusMap.checked_found; }
              else if (product.makerworld_checked === 'checked_not_found') { badgeVariant = "destructive"; badgeText = makerworldStatusMap.checked_not_found; }

              return (
                  <Card key={product.id} className={cn("card-gradient hover:shadow-lg transition-all flex flex-col", borderColorClass)}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{product.name}</CardTitle>
                           {/* Mostrar descrição apenas se não estiver editando */}
                           {!isEditing && product.description && (
                            <CardDescription className="mt-1 text-sm">{product.description}</CardDescription>
                           )}
                        </div>
                        {/* Botões Edit/Delete só aparecem se o usuário puder editar E não estiver editando */}
                        {canEdit && !isEditing && (
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)} className="text-muted-foreground hover:text-primary size-8 shrink-0" aria-label="Editar produto">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-muted-foreground hover:text-destructive size-8 shrink-0" aria-label="Remover produto">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {/* Botões Salvar/Cancelar aparecem se estiver editando */}
                        {isEditing && (
                             <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={handleUpdate} className="text-muted-foreground hover:text-green-500 size-8 shrink-0" aria-label="Salvar alterações">
                                    <Save className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="text-muted-foreground hover:text-destructive size-8 shrink-0" aria-label="Cancelar edição">
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                      </div>
                    </CardHeader>
                    {/* Conteúdo do Card: Modo Visualização ou Modo Edição */}
                    <CardContent className="space-y-2 text-sm flex-1 flex flex-col justify-between">
                      {isEditing ? (
                          // ---- MODO EDIÇÃO ----
                          <div className="space-y-3 pt-2">
                              <div className="space-y-1">
                                <Label htmlFor={`edit-source_url-${product.id}`} className="text-xs">Link Produto/Modelo</Label>
                                <Input
                                    id={`edit-source_url-${product.id}`}
                                    type="url"
                                    placeholder="https://"
                                    value={editFormData.source_url ?? ''}
                                    onChange={(e) => setEditFormData({...editFormData, source_url: e.target.value})}
                                    className="h-8 text-xs"
                                />
                               </div>
                               <div className="space-y-1">
                                <Label htmlFor={`edit-added_by-${product.id}`} className="text-xs">Adicionado Por *</Label>
                                <Select
                                    value={editFormData.added_by ?? ''}
                                    onValueChange={(value) => setEditFormData({...editFormData, added_by: value})}
                                >
                                    <SelectTrigger id={`edit-added_by-${product.id}`} className="h-8 text-xs">
                                    <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="Gabriel">Gabriel</SelectItem>
                                    <SelectItem value="Kaique">Kaique</SelectItem>
                                    <SelectItem value="Outro">Outro</SelectItem>
                                    </SelectContent>
                                </Select>
                               </div>
                               <div className="space-y-1">
                                 <Label htmlFor={`edit-makerworld-${product.id}`} className="text-xs">Status MakerWorld</Label>
                                <Select
                                    value={editFormData.makerworld_checked ?? 'pending'}
                                    onValueChange={(value) => setEditFormData({...editFormData, makerworld_checked: value as MiningProduct['makerworld_checked']})}
                                >
                                    <SelectTrigger id={`edit-makerworld-${product.id}`} className="h-8 text-xs">
                                    <SelectValue placeholder="Status..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">{makerworldStatusMap.pending}</SelectItem>
                                        <SelectItem value="checked_not_found">{makerworldStatusMap.checked_not_found}</SelectItem>
                                        <SelectItem value="checked_found">{makerworldStatusMap.checked_found}</SelectItem>
                                    </SelectContent>
                                </Select>
                               </div>
                          </div>
                      ) : (
                          // ---- MODO VISUALIZAÇÃO ----
                          <div>
                            {/* ... (Infos de Quantidade, Custo, Data Aquisição - como antes) ... */}
                            <div className="flex justify-between items-center"> <span className="text-muted-foreground">Quantidade:</span> <span className="font-semibold">{product.quantity}{product.unit ? ` ${product.unit}` : ''}</span> </div>
                            {product.cost !== null && typeof product.cost === 'number' && ( <div className="flex justify-between items-center"> <span className="text-muted-foreground">Custo Unitário:</span> <span className="font-semibold text-primary">R$ {product.cost.toFixed(2)}</span> </div> )}
                            <div className="flex justify-between items-center"> <span className="text-muted-foreground">Adquirido em:</span> <span>{new Date(product.acquisition_date).toLocaleDateString("pt-BR")}</span> </div>

                            {/* Link */}
                            {product.source_url && ( <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground">Link:</span> <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[150px]" title={product.source_url}> <ExternalLink className="inline h-3 w-3 mr-1"/> Ver Link </a> </div> )}
                            {/* Status MakerWorld */}
                            <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3"/> MakerWorld:</span> <Badge variant={badgeVariant} className="text-xs"> {badgeText} </Badge> </div>
                            {/* Adicionado por */}
                            {product.added_by && ( <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground">Adicionado por:</span> <span className="font-medium flex items-center gap-1"> <User className="h-3 w-3"/>{product.added_by} </span> </div> )}
                             {/* Observações */}
                             {product.notes && ( <div className="pt-3 border-t border-border/30 mt-3"> <p className="text-xs text-muted-foreground line-clamp-3">{product.notes}</p> </div> )}
                          </div>
                      )}

                    </CardContent>
                  </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}