import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import JSZip from "jszip";
import {
  ImagePlus, Palette, Download, Loader2, Eye, Package,
  Square, Smartphone, Monitor, X, History, Sparkles, CheckCircle2,
  Megaphone, Zap, Star, Copy, FileText, Tag, Home, Briefcase, Sun, UtensilsCrossed, ThumbsUp, ScanSearch, MessageSquare
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const PRESET_COLORS = [
  { name: "Preto", hex: "#1a1a1a" },
  { name: "Branco", hex: "#f5f5f5" },
  { name: "Vermelho", hex: "#dc2626" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Verde", hex: "#16a34a" },
  { name: "Amarelo", hex: "#eab308" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Roxo", hex: "#9333ea" },
  { name: "Laranja", hex: "#ea580c" },
  { name: "Cinza", hex: "#6b7280" },
  { name: "Marrom", hex: "#92400e" },
  { name: "Bege", hex: "#d4b896" },
  { name: "Azul Claro", hex: "#38bdf8" },
  { name: "Verde Limão", hex: "#84cc16" },
  { name: "Dourado", hex: "#d4a017" },
  { name: "Prata", hex: "#c0c0c0" },
];

const FORMATS = [
  { id: "square", label: "Quadrado", icon: Square, width: 1024, height: 1024 },
  { id: "story", label: "Story", icon: Smartphone, width: 1024, height: 1024 },
  { id: "banner", label: "Banner", icon: Monitor, width: 1024, height: 1024 },
];

const BACKGROUNDS = [
  { id: "white", label: "Fundo Branco", description: "Limpo e minimalista" },
  { id: "promo", label: "Promocional", description: "Com faixa de destaque" },
  { id: "premium", label: "Premium", description: "Gradiente elegante" },
];

const MARKETING_TYPES = [
  { id: "environment_living_room", label: "Sala de Estar", icon: Home, description: "Produto em ambiente de sala de estar aconchegante" },
  { id: "environment_office", label: "Escritório", icon: Briefcase, description: "Produto em ambiente de trabalho moderno" },
  { id: "environment_outdoor", label: "Área Externa", icon: Sun, description: "Produto em ambiente ao ar livre" },
  { id: "environment_kitchen", label: "Cozinha", icon: UtensilsCrossed, description: "Produto em ambiente de cozinha/jantar" },
  { id: "benefit", label: "Benefício", icon: ThumbsUp, description: "Destaca o principal benefício do produto" },
];

interface GeneratedImage {
  colorName: string;
  colorHex: string;
  format: string;
  dataUrl: string;
  width: number;
  height: number;
  type: "recolor" | "marketing";
  marketingType?: string;
}

interface HistoryEntry {
  id: string;
  product_name: string;
  colors: string[];
  background_style: string;
  formats: string[];
  created_at: string;
  generated_images: GeneratedImage[];
}

const RECOLOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recolor-product`;
const MARKETING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-marketing`;
const SHOPEE_TEXT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-shopee-text`;
const IDENTIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify-product`;
const CLEANUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-product-image`;

interface ShopeeText {
  title: string;
  description: string;
  keywords: string[];
}

export default function ImageGenerator() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [cleanedImageData, setCleanedImageData] = useState<string | null>(null);
  const [baseImageData, setBaseImageData] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<typeof PRESET_COLORS>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["square"]);
  const [backgroundStyle, setBackgroundStyle] = useState("white");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [selectedMarketingTypes, setSelectedMarketingTypes] = useState<string[]>([
    "environment_living_room", "environment_office", "environment_outdoor", "environment_kitchen", "benefit"
  ]);
  const [generateShopeeText, setGenerateShopeeText] = useState(true);
  const [benefitPrompt, setBenefitPrompt] = useState("");

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [shopeeText, setShopeeText] = useState<ShopeeText | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState("generator");
  const [resultFilter, setResultFilter] = useState<"all" | "recolor" | "marketing">("all");

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("image_generations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data as unknown as HistoryEntry[]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const imageData = ev.target?.result as string;
      setBaseImageData(imageData);
      // Auto-identify product
      await identifyProduct(imageData);
    };
    reader.readAsDataURL(file);
  };

  const identifyProduct = async (imageData: string) => {
    setIsIdentifying(true);
    try {
      const resp = await fetch(IDENTIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ imageBase64: imageData }),
      });

      if (resp.status === 429) {
        toast({ title: "Rate limit", description: "Aguarde e tente novamente.", variant: "destructive" });
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos no workspace.", variant: "destructive" });
        return;
      }
      if (!resp.ok) {
        console.error("Identify error:", await resp.text());
        toast({ title: "Não foi possível identificar o produto", description: "Preencha manualmente.", variant: "destructive" });
        return;
      }

      const data = await resp.json();
      if (data.name) {
        setProductName(data.name);
        toast({ title: "Produto identificado!", description: data.name });
      }
      if (data.description) {
        setProductDescription(data.description);
      }
    } catch (e) {
      console.error("Identify fetch error:", e);
    } finally {
      setIsIdentifying(false);
    }
  };

  const toggleColor = (color: typeof PRESET_COLORS[0]) => {
    setSelectedColors((prev) =>
      prev.find((c) => c.hex === color.hex)
        ? prev.filter((c) => c.hex !== color.hex)
        : [...prev, color]
    );
  };

  const addCustomColor = () => {
    if (!customColorName.trim()) return;
    const color = { name: customColorName.trim(), hex: customColorHex };
    if (!selectedColors.find((c) => c.hex === color.hex)) {
      setSelectedColors((prev) => [...prev, color]);
    }
    setCustomColorName("");
  };

  const toggleFormat = (formatId: string) => {
    setSelectedFormats((prev) =>
      prev.includes(formatId) ? prev.filter((f) => f !== formatId) : [...prev, formatId]
    );
  };

  const toggleMarketingType = (typeId: string) => {
    setSelectedMarketingTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const callCleanupApi = async (): Promise<string | null> => {
    try {
      const resp = await fetch(CLEANUP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: baseImageData,
          productName,
        }),
      });

      if (resp.status === 429) {
        toast({ title: "Rate limit", description: "Aguarde e tente novamente.", variant: "destructive" });
        return null;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos no workspace.", variant: "destructive" });
        return null;
      }
      if (!resp.ok) {
        console.error("Cleanup error:", await resp.text());
        toast({ title: "Erro ao limpar imagem", description: "Usando imagem original.", variant: "destructive" });
        return null;
      }

      const data = await resp.json();
      return data.imageUrl || null;
    } catch (e) {
      console.error("Cleanup fetch error:", e);
      return null;
    }
  };

  const getWorkingImage = () => cleanedImageData || baseImageData;

  const callRecolorApi = async (
    color: typeof PRESET_COLORS[0],
    format: typeof FORMATS[0]
  ): Promise<string | null> => {
    try {
      const resp = await fetch(RECOLOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: getWorkingImage(),
          colorName: color.name,
          colorHex: color.hex,
          productName,
          backgroundStyle,
          format: format.id,
        }),
      });

      if (resp.status === 429) {
        toast({ title: "Rate limit", description: "Aguarde um momento e tente novamente.", variant: "destructive" });
        return null;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos no workspace.", variant: "destructive" });
        return null;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error("Recolor error:", err);
        return null;
      }

      const data = await resp.json();
      return data.imageUrl || null;
    } catch (e) {
      console.error("Recolor fetch error:", e);
      return null;
    }
  };

  const callMarketingApi = async (marketingType: string, benefitIdx?: number): Promise<string | null> => {
    try {
      const resp = await fetch(MARKETING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: getWorkingImage(),
          productName,
          marketingType,
          ...(marketingType === "benefit" ? { benefitPrompt, benefitIndex: benefitIdx || 1 } : {}),
        }),
      });

      if (resp.status === 429) {
        toast({ title: "Rate limit", description: "Aguarde um momento e tente novamente.", variant: "destructive" });
        return null;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos no workspace.", variant: "destructive" });
        return null;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error("Marketing error:", err);
        return null;
      }

      const data = await resp.json();
      return data.imageUrl || null;
    } catch (e) {
      console.error("Marketing fetch error:", e);
      return null;
    }
  };

  const callShopeeTextApi = async (): Promise<ShopeeText | null> => {
    try {
      const resp = await fetch(SHOPEE_TEXT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          productName,
          imageBase64: getWorkingImage(),
        }),
      });

      if (resp.status === 429) {
        toast({ title: "Rate limit", description: "Aguarde um momento e tente novamente.", variant: "destructive" });
        return null;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos no workspace.", variant: "destructive" });
        return null;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error("Shopee text error:", err);
        return null;
      }

      return await resp.json();
    } catch (e) {
      console.error("Shopee text fetch error:", e);
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!baseImageData) {
      toast({ title: "Envie uma imagem base", variant: "destructive" });
      return;
    }
    if (selectedColors.length === 0 && selectedMarketingTypes.length === 0 && !generateShopeeText) {
      toast({ title: "Selecione cores, ambientes ou texto Shopee", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setShopeeText(null);
    setCleanedImageData(null);
    const results: GeneratedImage[] = [];

    const recolorTotal = selectedColors.length * selectedFormats.length;
    const hasBenefit = selectedMarketingTypes.includes("benefit") && benefitPrompt.trim();
    const environmentTypes = selectedMarketingTypes.filter((t) => t !== "benefit");
    const benefitCount = hasBenefit ? 3 : 0;
    const marketingTotal = environmentTypes.length + benefitCount;
    const shopeeStep = generateShopeeText && productName ? 1 : 0;
    const cleanupStep = 1; // Phase 0: always clean up the image first
    const total = cleanupStep + recolorTotal + marketingTotal + shopeeStep;
    let done = 0;

    // PHASE 0: Clean up image (professional 1024x1024 product photo)
    setProgressLabel(`🧹 Limpando e padronizando imagem (1024x1024)...`);
    setProgress(0);

    const cleanedUrl = await callCleanupApi();
    if (cleanedUrl) {
      setCleanedImageData(cleanedUrl);
    }
    done++;


    // PHASE 1: Recolor images
    if (selectedColors.length > 0 && selectedFormats.length > 0) {
      for (const color of selectedColors) {
        for (const fmtId of selectedFormats) {
          const fmt = FORMATS.find((f) => f.id === fmtId)!;
          setProgressLabel(`🎨 Recolorindo: ${color.name} — ${fmt.label}`);
          setProgress(Math.round((done / total) * 100));

          const imageUrl = await callRecolorApi(color, fmt);
          if (imageUrl) {
            const result: GeneratedImage = {
              colorName: color.name,
              colorHex: color.hex,
              format: fmtId,
              dataUrl: imageUrl,
              width: fmt.width,
              height: fmt.height,
              type: "recolor",
            };
            results.push(result);
            setGeneratedImages([...results]);
          }
          done++;
        }
      }
    }

    // PHASE 2: Environment images
    if (environmentTypes.length > 0) {
      for (const mktType of environmentTypes) {
        const mktLabel = MARKETING_TYPES.find((m) => m.id === mktType)?.label || mktType;
        setProgressLabel(`📸 Gerando: ${mktLabel}`);
        setProgress(Math.round((done / total) * 100));

        const imageUrl = await callMarketingApi(mktType);
        if (imageUrl) {
          const result: GeneratedImage = {
            colorName: mktLabel,
            colorHex: "#ffffff",
            format: "square",
            dataUrl: imageUrl,
            width: 1024,
            height: 1024,
            type: "marketing",
            marketingType: mktType,
          };
          results.push(result);
          setGeneratedImages([...results]);
        }
        done++;
      }
    }

    // PHASE 2b: Benefit images (3 variations)
    if (hasBenefit) {
      for (let i = 1; i <= 3; i++) {
        setProgressLabel(`💡 Gerando Benefício: variação ${i}/3`);
        setProgress(Math.round((done / total) * 100));

        const imageUrl = await callMarketingApi("benefit", i);
        if (imageUrl) {
          const result: GeneratedImage = {
            colorName: `Benefício ${i}`,
            colorHex: "#ffffff",
            format: "square",
            dataUrl: imageUrl,
            width: 1024,
            height: 1024,
            type: "marketing",
            marketingType: "benefit",
          };
          results.push(result);
          setGeneratedImages([...results]);
        }
        done++;
      }
    }

    // PHASE 3: Shopee SEO text
    if (generateShopeeText && productName) {
      setProgressLabel(`📝 Gerando título e descrição Shopee...`);
      setProgress(Math.round((done / total) * 100));

      const textResult = await callShopeeTextApi();
      if (textResult) {
        setShopeeText(textResult);
      }
      done++;
    }

    setProgress(100);
    setIsGenerating(false);

    // Save to history
    const { data: { user } } = await supabase.auth.getUser();
    if (user && results.length > 0) {
      await supabase.from("image_generations").insert({
        user_id: user.id,
        product_name: productName || "Sem nome",
        base_image_url: "ai-generated",
        colors: selectedColors.map((c) => c.name),
        background_style: backgroundStyle,
        formats: selectedFormats,
        generated_images: results.map((r) => ({
          colorName: r.colorName,
          colorHex: r.colorHex,
          format: r.format,
          width: r.width,
          height: r.height,
          type: r.type,
          marketingType: r.marketingType,
        })),
      });
    }

    const imageTotal = recolorTotal + marketingTotal;
    toast({
      title: `${results.length} imagens geradas!${shopeeStep ? " Texto Shopee pronto!" : ""}`,
      description: results.length < imageTotal
        ? `${imageTotal - results.length} falharam. Tente novamente.`
        : "Pronto para download.",
    });
  };

  const downloadAll = async () => {
    if (filteredImages.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder(productName || "imagens")!;

    for (let i = 0; i < filteredImages.length; i++) {
      const img = filteredImages[i];
      const prefix = img.type === "marketing" ? "ambiente" : "cor";
      const fileName = `${productName || "produto"}_${prefix}_${img.colorName}_${img.format}.png`;

      if (img.dataUrl.startsWith("data:")) {
        const base64 = img.dataUrl.split(",")[1];
        folder.file(fileName, base64, { base64: true });
      } else {
        try {
          const resp = await fetch(img.dataUrl);
          const blob = await resp.blob();
          folder.file(fileName, blob);
        } catch {
          console.error("Failed to fetch image for zip:", fileName);
        }
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName || "imagens"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingle = async (img: GeneratedImage) => {
    const prefix = img.type === "marketing" ? "ambiente" : "cor";
    const fileName = `${productName || "produto"}_${prefix}_${img.colorName}_${img.format}.png`;
    if (img.dataUrl.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = img.dataUrl;
      a.download = fileName;
      a.click();
    } else {
      try {
        const resp = await fetch(img.dataUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast({ title: "Erro ao baixar", variant: "destructive" });
      }
    }
  };

  const recolorCount = selectedColors.length * selectedFormats.length;
  const hasBenefitSelected = selectedMarketingTypes.includes("benefit");
  const environmentCount = selectedMarketingTypes.filter((t) => t !== "benefit").length;
  const benefitImageCount = hasBenefitSelected && benefitPrompt.trim() ? 3 : 0;
  const marketingCount = environmentCount + benefitImageCount;
  const totalImages = recolorCount + marketingCount;

  const filteredImages = generatedImages.filter((img) => {
    if (resultFilter === "all") return true;
    return img.type === resultFilter;
  });

  const recolorResults = generatedImages.filter((i) => i.type === "recolor").length;
  const marketingResults = generatedImages.filter((i) => i.type === "marketing").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="page-title">Gerador de Imagens</h1>
              <p className="page-subtitle">Identifica o produto, gera variações de cor, ambientes e texto SEO com IA</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full max-w-xs">
            <TabsTrigger value="generator" className="flex-1 gap-1.5">
              <Sparkles className="h-4 w-4" /> Gerar
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-1.5">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="space-y-6 mt-4">
            <div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
              {/* Left panel */}
              <div className="space-y-5 col-span-1">
                <Card className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Imagem Base</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  {baseImageData ? (
                    <div className="relative group">
                      <img
                        src={baseImageData}
                        alt="Base"
                        className="w-full h-40 object-contain rounded-lg border border-border bg-muted"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setBaseImageData(null); setProductName(""); setProductDescription(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      {isIdentifying && (
                        <div className="absolute inset-0 bg-background/70 rounded-lg flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-medium text-primary">Identificando produto...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para enviar</span>
                      <span className="text-xs text-muted-foreground">A IA identificará o produto automaticamente</span>
                    </button>
                  )}
                </Card>

                {/* Auto-identified product info */}
                <Card className="p-4 space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <ScanSearch className="h-4 w-4" /> Produto Identificado
                  </Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        placeholder={isIdentifying ? "Identificando..." : "Ex: Vaso Decorativo"}
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        disabled={isIdentifying}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <Input
                        placeholder={isIdentifying ? "Identificando..." : "Descrição do produto"}
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        disabled={isIdentifying}
                      />
                    </div>
                  </div>
                  {productName && !isIdentifying && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Produto identificado pela IA
                    </div>
                  )}
                </Card>

                <Card className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Estilo de Fundo (Recolorir)</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {BACKGROUNDS.map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => setBackgroundStyle(bg.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          backgroundStyle === bg.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <p className="text-sm font-medium">{bg.label}</p>
                        <p className="text-xs text-muted-foreground">{bg.description}</p>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Formatos (Recolorir)</Label>
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((fmt) => {
                      const Icon = fmt.icon;
                      const sel = selectedFormats.includes(fmt.id);
                      return (
                        <button
                          key={fmt.id}
                          onClick={() => toggleFormat(fmt.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                            sel
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {fmt.label}
                          {sel && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Right panel */}
              <div className={`space-y-5 ${isMobile ? "col-span-1" : "col-span-2"}`}>
                {/* PHASE 1: Colors */}
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Palette className="h-4 w-4" /> Fase 1: Imagens das Cores
                    </Label>
                    <Badge variant="secondary">{selectedColors.length} cores</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => {
                      const sel = selectedColors.find((c) => c.hex === color.hex);
                      return (
                        <button
                          key={color.hex}
                          onClick={() => toggleColor(color)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            sel
                              ? "ring-2 ring-primary border-primary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-border/50"
                            style={{ backgroundColor: color.hex }}
                          />
                          {color.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Cor personalizada</Label>
                      <Input
                        placeholder="Nome da cor"
                        value={customColorName}
                        onChange={(e) => setCustomColorName(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <input
                      type="color"
                      value={customColorHex}
                      onChange={(e) => setCustomColorHex(e.target.value)}
                      className="h-9 w-12 rounded border border-border cursor-pointer"
                    />
                    <Button size="sm" variant="outline" onClick={addCustomColor} disabled={!customColorName.trim()}>
                      Adicionar
                    </Button>
                  </div>

                  {selectedColors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                      {selectedColors.map((c) => (
                        <Badge
                          key={c.hex}
                          variant="outline"
                          className="gap-1.5 cursor-pointer hover:bg-destructive/10"
                          onClick={() => toggleColor(c)}
                        >
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.hex }} />
                          {c.name}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>

                {/* PHASE 2: Environments + Benefit */}
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Megaphone className="h-4 w-4" /> Fase 2: Ambientes e Benefício
                    </Label>
                    <Badge variant="secondary">{selectedMarketingTypes.length} imagens</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gera o produto em 4 ambientes diferentes + 1 imagem destacando o benefício principal
                  </p>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                     {MARKETING_TYPES.map((mkt) => {
                       const Icon = mkt.icon;
                       const sel = selectedMarketingTypes.includes(mkt.id);
                       return (
                         <button
                           key={mkt.id}
                           onClick={() => toggleMarketingType(mkt.id)}
                           className={`p-3 rounded-lg border text-left transition-all ${
                             sel
                               ? "border-primary bg-primary/5 ring-1 ring-primary"
                               : "border-border hover:border-primary/30"
                           }`}
                         >
                           <div className="flex items-center gap-2 mb-1">
                             <Icon className="h-4 w-4" />
                             <p className="text-sm font-medium">{mkt.label}</p>
                             {mkt.id === "benefit" && <span className="text-[10px] text-muted-foreground">(3 imgs)</span>}
                             {sel && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
                           </div>
                           <p className="text-xs text-muted-foreground">{mkt.description}</p>
                         </button>
                       );
                     })}
                   </div>

                   {/* Benefit prompt input */}
                   {hasBenefitSelected && (
                     <div className="space-y-2 pt-2 border-t border-border">
                       <Label className="flex items-center gap-2 text-xs font-semibold">
                         <MessageSquare className="h-3.5 w-3.5" /> Descreva o benefício do produto
                       </Label>
                       <Textarea
                         placeholder="Ex: Mantém o celular firme mesmo em estradas esburacadas, permite usar GPS e carregar ao mesmo tempo..."
                         value={benefitPrompt}
                         onChange={(e) => setBenefitPrompt(e.target.value)}
                         className="text-sm min-h-[80px]"
                       />
                       <p className="text-xs text-muted-foreground">
                         💡 A IA gerará 3 imagens diferentes mostrando esse benefício
                       </p>
                       {!benefitPrompt.trim() && (
                         <p className="text-xs text-amber-500">⚠️ Escreva o benefício para gerar as imagens</p>
                       )}
                     </div>
                   )}
                </Card>

                {/* PHASE 3: Shopee Text */}
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4" /> Fase 3: Título e Descrição Shopee
                    </Label>
                    <Switch
                      checked={generateShopeeText}
                      onCheckedChange={setGenerateShopeeText}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gera título SEO, descrição otimizada e palavras-chave para anúncio na Shopee
                  </p>
                  {!productName && generateShopeeText && (
                    <p className="text-xs text-amber-500">⚠️ Envie uma foto para identificar o produto automaticamente</p>
                  )}
                </Card>

                {/* Generate button + progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {recolorCount > 0 && (
                        <p>🎨 {recolorCount} {recolorCount === 1 ? "imagem" : "imagens"} de cores</p>
                      )}
                      {environmentCount > 0 && (
                        <p>📸 {environmentCount} {environmentCount === 1 ? "imagem" : "imagens"} de ambientes</p>
                      )}
                      {benefitImageCount > 0 && (
                        <p>💡 3 imagens de benefício</p>
                      )}
                      {generateShopeeText && productName && (
                        <p>📝 Título + Descrição Shopee</p>
                      )}
                      {(totalImages > 0 || (generateShopeeText && productName)) && (
                        <p className="font-medium text-foreground">Total: {totalImages} imagens{generateShopeeText && productName ? " + texto SEO" : ""} via IA</p>
                      )}
                    </div>
                    <Button
                      size="lg"
                      onClick={handleGenerate}
                      disabled={isGenerating || isIdentifying || !baseImageData || (totalImages === 0 && !(generateShopeeText && productName))}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Gerar em Lote (IA)</>
                      )}
                    </Button>
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        {progressLabel} • {progress}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Results gallery */}
                {generatedImages.length > 0 && (
                  <Card className="p-4 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-semibold text-sm">{generatedImages.length} imagens geradas</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                          <button
                            onClick={() => setResultFilter("all")}
                            className={`px-3 py-1.5 transition-colors ${resultFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                          >
                            Todas ({generatedImages.length})
                          </button>
                          {recolorResults > 0 && (
                            <button
                              onClick={() => setResultFilter("recolor")}
                              className={`px-3 py-1.5 border-l border-border transition-colors ${resultFilter === "recolor" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                              🎨 Cores ({recolorResults})
                            </button>
                          )}
                          {marketingResults > 0 && (
                            <button
                              onClick={() => setResultFilter("marketing")}
                              className={`px-3 py-1.5 border-l border-border transition-colors ${resultFilter === "marketing" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                              📸 Ambientes ({marketingResults})
                            </button>
                          )}
                        </div>
                        <Button size="sm" onClick={downloadAll} className="gap-1.5">
                          <Download className="h-4 w-4" /> Baixar ZIP
                        </Button>
                      </div>
                    </div>
                    <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4"}`}>
                      {filteredImages.map((img, i) => (
                        <div key={i} className="group relative rounded-lg overflow-hidden border border-border bg-muted">
                          <img
                            src={img.dataUrl}
                            alt={`${img.colorName} ${img.format}`}
                            className="w-full aspect-square object-contain"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => setPreviewImage(img)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => downloadSingle(img)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                            <div className="flex items-center gap-1.5">
                              {img.type === "recolor" ? (
                                <span className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: img.colorHex }} />
                              ) : (
                                <span className="text-xs">📸</span>
                              )}
                              <span className="text-xs text-white font-medium truncate">{img.colorName}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] mt-1 px-1.5 py-0">
                              {img.type === "recolor" ? "Cor" : img.marketingType === "benefit" ? "Benefício" : "Ambiente"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Shopee Text Results */}
                {shopeeText && (
                  <Card className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Texto Shopee Gerado
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          const full = `${shopeeText.title}\n\n${shopeeText.description}\n\nTags: ${shopeeText.keywords.join(", ")}`;
                          navigator.clipboard.writeText(full);
                          toast({ title: "Tudo copiado!" });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar Tudo
                      </Button>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Título ({shopeeText.title.length}/120 caracteres)</Label>
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm font-medium bg-muted p-3 rounded-lg">{shopeeText.title}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => { navigator.clipboard.writeText(shopeeText.title); toast({ title: "Título copiado!" }); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Descrição ({shopeeText.description.length}/2000 caracteres)</Label>
                      <div className="flex items-start gap-2">
                        <pre className="flex-1 text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap font-sans">{shopeeText.description}</pre>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => { navigator.clipboard.writeText(shopeeText.description); toast({ title: "Descrição copiada!" }); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Keywords */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Palavras-chave ({shopeeText.keywords.length})
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {shopeeText.keywords.map((kw, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="cursor-pointer hover:bg-primary/20"
                            onClick={() => { navigator.clipboard.writeText(kw); toast({ title: `"${kw}" copiada!` }); }}
                          >
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {history.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Nenhuma geração encontrada.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-semibold text-sm">{entry.product_name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("pt-BR")} •{" "}
                          {entry.colors?.length || 0} cores • {entry.formats?.length || 0} formatos •{" "}
                          {entry.background_style}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.colors?.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewImage?.type === "recolor" ? (
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: previewImage?.colorHex }} />
              ) : (
                <span>📸</span>
              )}
              {previewImage?.colorName} — {previewImage?.type === "recolor" ? "Cor" : previewImage?.marketingType === "benefit" ? "Benefício" : "Ambiente"}
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-3">
              <img
                src={previewImage.dataUrl}
                alt={previewImage.colorName}
                className="w-full rounded-lg border border-border"
              />
              <Button onClick={() => downloadSingle(previewImage)} className="w-full gap-2">
                <Download className="h-4 w-4" /> Baixar Imagem
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
