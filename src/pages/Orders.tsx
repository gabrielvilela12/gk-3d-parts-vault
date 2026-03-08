import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Trash2, Clock, CheckCircle2, GripVertical, Timer, CalendarClock, Search, X, Upload, FileSpreadsheet, AlertCircle, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";

interface ImportRow {
  platformOrderId: string;
  productName: string;
  variation: string;
  color: string;
  quantity: number;
  buyerNotes: string;
  matchedPieceId: string | null;
  matchedPieceName: string | null;
  imageUrl: string | null;
}

interface Order {
  id: string;
  piece_id: string;
  variation_id: string | null;
  quantity: number;
  is_printed: boolean;
  printed_at: string | null;
  printed_by: string | null;
  notes: string | null;
  color: string | null;
  created_at: string;
  pieces: {
    name: string;
    tempo_impressao_min: number | null;
    image_url: string | null;
  };
  piece_price_variations?: {
    variation_name: string;
    tempo_impressao_min: number | null;
  } | null;
}

interface Piece {
  id: string;
  name: string;
  tempo_impressao_min: number | null;
  image_url: string | null;
}

interface Variation {
  id: string;
  piece_id: string;
  variation_name: string;
  tempo_impressao_min: number | null;
}

interface Filament {
  id: string;
  name: string;
  color: string | null;
}

const formatTime = (minutes: number | null): string => {
  if (minutes === null || minutes === 0) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
};

const formatDateTime = (date: Date): string => {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [newOrder, setNewOrder] = useState({
    piece_id: "",
    variation_id: "",
    quantity: "1",
    color: "",
    notes: "",
  });
  const [pieceSearch, setPieceSearch] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Update "now" every minute for live countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [ordersRes, piecesRes, variationsRes, filamentsRes] = await Promise.all([
        supabase
          .from("orders")
          .select(`*, pieces(name, tempo_impressao_min, image_url), piece_price_variations(variation_name, tempo_impressao_min)`)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("pieces")
          .select("id, name, tempo_impressao_min, image_url")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("piece_price_variations")
          .select("id, piece_id, variation_name, tempo_impressao_min")
          .eq("user_id", user.id),
        supabase
          .from("filaments")
          .select("id, name, color")
          .eq("user_id", user.id)
          .order("name"),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (piecesRes.error) throw piecesRes.error;
      if (variationsRes.error) throw variationsRes.error;

      setOrders(ordersRes.data || []);
      setPieces(piecesRes.data || []);
      setVariations(variationsRes.data || []);
      setFilaments(filamentsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.piece_id) {
      toast({ title: "Selecione uma peça", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        piece_id: newOrder.piece_id,
        variation_id: newOrder.variation_id || null,
        quantity: parseInt(newOrder.quantity),
        color: newOrder.color || null,
        notes: newOrder.notes || null,
      });

      if (error) throw error;
      toast({ title: "Pedido criado!" });
      setNewOrder({ piece_id: "", variation_id: "", quantity: "1", color: "", notes: "" });
      setIsDialogOpen(false);
      fetchData();
    } catch {
      toast({ title: "Erro ao criar pedido", variant: "destructive" });
    }
  };

  const handleTogglePrinted = async (orderId: string, currentStatus: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("orders").update({
        is_printed: !currentStatus,
        printed_at: !currentStatus ? new Date().toISOString() : null,
        printed_by: !currentStatus ? user.email : null,
      }).eq("id", orderId);

      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        is_printed: !currentStatus,
        printed_at: !currentStatus ? new Date().toISOString() : null,
        printed_by: !currentStatus ? user.email : null,
      } : o));
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const normalizeText = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

  const findBestMatch = (productName: string): Piece | null => {
    const normalized = normalizeText(productName);
    // Try exact match first
    let match = pieces.find(p => normalizeText(p.name) === normalized);
    if (match) return match;
    // Try if piece name is contained in product name or vice versa
    match = pieces.find(p => {
      const pNorm = normalizeText(p.name);
      return normalized.includes(pNorm) || pNorm.includes(normalized);
    });
    if (match) return match;
    // Try matching by significant words (3+ chars)
    const words = normalized.split(/\s+/).filter(w => w.length >= 3);
    let bestScore = 0;
    let bestPiece: Piece | null = null;
    for (const piece of pieces) {
      const pNorm = normalizeText(piece.name);
      const matchCount = words.filter(w => pNorm.includes(w)).length;
      const score = matchCount / Math.max(words.length, 1);
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestPiece = piece;
      }
    }
    return bestPiece;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      const parsed: ImportRow[] = [];
      for (const row of rows) {
        const productName = row["Nome do Anúncio"] || "";
        if (!productName) continue;
        const variation = row["Variação"] || "";
        const colorPart = variation.split(",")[0]?.trim() || "";
        const quantity = parseInt(row["Qtd. do Produto"]) || 1;
        const platformOrderId = row["Nº de Pedido da Plataforma"] || "";
        const buyerNotes = row["Notas do Comprador"] || "";

        const matched = findBestMatch(productName);
        parsed.push({
          platformOrderId,
          productName,
          variation,
          color: colorPart,
          quantity,
          buyerNotes,
          matchedPieceId: matched?.id || null,
          matchedPieceName: matched?.name || null,
          imageUrl: matched?.image_url || null,
        });
      }

      setImportRows(parsed);
      setIsImportDialogOpen(true);
    } catch (err) {
      console.error("Error parsing file:", err);
      toast({ title: "Erro ao ler arquivo", variant: "destructive" });
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    const matchedRows = importRows.filter(r => r.matchedPieceId);
    if (matchedRows.length === 0) {
      toast({ title: "Nenhum produto correspondente encontrado", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const inserts = matchedRows.map(r => ({
        user_id: user.id,
        piece_id: r.matchedPieceId!,
        quantity: r.quantity,
        color: r.color || null,
        notes: r.buyerNotes ? `${r.platformOrderId} - ${r.buyerNotes}` : r.platformOrderId || null,
      }));

      const { error } = await supabase.from("orders").insert(inserts);
      if (error) throw error;

      toast({ title: `${matchedRows.length} pedido(s) importado(s)!` });
      setIsImportDialogOpen(false);
      setImportRows([]);
      fetchData();
    } catch {
      toast({ title: "Erro ao importar pedidos", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const updateImportRowMatch = (index: number, pieceId: string) => {
    const piece = pieces.find(p => p.id === pieceId);
    setImportRows(prev => prev.map((r, i) => i === index ? {
      ...r,
      matchedPieceId: piece?.id || null,
      matchedPieceName: piece?.name || null,
      imageUrl: piece?.image_url || null,
    } : r));

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast({ title: "Pedido excluído" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const getPrintTimeMin = (order: Order): number => {
    const t = order.variation_id && order.piece_price_variations
      ? order.piece_price_variations.tempo_impressao_min
      : order.pieces.tempo_impressao_min;
    return (t || 0) * order.quantity;
  };

  // Split orders into queue (not printed) and done (printed)
  const queue = useMemo(() => orders.filter(o => !o.is_printed), [orders]);
  const done = useMemo(() => orders.filter(o => o.is_printed), [orders]);

  // Calculate cumulative finish times for the queue
  const queueWithTimes = useMemo(() => {
    let accMinutes = 0;
    return queue.map(order => {
      const totalMin = getPrintTimeMin(order);
      accMinutes += totalMin;
      const finishAt = new Date(now.getTime() + accMinutes * 60_000);
      return { order, totalMin, accMinutes, finishAt };
    });
  }, [queue, now]);

  const totalQueueMin = queueWithTimes.length > 0 ? queueWithTimes[queueWithTimes.length - 1].accMinutes : 0;

  const availableVariations = variations.filter(v => v.piece_id === newOrder.piece_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Fila de Produção</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Organize a ordem de impressão e acompanhe os horários
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Pedido à Fila</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Peça *</Label>
                {newOrder.piece_id ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg border border-primary/40 bg-primary/5">
                    {(() => {
                      const sel = pieces.find(p => p.id === newOrder.piece_id);
                      if (!sel) return null;
                      return (
                        <>
                          {sel.image_url ? (
                            <img src={sel.image_url} alt={sel.name} className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{sel.name}</p>
                            {sel.tempo_impressao_min && (
                              <p className="text-xs text-muted-foreground">{formatTime(sel.tempo_impressao_min)}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setNewOrder({ ...newOrder, piece_id: "", variation_id: "" })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar peça..."
                        value={pieceSearch}
                        onChange={(e) => setPieceSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                    <ScrollArea className="h-[200px] rounded-lg border">
                      <div className="p-1 space-y-0.5">
                        {pieces
                          .filter(p => p.name.toLowerCase().includes(pieceSearch.toLowerCase()))
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setNewOrder({ ...newOrder, piece_id: p.id, variation_id: "" }); setPieceSearch(""); }}
                              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
                            >
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-md object-cover shrink-0" />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                {p.tempo_impressao_min && (
                                  <p className="text-[11px] text-muted-foreground">{formatTime(p.tempo_impressao_min)}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        {pieces.filter(p => p.name.toLowerCase().includes(pieceSearch.toLowerCase())).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma peça encontrada</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {availableVariations.length > 0 && (
                <div className="space-y-2">
                  <Label>Variação</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNewOrder({ ...newOrder, variation_id: "" })}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        !newOrder.variation_id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      Padrão
                    </button>
                    {availableVariations.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setNewOrder({ ...newOrder, variation_id: v.id })}
                        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                          newOrder.variation_id === v.id
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        {v.variation_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" value={newOrder.quantity} onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  {filaments.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {filaments.map(f => {
                        const colorMap: Record<string, string> = {
                          preto: "hsl(0 0% 10%)", black: "hsl(0 0% 10%)",
                          branco: "hsl(0 0% 95%)", white: "hsl(0 0% 95%)",
                          vermelho: "hsl(0 75% 50%)", red: "hsl(0 75% 50%)",
                          azul: "hsl(217 90% 50%)", blue: "hsl(217 90% 50%)",
                          verde: "hsl(140 70% 40%)", green: "hsl(140 70% 40%)",
                          amarelo: "hsl(50 95% 55%)", yellow: "hsl(50 95% 55%)",
                          laranja: "hsl(25 90% 55%)", orange: "hsl(25 90% 55%)",
                          rosa: "hsl(330 80% 60%)", pink: "hsl(330 80% 60%)",
                          roxo: "hsl(270 70% 50%)", purple: "hsl(270 70% 50%)",
                          cinza: "hsl(0 0% 55%)", gray: "hsl(0 0% 55%)",
                          marrom: "hsl(25 50% 30%)", brown: "hsl(25 50% 30%)",
                          bege: "hsl(35 40% 75%)", beige: "hsl(35 40% 75%)",
                        };
                        const colorKey = (f.color || f.name).toLowerCase().trim();
                        const bg = colorMap[colorKey] || "hsl(var(--muted))";
                        const isSelected = newOrder.color === (f.color || f.name);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setNewOrder({ ...newOrder, color: f.color || f.name })}
                            title={f.name}
                            className={`h-8 w-8 rounded-full border-2 transition-all ${
                              isSelected ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border hover:scale-105"
                            }`}
                            style={{ backgroundColor: bg }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <Input value={newOrder.color} onChange={(e) => setNewOrder({ ...newOrder, color: e.target.value })} placeholder="Ex: Preto" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} rows={2} />
              </div>

              <Button onClick={handleCreateOrder} className="w-full">Adicionar à Fila</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Na Fila</p>
            <p className="text-2xl font-bold">{queue.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Tempo Total</p>
            <p className="text-2xl font-bold">{formatTime(totalQueueMin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Término Previsto</p>
            <p className="text-lg font-bold">
              {totalQueueMin > 0 ? formatDateTime(new Date(now.getTime() + totalQueueMin * 60_000)) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-bold text-primary">{done.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Fila de Impressão
        </h2>

        {queueWithTimes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum pedido na fila. Adicione um pedido para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {queueWithTimes.map(({ order, totalMin, finishAt }, idx) => {
              const unitTime = order.variation_id && order.piece_price_variations
                ? order.piece_price_variations.tempo_impressao_min
                : order.pieces.tempo_impressao_min;

              return (
                <Card key={order.id} className="border-l-4 border-l-primary/60 hover:border-l-primary transition-colors">
                  <CardContent className="py-3 px-3 sm:px-4">
                    <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                      {/* Position */}
                      <div className="flex flex-col items-center justify-center w-6 sm:w-8 shrink-0 pt-0.5 sm:pt-0">
                        <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                      </div>

                      {/* Image */}
                      {order.pieces.image_url ? (
                        <img src={order.pieces.image_url} alt={order.pieces.name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info + time stacked on mobile */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs sm:text-sm truncate">{order.pieces.name}</span>
                          {order.quantity > 1 && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">x{order.quantity}</Badge>
                          )}
                          {order.color && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs">{order.color}</Badge>
                          )}
                          {order.piece_price_variations && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:inline-flex">{order.piece_price_variations.variation_name}</Badge>
                          )}
                        </div>
                        {order.notes && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{order.notes}</p>
                        )}
                        {/* Time info inline on mobile */}
                        <div className="flex items-center gap-3 mt-1 sm:hidden">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium">{formatTime(totalMin)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3 text-primary" />
                            <span className="text-[11px] text-primary font-medium">{formatDateTime(finishAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Time info - desktop only */}
                      <div className="text-right shrink-0 space-y-0.5 hidden sm:block">
                        <div className="flex items-center gap-1 justify-end">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{formatTime(totalMin)}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <CalendarClock className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-primary font-medium">{formatDateTime(finishAt)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => handleTogglePrinted(order.id, false)}
                          className="h-5 w-5"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteOrder(order.id)}>
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Done */}
      {done.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Concluídos ({done.length})
          </h2>
          <div className="space-y-1.5">
            {done.map(order => (
              <Card key={order.id} className="opacity-70 hover:opacity-100 transition-opacity">
                <CardContent className="py-2.5 px-4">
                  <div className="flex items-center gap-3">
                    {order.pieces.image_url ? (
                      <img src={order.pieces.image_url} alt={order.pieces.name} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through text-muted-foreground truncate">{order.pieces.name}</span>
                        {order.quantity > 1 && <Badge variant="secondary" className="text-xs">x{order.quantity}</Badge>}
                        {order.color && <Badge variant="outline" className="text-xs">{order.color}</Badge>}
                      </div>
                    </div>
                    {order.printed_at && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(order.printed_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => handleTogglePrinted(order.id, true)}
                        className="h-5 w-5"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteOrder(order.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
