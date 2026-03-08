import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import JSZip from "jszip";
import {
  ImagePlus, Palette, Download, Loader2, Trash2, Eye, Package,
  Square, Smartphone, Monitor, X, History, Sparkles, CheckCircle2
} from "lucide-react";

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
  { id: "square", label: "Quadrado", icon: Square, width: 1080, height: 1080 },
  { id: "story", label: "Story", icon: Smartphone, width: 1080, height: 1920 },
  { id: "banner", label: "Banner", icon: Monitor, width: 1920, height: 1080 },
];

const BACKGROUNDS = [
  { id: "white", label: "Fundo Branco", description: "Limpo e minimalista" },
  { id: "promo", label: "Promocional", description: "Com faixa de destaque" },
  { id: "premium", label: "Premium", description: "Gradiente elegante" },
];

interface GeneratedImage {
  colorName: string;
  colorHex: string;
  format: string;
  dataUrl: string;
  width: number;
  height: number;
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

export default function ImageGenerator() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState("");
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [baseImagePreview, setBaseImagePreview] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<typeof PRESET_COLORS>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["square"]);
  const [backgroundStyle, setBackgroundStyle] = useState("white");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState("generator");

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setBaseImage(img);
        setBaseImagePreview(ev.target?.result as string);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
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
      prev.includes(formatId)
        ? prev.filter((f) => f !== formatId)
        : [...prev, formatId]
    );
  };

  const drawImage = useCallback(
    (
      canvas: HTMLCanvasElement,
      img: HTMLImageElement,
      color: typeof PRESET_COLORS[0],
      format: typeof FORMATS[0],
      bg: string,
      name: string
    ) => {
      const ctx = canvas.getContext("2d")!;
      canvas.width = format.width;
      canvas.height = format.height;

      // Background
      if (bg === "white") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (bg === "promo") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, "#fef9c3");
        grad.addColorStop(1, "#fde68a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Promo banner stripe
        ctx.save();
        ctx.fillStyle = "#dc2626";
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-60, -10, 400, 50);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PROMOÇÃO", 140, 28);
        ctx.restore();
      } else if (bg === "premium") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, "#1e1b4b");
        grad.addColorStop(0.5, "#312e81");
        grad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Subtle pattern dots
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        for (let x = 0; x < canvas.width; x += 40) {
          for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw product image centered with padding
      const padding = Math.min(canvas.width, canvas.height) * 0.12;
      const availW = canvas.width - padding * 2;
      const availH = canvas.height - padding * 2 - 120; // reserve for text
      const scale = Math.min(availW / img.width, availH / img.height, 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (canvas.width - drawW) / 2;
      const drawY = padding + (availH - drawH) / 2;

      // Color tint overlay on product
      ctx.save();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = color.hex;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Re-draw with reduced tint for realism
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Product name
      const textY = canvas.height - padding - 50;
      const fontSize = Math.max(28, Math.min(canvas.width * 0.04, 48));
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = bg === "premium" ? "#e0e7ff" : "#111827";
      if (name) ctx.fillText(name, canvas.width / 2, textY);

      // Color name badge
      const badgeY = textY + fontSize * 0.8;
      const badgeFontSize = Math.max(18, fontSize * 0.55);
      ctx.font = `600 ${badgeFontSize}px Inter, system-ui, sans-serif`;
      const textW = ctx.measureText(color.name).width;
      const bx = canvas.width / 2 - textW / 2 - 16;
      const by = badgeY - badgeFontSize * 0.7;
      const bw = textW + 32;
      const bh = badgeFontSize + 14;
      ctx.fillStyle = color.hex;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();
      // Contrast text
      const r = parseInt(color.hex.slice(1, 3), 16);
      const g = parseInt(color.hex.slice(3, 5), 16);
      const b = parseInt(color.hex.slice(5, 7), 16);
      ctx.fillStyle = r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111" : "#fff";
      ctx.textAlign = "center";
      ctx.fillText(color.name, canvas.width / 2, badgeY);
    },
    []
  );

  const handleGenerate = async () => {
    if (!baseImage) {
      toast({ title: "Envie uma imagem base", variant: "destructive" });
      return;
    }
    if (selectedColors.length === 0) {
      toast({ title: "Selecione pelo menos uma cor", variant: "destructive" });
      return;
    }
    if (selectedFormats.length === 0) {
      toast({ title: "Selecione pelo menos um formato", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    const canvas = document.createElement("canvas");
    const results: GeneratedImage[] = [];

    for (const color of selectedColors) {
      for (const fmtId of selectedFormats) {
        const fmt = FORMATS.find((f) => f.id === fmtId)!;
        drawImage(canvas, baseImage, color, fmt, backgroundStyle, productName);
        results.push({
          colorName: color.name,
          colorHex: color.hex,
          format: fmtId,
          dataUrl: canvas.toDataURL("image/png"),
          width: fmt.width,
          height: fmt.height,
        });
        // Yield to UI
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    setGeneratedImages(results);
    setIsGenerating(false);

    // Save to history
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("image_generations").insert({
        user_id: user.id,
        product_name: productName || "Sem nome",
        base_image_url: baseImagePreview?.slice(0, 200) || "",
        colors: selectedColors.map((c) => c.name),
        background_style: backgroundStyle,
        formats: selectedFormats,
        generated_images: results.map((r) => ({
          colorName: r.colorName,
          colorHex: r.colorHex,
          format: r.format,
          width: r.width,
          height: r.height,
        })),
      });
    }

    toast({ title: `${results.length} imagens geradas!`, description: "Pronto para download." });
  };

  const downloadAll = async () => {
    if (generatedImages.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder(productName || "imagens")!;

    for (const img of generatedImages) {
      const base64 = img.dataUrl.split(",")[1];
      const fileName = `${productName || "produto"}_${img.colorName}_${img.format}.png`;
      folder.file(fileName, base64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName || "imagens"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingle = (img: GeneratedImage) => {
    const a = document.createElement("a");
    a.href = img.dataUrl;
    a.download = `${productName || "produto"}_${img.colorName}_${img.format}.png`;
    a.click();
  };

  const totalImages = selectedColors.length * selectedFormats.length;

  return (
    <div className="min-h-screen bg-background">
      <canvas ref={canvasRef} className="hidden" />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="page-title">Gerador de Imagens</h1>
              <p className="page-subtitle">Gere imagens de anúncios em lote para múltiplas cores</p>
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
              {/* Left panel - Config */}
              <div className="space-y-5 col-span-1">
                {/* Product name */}
                <Card className="p-4 space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4" /> Nome do Produto
                  </Label>
                  <Input
                    placeholder="Ex: Vaso Decorativo"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </Card>

                {/* Image upload */}
                <Card className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Imagem Base</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  {baseImagePreview ? (
                    <div className="relative group">
                      <img
                        src={baseImagePreview}
                        alt="Base"
                        className="w-full h-40 object-contain rounded-lg border border-border bg-muted"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setBaseImage(null); setBaseImagePreview(null); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para enviar</span>
                    </button>
                  )}
                </Card>

                {/* Background style */}
                <Card className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Estilo de Fundo</Label>
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

                {/* Formats */}
                <Card className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Formatos</Label>
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

              {/* Right panel - Colors + generate */}
              <div className={`space-y-5 ${isMobile ? "col-span-1" : "col-span-2"}`}>
                {/* Color selector */}
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Palette className="h-4 w-4" /> Cores
                    </Label>
                    <Badge variant="secondary">{selectedColors.length} selecionadas</Badge>
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

                  {/* Custom color */}
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

                  {/* Selected colors */}
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

                {/* Generate button */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-sm text-muted-foreground">
                    {totalImages > 0
                      ? `${totalImages} ${totalImages === 1 ? "imagem será gerada" : "imagens serão geradas"}`
                      : "Configure cores e formatos"}
                  </div>
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={isGenerating || !baseImage || selectedColors.length === 0 || selectedFormats.length === 0}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Gerar em Lote</>
                    )}
                  </Button>
                </div>

                {/* Results gallery */}
                {generatedImages.length > 0 && (
                  <Card className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{generatedImages.length} imagens geradas</h3>
                      <Button size="sm" onClick={downloadAll} className="gap-1.5">
                        <Download className="h-4 w-4" /> Baixar ZIP
                      </Button>
                    </div>
                    <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4"}`}>
                      {generatedImages.map((img, i) => (
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
                              <span className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: img.colorHex }} />
                              <span className="text-xs text-white font-medium truncate">{img.colorName}</span>
                            </div>
                          </div>
                        </div>
                      ))}
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
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: previewImage?.colorHex }} />
              {previewImage?.colorName} — {previewImage?.format} ({previewImage?.width}x{previewImage?.height})
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
