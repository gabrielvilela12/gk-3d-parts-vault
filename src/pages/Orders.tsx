import { useState, useEffect, useMemo } from "react";
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
import { Package, Plus, Trash2, Clock, CheckCircle2, GripVertical, Timer, CalendarClock, Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

      const [ordersRes, piecesRes, variationsRes] = await Promise.all([
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
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (piecesRes.error) throw piecesRes.error;
      if (variationsRes.error) throw variationsRes.error;

      setOrders(ordersRes.data || []);
      setPieces(piecesRes.data || []);
      setVariations(variationsRes.data || []);
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Fila de Produção</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize a ordem de impressão e acompanhe os horários
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Pedido</Button>
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
                  <Select value={newOrder.variation_id} onValueChange={(v) => setNewOrder({ ...newOrder, variation_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem variação</SelectItem>
                      {availableVariations.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.variation_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" value={newOrder.quantity} onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input value={newOrder.color} onChange={(e) => setNewOrder({ ...newOrder, color: e.target.value })} placeholder="Ex: Preto" />
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
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Position */}
                      <div className="flex flex-col items-center justify-center w-8 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                      </div>

                      {/* Image */}
                      {order.pieces.image_url ? (
                        <img src={order.pieces.image_url} alt={order.pieces.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{order.pieces.name}</span>
                          {order.quantity > 1 && (
                            <Badge variant="secondary" className="text-xs">x{order.quantity}</Badge>
                          )}
                          {order.color && (
                            <Badge variant="outline" className="text-xs">{order.color}</Badge>
                          )}
                          {order.piece_price_variations && (
                            <Badge variant="outline" className="text-xs">{order.piece_price_variations.variation_name}</Badge>
                          )}
                        </div>
                        {order.notes && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{order.notes}</p>
                        )}
                      </div>

                      {/* Time info */}
                      <div className="text-right shrink-0 space-y-0.5">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => handleTogglePrinted(order.id, false)}
                          className="h-5 w-5"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteOrder(order.id)}>
                          <Trash2 className="h-4 w-4" />
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
