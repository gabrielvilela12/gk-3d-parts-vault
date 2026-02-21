import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Save, Box, ChevronDown, Edit, Plus, Trash, Palette, Package } from "lucide-react";

// Interface para os inputs do formulário
interface FormData {
  name: string;
  quantidade: number;
  tempoImpressaoHoras: string;
  tempoImpressaoMinutos: string;
  pesoEstimadoG: string;
  material: string;
  category: string;
  notes: string;
  makerworldUrl: string;
}

// Interface para custos padrão (carregados de Configurações)
interface CostDefaults {
  custoKgFilamento: number;
  potenciaImpressoraW: number;
  custoKWh: number;
  custoFixoMes: number;
  unidadesMes: number;
  valorImpressora: number;
  vidaUtilHoras: number;
  percentualFalhas: number;
  custoAcessorios: number;
  markup: number;
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

interface AddPieceProps {
  isEditMode?: boolean;
}

interface ExistingFiles {
  stl_url: string | null;
  image_url: string | null;
}

interface MiningProduct {
  id: string;
  name: string;
}

interface Filament {
  id: string;
  name: string;
  color: string | null;
  custo_kg: number;
}

interface PriceVariation {
  id?: string;
  variation_name: string;
  custo_kg_filamento: string;
  peso_g: string;
  tempo_impressao_horas: string;
  tempo_impressao_minutos: string;
  calculated_cost: number;
  calculated_price: number;
}

// Calcular preço Shopee (sempre com frete grátis = 20%)
function calcShopeePrice(custoUnitario: number, markup: number, quantidade: number) {
  const COMISSAO = 0.20;
  const TAXA_FIXA_PADRAO = 7.00;
  const TAXA_FIXA_MINIMA = 2.00;
  const LIMITE_PRECO_TAXA_MINIMA = 8.00;
  const LIMITE_COMISSAO_REAIS = 100.00;

  const precoBase = (custoUnitario * markup) * quantidade;
  let taxaFixa = TAXA_FIXA_PADRAO;
  let precoConsumidor = (precoBase + taxaFixa) / (1 - COMISSAO);

  if (precoConsumidor < LIMITE_PRECO_TAXA_MINIMA) {
    taxaFixa = TAXA_FIXA_MINIMA;
    precoConsumidor = (precoBase + taxaFixa) / (1 - COMISSAO);
  }

  let comissaoEmReais = precoConsumidor * COMISSAO;
  if (comissaoEmReais > LIMITE_COMISSAO_REAIS) {
    comissaoEmReais = LIMITE_COMISSAO_REAIS;
    precoConsumidor = (custoUnitario * quantidade) + comissaoEmReais + taxaFixa;
  }

  const lucroLiquido = precoConsumidor - (custoUnitario * quantidade) - comissaoEmReais - taxaFixa;

  return { precoConsumidor, comissaoEmReais, taxaFixa, lucroLiquido };
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

  const [miningProducts, setMiningProducts] = useState<MiningProduct[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [priceVariations, setPriceVariations] = useState<PriceVariation[]>([]);

  const [costDefaults, setCostDefaults] = useState<CostDefaults>({
    custoKgFilamento: 100,
    potenciaImpressoraW: 1300,
    custoKWh: 0.5,
    custoFixoMes: 0,
    unidadesMes: 0,
    valorImpressora: 5000,
    vidaUtilHoras: 15000,
    percentualFalhas: 2,
    custoAcessorios: 2,
    markup: 1.5,
  });

  const [formData, setFormData] = useState<FormData>({
    name: "",
    quantidade: 1,
    tempoImpressaoHoras: "",
    tempoImpressaoMinutos: "",
    pesoEstimadoG: "",
    material: "PETG",
    category: "",
    notes: "",
    makerworldUrl: "",
  });

  const [costs, setCosts] = useState<CalculatedCosts>({
    custoMaterial: 0, custoEnergia: 0, custoFixoUnitario: 0, custoAmortizacao: 0,
    custoAcessorios: 0, custoFalhas: 0, custoUnitario: 0, precoConsumidor: 0,
    lucroBruto: 0, lucroLiquido: 0,
  });

  const [tempoTotalMinutos, setTempoTotalMinutos] = useState(0);

  // Fetch initial data
  useEffect(() => {
    const fetchAll = async () => {
      const [miningRes, filRes, presetRes] = await Promise.all([
        supabase.from("mining_products").select("id, name").order("name", { ascending: true }),
        supabase.from("filaments").select("*").order("name", { ascending: true }),
        supabase.from("calculation_presets").select("*").eq("preset_name", "default").maybeSingle(),
      ]);

      setMiningProducts(miningRes.data || []);
      setFilaments((filRes.data as any[]) || []);

      if (presetRes.data) {
        const d = presetRes.data;
        setCostDefaults({
          custoKgFilamento: d.custo_kwh || 100, // fallback
          potenciaImpressoraW: d.potencia_impressora_w || 1300,
          custoKWh: d.custo_kwh || 0.5,
          custoFixoMes: d.custo_fixo_mes || 0,
          unidadesMes: d.unidades_mes || 0,
          valorImpressora: d.valor_impressora || 5000,
          vidaUtilHoras: d.vida_util_horas || 15000,
          percentualFalhas: d.percentual_falhas || 2,
          custoAcessorios: d.custo_acessorios || 2,
          markup: d.markup || 1.5,
        });
      }
    };
    fetchAll();
  }, []);

  // Fetch piece data in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const fetchPiece = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.from("pieces").select("*").eq("id", id).single();
          if (error) throw error;
          if (data) {
            const { data: variations } = await supabase
              .from("piece_price_variations" as any).select("*").eq("piece_id", id);
            if (variations) {
              setPriceVariations(variations.map((v: any) => ({
                id: v.id, variation_name: v.variation_name,
                custo_kg_filamento: v.custo_kg_filamento?.toString() || "",
                peso_g: v.peso_g?.toString() || "",
                tempo_impressao_horas: Math.floor((v.tempo_impressao_min || 0) / 60).toString(),
                tempo_impressao_minutos: ((v.tempo_impressao_min || 0) % 60).toString(),
                calculated_cost: v.calculated_cost || 0, calculated_price: v.calculated_price || 0,
              })));
            }
            const totalMinutes = (data as any).tempo_impressao_min || 0;
            setFormData(prev => ({
              ...prev,
              name: data.name || "", material: data.material || "PETG",
              category: (data as any).category || "",
              pesoEstimadoG: (data as any).peso_g?.toString() || "",
              tempoImpressaoHoras: Math.floor(totalMinutes / 60) > 0 ? Math.floor(totalMinutes / 60).toString() : "",
              tempoImpressaoMinutos: (totalMinutes % 60) > 0 ? (totalMinutes % 60).toString() : "",
              notes: data.notes || "", makerworldUrl: (data as any).makerworld_url || "",
            }));
            setOriginalNotes(data.notes || "");
            setExistingFiles({ stl_url: data.stl_url, image_url: data.image_url });
          }
        } catch (error: any) {
          toast({ title: "Erro ao carregar peça", description: error.message, variant: "destructive" });
          navigate("/catalog");
        } finally {
          setLoading(false);
        }
      };
      fetchPiece();
    }
  }, [isEditMode, id, toast, navigate]);

  // Calculate costs based on defaults (using first filament price as reference for the main cost)
  useEffect(() => {
    const peso = parseFloat(formData.pesoEstimadoG) || 0;
    const horas = parseFloat(formData.tempoImpressaoHoras) || 0;
    const minutos = parseFloat(formData.tempoImpressaoMinutos) || 0;
    const tempoTotalHoras = horas + (minutos / 60);
    setTempoTotalMinutos(tempoTotalHoras * 60);

    const d = costDefaults;
    const quantidade = formData.quantidade || 1;

    // Use first filament price or default 100
    const custoKg = filaments.length > 0 ? filaments[0].custo_kg : 100;
    const custoMaterial = (peso / 1000) * custoKg;
    const custoEnergia = (d.potenciaImpressoraW / 1000) * tempoTotalHoras * d.custoKWh;
    const custoFixoUnitario = d.unidadesMes > 0 ? d.custoFixoMes / d.unidadesMes : 0;
    const custoAmortizacao = d.vidaUtilHoras > 0 ? (d.valorImpressora / d.vidaUtilHoras) * tempoTotalHoras : 0;
    const custoVariavel = custoMaterial + custoEnergia;
    const custoFalhas = custoVariavel * (d.percentualFalhas / 100);
    const custoUnitario = custoMaterial + custoEnergia + custoFixoUnitario + custoAmortizacao + d.custoAcessorios + custoFalhas;

    const shopee = calcShopeePrice(custoUnitario, d.markup, quantidade);

    setCosts({
      custoMaterial, custoEnergia, custoFixoUnitario, custoAmortizacao,
      custoAcessorios: d.custoAcessorios, custoFalhas, custoUnitario,
      precoConsumidor: shopee.precoConsumidor,
      lucroBruto: shopee.precoConsumidor - (custoUnitario * quantidade),
      lucroLiquido: shopee.lucroLiquido,
    });
  }, [formData, costDefaults, filaments]);

  // Calculate filament cost report
  const calculateFilamentCosts = () => {
    const peso = parseFloat(formData.pesoEstimadoG) || 0;
    const horas = parseFloat(formData.tempoImpressaoHoras) || 0;
    const minutos = parseFloat(formData.tempoImpressaoMinutos) || 0;
    const tempoTotalHoras = horas + (minutos / 60);

    if (peso <= 0 && tempoTotalHoras <= 0) return [];

    const d = costDefaults;
    const quantidade = formData.quantidade || 1;

    return filaments.map(filament => {
      const custoMaterial = (peso / 1000) * filament.custo_kg;
      const custoEnergia = (d.potenciaImpressoraW / 1000) * tempoTotalHoras * d.custoKWh;
      const custoFixoUnitario = d.unidadesMes > 0 ? d.custoFixoMes / d.unidadesMes : 0;
      const custoAmortizacao = d.vidaUtilHoras > 0 ? (d.valorImpressora / d.vidaUtilHoras) * tempoTotalHoras : 0;
      const custoVariavel = custoMaterial + custoEnergia;
      const custoFalhas = custoVariavel * (d.percentualFalhas / 100);
      const custoUnitario = custoMaterial + custoEnergia + custoFixoUnitario + custoAmortizacao + d.custoAcessorios + custoFalhas;

      const shopee = calcShopeePrice(custoUnitario, d.markup, quantidade);

      return {
        ...filament,
        custoMaterial,
        custoEnergia,
        custoAmortizacao,
        custoFalhas,
        custoUnitario,
        precoConsumidor: shopee.precoConsumidor,
        comissaoShopee: shopee.comissaoEmReais,
        taxaFixaShopee: shopee.taxaFixa,
        lucroLiquido: shopee.lucroLiquido,
      };
    });
  };

  const filamentCosts = calculateFilamentCosts();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // Price variation functions
  const addPriceVariation = () => {
    const newVariation: PriceVariation = {
      variation_name: "",
      custo_kg_filamento: filaments.length > 0 ? filaments[0].custo_kg.toString() : "100",
      peso_g: formData.pesoEstimadoG,
      tempo_impressao_horas: formData.tempoImpressaoHoras,
      tempo_impressao_minutos: formData.tempoImpressaoMinutos,
      calculated_cost: 0, calculated_price: 0,
    };
    const calculated = calculateVariationCosts(newVariation);
    setPriceVariations([...priceVariations, { ...newVariation, ...calculated }]);
  };

  const removePriceVariation = (index: number) => {
    setPriceVariations(priceVariations.filter((_, i) => i !== index));
  };

  const calculateVariationCosts = (variation: PriceVariation) => {
    const p = (v: string) => parseFloat(v) || 0;
    const peso = p(variation.peso_g);
    const horas = p(variation.tempo_impressao_horas);
    const minutos = p(variation.tempo_impressao_minutos);
    const tempoTotalHoras = horas + (minutos / 60);
    const d = costDefaults;
    const quantidade = formData.quantidade || 1;

    const custoMaterial = (peso / 1000) * p(variation.custo_kg_filamento);
    const custoEnergia = (d.potenciaImpressoraW / 1000) * tempoTotalHoras * d.custoKWh;
    const custoFixoUnitario = d.unidadesMes > 0 ? d.custoFixoMes / d.unidadesMes : 0;
    const custoAmortizacao = d.vidaUtilHoras > 0 ? (d.valorImpressora / d.vidaUtilHoras) * tempoTotalHoras : 0;
    const custoVariavel = custoMaterial + custoEnergia;
    const custoFalhas = custoVariavel * (d.percentualFalhas / 100);
    const custoUnitario = custoMaterial + custoEnergia + custoFixoUnitario + custoAmortizacao + d.custoAcessorios + custoFalhas;

    const shopee = calcShopeePrice(custoUnitario, d.markup, quantidade);

    return { calculated_cost: custoUnitario, calculated_price: shopee.precoConsumidor };
  };

  const updatePriceVariation = (index: number, field: string, value: string) => {
    const updated = [...priceVariations];
    updated[index] = { ...updated[index], [field]: value };
    const calculated = calculateVariationCosts(updated[index]);
    updated[index] = { ...updated[index], ...calculated };
    setPriceVariations(updated);
  };

  // Recalculate variations when defaults change
  useEffect(() => {
    if (priceVariations.length > 0) {
      const updated = priceVariations.map(v => ({ ...v, ...calculateVariationCosts(v) }));
      setPriceVariations(updated);
    }
  }, [costDefaults, formData.quantidade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let stlUrl = existingFiles.stl_url;
      let imageUrl = existingFiles.image_url;

      if (stlFile) {
        const stlPath = `${user.id}/${Date.now()}-${stlFile.name}`;
        const { error: stlError } = await supabase.storage.from("stl-files").upload(stlPath, stlFile);
        if (stlError) throw stlError;
        const { data: stlData } = supabase.storage.from("stl-files").getPublicUrl(stlPath);
        stlUrl = stlData.publicUrl;
      }

      if (imageFile) {
        const imagePath = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: imageError } = await supabase.storage.from("piece-images").upload(imagePath, imageFile);
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
        const { error: updateError } = await supabase.from("pieces").update(pieceData).eq("id", id);
        if (updateError) throw updateError;

        await supabase.from("piece_price_variations" as any).delete().eq("piece_id", id);

        if (priceVariations.length > 0) {
          const variationsToInsert = priceVariations.map(v => ({
            user_id: user.id, piece_id: id, variation_name: v.variation_name,
            custo_kg_filamento: parseFloat(v.custo_kg_filamento) || 0,
            peso_g: parseFloat(v.peso_g) || null,
            tempo_impressao_min: (parseInt(v.tempo_impressao_horas) * 60 || 0) + (parseInt(v.tempo_impressao_minutos) || 0),
            calculated_cost: calculateVariationCosts(v).calculated_cost,
            calculated_price: calculateVariationCosts(v).calculated_price,
          }));
          await supabase.from("piece_price_variations" as any).insert(variationsToInsert as any);
        }

        toast({ title: "Peça atualizada!", description: "Alterações salvas com sucesso." });
        navigate(`/piece/${id}`);
      } else {
        const { data: insertedPiece, error: insertError } = await supabase.from("pieces").insert({
          ...pieceData, width: null, height: null, depth: null,
        }).select().single();
        if (insertError) throw insertError;

        if (priceVariations.length > 0 && insertedPiece) {
          const variationsToInsert = priceVariations.map(v => ({
            user_id: user.id, piece_id: insertedPiece.id, variation_name: v.variation_name,
            custo_kg_filamento: parseFloat(v.custo_kg_filamento) || 0,
            peso_g: parseFloat(v.peso_g) || null,
            tempo_impressao_min: (parseInt(v.tempo_impressao_horas) * 60 || 0) + (parseInt(v.tempo_impressao_minutos) || 0),
            calculated_cost: calculateVariationCosts(v).calculated_cost,
            calculated_price: calculateVariationCosts(v).calculated_price,
          }));
          await supabase.from("piece_price_variations" as any).insert(variationsToInsert as any);
        }

        toast({ title: "Peça cadastrada!", description: "Adicionada ao catálogo com sucesso" });
        navigate("/catalog");
      }
    } catch (error: any) {
      toast({ title: isEditMode ? "Erro ao atualizar" : "Erro ao cadastrar", description: error.message, variant: "destructive" });
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
            <CardDescription>Cálculo automático com taxas Shopee (20% + R$ 7,00)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Collapsible asChild>
              <div className="p-4 bg-muted/30 rounded-lg">
                <CollapsibleTrigger className="w-full text-left flex flex-col items-start">
                  <CardDescription>Custo Unitário</CardDescription>
                  <p className="text-3xl font-bold">R$ {costs.custoUnitario.toFixed(2)}</p>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">Ver detalhamento <ChevronDown className="h-4 w-4" /></div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Filamento:</span> R$ {costs.custoMaterial.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Energia:</span> R$ {costs.custoEnergia.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Acessórios:</span> R$ {costs.custoAcessorios.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo Fixo:</span> R$ {costs.custoFixoUnitario.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amortização:</span> R$ {costs.custoAmortizacao.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Falhas:</span> R$ {costs.custoFalhas.toFixed(2)}</div>
                  <div className="flex justify-between font-bold border-t border-border mt-1 pt-1"><span>Total:</span> R$ {costs.custoUnitario.toFixed(2)}</div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible asChild>
              <div className="p-4 bg-muted/30 rounded-lg">
                <CollapsibleTrigger className="w-full text-left flex flex-col items-start">
                  <CardDescription>Preço Shopee (x{formData.quantidade})</CardDescription>
                  <p className="text-3xl font-bold text-primary">R$ {costs.precoConsumidor.toFixed(2)}</p>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">Ver detalhamento <ChevronDown className="h-4 w-4" /></div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Preço Final:</span> R$ {costs.precoConsumidor.toFixed(2)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lucro Bruto:</span> R$ {costs.lucroBruto.toFixed(2)}</div>
                  <div className="flex justify-between font-bold"><span>Lucro Líquido:</span> R$ {costs.lucroLiquido.toFixed(2)}</div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Card Relatório Completo por Filamento */}
        {filamentCosts.length > 0 && (
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Relatório de Custos por Filamento
              </CardTitle>
              <CardDescription>
                Preço automático Shopee (20% comissão + R$ 7,00 taxa) para cada filamento • Markup {costDefaults.markup}x
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b border-border">
                  <span className="col-span-2">Filamento</span>
                  <span className="text-right">Material</span>
                  <span className="text-right">Custo Unit.</span>
                  <span className="text-right">Preço Shopee</span>
                  <span className="text-right">Lucro</span>
                </div>
                {filamentCosts.map((fc) => (
                  <Collapsible key={fc.id} asChild>
                    <div className="border-b border-border/30">
                      <CollapsibleTrigger className="w-full">
                        <div className="grid grid-cols-6 gap-2 text-sm py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                          <span className="col-span-2 font-medium text-left">
                            {fc.name}{fc.color ? ` (${fc.color})` : ""}
                          </span>
                          <span className="text-right text-muted-foreground">R$ {fc.custoMaterial.toFixed(2)}</span>
                          <span className="text-right">R$ {fc.custoUnitario.toFixed(2)}</span>
                          <span className="text-right font-semibold text-primary">R$ {fc.precoConsumidor.toFixed(2)}</span>
                          <span className={`text-right font-semibold ${fc.lucroLiquido >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                            R$ {fc.lucroLiquido.toFixed(2)}
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="p-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground block">Energia</span>
                            <span className="font-medium">R$ {fc.custoEnergia.toFixed(2)}</span>
                          </div>
                          <div className="p-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground block">Amortização</span>
                            <span className="font-medium">R$ {fc.custoAmortizacao.toFixed(2)}</span>
                          </div>
                          <div className="p-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground block">Comissão Shopee</span>
                            <span className="font-medium">R$ {fc.comissaoShopee.toFixed(2)}</span>
                          </div>
                          <div className="p-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground block">Taxa Fixa</span>
                            <span className="font-medium">R$ {fc.taxaFixaShopee.toFixed(2)}</span>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
              <Input id="name" value={formData.name} onChange={handleInputChange} required list="mining-products-list" placeholder="Digite ou selecione um produto minerado..." />
              <datalist id="mining-products-list">
                {miningProducts.map((product) => (<option key={product.id} value={product.name} />))}
              </datalist>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" value={formData.category} onChange={handleInputChange} placeholder="Ex: Decoração, Utilidades..." list="category-suggestions" />
                <datalist id="category-suggestions">
                  <option value="Decoração" /><option value="Utilidades" /><option value="Ferramentas" />
                  <option value="Brinquedos" /><option value="Protótipos" /><option value="Peças de Reposição" />
                  <option value="Arte" /><option value="Organização" /><option value="Outros" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">Material</Label>
                <Input id="material" value={formData.material} onChange={handleInputChange} placeholder="Ex: PLA, PETG..." />
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
              <Input id="notes" value={formData.notes} onChange={handleInputChange} placeholder="Ex: Detalhes adicionais..." />
              {isEditMode && !formData.notes && originalNotes && (
                <p className="text-xs text-muted-foreground">Observação antiga: "{originalNotes}"</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card Variações de Preço */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Variações de Preço
                </CardTitle>
                <CardDescription className="mt-1">
                  Adicione variações por cor, material, tamanho ou outros atributos
                </CardDescription>
              </div>
              <Button type="button" onClick={addPriceVariation} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {priceVariations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma variação cadastrada. Clique em "Adicionar" para criar variações.
              </p>
            ) : (
              priceVariations.map((variation, index) => (
                <Card key={index} className="border-border/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <Label className="text-base">Variação #{index + 1}</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePriceVariation(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome da Variação</Label>
                        <Input placeholder="Ex: PETG Preto, Tamanho Grande..." value={variation.variation_name} onChange={(e) => updatePriceVariation(index, 'variation_name', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Custo por Kg (R$)</Label>
                          <Input type="number" step="0.01" placeholder="0.00" value={variation.custo_kg_filamento} onChange={(e) => updatePriceVariation(index, 'custo_kg_filamento', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Peso (g)</Label>
                          <Input type="number" step="0.01" placeholder="0.00" value={variation.peso_g} onChange={(e) => updatePriceVariation(index, 'peso_g', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Tempo de Impressão</Label>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="h" value={variation.tempo_impressao_horas} onChange={(e) => updatePriceVariation(index, 'tempo_impressao_horas', e.target.value)} className="w-20" />
                            <span className="flex items-center text-muted-foreground">:</span>
                            <Input type="number" placeholder="min" value={variation.tempo_impressao_minutos} onChange={(e) => updatePriceVariation(index, 'tempo_impressao_minutos', e.target.value)} className="w-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Custo de Produção</Label>
                        <p className="text-lg font-semibold">R$ {variation.calculated_cost.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Preço Shopee</Label>
                        <p className="text-lg font-semibold text-primary">R$ {variation.calculated_price.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
