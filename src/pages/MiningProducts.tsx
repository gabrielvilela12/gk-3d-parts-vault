import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Pickaxe,
  Plus,
  Trash2,
  ExternalLink,
  User,
  Search,
  Edit,
  Save,
  XCircle,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Interface (garanta que o DB tenha makerworld_url e stl_url)
interface MiningProduct {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  acquisition_date: string;
  cost: number | null;
  notes: string | null;
  source_url: string | null; // Link geral
  makerworld_checked: 'pending' | 'checked_not_found' | 'checked_found' | null;
  makerworld_url: string | null; // Link específico MakerWorld
  stl_url: string | null; // Link STL
  added_by: string | null;
  user_id: string;
  profiles?: { full_name: string | null } | null;
}

// Mapas (sem alterações)
const makerworldStatusMap = {
    pending: "Precisa Procurar",
    checked_not_found: "Procurado (Não Achou)",
    checked_found: "Procurado (Achou)",
};
const addedByBorderColorMap: { [key: string]: string } = {
    Gabriel: "border-blue-500",
    Kaique: "border-green-500",
};

// Interface EditState (sem stl_url para edição rápida)
interface EditState {
    source_url: string | null;
    added_by: string | null;
    makerworld_checked: 'pending' | 'checked_not_found' | 'checked_found' | null;
    makerworld_url: string | null;
}

export default function MiningProducts() {
  const [products, setProducts] = useState<MiningProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Estados para edição rápida (Função de Edição)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditState>({
      source_url: '',
      added_by: '',
      makerworld_checked: 'pending',
      makerworld_url: '',
  });

  // Estado para o formulário de adição
  const [addFormData, setAddFormData] = useState({
    name: "", description: "", quantity: "", unit: "", cost: "",
    notes: "", source_url: "", makerworld_checked: 'pending' as MiningProduct['makerworld_checked'],
    makerworld_url: "",
    added_by: "",
  });
  const [stlFile, setStlFile] = useState<File | null>(null);
  const addStlInputRef = useRef<HTMLInputElement>(null);

  // Funções de busca de dados
  const fetchUserProfile = async (userId: string) => {
     try {
        const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        if (error) { console.error("Erro ao buscar perfil:", error); return; }
        const fullNameLower = data?.full_name?.toLowerCase();
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
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mining_products")
        .select("*, profiles ( full_name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive", });
    } finally {
      setLoading(false);
    }
   };

  // Função para Adicionar Produto
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) { toast({ title: "Erro", description: "Usuário não identificado.", variant: "destructive" }); return; }
    if (!addFormData.added_by) { toast({ title: "Campo obrigatório", description: "Selecione quem adicionou o produto.", variant: "destructive" }); return; }

    setLoading(true);
    try {
      let finalStlUrl: string | null = null;

      // Upload STL somente se 'checked_found' e se houver arquivo
      if (addFormData.makerworld_checked === 'checked_found' && stlFile) {
        const filePath = `mining_stl/${currentUserId}/${Date.now()}-${stlFile.name}`;
        const { error: uploadError } = await supabase.storage.from('stl-files').upload(filePath, stlFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(filePath);
        finalStlUrl = urlData.publicUrl;
      }

      const productToInsert = {
        user_id: currentUserId,
        name: addFormData.name,
        description: addFormData.description || null,
        quantity: parseFloat(addFormData.quantity) || 0,
        unit: addFormData.unit || null,
        cost: addFormData.cost ? parseFloat(addFormData.cost) : null,
        notes: addFormData.notes || null,
        source_url: addFormData.source_url || null,
        makerworld_checked: addFormData.makerworld_checked,
        makerworld_url: (addFormData.makerworld_checked === 'checked_found' && addFormData.makerworld_url) ? addFormData.makerworld_url : null,
        stl_url: finalStlUrl,
        added_by: addFormData.added_by,
      };

      const { error: insertError } = await supabase.from("mining_products").insert(productToInsert);
      if (insertError) throw insertError;

      toast({ title: "Produto adicionado!", description: "O produto foi registrado com sucesso." });

      // Resetar formulário
      setAddFormData({ name: "", description: "", quantity: "", unit: "", cost: "", notes: "", source_url: "", makerworld_checked: 'pending', makerworld_url: "", added_by: "" });
      setStlFile(null);
      if (addStlInputRef.current) addStlInputRef.current.value = "";
      if (currentUserId) await fetchUserProfile(currentUserId); // Repopular 'added_by'
      setDialogOpen(false);
      fetchProducts();

    } catch (error: any) {
      toast({ title: "Erro ao adicionar produto", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  // Função para Deletar
  const handleDelete = async (id: string) => {
    // (Poderia adicionar exclusão do STL do storage aqui se quisesse)
    if (!window.confirm("Tem certeza que deseja excluir?")) { return; }
    try {
      const { error } = await supabase.from("mining_products").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Produto removido" });
      fetchProducts();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };


  // --- Funções para Edição Rápida (A "FUNÇÃO DE EDITAR" ESTÁ AQUI) ---

  // 1. handleEditClick: Prepara o formulário de edição
  const handleEditClick = (product: MiningProduct) => {
    setEditingProductId(product.id);
    setEditFormData({
        source_url: product.source_url,
        added_by: product.added_by,
        makerworld_checked: product.makerworld_checked ?? 'pending',
        makerworld_url: product.makerworld_url,
    });
  };

  // 2. handleCancelEdit: Cancela o modo de edição
  const handleCancelEdit = () => {
    setEditingProductId(null);
  };

  // 3. handleUpdate: Salva as alterações da edição
  const handleUpdate = async () => {
    if (!editingProductId || !currentUserId) return;
     if (!editFormData.added_by) { toast({ title: "Campo obrigatório", description: "Selecione quem adicionou o produto.", variant: "destructive" }); return; }

    setLoading(true);
    try {
       const { error } = await supabase
         .from("mining_products")
         .update({
             source_url: editFormData.source_url || null,
             added_by: editFormData.added_by,
             makerworld_checked: editFormData.makerworld_checked,
             makerworld_url: (editFormData.makerworld_checked === 'checked_found' && editFormData.makerworld_url) ? editFormData.makerworld_url : null,
             // Não editamos o STL aqui
         })
         .eq('id', editingProductId);

       if (error) throw error;
       toast({ title: "Produto atualizado!" });
       setEditingProductId(null);
       fetchProducts();
    } catch (error: any) {
         toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  // ----- Renderização -----

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
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header e Botão Adicionar */}
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
             <div>
                <h1 className="text-4xl font-bold mb-2">Produtos Minerados</h1>
                <p className="text-muted-foreground">Controle seu estoque de materiais minerados</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="gap-2 w-full md:w-auto" disabled={loading}> <Plus className="h-4 w-4" /> Adicionar Produto </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader> <DialogTitle>Novo Produto Minerado</DialogTitle> <DialogDescription> Registre um novo produto minerado </DialogDescription> </DialogHeader>
                    {/* Formulário de ADIÇÃO Atualizado */}
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {/* Campos (Nome, Qtd, Unidade, Custo) */}
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"> <Label htmlFor="add-name">Nome *</Label> <Input id="add-name" value={addFormData.name} onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })} required placeholder="Ex: Filamento PLA Azul..." /> </div>
                            <div className="space-y-2"> <Label htmlFor="add-quantity">Quantidade *</Label> <Input id="add-quantity" type="number" step="any" value={addFormData.quantity} onChange={(e) => setAddFormData({ ...addFormData, quantity: e.target.value })} required placeholder="0.00" /> </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-2"> <Label htmlFor="add-unit">Unidade</Label> <Input id="add-unit" value={addFormData.unit} onChange={(e) => setAddFormData({ ...addFormData, unit: e.target.value })} placeholder="Ex: Kg, Rolo, Peça" /> </div>
                            <div className="space-y-2"> <Label htmlFor="add-cost">Custo Unitário (R$)</Label> <Input id="add-cost" type="number" step="0.01" value={addFormData.cost} onChange={(e) => setAddFormData({ ...addFormData, cost: e.target.value })} placeholder="0.00" /> </div>
                        </div>

                        {/* Campos (Link Geral, AddBy, MW Status) */}
                        <div className="space-y-2"> <Label htmlFor="add-source_url">Link Geral (Opcional)</Label> <Input id="add-source_url" type="url" value={addFormData.source_url} onChange={(e) => setAddFormData({ ...addFormData, source_url: e.target.value })} placeholder="Link da loja, modelo, etc." /> </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"> <Label htmlFor="add-added_by">Adicionado Por *</Label> <Select required value={addFormData.added_by} onValueChange={(value) => setAddFormData({ ...addFormData, added_by: value })} > <SelectTrigger id="add-added_by"> <SelectValue placeholder="Selecione..." /> </SelectTrigger> <SelectContent> <SelectItem value="Gabriel">Gabriel</SelectItem> <SelectItem value="Kaique">Kaique</SelectItem> <SelectItem value="Outro">Outro</SelectItem> </SelectContent> </Select> </div>
                            <div className="space-y-2"> <Label htmlFor="add-makerworld_checked">Status MakerWorld</Label>
                                <Select
                                    value={addFormData.makerworld_checked ?? 'pending'}
                                    onValueChange={(value) => setAddFormData({
                                        ...addFormData,
                                        makerworld_checked: value as MiningProduct['makerworld_checked'],
                                        // Limpar campos se mudar de 'achou' para outro
                                        makerworld_url: value === 'checked_found' ? addFormData.makerworld_url : "",
                                        // stlFile é limpo no submit ou manualmente
                                    })}
                                >
                                    <SelectTrigger id="add-makerworld_checked"> <SelectValue placeholder="Status..." /> </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">{makerworldStatusMap.pending}</SelectItem>
                                        <SelectItem value="checked_not_found">{makerworldStatusMap.checked_not_found}</SelectItem>
                                        <SelectItem value="checked_found">{makerworldStatusMap.checked_found}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Campos Condicionais: Link MW e STL (SÓ APARECEM SE 'checked_found') */}
                        {addFormData.makerworld_checked === 'checked_found' && (
                            <div className="p-4 border border-primary/30 rounded-md space-y-4 bg-background/30">
                                <div className="space-y-2">
                                    <Label htmlFor="add-makerworld_url" className="text-primary">Link Específico MakerWorld *</Label>
                                    <Input
                                    id="add-makerworld_url"
                                    type="url"
                                    value={addFormData.makerworld_url}
                                    onChange={(e) => setAddFormData({ ...addFormData, makerworld_url: e.target.value })}
                                    placeholder="https://makerworld.com/..."
                                    required // Pode ser obrigatório se 'achou'
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="add-stl" className="text-primary">Arquivo STL (Opcional)</Label>
                                    <Input
                                        id="add-stl"
                                        type="file"
                                        accept=".stl"
                                        ref={addStlInputRef}
                                        onChange={(e) => setStlFile(e.target.files?.[0] || null)}
                                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                    />
                                    {stlFile && <p className="text-xs text-muted-foreground mt-1">Arquivo: {stlFile.name}</p>}
                                </div>
                          </div>
                        )}

                        {/* Campos (Descrição, Notas) */}
                        <div className="space-y-2"> <Label htmlFor="add-description">Descrição</Label> <Textarea id="add-description" value={addFormData.description} onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })} placeholder="Breve descrição do produto..." rows={2} /> </div>
                        <div className="space-y-2"> <Label htmlFor="add-notes">Observações</Label> <Textarea id="add-notes" value={addFormData.notes} onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })} placeholder="Localização, fornecedor..." rows={3} /> </div>

                        <Button type="submit" className="w-full mt-4" disabled={loading}>
                            {loading ? "Adicionando..." : "Adicionar Produto"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>


        {/* Lista de Produtos */}
        {products.length === 0 && !loading ? (
           <Card className="card-gradient border-border/50">
             <CardContent className="flex flex-col items-center justify-center py-16">
               <Pickaxe className="h-16 w-16 text-muted-foreground mb-4" />
               <h3 className="text-xl font-semibold mb-2">Nenhum produto minerado</h3>
               <p className="text-muted-foreground mb-4">Comece adicionando seu primeiro produto</p>
               <Button onClick={() => setDialogOpen(true)}>Adicionar primeiro produto</Button>
             </CardContent>
           </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              // 4. Lógica de Edição: 'isEditing' controla qual visualização mostrar
              const isEditing = editingProductId === product.id;
              const canEdit = currentUserId === product.user_id;
              
              const borderColorClass = product.added_by && addedByBorderColorMap[product.added_by] ? `${addedByBorderColorMap[product.added_by]} border-2` : "border-border/50";
              let badgeVariant: "secondary" | "destructive" | "outline" = "outline";
              let badgeText = makerworldStatusMap.pending;
              if (product.makerworld_checked === 'checked_found') { badgeVariant = "secondary"; badgeText = makerworldStatusMap.checked_found; }
              else if (product.makerworld_checked === 'checked_not_found') { badgeVariant = "destructive"; badgeText = makerworldStatusMap.checked_not_found; }

              return (
                  <Card key={product.id} className={cn("card-gradient hover:shadow-lg transition-all flex flex-col", borderColorClass)}>
                    <CardHeader>
                        {/* Botões de Edição (lápis/deletar) ou (salvar/cancelar) */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <CardTitle className="text-xl">{product.name}</CardTitle>
                                {!isEditing && product.description && ( <CardDescription className="mt-1 text-sm">{product.description}</CardDescription> )}
                            </div>
                            {/* Botões de Visualização (Editar/Deletar) */}
                            {canEdit && !isEditing && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)} className="text-muted-foreground hover:text-primary size-8 shrink-0" aria-label="Editar produto" disabled={loading}> <Edit className="h-4 w-4" /> </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-muted-foreground hover:text-destructive size-8 shrink-0" aria-label="Remover produto" disabled={loading}> <Trash2 className="h-4 w-4" /> </Button>
                                </div>
                            )}
                            {/* Botões do Modo Edição (Salvar/Cancelar) */}
                            {isEditing && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={handleUpdate} className="text-muted-foreground hover:text-green-500 size-8 shrink-0" aria-label="Salvar alterações" disabled={loading}> <Save className="h-4 w-4" /> </Button>
                                    <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="text-muted-foreground hover:text-destructive size-8 shrink-0" aria-label="Cancelar edição" disabled={loading}> <XCircle className="h-4 w-4" /> </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    {/* Conteúdo do Card: Alterna entre Edição e Visualização */}
                    <CardContent className="space-y-2 text-sm flex-1 flex flex-col justify-between">
                      {isEditing ? (
                          // ---- MODO EDIÇÃO ----
                          <div className="space-y-3 pt-2">
                               {/* Link Geral */}
                                <div className="space-y-1">
                                    <Label htmlFor={`edit-source_url-${product.id}`} className="text-xs">Link Geral</Label>
                                    <Input id={`edit-source_url-${product.id}`} type="url" placeholder="Link loja, modelo, etc." value={editFormData.source_url ?? ''} onChange={(e) => setEditFormData({...editFormData, source_url: e.target.value})} className="h-8 text-xs" />
                                </div>
                               {/* Adicionado Por */}
                                <div className="space-y-1">
                                    <Label htmlFor={`edit-added_by-${product.id}`} className="text-xs">Adicionado Por *</Label>
                                    <Select value={editFormData.added_by ?? ''} onValueChange={(value) => setEditFormData({...editFormData, added_by: value})} >
                                        <SelectTrigger id={`edit-added_by-${product.id}`} className="h-8 text-xs"> <SelectValue placeholder="Selecione..." /> </SelectTrigger>
                                        <SelectContent> <SelectItem value="Gabriel">Gabriel</SelectItem> <SelectItem value="Kaique">Kaique</SelectItem> <SelectItem value="Outro">Outro</SelectItem> </SelectContent>
                                    </Select>
                                </div>
                               {/* Status MakerWorld */}
                                <div className="space-y-1">
                                    <Label htmlFor={`edit-makerworld-${product.id}`} className="text-xs">Status MakerWorld</Label>
                                    <Select
                                        value={editFormData.makerworld_checked ?? 'pending'}
                                        onValueChange={(value) => setEditFormData({
                                            ...editFormData,
                                            makerworld_checked: value as MiningProduct['makerworld_checked'],
                                            // Limpar link MW se mudar status
                                            makerworld_url: value === 'checked_found' ? editFormData.makerworld_url : null
                                        })}
                                    >
                                        <SelectTrigger id={`edit-makerworld-${product.id}`} className="h-8 text-xs"> <SelectValue placeholder="Status..." /> </SelectTrigger>
                                        <SelectContent> <SelectItem value="pending">{makerworldStatusMap.pending}</SelectItem> <SelectItem value="checked_not_found">{makerworldStatusMap.checked_not_found}</SelectItem> <SelectItem value="checked_found">{makerworldStatusMap.checked_found}</SelectItem> </SelectContent>
                                    </Select>
                                </div>

                                {/* Input Condicional MakerWorld URL */}
                               {editFormData.makerworld_checked === 'checked_found' && (
                                <div className="space-y-1">
                                  <Label htmlFor={`edit-makerworld_url-${product.id}`} className="text-xs text-primary">Link Específico MakerWorld *</Label>
                                  <Input
                                    id={`edit-makerworld_url-${product.id}`}
                                    type="url"
                                    placeholder="https://makerworld.com/..."
                                    value={editFormData.makerworld_url ?? ''}
                                    onChange={(e) => setEditFormData({ ...editFormData, makerworld_url: e.target.value })}
                                    className="h-8 text-xs"
                                    required
                                  />
                                </div>
                              )}
                              {/* O upload de STL não é feito na edição rápida */}
                          </div>
                      ) : (
                          // ---- MODO VISUALIZAÇÃO ----
                          <div>
                            {/* Infos Básicas */}
                            <div className="flex justify-between items-center"> <span className="text-muted-foreground">Quantidade:</span> <span className="font-semibold">{product.quantity}{product.unit ? ` ${product.unit}` : ''}</span> </div>
                            {product.cost !== null && typeof product.cost === 'number' && ( <div className="flex justify-between items-center"> <span className="text-muted-foreground">Custo Unitário:</span> <span className="font-semibold text-primary">R$ {product.cost.toFixed(2)}</span> </div> )}
                            <div className="flex justify-between items-center"> <span className="text-muted-foreground">Adquirido em:</span> <span>{new Date(product.acquisition_date).toLocaleDateString("pt-BR")}</span> </div>

                            {/* Link Geral */}
                            {product.source_url && ( <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground">Link Geral:</span> <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[150px]" title={product.source_url}> <ExternalLink className="inline h-3 w-3 mr-1"/> Ver Link </a> </div> )}

                            {/* Status MakerWorld */}
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3"/> MakerWorld:</span>
                                <Badge variant={badgeVariant} className="text-xs"> {badgeText} </Badge>
                            </div>

                            {/* Seção Condicional 'Achado no MW' (Agrupando Link MW e STL) */}
                            {product.makerworld_checked === 'checked_found' && (
                                <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                                    {/* Link Específico MakerWorld */}
                                    <div className="flex justify-between items-center">
                                        {product.makerworld_url ? (
                                            <>
                                                <span className="text-muted-foreground text-green-500 flex items-center gap-1"><CheckCircle className="h-3 w-3"/> Link MW:</span>
                                                <a href={product.makerworld_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[150px]" title={product.makerworld_url}> <ExternalLink className="inline h-3 w-3 mr-1"/> Ver Link MW </a>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-muted-foreground text-yellow-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Link MW:</span>
                                                <span className="text-xs text-yellow-500">Não fornecido</span>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Botão Download STL */}
                                    <div className="flex justify-between items-center">
                                        {product.stl_url ? (
                                            <>
                                                <span className="text-muted-foreground text-green-500 flex items-center gap-1"><Download className="h-3 w-3"/> STL:</span>
                                                <Button asChild size="xs" variant="outline" className="gap-1 text-xs h-6 px-2">
                                                    <a href={product.stl_url} download target="_blank" rel="noopener noreferrer">
                                                        Baixar
                                                    </a>
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-muted-foreground text-yellow-500 flex items-center gap-1"><Download className="h-3 w-3"/> STL:</span>
                                                <span className="text-xs text-yellow-500">Não fornecido</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Adicionado por */}
                            {product.added_by && ( <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground">Adicionado por:</span> <span className="font-medium flex items-center gap-1"> <User className="h-3 w-3"/>{product.added_by} </span> </div> )}

                            {/* Observações */}
                             {product.notes && (
                                // A borda superior SÓ aparece se a seção MW/STL NÃO apareceu
                                <div className={cn("pt-3 mt-3", (product.makerworld_checked !== 'checked_found') ? "border-t border-border/30" : "")}>
                                     <p className="text-xs text-muted-foreground break-words">{product.notes}</p>
                                </div>
                             )}
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