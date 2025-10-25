import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pickaxe, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MiningProduct {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  acquisition_date: string;
  cost: number;
  notes: string;
}

export default function MiningProducts() {
  const [products, setProducts] = useState<MiningProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    quantity: "",
    unit: "",
    cost: "",
    notes: "",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("mining_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
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
        description: formData.description,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        notes: formData.notes,
      });

      if (error) throw error;

      toast({
        title: "Produto adicionado!",
        description: "O produto minerado foi registrado com sucesso.",
      });

      setFormData({
        name: "",
        description: "",
        quantity: "",
        unit: "",
        cost: "",
        notes: "",
      });
      setDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar produto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("mining_products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Produto removido",
        description: "O produto foi removido com sucesso.",
      });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Erro ao remover produto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Pickaxe className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando produtos minerados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Produtos Minerados</h1>
            <p className="text-muted-foreground">Controle seu estoque de materiais minerados</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo Produto Minerado</DialogTitle>
                <DialogDescription>
                  Registre um novo produto minerado no sistema
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Ex: Ouro, Ferro, Diamante..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                      placeholder="Ex: 150"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="Ex: kg, g, unidades..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cost">Custo (R$)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o produto..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações técnicas, localização, etc..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Adicionar Produto
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {products.length === 0 ? (
          <Card className="card-gradient border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Pickaxe className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum produto cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comece adicionando seus primeiros produtos minerados
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="card-gradient border-border/50 hover:glow-primary transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{product.name}</CardTitle>
                      {product.description && (
                        <CardDescription className="mt-2">{product.description}</CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Quantidade:</span>
                    <span className="font-semibold">
                      {product.quantity} {product.unit}
                    </span>
                  </div>
                  
                  {product.cost && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Custo:</span>
                      <span className="font-semibold text-primary">
                        R$ {product.cost.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Adquirido em:</span>
                    <span className="text-sm">
                      {new Date(product.acquisition_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  {product.notes && (
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">{product.notes}</p>
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
