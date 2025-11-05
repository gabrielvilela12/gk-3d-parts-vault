import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Save, DollarSign, Box, Timer, Bolt, TrendingDown, Settings, Percent, Package, ChevronDown, Edit } from "lucide-react";

// Interface para os inputs do formulário
interface FormData {
  name: string;
  quantidade: number;
  tempoImpressaoHoras: string;
  tempoImpressaoMinutos: string;
  pesoEstimadoG: string;
  material: string;
  category: string;
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
  notes: string;
  makerworldUrl: string;
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

// Interface para as props do componente
interface AddPieceProps {
  isEditMode?: boolean;
}

// URLs para manter o estado dos arquivos existentes
interface ExistingFiles {
  stl_url: string | null;
  image_url: string | null;
}

// Interface para os produtos minerados (para o autocomplete)
interface MiningProduct {
  id: string;
  name: string;
}

export default function AddPiece({ isEditMode = false }: AddPieceProps) {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stlFile, setStlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingFiles, setExistingFiles] = useState<ExistingFiles>({ stl_url: null, image_url: null });
  const [originalNotes, setOriginalNotes] = useState(""); 
  
  // --- NOVO ESTADO PARA OS PRODUTOS MINERADOS ---
  const [miningProducts, setMiningProducts] = useState<MiningProduct[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    quantidade: 1,
    tempoImpressaoHoras: "",
    tempoImpressaoMinutos: "",
    pesoEstimadoG: "",
    material: "PETG",
    category: "",
    custoKgFilamento: "100",
    potenciaImpressoraW: "1300",
    custoKWh: "0.5",
    custoFixoMes: "",
    unidadesMes: "",
    valorImpressora: "5000",
    vidaUtilHoras: "15000",
    percentualFalhas: "2",
    custoAcessorios: "2",
    markup: "1.5",
    imposto: "",
    taxaPagamento: "15",
    incluirImpostos: true,
    notes: "",
    makerworldUrl: "",
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

  const [tempoTotalMinutos, setTempoTotalMinutos] = useState(0);

  // --- NOVO useEffect PARA BUSCAR PRODUTOS MINERADOS ---
  useEffect(() => {
    const fetchMiningProducts = async () => {
      try {
        const { data, error } = await supabase
          .from("mining_products")
          .select("id, name")
          .order("name", { ascending: true });
        
        if (error) throw error;
        setMiningProducts(data || []);
      } catch (error: any) {
        console.error("Erro ao buscar produtos minerados:", error.message);
      }
    };
    
    fetchMiningProducts();
  }, []);

  // Busca dados da peça se estiver em modo de edição
  useEffect(() => {
    if (isEditMode && id) {
      const fetchPiece = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from("pieces")
            .select("*")
            .eq("id", id)
            .single();
  
          if (error) throw error;
  
          if (data) {
            const totalMinutes = (data as any).tempo_impressao_min || 0;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
  
            // Extrair valores das notes se existirem
            let extractedMarkup = "";
            let extractedImposto = "";
            let extractedTaxa = "";
            if (data.notes) {
              const markupMatch = data.notes.match(/Markup:\s*([0-9.]+)/i);
              const impostoMatch = data.notes.match(/Imposto:\s*([0-9.]+)/i);
              const taxaMatch = data.notes.match(/Taxa:\s*([0-9.]+)/i);
              
              if (markupMatch) extractedMarkup = markupMatch[1];
              if (impostoMatch) extractedImposto = impostoMatch[1];
              if (taxaMatch) extractedTaxa = taxaMatch[1];
            }

            setFormData(prev => ({
              ...prev, 
              name: data.name || "",
              material: data.material || "PETG",
              category: (data as any).category || "",
              pesoEstimadoG: (data as any).peso_g?.toString() || "",
              tempoImpressaoHoras: hours > 0 ? hours.toString() : "",
              tempoImpressaoMinutos: minutes > 0 ? minutes.toString() : "",
              notes: data.notes || "",
              makerworldUrl: (data as any).makerworld_url || "",
              custoKgFilamento: prev.custoKgFilamento || "100", // Manter padrão se não houver
              custoFixoMes: "",
              unidadesMes: "",
              custoAcessorios: (data as any).custo_acessorios?.toString() || prev.custoAcessorios || "2",
              markup: extractedMarkup || prev.markup || "1.5",
              imposto: extractedImposto,
              taxaPagamento: extractedTaxa || prev.taxaPagamento || "15",
            }));
            
            setOriginalNotes(data.notes || "");
            setExistingFiles({ stl_url: data.stl_url, image_url: data.image_url });
          }
        } catch (error: any) {
          toast({
            title: "Erro ao carregar dados da peça",
            description: error.message,
            variant: "destructive",
          });
          navigate("/catalog");
        } finally {
          setLoading(false);
        }
      };
      fetchPiece();
    }
  }, [isEditMode, id, toast, navigate]);


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
    setTempoTotalMinutos(tempoTotalHoras * 60); 
    
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { 
    const { id, value, type } = e.target;
    // @ts-ignore
    setFormData(prev => ({
      ...prev,
      [id]: type === "number" ? value : value
    }));
  };
  
  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, incluirImpostos: checked }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let stlUrl = existingFiles.stl_url; 
      let imageUrl = existingFiles.image_url;

      if (stlFile) {
        const stlPath = `${user.id}/${Date.now()}-${stlFile.name}`;
        const { error: stlError } = await supabase.storage
          .from("stl-files")
          .upload(stlPath, stlFile);
        if (stlError) throw stlError;
        const { data: stlData } = supabase.storage.from("stl-files").getPublicUrl(stlPath);
        stlUrl = stlData.publicUrl;
      }

      if (imageFile) {
        const imagePath = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: imageError } = await supabase.storage
          .from("piece-images")
          .upload(imagePath, imageFile);
        if (imageError) throw imageError;
        const { data: imageData } = supabase.storage.from("piece-images").getPublicUrl(imagePath);
        imageUrl = imageData.publicUrl;
      }

      const pieceData = {
        user_id: user.id,
        name: formData.name,
        material: formData.material,
        category: formData.category || null,
        stl_url: stlUrl,
        image_url: imageUrl,
        notes: formData.notes,
        cost: costs.custoUnitario,
        peso_g: parseFloat(formData.pesoEstimadoG) || null,
        tempo_impressao_min: tempoTotalMinutos || null,
        custo_material: costs.custoMaterial || null,
        custo_energia: costs.custoEnergia || null,
        preco_venda: costs.precoConsumidor || null,
        lucro_liquido: costs.lucroLiquido || null,
        makerworld_url: formData.makerworldUrl || null,
        custo_acessorios: costs.custoAcessorios || null,
      } as any;

      if (isEditMode && id) {
        const { error: updateError } = await supabase
          .from("pieces")
          .update(pieceData)
          .eq("id", id);
  
        if (updateError) throw updateError;
  
        toast({
          title: "Peça atualizada!",
          description: "As alterações foram salvas com sucesso.",
        });
        navigate(`/piece/${id}`); 

      } else {
        const { error: insertError } = await supabase.from("pieces").insert({
          ...pieceData,
          width: null,
          height: null,
          depth: null,
        });
  
        if (insertError) throw insertError;
  
        toast({
          title: "Peça cadastrada!",
          description: "A peça foi adicionada ao catálogo com sucesso",
        });
        navigate("/catalog");
      }

    } catch (error: any) {
      toast({
        title: isEditMode ? "Erro ao atualizar peça" : "Erro ao cadastrar peça",
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
          <CardHeader>
            <CardTitle>{isEditMode ? "Recalcular Preços" : "Resumo de Preços"}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isEditMode ? <Edit className="h-5 w-5 text-primary" /> : <Box className="h-5 w-5 text-primary" />}
              {isEditMode ? "Editar Modelo" : "Modelo"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do STL *</Label>
              {/* --- INPUT MODIFICADO COM DATALIST --- */}
              <Input 
                id="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                required 
                list="mining-products-list" 
                placeholder="Digite ou selecione um produto minerado..."
              />
              <datalist id="mining-products-list">
                {miningProducts.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
              {/* --- FIM DA MODIFICAÇÃO --- */}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input 
                  id="category" 
                  value={formData.category} 
                  onChange={handleInputChange} 
                  placeholder="Ex: Decoração, Utilidades, Ferramentas..." 
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  <option value="Decoração" />
                  <option value="Utilidades" />
                  <option value="Ferramentas" />
                  <option value="Brinquedos" />
                  <option value="Protótipos" />
                  <option value="Peças de Reposição" />
                  <option value="Arte" />
                  <option value="Organização" />
                  <option value="Outros" />
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input id="quantidade" type="number" value={formData.quantidade} onChange={handleInputChange} min="1" step="1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {isEditMode && existingFiles.stl_url && !stlFile && (
                <p className="text-xs text-muted-foreground">Arquivo atual: <a href={existingFiles.stl_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Ver STL</a></p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Foto da Peça (Opcional)</Label>
              <Input id="image" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              {isEditMode && existingFiles.image_url && !imageFile && (
                <img src={existingFiles.image_url} alt="Preview" className="w-20 h-20 rounded-md object-cover mt-2" />
              )}
            </div>
             <div className="space-y-2">
              <Label htmlFor="makerworldUrl">Link do Makerworld (Opcional)</Label>
              <Input id="makerworldUrl" type="url" value={formData.makerworldUrl} onChange={handleInputChange} placeholder="https://makerworld.com/..." />
            </div>
             <div className="space-y-2">
              <Label htmlFor="notes">Observações Técnicas</Label>
              <Input id="notes" value={formData.notes} onChange={handleInputChange} placeholder="Ex: Markup: 1.5x, Imposto: 5%" />
              {isEditMode && !formData.notes && originalNotes && (
                 <p className="text-xs text-muted-foreground">Observação antiga: "{originalNotes}"</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Card Custos */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Custos</CardTitle>
            {isEditMode && (
              <CardDescription>
                Insira os dados de custo para recalcular a precificação.
              </CardDescription>
            )}
          </CardHeader>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Configuração de Preços</CardTitle>
             {isEditMode && (
              <CardDescription>
                Insira a margem e taxas para recalcular o preço final.
              </CardDescription>
            )}
          </CardHeader>
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
              <Switch id="incluirImpostos" checked={formData.incluirImpostos} onCheckedChange={handleSwitchChange} />
              <Label htmlFor="incluirImpostos">Incluir imposto e taxa de pagamento no preço final</Label>
            </div>
          </CardContent>
        </Card>

        {/* Botão Salvar */}
        <Button type="submit" className="w-full gap-2" disabled={loading}>
          <Save className="h-4 w-4" />
          {loading ? "Salvando..." : (isEditMode ? "Salvar Alterações" : "Salvar no GK")}
        </Button>
      </form>
    </div>
  );
}