import { useState, useEffect } from "react";
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
import { Package, Plus, Trash2, Clock, CheckCircle2, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterPrintStatus, setFilterPrintStatus] = useState<string>("all");
  const [filterMaxHours, setFilterMaxHours] = useState<string>("");
  const [filterColor, setFilterColor] = useState<string>("all");
  const [newOrder, setNewOrder] = useState({
    piece_id: "",
    variation_id: "",
    quantity: "1",
    color: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          pieces(name, tempo_impressao_min, image_url),
          piece_price_variations(variation_name, tempo_impressao_min)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch pieces
      const { data: piecesData, error: piecesError } = await supabase
        .from("pieces")
        .select("id, name, tempo_impressao_min, image_url")
        .eq("user_id", user.id)
        .order("name");

      if (piecesError) throw piecesError;
      setPieces(piecesData || []);

      // Fetch all variations
      const { data: variationsData, error: variationsError } = await supabase
        .from("piece_price_variations")
        .select("id, piece_id, variation_name, tempo_impressao_min")
        .eq("user_id", user.id);

      if (variationsError) throw variationsError;
      setVariations(variationsData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os pedidos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.piece_id) {
      toast({
        title: "Peça obrigatória",
        description: "Por favor, selecione uma peça.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          piece_id: newOrder.piece_id,
          variation_id: newOrder.variation_id || null,
          quantity: parseInt(newOrder.quantity),
          color: newOrder.color || null,
          notes: newOrder.notes || null,
        });

      if (error) throw error;

      toast({
        title: "Pedido criado",
        description: "O pedido foi criado com sucesso.",
      });

      setNewOrder({ piece_id: "", variation_id: "", quantity: "1", color: "", notes: "" });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating order:", error);
      toast({
        title: "Erro ao criar",
        description: "Não foi possível criar o pedido.",
        variant: "destructive",
      });
    }
  };

  const handleTogglePrinted = async (orderId: string, currentStatus: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("orders")
        .update({
          is_printed: !currentStatus,
          printed_at: !currentStatus ? new Date().toISOString() : null,
          printed_by: !currentStatus ? user.email : null,
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(orders.map(order =>
        order.id === orderId
          ? {
              ...order,
              is_printed: !currentStatus,
              printed_at: !currentStatus ? new Date().toISOString() : null,
              printed_by: !currentStatus ? user.email : null,
            }
          : order
      ));

      toast({
        title: !currentStatus ? "Marcado como impresso" : "Desmarcado",
        description: !currentStatus ? "O pedido foi marcado como impresso." : "O pedido foi desmarcado.",
      });
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      setOrders(orders.filter(order => order.id !== orderId));
      toast({
        title: "Pedido excluído",
        description: "O pedido foi excluído com sucesso.",
      });
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o pedido.",
        variant: "destructive",
      });
    }
  };

  const getPrintTime = (order: Order): number | null => {
    if (order.variation_id && order.piece_price_variations) {
      return order.piece_price_variations.tempo_impressao_min;
    }
    return order.pieces.tempo_impressao_min;
  };

  const filteredOrders = orders.filter(order => {
    // Filter by print status
    if (filterPrintStatus === "printed" && !order.is_printed) return false;
    if (filterPrintStatus === "not_printed" && order.is_printed) return false;

    // Filter by color
    if (filterColor !== "all") {
      if (filterColor === "no_color" && order.color) return false;
      if (filterColor !== "no_color" && order.color !== filterColor) return false;
    }

    // Filter by max hours (exact hours, not decimals)
    if (filterMaxHours) {
      const printTime = getPrintTime(order);
      if (printTime === null) return false;
      const maxMinutes = parseInt(filterMaxHours) * 60; // Exact hours only
      if (printTime > maxMinutes) return false;
    }

    return true;
  });

  const getTotalPrintTime = (order: Order): number => {
    const printTime = getPrintTime(order);
    return (printTime || 0) * order.quantity;
  };

  const formatTime = (minutes: number | null): string => {
    if (minutes === null) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const availableVariations = variations.filter(v => v.piece_id === newOrder.piece_id);

  // Get unique colors from orders
  const availableColors = Array.from(
    new Set(orders.map(o => o.color).filter(Boolean))
  ).sort();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Controle de Pedidos</h1>
            <p className="text-muted-foreground">Gerencie os pedidos vendidos e status de impressão</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Pedido</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="piece">Peça *</Label>
                  <Select value={newOrder.piece_id} onValueChange={(value) => setNewOrder({ ...newOrder, piece_id: value, variation_id: "" })}>
                    <SelectTrigger id="piece">
                      <SelectValue placeholder="Selecione uma peça" />
                    </SelectTrigger>
                    <SelectContent>
                      {pieces.map(piece => (
                        <SelectItem key={piece.id} value={piece.id}>
                          <div className="flex items-center gap-3">
                            {piece.image_url ? (
                              <img 
                                src={piece.image_url} 
                                alt={piece.name}
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <span>{piece.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {availableVariations.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="variation">Variação</Label>
                    <Select value={newOrder.variation_id} onValueChange={(value) => setNewOrder({ ...newOrder, variation_id: value })}>
                      <SelectTrigger id="variation">
                        <SelectValue placeholder="Selecione uma variação (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem variação</SelectItem>
                        {availableVariations.map(variation => (
                          <SelectItem key={variation.id} value={variation.id}>
                            {variation.variation_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newOrder.quantity}
                      onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Cor</Label>
                    <Input
                      id="color"
                      value={newOrder.color}
                      onChange={(e) => setNewOrder({ ...newOrder, color: e.target.value })}
                      placeholder="Ex: Preto, Branco"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                    placeholder="Observações sobre o pedido"
                    rows={3}
                  />
                </div>

                <Button onClick={handleCreateOrder} className="w-full">
                  Criar Pedido
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filterStatus">Status de Impressão</Label>
                <Select value={filterPrintStatus} onValueChange={setFilterPrintStatus}>
                  <SelectTrigger id="filterStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="printed">Impresso</SelectItem>
                    <SelectItem value="not_printed">Não Impresso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterColor">Cor</Label>
                <Select value={filterColor} onValueChange={setFilterColor}>
                  <SelectTrigger id="filterColor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as cores</SelectItem>
                    <SelectItem value="no_color">Sem cor</SelectItem>
                    {availableColors.map(color => (
                      <SelectItem key={color} value={color!}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterHours">Máximo de Horas (por unidade)</Label>
                <Input
                  id="filterHours"
                  type="number"
                  min="1"
                  step="1"
                  value={filterMaxHours}
                  onChange={(e) => setFilterMaxHours(e.target.value)}
                  placeholder="Ex: 2 (horas exatas)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-2xl font-bold">{filteredOrders.length}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Não Impressos</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {filteredOrders.filter(o => !o.is_printed).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Impressos</p>
                  <p className="text-2xl font-bold text-green-500">
                    {filteredOrders.filter(o => o.is_printed).length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Impresso</TableHead>
                <TableHead>Peça</TableHead>
                <TableHead>Variação</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-center">Tempo/Un.</TableHead>
                <TableHead className="text-center">Tempo Total</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum pedido encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => (
                  <TableRow key={order.id} className={order.is_printed ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={order.is_printed}
                        onCheckedChange={() => handleTogglePrinted(order.id, order.is_printed)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {order.pieces.image_url ? (
                          <img 
                            src={order.pieces.image_url} 
                            alt={order.pieces.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{order.pieces.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.piece_price_variations ? (
                        <Badge variant="outline">{order.piece_price_variations.variation_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem variação</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.color ? (
                        <Badge variant="secondary">{order.color}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{order.quantity}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatTime(getPrintTime(order))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {formatTime(getTotalPrintTime(order))}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {order.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteOrder(order.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
