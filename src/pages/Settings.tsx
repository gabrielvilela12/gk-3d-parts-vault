import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plus, Trash, Palette, Save, DollarSign, Timer, Bolt, TrendingDown, Percent, Package } from "lucide-react";

interface Filament {
  id?: string;
  name: string;
  color: string;
  custo_kg: number;
}

interface CostDefaults {
  potenciaImpressoraW: string;
  custoKWh: string;
  custoFixoMes: string;
  unidadesMes: string;
  valorImpressora: string;
  vidaUtilHoras: string;
  percentualFalhas: string;
  custoAcessorios: string;
  markup: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);

  const [defaults, setDefaults] = useState<CostDefaults>({
    potenciaImpressoraW: "1300",
    custoKWh: "0.5",
    custoFixoMes: "",
    unidadesMes: "",
    valorImpressora: "5000",
    vidaUtilHoras: "15000",
    percentualFalhas: "2",
    custoAcessorios: "2",
    markup: "1.5",
  });

  const [newFilament, setNewFilament] = useState<Filament>({
    name: "",
    color: "",
    custo_kg: 100,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [filRes, presetRes] = await Promise.all([
        supabase.from("filaments").select("*").order("name", { ascending: true }),
        supabase.from("calculation_presets").select("*").eq("preset_name", "default").maybeSingle(),
      ]);
      if (filRes.error) throw filRes.error;
      setFilaments((filRes.data as any[]) || []);

      if (presetRes.data) {
        const d = presetRes.data;
        setPresetId(d.id);
        setDefaults({
          potenciaImpressoraW: d.potencia_impressora_w?.toString() || "1300",
          custoKWh: d.custo_kwh?.toString() || "0.5",
          custoFixoMes: d.custo_fixo_mes?.toString() || "",
          unidadesMes: d.unidades_mes?.toString() || "",
          valorImpressora: d.valor_impressora?.toString() || "5000",
          vidaUtilHoras: d.vida_util_horas?.toString() || "15000",
          percentualFalhas: d.percentual_falhas?.toString() || "2",
          custoAcessorios: d.custo_acessorios?.toString() || "2",
          markup: d.markup?.toString() || "1.5",
        });
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveDefaults = async () => {
    setSavingDefaults(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const p = (v: string) => parseFloat(v) || 0;
      const payload = {
        user_id: user.id,
        preset_name: "default",
        potencia_impressora_w: p(defaults.potenciaImpressoraW),
        custo_kwh: p(defaults.custoKWh),
        custo_fixo_mes: p(defaults.custoFixoMes) || null,
        unidades_mes: p(defaults.unidadesMes) || null,
        valor_impressora: p(defaults.valorImpressora),
        vida_util_horas: p(defaults.vidaUtilHoras),
        percentual_falhas: p(defaults.percentualFalhas),
        custo_acessorios: p(defaults.custoAcessorios),
        markup: p(defaults.markup),
      };

      if (presetId) {
        const { error } = await supabase.from("calculation_presets").update(payload).eq("id", presetId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("calculation_presets").insert(payload).select().single();
        if (error) throw error;
        setPresetId(data.id);
      }

      toast({ title: "Configurações salvas!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleDefaultChange = (field: keyof CostDefaults, value: string) => {
    setDefaults(prev => ({ ...prev, [field]: value }));
  };

  // Filament CRUD
  const addFilament = async () => {
    if (!newFilament.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
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
      const { data } = await supabase.from("filaments").select("*").order("name", { ascending: true });
      setFilaments((data as any[]) || []);
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
      const { error } = await supabase.from("filaments")
        .update({ name: filament.name, color: filament.color, custo_kg: filament.custo_kg } as any)
        .eq("id", filament.id);
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleFilamentChange = (index: number, field: keyof Filament, value: string | number) => {
    const updated = [...filaments];
    updated[index] = { ...updated[index], [field]: value };
    setFilaments(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações Padrão</h1>
          <p className="text-muted-foreground">Custos padrão e filamentos para precificação automática</p>
        </div>
      </div>

      {/* Custos Padrão */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Custos Padrão
          </CardTitle>
          <CardDescription>
            Estes valores serão usados automaticamente ao adicionar peças
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Timer className="h-4 w-4" /> Impressora
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Potência da Impressora (W)</Label>
              <Input type="number" value={defaults.potenciaImpressoraW} onChange={(e) => handleDefaultChange("potenciaImpressoraW", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Custo por KWh (R$)</Label>
              <Input type="number" step="0.01" value={defaults.custoKWh} onChange={(e) => handleDefaultChange("custoKWh", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pt-2">
            <Bolt className="h-4 w-4" /> Custo Fixo
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Custo Fixo por Mês (R$)</Label>
              <Input type="number" step="0.01" value={defaults.custoFixoMes} onChange={(e) => handleDefaultChange("custoFixoMes", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Unidades/Mês</Label>
              <Input type="number" value={defaults.unidadesMes} onChange={(e) => handleDefaultChange("unidadesMes", e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pt-2">
            <TrendingDown className="h-4 w-4" /> Amortização
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor da Impressora 3D (R$)</Label>
              <Input type="number" step="0.01" value={defaults.valorImpressora} onChange={(e) => handleDefaultChange("valorImpressora", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vida Útil (horas)</Label>
              <Input type="number" value={defaults.vidaUtilHoras} onChange={(e) => handleDefaultChange("vidaUtilHoras", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pt-2">
            <Percent className="h-4 w-4" /> Falhas e Extras
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Percentual de Falhas (%)</Label>
              <Input type="number" value={defaults.percentualFalhas} onChange={(e) => handleDefaultChange("percentualFalhas", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Custo Acessórios (R$)</Label>
              <Input type="number" step="0.01" value={defaults.custoAcessorios} onChange={(e) => handleDefaultChange("custoAcessorios", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Markup (x)</Label>
              <Input type="number" step="0.1" value={defaults.markup} onChange={(e) => handleDefaultChange("markup", e.target.value)} />
            </div>
          </div>

          <Button onClick={saveDefaults} disabled={savingDefaults} className="gap-2 w-full mt-4">
            <Save className="h-4 w-4" />
            {savingDefaults ? "Salvando..." : "Salvar Configurações Padrão"}
          </Button>
        </CardContent>
      </Card>

      {/* Adicionar Filamento */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Adicionar Filamento
          </CardTitle>
          <CardDescription>
            Cadastre filamentos com diferentes cores e preços
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome / Material</Label>
              <Input placeholder="Ex: PETG, PLA..." value={newFilament.name} onChange={(e) => setNewFilament(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input placeholder="Ex: Preto, Branco..." value={newFilament.color} onChange={(e) => setNewFilament(prev => ({ ...prev, color: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Custo por Kg (R$)</Label>
              <Input type="number" step="0.01" value={newFilament.custo_kg} onChange={(e) => setNewFilament(prev => ({ ...prev, custo_kg: parseFloat(e.target.value) || 0 }))} />
            </div>
            <Button onClick={addFilament} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Filamentos */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Filamentos Cadastrados
          </CardTitle>
          <CardDescription>{filaments.length} filamento(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filaments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum filamento cadastrado. Adicione acima para ver o relatório de custos ao adicionar peças.
            </p>
          ) : (
            filaments.map((filament, index) => (
              <div key={filament.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input value={filament.name} onChange={(e) => handleFilamentChange(index, "name", e.target.value)} onBlur={() => updateFilament(filament)} placeholder="Nome" />
                  <Input value={filament.color || ""} onChange={(e) => handleFilamentChange(index, "color", e.target.value)} onBlur={() => updateFilament(filament)} placeholder="Cor" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">R$/Kg:</span>
                    <Input type="number" step="0.01" value={filament.custo_kg} onChange={(e) => handleFilamentChange(index, "custo_kg", parseFloat(e.target.value) || 0)} onBlur={() => updateFilament(filament)} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => filament.id && deleteFilament(filament.id)} className="text-destructive hover:text-destructive shrink-0">
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
