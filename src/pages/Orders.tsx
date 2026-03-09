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
import { Package, Plus, Trash2, Clock, CheckCircle2, GripVertical, Timer, CalendarClock, Search, X, Upload, FileSpreadsheet, AlertCircle, Check, Filter, ShoppingBag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";
import QueueOptimizerChat from "@/components/QueueOptimizerChat";

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
  const [filterColor, setFilterColor] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "queue" | "done">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
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
          .order("position", { ascending: true })
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

      // Check existing orders to avoid duplicates
      const existingNotes = orders.map(o => o.notes || "");

      // First, consolidate duplicate rows within the same batch (same platformOrderId + same piece)
      const consolidatedMap = new Map<string, ImportRow>();
      for (const r of matchedRows) {
        const key = `${r.platformOrderId}::${r.matchedPieceId}::${r.color}`;
        const existing = consolidatedMap.get(key);
        if (existing) {
          existing.quantity += r.quantity;
          // Keep buyer notes from first occurrence
        } else {
          consolidatedMap.set(key, { ...r });
        }
      }
      const consolidatedRows = Array.from(consolidatedMap.values());

      // Then filter out rows that already exist in the database
      const newRows = consolidatedRows.filter(r => {
        const noteKey = r.platformOrderId || "";
        if (!noteKey) return true;
        const isDuplicate = orders.some(o => {
          const orderNote = o.notes || "";
          return orderNote.includes(noteKey) && o.piece_id === r.matchedPieceId;
        });
        return !isDuplicate;
      });

      if (newRows.length === 0) {
        toast({ title: "Todos os pedidos já existem na fila", description: `${matchedRows.length} pedido(s) já importado(s) anteriormente.` });
        setIsImportDialogOpen(false);
        setImportRows([]);
        return;
      }

      const skipped = consolidatedRows.length - newRows.length;

      const inserts = newRows.map(r => ({
        user_id: user.id,
        piece_id: r.matchedPieceId!,
        quantity: r.quantity,
        color: r.color || null,
        notes: r.buyerNotes ? `${r.platformOrderId} - ${r.buyerNotes}` : r.platformOrderId || null,
      }));

      const { error } = await supabase.from("orders").insert(inserts);
      if (error) throw error;

      const msg = skipped > 0
        ? `${newRows.length} novo(s), ${skipped} duplicado(s) ignorado(s)`
        : `${newRows.length} pedido(s) importado(s)!`;
      toast({ title: "Importação concluída", description: msg });
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
  };

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

  // Extract unique colors and platform order IDs
  const uniqueColors = useMemo(() => {
    const colors = new Set(orders.map(o => o.color).filter(Boolean) as string[]);
    return Array.from(colors).sort();
  }, [orders]);

  // Filter orders
  const filterOrder = (order: Order) => {
    if (filterColor !== "all" && order.color !== filterColor) return false;
    if (filterSearch && !order.pieces.name.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !(order.notes || "").toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  };

  const filteredQueue = useMemo(() => queue.filter(filterOrder), [queue, filterColor, filterSearch]);
  const filteredDone = useMemo(() => done.filter(filterOrder), [done, filterColor, filterSearch]);

  // Extract platform order ID from notes
  const getPlatformId = (order: Order): string => {
    const notes = order.notes || "";
    // Format: "PLATFORM_ID - buyer notes" or just "PLATFORM_ID"
    const match = notes.match(/^(\S+)/);
    return match?.[1] || "sem-pedido";
  };

  // Group orders by platform order ID
  const groupOrders = (orderList: Order[]) => {
    const groups: Record<string, Order[]> = {};
    for (const order of orderList) {
      const key = getPlatformId(order);
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    return Object.entries(groups);
  };

  const groupedQueue = useMemo(() => groupOrders(filteredQueue), [filteredQueue]);
  const groupedDone = useMemo(() => groupOrders(filteredDone), [filteredDone]);

  // Calculate cumulative finish times for the queue
  const queueWithTimes = useMemo(() => {
    let accMinutes = 0;
    return filteredQueue.map(order => {
      const totalMin = getPrintTimeMin(order);
      accMinutes += totalMin;
      const finishAt = new Date(now.getTime() + accMinutes * 60_000);
      return { order, totalMin, accMinutes, finishAt };
    });
  }, [filteredQueue, now]);

  const queueTimeMap = useMemo(() => {
    const map = new Map<string, { totalMin: number; finishAt: Date }>();
    queueWithTimes.forEach(qt => map.set(qt.order.id, { totalMin: qt.totalMin, finishAt: qt.finishAt }));
    return map;
  }, [queueWithTimes]);

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
            Importe pedidos via Excel exportado do{" "}
            <a href="https://app.upseller.com/pt/order/to-ship" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              UpSeller → Pedidos → Para Enviar
            </a>
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />Importar Excel
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Pedidos do Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                {importRows.filter(r => r.matchedPieceId).length} correspondidos
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {importRows.filter(r => !r.matchedPieceId).length} não encontrados
              </Badge>
            </div>
            <ScrollArea className="h-[400px] pr-3">
              <div className="space-y-2">
                {importRows.map((row, idx) => (
                  <Card key={idx} className={`border-l-4 ${row.matchedPieceId ? 'border-l-primary' : 'border-l-destructive'}`}>
                    <CardContent className="py-2.5 px-3">
                      <div className="flex items-start gap-2">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-muted-foreground truncate" title={row.productName}>{row.productName}</p>
                          {row.matchedPieceId ? (
                            <p className="text-sm font-medium text-primary truncate">→ {row.matchedPieceName}</p>
                          ) : (
                            <Select onValueChange={(v) => updateImportRowMatch(idx, v)}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Selecionar peça manualmente..." />
                              </SelectTrigger>
                              <SelectContent>
                                {pieces.map(p => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {row.color && <Badge variant="outline" className="text-[10px]">{row.color}</Badge>}
                            <Badge variant="secondary" className="text-[10px]">x{row.quantity}</Badge>
                            {row.platformOrderId && <Badge variant="secondary" className="text-[10px] font-mono">{row.platformOrderId}</Badge>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            <Button onClick={handleConfirmImport} className="w-full" disabled={isImporting || importRows.filter(r => r.matchedPieceId).length === 0}>
              {isImporting ? "Importando..." : `Importar ${importRows.filter(r => r.matchedPieceId).length} pedido(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar peça ou nº pedido..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filterColor} onValueChange={setFilterColor}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
            <SelectValue placeholder="Cor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cores</SelectItem>
            {uniqueColors.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {(["all", "queue", "done"] as const).map(s => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              size="sm"
              className="text-xs h-9"
              onClick={() => setFilterStatus(s)}
            >
              {s === "all" ? "Todos" : s === "queue" ? "Na Fila" : "Concluídos"}
            </Button>
          ))}
        </div>
      </div>

      {/* Queue Summary */}
      {filterStatus !== "done" && filteredQueue.length > 0 && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Peças na fila</div>
            <div className="text-lg font-bold">{filteredQueue.length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Tempo total</div>
            <div className="text-lg font-bold">{formatTime(totalQueueMin)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Cores</div>
            <div className="text-lg font-bold">{new Set(filteredQueue.map(o => o.color).filter(Boolean)).size || 1}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Pedidos</div>
            <div className="text-lg font-bold">{groupedQueue.length}</div>
          </Card>
        </div>
      )}

      {/* Queue grouped by platform order */}
      {filterStatus !== "done" && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Fila de Impressão ({filteredQueue.length})
          </h2>

          {groupedQueue.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum pedido na fila.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedQueue.map(([platformId, groupOrders]) => (
                <Card key={platformId} className="overflow-hidden">
                  <CardHeader className="py-2.5 px-3 sm:px-4 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold font-mono">{platformId === "sem-pedido" ? "Sem nº de pedido" : platformId}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">{groupOrders.length} {groupOrders.length === 1 ? "item" : "itens"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {groupOrders.map((order) => {
                        const times = queueTimeMap.get(order.id);
                        const totalMin = times?.totalMin || 0;
                        const finishAt = times?.finishAt || now;

                        return (
                          <div key={order.id} className="py-2.5 px-3 sm:px-4 hover:bg-accent/30 transition-colors">
                            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                              {order.pieces.image_url ? (
                                <img src={order.pieces.image_url} alt={order.pieces.name} className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-xs sm:text-sm truncate">{order.pieces.name}</span>
                                  {order.quantity > 1 && <Badge variant="secondary" className="text-[10px]">x{order.quantity}</Badge>}
                                  {order.color && <Badge variant="outline" className="text-[10px]">{order.color}</Badge>}
                                  {order.piece_price_variations && (
                                    <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{order.piece_price_variations.variation_name}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
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
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Checkbox checked={false} onCheckedChange={() => handleTogglePrinted(order.id, false)} className="h-5 w-5" />
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteOrder(order.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Done grouped by platform order */}
      {filterStatus !== "queue" && filteredDone.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Concluídos ({filteredDone.length})
          </h2>
          <div className="space-y-4">
            {groupedDone.map(([platformId, groupOrders]) => (
              <Card key={platformId} className="overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                <CardHeader className="py-2 px-3 sm:px-4 bg-muted/30 border-b">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold font-mono text-muted-foreground">{platformId === "sem-pedido" ? "Sem nº de pedido" : platformId}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">{groupOrders.length} {groupOrders.length === 1 ? "item" : "itens"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {groupOrders.map(order => (
                      <div key={order.id} className="py-2 px-3 sm:px-4">
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
                            <span className="text-xs text-muted-foreground shrink-0">{new Date(order.printed_at).toLocaleDateString("pt-BR")}</span>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            <Checkbox checked={true} onCheckedChange={() => handleTogglePrinted(order.id, true)} className="h-5 w-5" />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteOrder(order.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Chat */}
      <QueueOptimizerChat
        queueData={filteredQueue.map(o => ({
          id: o.id,
          name: o.pieces.name,
          color: o.color,
          quantity: o.quantity,
          tempo_min: o.variation_id && o.piece_price_variations
            ? o.piece_price_variations.tempo_impressao_min
            : o.pieces.tempo_impressao_min,
          variation: o.piece_price_variations?.variation_name || null,
          platformOrderId: (o.notes || "").split(" - ")[0] || "",
        }))}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        onReorder={async (orderedIds, explanation) => {
          try {
            // Update position for each order
            const updates = orderedIds.map((id, idx) =>
              supabase.from("orders").update({ position: idx }).eq("id", id)
            );
            await Promise.all(updates);
            toast({ title: "Fila reorganizada pela IA!", description: explanation });
            fetchData();
          } catch {
            toast({ title: "Erro ao reorganizar fila", variant: "destructive" });
          }
        }}
      />
    </div>
  );
}
