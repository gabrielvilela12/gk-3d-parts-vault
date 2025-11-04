import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Save, DollarSign, Box, Timer, Bolt, TrendingDown, Settings, Percent, Package, ChevronDown } from "lucide-react";

// Interface para os inputs do formulário
interface FormData {
  name: string;
  quantidade: number;
  tempoImpressaoHoras: string;
  tempoImpressaoMinutos: string;
  pesoEstimadoG: string;
  material: string;
  custoKgFilamento: string;
  potenciaImpressoraW: string;
  custoKWh: string;
  custoFixoMes: string;
  unidadesMes: string;
  valorImpressora: string;
  vidaUtilHoras: string;
  percentualFalhas: string;
  custoAcessorios: string;
  markup: string;
  imposto: string;
  taxaPagamento: string;
  incluirImpostos: boolean;
}

// Interface para os valores calculados
interface CalculatedCosts {
  custoMaterial: number;
  custoEnergia: number;
  custoFixoUnitario: number;
  custoAmortizacao: number;
  custoAcessorios: number;
  custoFalhas: number;
  custoUnitario: number;
  precoConsumidor: number;
  lucroBruto: number;
  lucroLiquido: number;
}

export default function AddPiece() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stlFile, setStlFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    quantidade: 1,
    tempoImpressaoHoras: "",
    tempoImpressaoMinutos: "",
    pesoEstimadoG: "",
    material: "PLA",
    custoKgFilamento: "",
    potenciaImpressoraW: "",
    custoKWh: "",
    custoFixoMes: "",
    unidadesMes: "",
    valorImpressora: "",
    vidaUtilHoras: "",
    percentualFalhas: "",
    custoAcessorios: "",
    markup: "",
    imposto: "",
    taxaPagamento: "",
    incluirImpostos: true,
  });

  const [costs, setCosts] = useState<CalculatedCosts>({
    custoMaterial: 0,
    custoEnergia: 0,
    custoFixoUnitario: 0,
    custoAmortizacao: 0,
    custoAcessorios: 0,
    custoFalhas: 0,
    custoUnitario: 0,
    precoConsumidor: 0,
    lucroBruto: 0,
    lucroLiquido: 0,
  });

  useEffect(() => {
    const p = (value: string) => parseFloat(value) || 0;

    const peso = p(formData.pesoEstimadoG);
    const custoKg = p(formData.custoKgFilamento);
    const horas = p(formData.tempoImpressaoHoras);
    const minutos = p(formData.tempoImpressaoMinutos);
    const potenciaW = p(formData.potenciaImpressoraW);
    const custoKWh = p(formData.custoKWh);
    const custoFixo = p(formData.custoFixoMes);
    const unidades = p(formData.unidadesMes);
    const valorImpressora = p(formData.valorImpressora);
    const vidaUtil = p(formData.vidaUtilHoras);
    const custoAcessorios = p(formData.custoAcessorios);
    const percentualFalhas = p(formData.percentualFalhas);
    const markup = p(formData.markup);
    const imposto = p(formData.imposto);
    const taxa = p(formData.taxaPagamento);
    const incluirImpostos = formData.incluirImpostos;
    const quantidade = p(String(formData.quantidade)) || 1;

    const tempoTotalHoras = horas + (minutos / 60);
    const custoMaterial = (peso / 1000) * custoKg;
    const custoEnergia = (potenciaW / 1000) * tempoTotalHoras * custoKWh;
    const custoFixoUnitario = unidades > 0 ? custoFixo / unidades : 0;
    const custoAmortizacao = vidaUtil > 0 ? (valorImpressora / vidaUtil) * tempoTotalHoras : 0;
    const custoVariavel = custoMaterial + custoEnergia;
    const custoFalhas = custoVariavel * (percentualFalhas / 100);

    const custoUnitario = custoMaterial + custoEnergia + custoFixoUnitario + custoAmortizacao + custoAcessorios + custoFalhas;

    const precoBase = (custoUnitario * markup) * quantidade;
    let precoConsumidor = precoBase;
    if (incluirImpostos && (imposto > 0 || taxa > 0)) {
      const divisor = 1 - (imposto / 100) - (taxa / 100);
      precoConsumidor = divisor > 0 ? precoBase / divisor : precoBase;
    }

    const lucroBruto = precoConsumidor - (custoUnitario * quantidade);
    const impostoPago = precoConsumidor * (imposto / 100);
    const taxaPaga = precoConsumidor * (taxa / 100);
    const lucroLiquido = lucroBruto - impostoPago - taxaPaga;

    setCosts({
      custoMaterial,
      custoEnergia,
      custoFixoUnitario,
      custoAmortizacao,
      custoAcessorios: custoAcessorios,
      custoFalhas,
      custoUnitario,
      precoConsumidor,
      lucroBruto,
      lucroLiquido,
    });
  }, [formData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === "number" ? value : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let stlUrl = "";

      if (stlFile) {
        const stlPath = `${user.id}/${Date.now()}-${stlFile.name}`;
        const { error: stlError } = await supabase.storage
          .from("stl-files")
          .upload(stlPath, stlFile);

        if (stlError) throw stlError;

        const { data: stlData } = supabase.storage.from("stl-files").getPublicUrl(stlPath);
        stlUrl = stlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("pieces").insert({
        user_id: user.id,
        name: formData.name,
        material: formData.material,
        cost: costs.custoUnitario,
        stl_url: stlUrl,
        notes: `Peso: ${formData.pesoEstimadoG}g, Tempo: ${formData.tempoImpressaoHoras}h ${formData.tempoImpressaoMinutos}m, Markup: ${formData.markup}x`,
        width: null,
        height: null,
        depth: null,
        image_url: null,
      });

      if (insertError) throw insertError;

      toast({
        title: "Peça cadastrada!",
        description: "A peça foi adicionada ao catálogo com sucesso",
      });

      navigate("/catalog");
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar peça",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        
        {/* Card Resumo de Preços */}
        <Card className="card-gradient border-border/50 sticky top-16 z-40 backdrop-blur-lg">
          <CardHeader><CardTitle>Resumo de Preços</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Custo Unitário Detalhado */}
            <Collapsible asChild>
              <div className="p-4 bg-muted/30 rounded-lg">
                <CollapsibleTrigger className="w-full text-left flex flex-col items-start">
                  <CardDescription>Custo Unitário</CardDescription>
                  <p className="text-3xl font-bold">R$ {costs.custoUnitario.toFixed(2)}</p>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">Ver detalhamento <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:-rotate-180" /></div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Filamento:</span> R$ {costs.custoMaterial.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Energia:</span> R$ {costs.custoEnergia.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Acessórios:</span> R$ {costs.custoAcessorios.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo Fixo:</span> R$ {costs.custoFixoUnitario.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amortização:</span> R$ {costs.custoAmortizacao.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Falhas:</span> R$ {costs.custoFalhas.toFixed(2)}</div>
                  <div className="flex justify-between font-bold border-t border-border mt-1 pt-1"><span className="text-foreground">Total de Custos:</span> R$ {costs.custoUnitario.toFixed(2)}</div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Preço Consumidor Detalhado */}
            <Collapsible asChild>
              <div className="p-4 bg-muted/30 rounded-lg">
                <CollapsibleTrigger className="w-full text-left flex flex-col items-start">
                  <CardDescription>Preço Consumidor (x{formData.quantidade})</CardDescription>
                  <p className="text-3xl font-bold text-primary">R$ {costs.precoConsumidor.toFixed(2)}</p>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">Ver detalhamento <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:-rotate-180" /></div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Preço Consumidor Final:</span> R$ {costs.precoConsumidor.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lucro Bruto:</span> R$ {costs.lucroBruto.toFixed(2)}</div>
                  <div className="flex justify-between font-bold"><span className="text-foreground">Lucro Líquido:</span> R$ {costs.lucroLiquido.toFixed(2)}</div>
                </CollapsibleContent>
              </div>
            </Collapsible>

          </CardContent>
        </Card>

        {/* Card Modelo */}
        <Card className="card-gradient border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Box className="h-5 w-5 text-primary" /> Modelo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do STL *</Label>
              <Input id="name" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input id="quantidade" type="number" value={formData.quantidade} onChange={handleInputChange} min="1" step="1" />
              </div>
              <div className="space-y-2">
                <Label>Tempo de Impressão</Label>
                <div className="flex gap-2">
                  <Input id="tempoImpressaoHoras" type="number" value={formData.tempoImpressaoHoras} onChange={handleInputChange} placeholder="Horas" />
                  <Input id="tempoImpressaoMinutos" type="number" value={formData.tempoImpressaoMinutos} onChange={handleInputChange} placeholder="Min" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pesoEstimadoG">Peso Estimado (g)</Label>
                <Input id="pesoEstimadoG" type="number" step="0.1" value={formData.pesoEstimadoG} onChange={handleInputChange} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stl">Arquivo STL (Opcional)</Label>
              <Input id="stl" type="file" accept=".stl" onChange={(e) => setStlFile(e.target.files?.[0] || null)} />
            </div>
          </CardContent>
        </Card>
        
        {/* Card Custos */}
        <Card className="card-gradient border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Custos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">Material</Label>
                <Input id="material" value={formData.material} onChange={handleInputChange} placeholder="Ex: PLA, ABS..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custoKgFilamento">Custo por Kg de Filamento (R$)</Label>
                <Input id="custoKgFilamento" type="number" step="0.01" value={formData.custoKgFilamento} onChange={handleInputChange} placeholder="0.00" />
              </div>
            </div>
            <CardTitle className="flex items-center gap-2 text-lg pt-4"><Timer className="h-4 w-4" /> Impressora</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="potenciaImpressoraW">Potência da Impressora (W)</Label>
                <Input id="potenciaImpressoraW" type="number" value={formData.potenciaImpressoraW} onChange={handleInputChange} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custoKWh">Custo por KWh (R$)</Label>
                <Input id="custoKWh" type="number" step="0.01" value={formData.custoKWh} onChange={handleInputChange} placeholder="0.00" />
              </div>
            </div>
            <CardTitle className="flex items-center gap-2 text-lg pt-4"><Bolt className="h-4 w-4" /> Custo Fixo</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custoFixoMes">Custo Fixo por Mês (R$)</Label>
                <Input id="custoFixoMes" type="number" step="0.01" value={formData.custoFixoMes} onChange={handleInputChange} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidadesMes">Unidades/Mês</Label>
                <Input id="unidadesMes" type="number" value={formData.unidadesMes} onChange={handleInputChange} placeholder="0" />
              </div>
            </div>
            <CardTitle className="flex items-center gap-2 text-lg pt-4"><TrendingDown className="h-4 w-4" /> Amortização</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valorImpressora">Valor da Impressora 3D (R$)</Label>
                <Input id="valorImpressora" type="number" step="0.01" value={formData.valorImpressora} onChange={handleInputChange} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vidaUtilHoras">Vida Útil (horas)</Label>
                <Input id="vidaUtilHoras" type="number" value={formData.vidaUtilHoras} onChange={handleInputChange} placeholder="0" />
              </div>
            </div>
            <CardTitle className="flex items-center gap-2 text-lg pt-4"><Percent className="h-4 w-4" /> Percentual de Falhas</CardTitle>
            <div className="space-y-2">
              <Label htmlFor="percentualFalhas">Percentual de Falhas (%)</Label>
              <Input id="percentualFalhas" type="number" value={formData.percentualFalhas} onChange={handleInputChange} placeholder="0" />
            </div>
            <CardTitle className="flex items-center gap-2 text-lg pt-4"><Package className="h-4 w-4" /> Acessórios e Embalagem</CardTitle>
            <div className="space-y-2">
              <Label htmlFor="custoAcessorios">Custo Acessórios (R$)</Label>
              <Input id="custoAcessorios" type="number" step="0.01" value={formData.custoAcessorios} onChange={handleInputChange} placeholder="0.00" />
            </div>
          </CardContent>
        </Card>

        {/* Card Configuração de Preços */}
        <Card className="card-gradient border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Configuração de Preços</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="markup">Markup (x)</Label>
                <Input id="markup" type="number" step="0.1" value={formData.markup} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imposto">Imposto (%)</Label>
                <Input id="imposto" type="number" value={formData.imposto} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxaPagamento">Taxa de Pagamento (%)</Label>
                <Input id="taxaPagamento" type="number" value={formData.taxaPagamento} onChange={handleInputChange} />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch id="incluirImpostos" checked={formData.incluirImpostos} onCheckedChange={(checked) => setFormData(prev => ({...prev, incluirImpostos: checked}))} />
              <Label htmlFor="incluirImpostos">Incluir imposto e taxa de pagamento no preço final</Label>
            </div>
          </CardContent>
        </Card>

        {/* Botão Salvar */}
        <Button type="submit" className="w-full gap-2" disabled={loading}>
          <Save className="h-4 w-4" />
          {loading ? "Salvando..." : "Salvar no GK"}
        </Button>
      </form>
    </div>
  );
}
