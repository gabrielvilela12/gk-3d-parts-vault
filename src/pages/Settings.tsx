import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plus, Trash, Palette, Save } from "lucide-react";

interface Filament {
  id?: string;
  name: string;
  color: string;
  custo_kg: number;
}

export default function Settings() {
  const { toast } = useToast();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New filament form
  const [newFilament, setNewFilament] = useState<Filament>({
    name: "",
    color: "",
    custo_kg: 100,
  });

  useEffect(() => {
    fetchFilaments();
  }, []);

  const fetchFilaments = async () => {
    try {
      const { data, error } = await supabase
        .from("filaments")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      setFilaments((data as any[]) || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar filamentos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addFilament = async () => {
    if (!newFilament.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do filamento.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("filaments").insert({
        user_id: user.id,
        name: newFilament.name.trim(),
        color: newFilament.color.trim() || null,
        custo_kg: newFilament.custo_kg,
      } as any);
      if (error) throw error;

      toast({ title: "Filamento adicionado!" });
      setNewFilament({ name: "", color: "", custo_kg: 100 });
      fetchFilaments();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteFilament = async (id: string) => {
    try {
      const { error } = await supabase.from("filaments").delete().eq("id", id);
      if (error) throw error;
      setFilaments(filaments.filter(f => f.id !== id));
      toast({ title: "Filamento removido!" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const updateFilament = async (filament: Filament) => {
    if (!filament.id) return;
    try {
      const { error } = await supabase
        .from("filaments")
        .update({ name: filament.name, color: filament.color, custo_kg: filament.custo_kg } as any)
        .eq("id", filament.id);
      if (error) throw error;
      toast({ title: "Filamento atualizado!" });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleFilamentChange = (index: number, field: keyof Filament, value: string | number) => {
    const updated = [...filaments];
    updated[index] = { ...updated[index], [field]: value };
    setFilaments(updated);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações Padrão</h1>
          <p className="text-muted-foreground">Gerencie seus filamentos e custos padrão</p>
        </div>
      </div>

      {/* Cadastrar novo filamento */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Adicionar Filamento
          </CardTitle>
          <CardDescription>
            Cadastre filamentos com diferentes cores e preços para usar na precificação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome / Material</Label>
              <Input
                placeholder="Ex: PETG, PLA, ABS..."
                value={newFilament.name}
                onChange={(e) => setNewFilament(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input
                placeholder="Ex: Preto, Branco..."
                value={newFilament.color}
                onChange={(e) => setNewFilament(prev => ({ ...prev, color: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Custo por Kg (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={newFilament.custo_kg}
                onChange={(e) => setNewFilament(prev => ({ ...prev, custo_kg: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <Button onClick={addFilament} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de filamentos */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Filamentos Cadastrados
          </CardTitle>
          <CardDescription>
            {filaments.length} filamento(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Carregando...</p>
            </div>
          ) : filaments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum filamento cadastrado. Adicione filamentos acima para ver o relatório de custos ao adicionar peças.
            </p>
          ) : (
            filaments.map((filament, index) => (
              <div key={filament.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    value={filament.name}
                    onChange={(e) => handleFilamentChange(index, "name", e.target.value)}
                    onBlur={() => updateFilament(filament)}
                    placeholder="Nome"
                  />
                  <Input
                    value={filament.color || ""}
                    onChange={(e) => handleFilamentChange(index, "color", e.target.value)}
                    onBlur={() => updateFilament(filament)}
                    placeholder="Cor"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">R$/Kg:</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={filament.custo_kg}
                      onChange={(e) => handleFilamentChange(index, "custo_kg", parseFloat(e.target.value) || 0)}
                      onBlur={() => updateFilament(filament)}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => filament.id && deleteFilament(filament.id)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
