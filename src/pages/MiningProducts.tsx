// src/pages/MiningProducts.tsx
import { useEffect, useState, useRef, useMemo } from "react"; // useMemo importado
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch"; // Importar o Switch
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
  DollarSign, // Ícone para Ativo
  Filter, // Ícone para filtros
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Interface atualizada com is_selling
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
  makerworld_url: string | null; 
  stl_url: string | null; 
  added_by: string | null;
  is_selling: boolean | null;
  user_id: string;
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

// Interface EditState atualizada com is_selling
interface EditState {
    source_url: string | null;
    added_by: string | null;
    makerworld_checked: 'pending' | 'checked_not_found' | 'checked_found' | null;
    makerworld_url: string | null;
    is_selling: boolean | null; // Novo campo
}

export default function MiningProducts() {
  const [products, setProducts] = useState<MiningProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<MiningProduct[]>([]); // Estado para produtos filtrados
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
      is_selling: false, // Novo campo
  });

  // Estado para o formulário de adição (atualizado com is_selling)
  const [addFormData, setAddFormData] = useState({
    name: "", description: "", quantity: "", unit: "", cost: "",
    notes: "", source_url: "", makerworld_checked: 'pending' as MiningProduct['makerworld_checked'],
    makerworld_url: "",
    added_by: "",
    is_selling: false, // Novo campo
  });
  const [stlFile, setStlFile] = useState<File | null>(null);
  const addStlInputRef = useRef<HTMLInputElement>(null);
  
  // Estados dos Filtros
  const [filterSearch, setFilterSearch] = useState("");
  const [filterAddedBy, setFilterAddedBy] = useState("all");
  const [filterMWStatus, setFilterMWStatus] = useState("all");
  const [filterSelling, setFilterSelling] = useState("all"); // 'all', 'true', 'false'

  // *** CORREÇÃO: HOOK MOVIDO PARA CIMA ***
  // Obter nomes únicos para filtro (DEVE ESTAR ANTES DE QUALQUER RETORNO)
  const addedByOptions = useMemo(() => {
    const names = new Set(products.map(p => p.added_by).filter(Boolean));
    return Array.from(names) as string[];
  }, [products]);


  // Funções de busca de dados
  const fetchUserProfile = async (userId: string) => {
     try {
        const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        if (error) { console.error("Erro ao buscar perfil:", error); return; }
        const fullNameLower = data?.full_name?.toLowerCase();
        
        let addedBy = "Outro"; // Default
        if (fullNameLower?.includes('gabriel')) {
            addedBy = 'Gabriel';
        } else if (fullNameLower?.includes('kaique')) {
            addedBy = 'Kaique';
        }
        setAddFormData(prev => ({ ...prev, added_by: addedBy }));

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
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts((data as any) || []);
      setFilteredProducts((data as any) || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive", });
    } finally {
      setLoading(false);
    }
   };

  // Lógica de Filtragem (Client-side)
  useEffect(() => {
    let tempProducts = [...products];

    // 1. Filtro de Busca (Nome ou Descrição)
    if (filterSearch) {
      tempProducts = tempProducts.filter(p => 
        p.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        p.description?.toLowerCase().includes(filterSearch.toLowerCase())
      );
    }

    // 2. Filtro "Adicionado Por"
    if (filterAddedBy !== "all") {
      tempProducts = tempProducts.filter(p => p.added_by === filterAddedBy);
    }

    // 3. Filtro "Status MakerWorld"
    if (filterMWStatus !== "all") {
      tempProducts = tempProducts.filter(p => (p.makerworld_checked ?? 'pending') === filterMWStatus);
    }

    // 4. Filtro "Ativo"
    if (filterSelling !== "all") {
      const isSelling = filterSelling === 'true';
      tempProducts = tempProducts.filter(p => (p.is_selling ?? false) === isSelling);
    }

    setFilteredProducts(tempProducts);
  }, [filterSearch, filterAddedBy, filterMWStatus, filterSelling, products]);


  // Função para Adicionar Produto (Atualizada com is_selling)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) { toast({ title: "Erro", description: "Usuário não identificado.", variant: "destructive" }); return; }
    if (!addFormData.added_by) { toast({ title: "Campo obrigatório", description: "Selecione quem adicionou o produto.", variant: "destructive" }); return; }

    setLoading(true);
    try {
      let finalStlUrl: string | null = null;

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
        is_selling: addFormData.is_selling, // Novo campo
      };

      const { error: insertError } = await supabase.from("mining_products").insert(productToInsert);
      if (insertError) throw insertError;

      toast({ title: "Produto adicionado!", description: "O produto foi registrado com sucesso." });

      // Resetar formulário
      const originalAddedBy = addFormData.added_by; // Manter quem adicionou
      setAddFormData({ name: "", description: "", quantity: "", unit: "", cost: "", notes: "", source_url: "", makerworld_checked: 'pending', makerworld_url: "", added_by: originalAddedBy, is_selling: false });
      setStlFile(null);
      if (addStlInputRef.current) addStlInputRef.current.value = "";
      setDialogOpen(false);
      fetchProducts(); // Recarrega todos os produtos

    } catch (error: any) {
      toast({ title: "Erro ao adicionar produto", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  // Função para Deletar
  const handleDelete = async (id: string) => {
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


  // --- Funções para Edição Rápida (Atualizadas com is_selling) ---

  // 1. handleEditClick: Prepara o formulário de edição
  const handleEditClick = (product: MiningProduct) => {
    setEditingProductId(product.id);
    setEditFormData({
        source_url: product.source_url,
        added_by: product.added_by,
        makerworld_checked: product.makerworld_checked ?? 'pending',
        makerworld_url: product.makerworld_url,
        is_selling: product.is_selling ?? false, // Novo campo
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
             is_selling: editFormData.is_selling, // Novo campo
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

  // Bloco de loading (AGORA SEGURO)
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
                <p className="text-muted-foreground">
                  {loading ? "Carregando..." : `${filteredProducts.length} de ${products.length} produtos exibidos`}
                </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="gap-2 w-full md:w-auto" disabled={loading}> <Plus className="h-4 w-4" /> Adicionar Produto </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader> <DialogTitle>Novo Produto Minerado</DialogTitle> <DialogDescription> Registre um novo produto minerado </DialogDescription> </DialogHeader>
                    {/* Formulário de ADIÇÃO Atualizado com is_selling */}
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {/* Nome */}
                         <div className="space-y-2"> <Label htmlFor="add-name">Nome *</Label> <Input id="add-name" value={addFormData.name} onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })} required placeholder="Ex: Filamento PLA Azul..." /> </div>
                        
                         {/* Link Geral */}
                        <div className="space-y-2"> <Label htmlFor="add-source_url">Link Geral (Opcional)</Label> <Input id="add-source_url" type="url" value={addFormData.source_url} onChange={(e) => setAddFormData({ ...addFormData, source_url: e.target.value })} placeholder="Link da loja, modelo, etc." /> </div>
                        
                        {/* Adicionado Por e Status MW */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"> <Label htmlFor="add-added_by">Adicionado Por *</Label> <Select required value={addFormData.added_by} onValueChange={(value) => setAddFormData({ ...addFormData, added_by: value })} > <SelectTrigger id="add-added_by"> <SelectValue placeholder="Selecione..." /> </SelectTrigger> <SelectContent> <SelectItem value="Gabriel">Gabriel</SelectItem> <SelectItem value="Kaique">Kaique</SelectItem> <SelectItem value="Outro">Outro</SelectItem> </SelectContent> </Select> </div>
                            <div className="space-y-2"> <Label htmlFor="add-makerworld_checked">Status MakerWorld</Label>
                                <Select
                                    value={addFormData.makerworld_checked ?? 'pending'}
                                    onValueChange={(value) => setAddFormData({
                                        ...addFormData,
                                        makerworld_checked: value as MiningProduct['makerworld_checked'],
                                        makerworld_url: value === 'checked_found' ? addFormData.makerworld_url : "",
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

                        {/* Campos Condicionais: Link MW e STL */}
                        {addFormData.makerworld_checked === 'checked_found' && (
                            <div className="p-4 border border-primary/30 rounded-md space-y-4 bg-background/30">
                                <div className="space-y-2">
                                    <Label htmlFor="add-makerworld_url" className="text-primary">Link Específico MakerWorld *</Label>
                                    <Input id="add-makerworld_url" type="url" value={addFormData.makerworld_url} onChange={(e) => setAddFormData({ ...addFormData, makerworld_url: e.target.value })} placeholder="https://makerworld.com/..." required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="add-stl" className="text-primary">Arquivo STL (Opcional)</Label>
                                    <Input id="add-stl" type="file" accept=".stl" ref={addStlInputRef} onChange={(e) => setStlFile(e.target.files?.[0] || null)} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" />
                                    {stlFile && <p className="text-xs text-muted-foreground mt-1">Arquivo: {stlFile.name}</p>}
                                </div>
                          </div>
                        )}
                        
                        {/* Novo Campo: Ativo */}
                        <div className="flex items-center justify-between space-x-2 pt-2">
                            <Label htmlFor="add-is_selling" className="flex flex-col space-y-1">
                                <span>Ativo?</span>
                                <span className="font-normal leading-snug text-muted-foreground text-xs">
                                    Marque se este item está disponível para venda.
                                </span>
                            </Label>
                            <Switch
                                id="add-is_selling"
                                checked={addFormData.is_selling}
                                onCheckedChange={(checked) => setAddFormData({ ...addFormData, is_selling: checked })}
                            />
                        </div>

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
        
        {/* --- BARRA DE FILTROS --- */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro 1: Busca */}
            <div className="space-y-2">
              <Label htmlFor="filter-search">Buscar por Nome</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="filter-search"
                  placeholder="Nome ou descrição..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filtro 2: Adicionado Por */}
            <div className="space-y-2">
              <Label htmlFor="filter-added_by">Adicionado Por</Label>
              <Select value={filterAddedBy} onValueChange={setFilterAddedBy}>
                <SelectTrigger id="filter-added_by">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {addedByOptions.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro 3: Status MW */}
            <div className="space-y-2">
              <Label htmlFor="filter-mw_status">Status MakerWorld</Label>
              <Select value={filterMWStatus} onValueChange={setFilterMWStatus}>
                <SelectTrigger id="filter-mw_status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">{makerworldStatusMap.pending}</SelectItem>
                  <SelectItem value="checked_not_found">{makerworldStatusMap.checked_not_found}</SelectItem>
                  <SelectItem value="checked_found">{makerworldStatusMap.checked_found}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro 4: Ativo */}
            <div className="space-y-2">
              <Label htmlFor="filter-selling">Status Venda</Label>
              <Select value={filterSelling} onValueChange={setFilterSelling}>
                <SelectTrigger id="filter-selling">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


        {/* Lista de Produtos (agora usa filteredProducts) */}
        {filteredProducts.length === 0 ? (
           <Card className="card-gradient border-border/50">
             <CardContent className="flex flex-col items-center justify-center py-16">
               <Pickaxe className="h-16 w-16 text-muted-foreground mb-4" />
               <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
               <p className="text-muted-foreground mb-4">
                 {products.length > 0 ? "Nenhum produto corresponde aos filtros aplicados." : "Comece adicionando seu primeiro produto"}
                </p>
               {products.length === 0 && (
                  <Button onClick={() => setDialogOpen(true)}>Adicionar primeiro produto</Button>
               )}
             </CardContent>
           </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
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
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <CardTitle className="text-xl">{product.name}</CardTitle>
                                {!isEditing && product.description && ( <CardDescription className="mt-1 text-sm">{product.description}</CardDescription> )}
                            </div>
                            {canEdit && !isEditing && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)} className="text-muted-foreground hover:text-primary size-8 shrink-0" aria-label="Editar produto" disabled={loading}> <Edit className="h-4 w-4" /> </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-muted-foreground hover:text-destructive size-8 shrink-0" aria-label="Remover produto" disabled={loading}> <Trash2 className="h-4 w-4" /> </Button>
                                </div>
                            )}
                            {isEditing && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={handleUpdate} className="text-muted-foreground hover:text-green-500 size-8 shrink-0" aria-label="Salvar alterações" disabled={loading}> <Save className="h-4 w-4" /> </Button>
                                    <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="text-muted-foreground hover:text-destructive size-8 shrink-0" aria-label="Cancelar edição" disabled={loading}> <XCircle className="h-4 w-4" /> </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-2 text-sm flex-1 flex flex-col justify-between">
                      {isEditing ? (
                          // ---- MODO EDIÇÃO ----
                          <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <Label htmlFor={`edit-source_url-${product.id}`} className="text-xs">Link Geral</Label>
                                    <Input id={`edit-source_url-${product.id}`} type="url" placeholder="Link loja, modelo, etc." value={editFormData.source_url ?? ''} onChange={(e) => setEditFormData({...editFormData, source_url: e.target.value})} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`edit-added_by-${product.id}`} className="text-xs">Adicionado Por *</Label>
                                    <Select value={editFormData.added_by ?? ''} onValueChange={(value) => setEditFormData({...editFormData, added_by: value})} >
                                        <SelectTrigger id={`edit-added_by-${product.id}`} className="h-8 text-xs"> <SelectValue placeholder="Selecione..." /> </SelectTrigger>
                                        <SelectContent> <SelectItem value="Gabriel">Gabriel</SelectItem> <SelectItem value="Kaique">Kaique</SelectItem> <SelectItem value="Outro">Outro</SelectItem> </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`edit-makerworld-${product.id}`} className="text-xs">Status MakerWorld</Label>
                                    <Select
                                        value={editFormData.makerworld_checked ?? 'pending'}
                                        onValueChange={(value) => setEditFormData({
                                            ...editFormData,
                                            makerworld_checked: value as MiningProduct['makerworld_checked'],
                                            makerworld_url: value === 'checked_found' ? editFormData.makerworld_url : null
                                        })}
                                    >
                                        <SelectTrigger id={`edit-makerworld-${product.id}`} className="h-8 text-xs"> <SelectValue placeholder="Status..." /> </SelectTrigger>
                                        <SelectContent> <SelectItem value="pending">{makerworldStatusMap.pending}</SelectItem> <SelectItem value="checked_not_found">{makerworldStatusMap.checked_not_found}</SelectItem> <SelectItem value="checked_found">{makerworldStatusMap.checked_found}</SelectItem> </SelectContent>
                                    </Select>
                                </div>

                               {editFormData.makerworld_checked === 'checked_found' && (
                                <div className="space-y-1">
                                  <Label htmlFor={`edit-makerworld_url-${product.id}`} className="text-xs text-primary">Link Específico MakerWorld *</Label>
                                  <Input id={`edit-makerworld_url-${product.id}`} type="url" placeholder="https://makerworld.com/..." value={editFormData.makerworld_url ?? ''} onChange={(e) => setEditFormData({ ...editFormData, makerworld_url: e.target.value })} className="h-8 text-xs" required />
                                </div>
                               )}
                               
                               {/* Novo Switch 'Ativo' na Edição */}
                               <div className="flex items-center justify-between space-x-2 pt-2">
                                  <Label htmlFor={`edit-is_selling-${product.id}`} className="text-xs">
                                      Ativo?
                                  </Label>
                                  <Switch
                                      id={`edit-is_selling-${product.id}`}
                                      checked={editFormData.is_selling ?? false}
                                      onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_selling: checked })}
                                  />
                               </div>
                          </div>
                      ) : (
                          // ---- MODO VISUALIZAÇÃO ----
                          <div>
                            {/* Status Venda (NOVO) */}
                            {product.is_selling ? (
                                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 mb-2">
                                  <DollarSign className="h-3 w-3 mr-1"/> Ativo
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-xs mb-2">
                                  Não Ativo
                                </Badge>
                            )}

                            {product.cost !== null && typeof product.cost === 'number' && ( <div className="flex justify-between items-center"> <span className="text-muted-foreground">Custo Unitário:</span> <span className="font-semibold text-primary">R$ {product.cost.toFixed(2)}</span> </div> )}
                            <div className="flex justify-between items-center"> <span className="text-muted-foreground">Adquirido em:</span> <span>{new Date(product.acquisition_date).toLocaleDateString("pt-BR")}</span> </div>
                            {product.source_url && ( <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground">Link Geral:</span> <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[150px]" title={product.source_url}> <ExternalLink className="inline h-3 w-3 mr-1"/> Ver Link </a> </div> )}
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3"/> MakerWorld:</span>
                                <Badge variant={badgeVariant} className="text-xs"> {badgeText} </Badge>
                            </div>

                            {product.makerworld_checked === 'checked_found' && (
                                <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
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
                                    <div className="flex justify-between items-center">
                                        {product.stl_url ? (
                                            <>
                                                <span className="text-muted-foreground text-green-500 flex items-center gap-1"><Download className="h-3 w-3"/> STL:</span>
                                                <Button asChild size="sm" variant="outline" className="gap-1 text-xs h-6 px-2">
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

                            {product.added_by && ( <div className="flex justify-between items-center mt-1"> <span className="text-muted-foreground">Adicionado por:</span> <span className="font-medium flex items-center gap-1"> <User className="h-3 w-3"/>{product.added_by} </span> </div> )}

                             {product.notes && (
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