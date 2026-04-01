import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  GripVertical,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Timer,
  Trash2,
  Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QueueOptimizerChat from "@/components/QueueOptimizerChat";
import { useToast } from "@/hooks/use-toast";

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
  shopeeImageUrl: string | null;
}

interface Order {
  id: string;
  piece_id: string;
  variation_id: string | null;
  quantity: number;
  status?: OrderStatus;
  is_printed: boolean;
  position: number | null;
  printer_id: string | null;
  started_at: string | null;
  expected_finish_at: string | null;
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
  printers?: {
    name: string;
  } | null;
}

interface Piece {
  id: string;
  name: string;
  tempo_impressao_min: number | null;
  image_url: string | null;
}

interface PrinterItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

type OrderStatus = "pending" | "printing" | "done";

type OrderPersistenceUpdate = {
  printer_id?: string | null;
  position?: number | null;
  status?: OrderStatus;
  is_printed?: boolean;
  printed_at?: string | null;
  printed_by?: string | null;
  started_at?: string | null;
  expected_finish_at?: string | null;
};

interface QueueSection {
  printerId: string | null;
  title: string;
  description: string;
  orders: Order[];
  totalMin: number;
  finishAt: Date | null;
  busyUntil: Date | null;
  printingCount: number;
  pendingCount: number;
}

const UNASSIGNED_PRINTER_KEY = "__unassigned__";

const getPrinterKey = (printerId: string | null) => printerId ?? UNASSIGNED_PRINTER_KEY;

const fromPrinterKey = (printerKey: string) =>
  printerKey === UNASSIGNED_PRINTER_KEY ? null : printerKey;

const getOrderStatus = (order: Pick<Order, "status" | "is_printed">): OrderStatus => {
  if (order.status === "pending" || order.status === "printing" || order.status === "done") {
    return order.status;
  }

  return order.is_printed ? "done" : "pending";
};

const isOrderDone = (order: Pick<Order, "status" | "is_printed">) => getOrderStatus(order) === "done";

const isOrderPrinting = (order: Pick<Order, "status" | "is_printed">) =>
  getOrderStatus(order) === "printing";

const isOrderPending = (order: Pick<Order, "status" | "is_printed">) =>
  getOrderStatus(order) === "pending";

const sortQueueOrders = (left: Order, right: Order) => {
  const leftPrinting = isOrderPrinting(left);
  const rightPrinting = isOrderPrinting(right);

  if (leftPrinting !== rightPrinting) {
    return leftPrinting ? -1 : 1;
  }

  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;

  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }

  return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
};

const formatTime = (minutes: number | null): string => {
  if (minutes === null) return "N/A";
  if (minutes === 0) return "0min";

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
};

const formatDateTime = (date: Date): string =>
  date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatHour = (date: Date): string =>
  date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPrinterDialogOpen, setIsPrinterDialogOpen] = useState(false);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [isPersistingQueue, setIsPersistingQueue] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: "", description: "" });
  const [filterColor, setFilterColor] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "queue" | "done">("all");
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverOrderId, setDragOverOrderId] = useState<string | null>(null);
  const [dragOverPrinterKey, setDragOverPrinterKey] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAutoCompletingRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [ordersRes, piecesRes, printersRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "*, pieces(name, tempo_impressao_min, image_url), piece_price_variations(variation_name, tempo_impressao_min), printers(name)",
          )
          .eq("user_id", user.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("pieces")
          .select("id, name, tempo_impressao_min, image_url")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        supabase
          .from("printers")
          .select("id, name, description, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (piecesRes.error) throw piecesRes.error;
      if (printersRes.error) throw printersRes.error;

      const normalizedOrders = ((ordersRes.data as Order[]) || []).map((order) => ({
        ...order,
        status: getOrderStatus(order),
        started_at: order.started_at ?? null,
        expected_finish_at: order.expected_finish_at ?? null,
      }));

      setOrders(normalizedOrders);
      setPieces((piecesRes.data as Piece[]) || []);
      setPrinters((printersRes.data as PrinterItem[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const getNextPosition = (printerId: string | null, sourceOrders: Order[] = orders) => {
    const samePrinterQueue = sourceOrders.filter(
      (order) => !isOrderDone(order) && (order.printer_id ?? null) === printerId,
    );

    if (samePrinterQueue.length === 0) return 0;

    return Math.max(...samePrinterQueue.map((order) => order.position ?? -1)) + 1;
  };

  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const findBestMatch = (productName: string, activePieces: Piece[] = pieces): Piece | null => {
    const normalized = normalizeText(productName);
    const exactMatch = activePieces.find((piece) => normalizeText(piece.name) === normalized);
    if (exactMatch) return exactMatch;

    const containMatches = activePieces.filter((piece) => {
      const normalizedPiece = normalizeText(piece.name);
      return normalized.includes(normalizedPiece) || normalizedPiece.includes(normalized);
    });

    if (containMatches.length === 1) return containMatches[0];
    if (containMatches.length > 1) {
      return containMatches.sort((left, right) => right.name.length - left.name.length)[0];
    }

    const words = normalized.split(/\s+/).filter((word) => word.length >= 3);
    let bestScore = 0;
    let bestPiece: Piece | null = null;

    for (const piece of activePieces) {
      const normalizedPiece = normalizeText(piece.name);
      const pieceWords = normalizedPiece.split(/\s+/).filter((word) => word.length >= 3);
      const productInPiece = words.filter((word) => normalizedPiece.includes(word)).length;
      const pieceInProduct = pieceWords.filter((word) => normalized.includes(word)).length;
      const scoreForward = productInPiece / Math.max(words.length, 1);
      const scoreReverse = pieceInProduct / Math.max(pieceWords.length, 1);
      const score =
        scoreForward + scoreReverse > 0
          ? (2 * scoreForward * scoreReverse) / (scoreForward + scoreReverse)
          : 0;

      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestPiece = piece;
      }
    }

    return bestPiece;
  };

  async function processImportRows(parsed: ImportRow[]) {
    if (parsed.length === 0) return;

    toast({
      title: "Iniciando verificacao...",
      description: "Buscando seus produtos cadastrados.",
    });

    let activePieces = pieces;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("pieces")
          .select("id, name, tempo_impressao_min, image_url")
          .eq("user_id", user.id)
          .order("name", { ascending: true });

        if (data && data.length > 0) {
          activePieces = data as Piece[];
          setPieces(data as Piece[]);
        }
      }
    } catch (error) {
      console.error(error);
    }

    for (const row of parsed) {
      const matchedPiece = findBestMatch(row.productName, activePieces);

      if (matchedPiece) {
        row.matchedPieceId = matchedPiece.id;
        row.matchedPieceName = matchedPiece.name;
        row.imageUrl = matchedPiece.image_url;
      }
    }

    const unmatchedProducts = parsed.reduce((accumulator, row) => {
      if (!row.matchedPieceId && !accumulator.find((item) => item.productName === row.productName)) {
        accumulator.push(row);
      }

      return accumulator;
    }, [] as ImportRow[]);

    if (unmatchedProducts.length > 0 && activePieces.length > 0) {
      toast({
        title: "IA ativada",
        description: `Analisando ${unmatchedProducts.length} produto(s) por imagem e nome.`,
      });

      try {
        const { data: matchData, error: matchError } = await supabase.functions.invoke(
          "match-product-image",
          {
            body: {
              products: unmatchedProducts.map((row) => ({
                productName: row.productName,
                imageUrl: row.shopeeImageUrl,
              })),
              pieces: activePieces.map((piece) => ({ id: piece.id, name: piece.name })),
            },
          },
        );

        if (!matchError && matchData?.matches) {
          const matchMap = new Map<string, { pieceId: string; confidence: string }>();

          for (const match of matchData.matches) {
            if (match.pieceId && match.pieceId !== "null") {
              const product = unmatchedProducts[match.productIndex];
              if (product) {
                matchMap.set(product.productName, {
                  pieceId: match.pieceId,
                  confidence: match.confidence,
                });
              }
            }
          }

          for (const row of parsed) {
            if (row.matchedPieceId) continue;

            const match = matchMap.get(row.productName);
            if (!match) continue;

            const piece = activePieces.find((item) => item.id === match.pieceId);
            if (!piece) continue;

            row.matchedPieceId = piece.id;
            row.matchedPieceName = piece.name;
            row.imageUrl = piece.image_url;
          }
        }
      } catch (error) {
        console.error("AI invocation exception:", error);
      }
    }

    setImportRows(parsed);
    setIsImportDialogOpen(true);
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const parsed: ImportRow[] = [];

      for (const row of rows) {
        const productName = String(row["Nome do Anúncio"] || row["Nome do Anuncio"] || "");
        if (!productName) continue;

        const variation = String(row["Variação"] || row["Variacao"] || "");
        const colorPart = variation.split(",")[0]?.trim() || "";
        const quantity = Number.parseInt(String(row["Qtd. do Produto"] || 1), 10) || 1;
        const platformOrderId = String(
          row["Nº de Pedido da Plataforma"] || row["N° de Pedido da Plataforma"] || "",
        );
        const buyerNotes = String(row["Notas do Comprador"] || "");
        const shopeeImageUrl = String(row["Link da Imagem"] || "").replace(/\\/g, "");

        parsed.push({
          platformOrderId,
          productName,
          variation,
          color: colorPart,
          quantity,
          buyerNotes,
          matchedPieceId: null,
          matchedPieceName: null,
          imageUrl: null,
          shopeeImageUrl: shopeeImageUrl || null,
        });
      }

      await processImportRows(parsed);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({ title: "Erro ao ler arquivo", variant: "destructive" });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    const matchedRows = importRows.filter((row) => row.matchedPieceId);
    if (matchedRows.length === 0) {
      toast({ title: "Nenhum produto correspondente encontrado", variant: "destructive" });
      return;
    }

    setIsImporting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const consolidatedMap = new Map<string, ImportRow>();

      for (const row of matchedRows) {
        const key = `${row.platformOrderId}::${row.matchedPieceId}::${row.color}`;
        const existing = consolidatedMap.get(key);

        if (existing) {
          existing.quantity += row.quantity;
        } else {
          consolidatedMap.set(key, { ...row });
        }
      }

      const consolidatedRows = Array.from(consolidatedMap.values());

      const newRows = consolidatedRows.filter((row) => {
        const noteKey = row.platformOrderId || "";
        if (!noteKey) return true;

        return !orders.some((order) => {
          const orderNote = order.notes || "";
          return orderNote.includes(noteKey) && order.piece_id === row.matchedPieceId;
        });
      });

      if (newRows.length === 0) {
        toast({
          title: "Todos os pedidos ja existem",
          description: `${matchedRows.length} pedido(s) ja estavam na fila.`,
        });
        setIsImportDialogOpen(false);
        setImportRows([]);
        return;
      }

      const skipped = consolidatedRows.length - newRows.length;
      let nextPosition = getNextPosition(null);

      const inserts = newRows.map((row) => ({
        user_id: user.id,
        piece_id: row.matchedPieceId!,
        quantity: row.quantity,
        color: row.color || null,
        notes: row.buyerNotes ? `${row.platformOrderId} - ${row.buyerNotes}` : row.platformOrderId || null,
        status: "pending",
        position: nextPosition++,
        started_at: null,
        expected_finish_at: null,
      }));

      const { error } = await supabase.from("orders").insert(inserts);
      if (error) throw error;

      toast({
        title: "Importacao concluida",
        description:
          skipped > 0
            ? `${newRows.length} novo(s), ${skipped} duplicado(s) ignorado(s)`
            : `${newRows.length} pedido(s) importado(s)!`,
      });

      setIsImportDialogOpen(false);
      setImportRows([]);
      await fetchData();
    } catch (error) {
      console.error("Error importing orders:", error);
      toast({ title: "Erro ao importar pedidos", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const updateImportRowMatch = (index: number, pieceId: string) => {
    setImportRows((previousRows) => {
      const targetRow = previousRows[index];
      const piece = pieces.find((item) => item.id === pieceId);

      return previousRows.map((row, rowIndex) => {
        if (rowIndex === index || (!row.matchedPieceId && row.productName === targetRow.productName)) {
          return {
            ...row,
            matchedPieceId: piece?.id || null,
            matchedPieceName: piece?.name || null,
            imageUrl: piece?.image_url || null,
          };
        }

        return row;
      });
    });
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;

      setOrders((previousOrders) => previousOrders.filter((order) => order.id !== orderId));
      toast({ title: "Pedido excluido" });
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const updateSingleOrder = async (
    orderId: string,
    update: OrderPersistenceUpdate,
    successToast?: { title: string; description?: string },
  ) => {
    try {
      const { error } = await supabase.from("orders").update(update).eq("id", orderId);

      if (error) throw error;

      if (successToast) {
        toast(successToast);
      }

      await fetchData();
    } catch (error) {
      console.error("Error updating order:", error);
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const buildQueueBuckets = (queueOrders: Order[]) => {
    const buckets = new Map<string, Order[]>();
    buckets.set(UNASSIGNED_PRINTER_KEY, []);

    printers.forEach((printer) => {
      buckets.set(printer.id, []);
    });

    [...queueOrders].sort(sortQueueOrders).forEach((order) => {
      const printerKey = getPrinterKey(order.printer_id);
      const bucket = buckets.get(printerKey) || [];
      bucket.push(order);
      buckets.set(printerKey, bucket);
    });

    return buckets;
  };

  const clearDragState = () => {
    setDraggedOrderId(null);
    setDragOverOrderId(null);
    setDragOverPrinterKey(null);
  };

  const persistQueueBuckets = async (
    buckets: Map<string, Order[]>,
    successToast?: { title: string; description?: string },
    overrides: Map<string, OrderPersistenceUpdate> = new Map(),
  ) => {
    setIsPersistingQueue(true);

    try {
      const updates = Array.from(buckets.entries()).flatMap(([printerKey, bucketOrders]) =>
        bucketOrders.map((order, index) => ({
          id: order.id,
          payload: {
            printer_id: fromPrinterKey(printerKey),
            position: index,
            ...overrides.get(order.id),
          } as OrderPersistenceUpdate,
        })),
      );

      const results = await Promise.all(
        updates.map((update) =>
          supabase.from("orders").update(update.payload).eq("id", update.id),
        ),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      clearDragState();

      if (successToast) {
        toast(successToast);
      }

      await fetchData();
    } catch (error) {
      console.error("Error persisting queue:", error);
      toast({ title: "Erro ao salvar fila", variant: "destructive" });
    } finally {
      setIsPersistingQueue(false);
    }
  };

  const moveOrderInQueue = async (
    orderId: string,
    targetPrinterId: string | null,
    targetOrderId: string | null = null,
    successToast?: { title: string; description?: string },
  ) => {
    const movingOrder = orders.find((order) => order.id === orderId && isOrderPending(order));
    if (!movingOrder) return;
    if (targetOrderId === orderId) return;

    const buckets = buildQueueBuckets(orders.filter((order) => !isOrderDone(order) && order.id !== orderId));
    const printerKey = getPrinterKey(targetPrinterId);
    const targetBucket = buckets.get(printerKey) || [];
    const insertIndex = targetOrderId
      ? targetBucket.findIndex((order) => order.id === targetOrderId)
      : targetBucket.length;

    targetBucket.splice(
      insertIndex >= 0 ? insertIndex : targetBucket.length,
      0,
      { ...movingOrder, printer_id: targetPrinterId },
    );
    buckets.set(printerKey, targetBucket);

    await persistQueueBuckets(buckets, successToast);
  };

  const handleOrderPrinterChange = async (orderId: string, printerId: string | null) => {
    await moveOrderInQueue(orderId, printerId, null, {
      title: "Pedido direcionado",
      description: "A fila foi atualizada para a impressora selecionada.",
    });
  };

  const handleOrderStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    const currentStatus = getOrderStatus(order);
    if (currentStatus === nextStatus) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (nextStatus === "printing") {
        if (!order.printer_id) {
          toast({
            title: "Escolha uma impressora primeiro",
            description: "Direcione o pedido para uma maquina antes de marcar como fazendo.",
            variant: "destructive",
          });
          return;
        }

        const hasAnotherPrintingOrder = orders.some(
          (candidate) =>
            candidate.id !== order.id &&
            (candidate.printer_id ?? null) === order.printer_id &&
            isOrderPrinting(candidate),
        );

        if (hasAnotherPrintingOrder) {
          toast({
            title: "Essa impressora ja esta fazendo um pedido",
            description: "Finalize o atual ou volte ele para pendente antes de iniciar outro.",
            variant: "destructive",
          });
          return;
        }

        const startedAt = new Date();
        const expectedFinishAt = new Date(startedAt.getTime() + getPrintTimeMin(order) * 60_000);
        const buckets = buildQueueBuckets(orders.filter((item) => !isOrderDone(item) && item.id !== order.id));
        const printerKey = getPrinterKey(order.printer_id);
        const targetBucket = buckets.get(printerKey) || [];

        targetBucket.unshift({
          ...order,
          status: "printing",
          is_printed: false,
          started_at: startedAt.toISOString(),
          expected_finish_at: expectedFinishAt.toISOString(),
          printed_at: null,
          printed_by: null,
        });
        buckets.set(printerKey, targetBucket);

        const overrides = new Map<string, OrderPersistenceUpdate>([
          [
            order.id,
            {
              status: "printing",
              is_printed: false,
              started_at: startedAt.toISOString(),
              expected_finish_at: expectedFinishAt.toISOString(),
              printed_at: null,
              printed_by: null,
            },
          ],
        ]);

        await persistQueueBuckets(buckets, {
          title: "Pedido em producao",
          description: `A impressora ficara ocupada ate ${formatHour(expectedFinishAt)} neste item.`,
        }, overrides);
        return;
      }

      if (nextStatus === "done") {
        const completedAt =
          currentStatus === "printing" && order.expected_finish_at
            ? order.expected_finish_at
            : new Date().toISOString();

        await updateSingleOrder(
          order.id,
          {
            status: "done",
            is_printed: true,
            printed_at: completedAt,
            printed_by: user.email ?? "manual",
            started_at: currentStatus === "printing" ? order.started_at : null,
            expected_finish_at: currentStatus === "printing" ? order.expected_finish_at : null,
          },
          { title: "Pedido marcado como feito" },
        );
        return;
      }

      await updateSingleOrder(
        order.id,
        {
          status: "pending",
          is_printed: false,
          printed_at: null,
          printed_by: null,
          started_at: null,
          expected_finish_at: null,
          position:
            currentStatus === "done"
              ? getNextPosition(order.printer_id, orders.filter((item) => item.id !== order.id))
              : order.position ?? 0,
        },
        {
          title: "Pedido voltou para pendente",
          description: "Ele volta para a fila da impressora selecionada.",
        },
      );
    } catch (error) {
      console.error("Error changing order status:", error);
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  const handleCreatePrinter = async () => {
    if (!newPrinter.name.trim()) {
      toast({ title: "Informe o nome da impressora", variant: "destructive" });
      return;
    }

    setIsSavingPrinter(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("printers").insert({
        user_id: user.id,
        name: newPrinter.name.trim(),
        description: newPrinter.description.trim() || null,
      });

      if (error) throw error;

      setNewPrinter({ name: "", description: "" });
      toast({ title: "Impressora adicionada!" });
      await fetchData();
    } catch (error) {
      console.error("Error creating printer:", error);
      toast({ title: "Erro ao adicionar impressora", variant: "destructive" });
    } finally {
      setIsSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (printerId: string) => {
    try {
      const { error } = await supabase.from("printers").delete().eq("id", printerId);
      if (error) throw error;

      toast({
        title: "Impressora removida",
        description: "Os pedidos ligados a ela voltaram para a fila sem impressora.",
      });
      await fetchData();
    } catch (error) {
      console.error("Error deleting printer:", error);
      toast({ title: "Erro ao remover impressora", variant: "destructive" });
    }
  };

  const getPrintTimeMin = (order: Order) => {
    const time =
      order.variation_id && order.piece_price_variations
        ? order.piece_price_variations.tempo_impressao_min
        : order.pieces.tempo_impressao_min;

    return (time || 0) * order.quantity;
  };

  const getOrderExpectedFinishAt = (order: Order, referenceDate = now) => {
    if (isOrderPrinting(order)) {
      if (order.expected_finish_at) {
        return new Date(order.expected_finish_at);
      }

      if (order.started_at) {
        return new Date(new Date(order.started_at).getTime() + getPrintTimeMin(order) * 60_000);
      }
    }

    return new Date(referenceDate.getTime() + getPrintTimeMin(order) * 60_000);
  };

  const getRemainingPrintTimeMin = (order: Order, referenceDate = now) => {
    if (!isOrderPrinting(order)) {
      return getPrintTimeMin(order);
    }

    const expectedFinishAt = getOrderExpectedFinishAt(order, referenceDate);
    return Math.max(0, Math.ceil((expectedFinishAt.getTime() - referenceDate.getTime()) / 60_000));
  };

  const syncOverduePrintingOrders = async (sourceOrders: Order[] = orders) => {
    if (isAutoCompletingRef.current) return;

    const overdueOrders = sourceOrders.filter(
      (order) =>
        isOrderPrinting(order) &&
        getOrderExpectedFinishAt(order).getTime() <= new Date().getTime(),
    );

    if (overdueOrders.length === 0) return;

    isAutoCompletingRef.current = true;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const results = await Promise.all(
        overdueOrders.map((order) =>
          supabase
            .from("orders")
            .update({
              status: "done",
              is_printed: true,
              printed_at: order.expected_finish_at ?? new Date().toISOString(),
              printed_by: user?.email ?? "automatico",
            })
            .eq("id", order.id),
        ),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      toast({
        title: "Pedidos finalizados automaticamente",
        description: `${overdueOrders.length} pedido(s) saiu(ram) de "fazendo" para "feito".`,
      });
      await fetchData();
    } catch (error) {
      console.error("Error auto completing orders:", error);
      toast({ title: "Erro ao finalizar automaticamente", variant: "destructive" });
    } finally {
      isAutoCompletingRef.current = false;
    }
  };

  useEffect(() => {
    void syncOverduePrintingOrders();
  }, [now, orders]);

  const queue = useMemo(
    () => orders.filter((order) => !isOrderDone(order)).sort(sortQueueOrders),
    [orders],
  );
  const done = useMemo(() => orders.filter((order) => isOrderDone(order)), [orders]);
  const printingCount = useMemo(
    () => queue.filter((order) => isOrderPrinting(order)).length,
    [queue],
  );

  const uniqueColors = useMemo(() => {
    const colors = new Set(orders.map((order) => order.color).filter(Boolean) as string[]);
    return Array.from(colors).sort();
  }, [orders]);

  const filterOrder = (order: Order) => {
    if (filterColor !== "all" && order.color !== filterColor) return false;

    if (
      filterSearch &&
      !order.pieces.name.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !(order.notes || "").toLowerCase().includes(filterSearch.toLowerCase())
    ) {
      return false;
    }

    return true;
  };

  const filteredQueue = useMemo(() => queue.filter(filterOrder), [queue, filterColor, filterSearch]);
  const filteredDone = useMemo(() => done.filter(filterOrder), [done, filterColor, filterSearch]);

  const getPlatformId = (order: Order) => {
    const notes = order.notes || "";
    const match = notes.match(/^(\S+)/);
    return match?.[1] || "sem-pedido";
  };

  const groupOrders = (orderList: Order[]) => {
    const groups: Record<string, Order[]> = {};

    for (const order of orderList) {
      const key = getPlatformId(order);
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }

    return Object.entries(groups);
  };

  const groupedDone = useMemo(() => groupOrders(filteredDone), [filteredDone]);

  const totalQueueMin = useMemo(
    () => queue.reduce((total, order) => total + getRemainingPrintTimeMin(order), 0),
    [queue],
  );

  const filteredQueueMin = useMemo(
    () => filteredQueue.reduce((total, order) => total + getRemainingPrintTimeMin(order), 0),
    [filteredQueue],
  );

  const printerStatsMap = useMemo(() => {
    const statsMap = new Map<
      string,
      { count: number; totalMin: number; printingCount: number; busyUntil: Date | null }
    >();
    statsMap.set(UNASSIGNED_PRINTER_KEY, {
      count: 0,
      totalMin: 0,
      printingCount: 0,
      busyUntil: null,
    });

    printers.forEach((printer) => {
      statsMap.set(printer.id, { count: 0, totalMin: 0, printingCount: 0, busyUntil: null });
    });

    const buckets = buildQueueBuckets(queue);

    buckets.forEach((bucketOrders, printerKey) => {
      let cursor = now;
      let totalMin = 0;
      let printing = 0;

      bucketOrders.forEach((order) => {
        if (isOrderPrinting(order)) {
          printing += 1;
          const finishAt = getOrderExpectedFinishAt(order, now);
          const remainingMin = getRemainingPrintTimeMin(order, now);
          totalMin += remainingMin;
          cursor = finishAt > now ? finishAt : now;
          return;
        }

        const durationMin = getPrintTimeMin(order);
        totalMin += durationMin;
        cursor = new Date(cursor.getTime() + durationMin * 60_000);
      });

      statsMap.set(printerKey, {
        count: bucketOrders.length,
        totalMin,
        printingCount: printing,
        busyUntil: bucketOrders.length > 0 ? cursor : null,
      });
    });

    return statsMap;
  }, [now, printers, queue]);

  const queueSections = useMemo<QueueSection[]>(() => {
    const sections = [
      {
        printerId: null,
        title: "Sem impressora",
        description: "Pedidos ainda nao direcionados",
        orders: [] as Order[],
      },
      ...printers.map((printer) => ({
        printerId: printer.id,
        title: printer.name,
        description: printer.description || "Fila desta impressora",
        orders: [] as Order[],
      })),
    ];

    const sectionMap = new Map<string, (typeof sections)[number]>();
    sections.forEach((section) => {
      sectionMap.set(getPrinterKey(section.printerId), section);
    });

    filteredQueue.forEach((order) => {
      const printerKey = getPrinterKey(order.printer_id);
      const targetSection = sectionMap.get(printerKey) || sectionMap.get(UNASSIGNED_PRINTER_KEY);
      targetSection?.orders.push(order);
    });

    return sections
      .map((section) => {
        let accumulatedMinutes = 0;
        let finishAt: Date | null = null;
        let busyCursor = now;
        let printingOrders = 0;
        let pendingOrders = 0;

        section.orders.forEach((order) => {
          if (isOrderPrinting(order)) {
            printingOrders += 1;
            finishAt = getOrderExpectedFinishAt(order, now);
            accumulatedMinutes += getRemainingPrintTimeMin(order, now);
            busyCursor = finishAt > now ? finishAt : now;
            return;
          }

          pendingOrders += 1;
          const durationMin = getPrintTimeMin(order);
          accumulatedMinutes += durationMin;
          busyCursor = new Date(busyCursor.getTime() + durationMin * 60_000);
          finishAt = busyCursor;
        });

        return {
          printerId: section.printerId,
          title: section.title,
          description: section.description,
          orders: section.orders,
          totalMin: accumulatedMinutes,
          finishAt,
          busyUntil: section.orders.length > 0 ? busyCursor : null,
          printingCount: printingOrders,
          pendingCount: pendingOrders,
        };
      })
      .filter((section) => section.orders.length > 0 || section.printerId === null || printers.length === 0);
  }, [filteredQueue, now, printers]);

  const queueTimeMap = useMemo(() => {
    const timeMap = new Map<
      string,
      {
        totalMin: number;
        remainingMin: number;
        startAt: Date;
        finishAt: Date;
        status: OrderStatus;
      }
    >();

    queueSections.forEach((section) => {
      let cursor = now;

      section.orders.forEach((order) => {
        if (isOrderPrinting(order)) {
          const finishAt = getOrderExpectedFinishAt(order, now);
          const remainingMin = getRemainingPrintTimeMin(order, now);
          const startAt = order.started_at ? new Date(order.started_at) : now;

          timeMap.set(order.id, {
            totalMin: getPrintTimeMin(order),
            remainingMin,
            startAt,
            finishAt,
            status: "printing",
          });

          cursor = finishAt > now ? finishAt : now;
          return;
        }

        const durationMin = getPrintTimeMin(order);
        const startAt = cursor;
        const finishAt = new Date(cursor.getTime() + durationMin * 60_000);

        timeMap.set(order.id, {
          totalMin: durationMin,
          remainingMin: durationMin,
          startAt,
          finishAt,
          status: "pending",
        });

        cursor = finishAt;
      });
    });

    return timeMap;
  }, [now, queueSections]);

  const hasQueueVisible = useMemo(
    () => queueSections.some((section) => section.orders.length > 0),
    [queueSections],
  );

  const activeQueueSections = useMemo(
    () => queueSections.filter((section) => section.orders.length > 0).length,
    [queueSections],
  );

  const canReorderQueue = filterColor === "all" && !filterSearch.trim() && !isPersistingQueue;
  const unassignedQueueCount = printerStatsMap.get(UNASSIGNED_PRINTER_KEY)?.count || 0;

  const handleDragStart = (order: Order) => {
    if (!canReorderQueue || !isOrderPending(order)) return;
    setDraggedOrderId(order.id);
    setDragOverOrderId(null);
    setDragOverPrinterKey(getPrinterKey(order.printer_id));
  };

  const handleDragEnd = () => {
    clearDragState();
  };

  const handleSectionDragOver = (event: DragEvent<HTMLDivElement>, printerId: string | null) => {
    if (!draggedOrderId || !canReorderQueue) return;
    event.preventDefault();
    setDragOverOrderId(null);
    setDragOverPrinterKey(getPrinterKey(printerId));
  };

  const handleSectionDrop = async (
    event: DragEvent<HTMLDivElement>,
    printerId: string | null,
  ) => {
    if (!draggedOrderId || !canReorderQueue) return;
    event.preventDefault();
    await moveOrderInQueue(draggedOrderId, printerId);
  };

  const handleOrderDragOver = (event: DragEvent<HTMLDivElement>, order: Order) => {
    if (!draggedOrderId || !canReorderQueue || !isOrderPending(order)) return;
    event.preventDefault();
    event.stopPropagation();

    if (draggedOrderId === order.id) return;

    setDragOverOrderId(order.id);
    setDragOverPrinterKey(getPrinterKey(order.printer_id));
  };

  const handleOrderDrop = async (event: DragEvent<HTMLDivElement>, order: Order) => {
    if (!draggedOrderId || !canReorderQueue || draggedOrderId === order.id || !isOrderPending(order)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    await moveOrderInQueue(draggedOrderId, order.printer_id, order.id);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Fila de Producao</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Importe pedidos via Excel exportado do{" "}
            <a
              href="https://app.upseller.com/pt/order/to-ship"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              UpSeller - Pedidos - Para Enviar
            </a>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isPrinterDialogOpen} onOpenChange={setIsPrinterDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" />
                Gerenciar impressoras
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Impressoras cadastradas
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Nome da impressora</Label>
                    <Input
                      placeholder="Ex: Bambu A1, Ender 3, K1..."
                      value={newPrinter.name}
                      onChange={(event) =>
                        setNewPrinter((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descricao opcional</Label>
                    <Input
                      placeholder="Ex: impressora principal, PETG, fila rapida..."
                      value={newPrinter.description}
                      onChange={(event) =>
                        setNewPrinter((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </div>
                  <Button onClick={handleCreatePrinter} disabled={isSavingPrinter}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isSavingPrinter ? "Salvando..." : "Adicionar impressora"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Lista atual</p>
                  {printers.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma impressora cadastrada ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {printers.map((printer) => {
                        const stats = printerStatsMap.get(printer.id) || {
                          count: 0,
                          totalMin: 0,
                          printingCount: 0,
                          busyUntil: null,
                        };

                        return (
                          <div
                            key={printer.id}
                            className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                              <Printer className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium">{printer.name}</p>
                                <Badge variant="secondary" className="text-[10px]">
                                  {stats.count} na fila
                                </Badge>
                                {stats.printingCount > 0 ? (
                                  <Badge className="text-[10px]">Fazendo {stats.printingCount}</Badge>
                                ) : null}
                                <Badge variant="outline" className="text-[10px]">
                                  Restante {formatTime(stats.totalMin)}
                                </Badge>
                              </div>
                              {printer.description ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {printer.description}
                                </p>
                              ) : null}
                              {stats.busyUntil ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Ocupada ate {formatHour(stats.busyUntil)}
                                </p>
                              ) : null}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeletePrinter(printer.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
        </div>
      </div>

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
                {importRows.filter((row) => row.matchedPieceId).length} correspondidos
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {importRows.filter((row) => !row.matchedPieceId).length} nao encontrados
              </Badge>
            </div>
            <ScrollArea className="h-[400px] pr-3">
              <div className="space-y-2">
                {importRows.map((row, index) => (
                  <Card
                    key={index}
                    className={`border-l-4 ${
                      row.matchedPieceId ? "border-l-primary" : "border-l-destructive"
                    }`}
                  >
                    <CardContent className="py-2.5 px-3">
                      <div className="flex items-start gap-2">
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-muted-foreground truncate" title={row.productName}>
                            {row.productName}
                          </p>
                          {row.matchedPieceId ? (
                            <p className="text-sm font-medium text-primary truncate">
                              {row.matchedPieceName}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-orange-500 truncate">
                                {row.productName}
                              </p>
                              <Select onValueChange={(value) => updateImportRowMatch(index, value)}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Corrigir peca manualmente..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {pieces.map((piece) => (
                                    <SelectItem key={piece.id} value={piece.id} className="text-xs">
                                      {piece.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {row.color ? (
                              <Badge variant="outline" className="text-[10px]">
                                {row.color}
                              </Badge>
                            ) : null}
                            <Badge variant="secondary" className="text-[10px]">
                              x{row.quantity}
                            </Badge>
                            {row.platformOrderId ? (
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                {row.platformOrderId}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            <Button
              onClick={handleConfirmImport}
              className="w-full"
              disabled={isImporting || importRows.filter((row) => row.matchedPieceId).length === 0}
            >
              {isImporting
                ? "Importando..."
                : `Importar ${importRows.filter((row) => row.matchedPieceId).length} de ${importRows.length} pedido(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold">{queue.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Fazendo</p>
            <p className="text-2xl font-bold text-primary">{printingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Tempo restante</p>
            <p className="text-2xl font-bold">{formatTime(totalQueueMin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Impressoras</p>
            <p className="text-2xl font-bold">{printers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Sem impressora</p>
            <p className="text-2xl font-bold">{unassignedQueueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Concluidos</p>
            <p className="text-2xl font-bold text-primary">{done.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar peca ou no do pedido..."
            value={filterSearch}
            onChange={(event) => setFilterSearch(event.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filterColor} onValueChange={setFilterColor}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
            <SelectValue placeholder="Cor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cores</SelectItem>
            {uniqueColors.map((color) => (
              <SelectItem key={color} value={color}>
                {color}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {(["all", "queue", "done"] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              className="text-xs h-9"
              onClick={() => setFilterStatus(status)}
            >
              {status === "all" ? "Todos" : status === "queue" ? "Na fila" : "Concluidos"}
            </Button>
          ))}
        </div>
      </div>

      {filterStatus !== "done" && filteredQueue.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Pendentes</div>
            <div className="text-lg font-bold">{filteredQueue.filter((order) => isOrderPending(order)).length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Fazendo agora</div>
            <div className="text-lg font-bold text-primary">
              {filteredQueue.filter((order) => isOrderPrinting(order)).length}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Tempo restante</div>
            <div className="text-lg font-bold">{formatTime(filteredQueueMin)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Filas ativas</div>
            <div className="text-lg font-bold">{activeQueueSections}</div>
          </Card>
        </div>
      ) : null}

      {filterStatus !== "done" ? (
        <div className="mb-8">
          <div className="flex flex-col gap-1 mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Fila por impressora ({filteredQueue.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Arraste os cards para mudar a ordem da fila ou mover entre impressoras.
              O seletor da linha tambem pode redirecionar o pedido e trocar entre pendente, fazendo e feito.
            </p>
            {!canReorderQueue ? (
              <p className="text-xs text-amber-600">
                Limpe a busca e o filtro de cor para arrastar a fila com o mouse.
              </p>
            ) : null}
          </div>

          {!hasQueueVisible ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum pedido na fila.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {queueSections.map((section) => {
                const printerKey = getPrinterKey(section.printerId);

                return (
                  <Card
                    key={printerKey}
                    className={`overflow-hidden transition-colors ${
                      dragOverPrinterKey === printerKey && !dragOverOrderId ? "ring-2 ring-primary/50" : ""
                    }`}
                  >
                    <CardHeader className="py-3 px-3 sm:px-4 bg-muted/40 border-b">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Printer className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">{section.title}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {section.orders.length} {section.orders.length === 1 ? "item" : "itens"}
                        </Badge>
                        {section.printingCount > 0 ? (
                          <Badge className="text-[10px]">Fazendo {section.printingCount}</Badge>
                        ) : null}
                        {section.pendingCount > 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            Pendentes {section.pendingCount}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px]">
                          Restante {formatTime(section.totalMin)}
                        </Badge>
                        {section.busyUntil ? (
                          <Badge variant="outline" className="text-[10px]">
                            Ocupada ate {formatHour(section.busyUntil)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </CardHeader>

                    <CardContent
                      className="p-0"
                      onDragOver={(event) => handleSectionDragOver(event, section.printerId)}
                      onDrop={(event) => handleSectionDrop(event, section.printerId)}
                    >
                      {section.orders.length === 0 ? (
                        <div className="py-8 px-4 text-center text-sm text-muted-foreground border-t border-dashed">
                          Solte aqui os pedidos desta impressora.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {section.orders.map((order) => {
                            const times = queueTimeMap.get(order.id);
                            const totalMin = times?.totalMin || 0;
                            const remainingMin = times?.remainingMin || 0;
                            const startAt = times?.startAt || now;
                            const finishAt = times?.finishAt || now;
                            const orderStatus = getOrderStatus(order);
                            const isPrintingRow = orderStatus === "printing";
                            const isPendingRow = orderStatus === "pending";
                            const platformId = getPlatformId(order);

                            return (
                              <div
                                key={order.id}
                                className={`py-3 px-3 sm:px-4 transition-colors ${
                                  dragOverOrderId === order.id
                                    ? "bg-primary/5 border-t-2 border-primary"
                                    : "hover:bg-accent/30"
                                }`}
                                onDragOver={
                                  isPendingRow ? (event) => handleOrderDragOver(event, order) : undefined
                                }
                                onDrop={isPendingRow ? (event) => handleOrderDrop(event, order) : undefined}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    draggable={canReorderQueue && isPendingRow}
                                    onDragStart={() => handleDragStart(order)}
                                    onDragEnd={handleDragEnd}
                                    className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed ${
                                      canReorderQueue && isPendingRow
                                        ? "cursor-grab text-muted-foreground hover:text-foreground"
                                        : "opacity-40 cursor-not-allowed"
                                    }`}
                                    title={
                                      canReorderQueue && isPendingRow
                                        ? "Arraste para reordenar ou mover de impressora"
                                        : isPrintingRow
                                          ? "Pedido em producao nao pode ser arrastado"
                                          : "Limpe os filtros para arrastar"
                                    }
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </div>

                                  {order.pieces.image_url ? (
                                    <img
                                      src={order.pieces.image_url}
                                      alt={order.pieces.name}
                                      className="h-11 w-11 rounded-lg object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-sm truncate">{order.pieces.name}</span>
                                      {order.quantity > 1 ? (
                                        <Badge variant="secondary" className="text-[10px]">
                                          x{order.quantity}
                                        </Badge>
                                      ) : null}
                                      {order.color ? (
                                        <Badge variant="outline" className="text-[10px]">
                                          {order.color}
                                        </Badge>
                                      ) : null}
                                      {order.piece_price_variations ? (
                                        <Badge variant="outline" className="text-[10px]">
                                          {order.piece_price_variations.variation_name}
                                        </Badge>
                                      ) : null}
                                      {platformId !== "sem-pedido" ? (
                                        <Badge variant="secondary" className="text-[10px] font-mono">
                                          {platformId}
                                        </Badge>
                                      ) : null}
                                      <Badge
                                        variant={isPrintingRow ? "default" : "outline"}
                                        className="text-[10px]"
                                      >
                                        {isPrintingRow ? "Fazendo" : "Pendente"}
                                      </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-[11px] font-medium">
                                          {isPrintingRow ? `Resta ${formatTime(remainingMin)}` : formatTime(totalMin)}
                                        </span>
                                      </div>
                                      {isPrintingRow ? (
                                        <div className="flex items-center gap-1">
                                          <Timer className="h-3 w-3 text-primary" />
                                          <span className="text-[11px] text-primary font-medium">
                                            Inicio {formatHour(startAt)}
                                          </span>
                                        </div>
                                      ) : null}
                                      <div className="flex items-center gap-1">
                                        <CalendarClock className="h-3 w-3 text-primary" />
                                        <span className="text-[11px] text-primary font-medium">
                                          {isPrintingRow ? `Termina ${formatHour(finishAt)}` : `Prev. ${formatDateTime(finishAt)}`}
                                        </span>
                                      </div>
                                      <Select
                                        disabled={isPrintingRow}
                                        value={getPrinterKey(order.printer_id)}
                                        onValueChange={(value) => {
                                          const nextPrinterId = fromPrinterKey(value);
                                          if ((order.printer_id ?? null) === nextPrinterId) return;
                                          void handleOrderPrinterChange(order.id, nextPrinterId);
                                        }}
                                      >
                                        <SelectTrigger className="h-7 w-[190px] text-xs">
                                          <SelectValue placeholder="Direcionar impressora" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={UNASSIGNED_PRINTER_KEY}>
                                            Sem impressora
                                          </SelectItem>
                                          {printers.map((printer) => (
                                            <SelectItem key={printer.id} value={printer.id}>
                                              {printer.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        value={orderStatus}
                                        onValueChange={(value) =>
                                          void handleOrderStatusChange(order.id, value as OrderStatus)
                                        }
                                      >
                                        <SelectTrigger className="h-7 w-[150px] text-xs">
                                          <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pendente</SelectItem>
                                          <SelectItem value="printing">Fazendo</SelectItem>
                                          <SelectItem value="done">Feito</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => void handleDeleteOrder(order.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {filterStatus !== "queue" && filteredDone.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Concluidos ({filteredDone.length})
          </h2>
          <div className="space-y-4">
            {groupedDone.map(([platformId, groupOrders]) => (
              <Card
                key={platformId}
                className="overflow-hidden opacity-80 hover:opacity-100 transition-opacity"
              >
                <CardHeader className="py-2 px-3 sm:px-4 bg-muted/30 border-b">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold font-mono text-muted-foreground">
                      {platformId === "sem-pedido" ? "Sem no de pedido" : platformId}
                    </span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {groupOrders.length} {groupOrders.length === 1 ? "item" : "itens"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {groupOrders.map((order) => (
                      <div key={order.id} className="py-2 px-3 sm:px-4">
                        <div className="flex items-center gap-3">
                          {order.pieces.image_url ? (
                            <img
                              src={order.pieces.image_url}
                              alt={order.pieces.name}
                              className="h-9 w-9 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm line-through text-muted-foreground truncate">
                                {order.pieces.name}
                              </span>
                              {order.quantity > 1 ? (
                                <Badge variant="secondary" className="text-xs">
                                  x{order.quantity}
                                </Badge>
                              ) : null}
                              {order.color ? (
                                <Badge variant="outline" className="text-xs">
                                  {order.color}
                                </Badge>
                              ) : null}
                              {order.printers?.name ? (
                                <Badge variant="outline" className="text-xs">
                                  {order.printers.name}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          {order.printed_at ? (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDateTime(new Date(order.printed_at))}
                            </span>
                          ) : null}
                          <div className="flex items-center gap-2 shrink-0">
                            <Select
                              value={getOrderStatus(order)}
                              onValueChange={(value) =>
                                void handleOrderStatusChange(order.id, value as OrderStatus)
                              }
                            >
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="printing">Fazendo</SelectItem>
                                <SelectItem value="done">Feito</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteOrder(order.id)}
                            >
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
      ) : null}

      <QueueOptimizerChat
        queueData={filteredQueue.filter((order) => isOrderPending(order)).map((order) => ({
          id: order.id,
          name: order.pieces.name,
          color: order.color,
          quantity: order.quantity,
          tempo_min:
            order.variation_id && order.piece_price_variations
              ? order.piece_price_variations.tempo_impressao_min
              : order.pieces.tempo_impressao_min,
          variation: order.piece_price_variations?.variation_name || null,
          platformOrderId: (order.notes || "").split(" - ")[0] || "",
        }))}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        onReorder={async (orderedIds, explanation) => {
          try {
            const rankMap = new Map(orderedIds.map((id, index) => [id, index]));
            const buckets = buildQueueBuckets(orders.filter((order) => !isOrderDone(order)));
            const reorderedBuckets = new Map<string, Order[]>();

            buckets.forEach((bucketOrders, printerKey) => {
              const printingOrders = bucketOrders.filter((order) => isOrderPrinting(order));
              const pendingOrders = bucketOrders
                .filter((order) => isOrderPending(order))
                .sort((left, right) => {
                  const leftRank = rankMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
                  const rightRank = rankMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;

                  if (leftRank !== rightRank) return leftRank - rightRank;
                  return sortQueueOrders(left, right);
                });

              const nextOrders = [...printingOrders, ...pendingOrders];

              reorderedBuckets.set(printerKey, nextOrders);
            });

            await persistQueueBuckets(reorderedBuckets, {
              title: "Fila reorganizada pela IA!",
              description: explanation,
            });
          } catch (error) {
            console.error("Error reordering queue with AI:", error);
            toast({ title: "Erro ao reorganizar fila", variant: "destructive" });
          }
        }}
      />
    </div>
  );
}
