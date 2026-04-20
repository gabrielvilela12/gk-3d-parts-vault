import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
  type DragEvent,
} from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  Columns3,
  FileDown,
  FileSpreadsheet,
  GripVertical,
  LayoutList,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Square,
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface ImportRow {
  platformOrderId: string;
  productName: string;
  storeName: string;
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
  platform_order_id?: string | null;
  source_product_name?: string | null;
  store_name?: string | null;
  snapshot_unit_cost?: number | null;
  snapshot_unit_price?: number | null;
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
  reference_names?: string[] | null;
  cost: number | null;
  custo_material: number | null;
  custo_energia: number | null;
  custo_acessorios: number | null;
  preco_venda: number | null;
  tempo_impressao_min: number | null;
  image_url: string | null;
  peso_g: number | null;
}

interface PrinterItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  position: number;
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
const ALL_PRINTERS_FILTER_KEY = "__all_printers__";
const PRINTER_MIGRATION_NAME = "20260401110000_add_printers_and_order_assignment.sql";
const ORDER_STATUS_MIGRATION_NAME = "20260401123000_add_order_printing_status.sql";
const ORDER_COST_SNAPSHOT_MIGRATION_NAME = "20260401170000_add_order_cost_snapshots.sql";
const ORDER_STORE_MIGRATION_NAME = "20260411184500_add_order_store_name.sql";
const FEATURE_MIGRATION_HELP = `Aplique as migrations ${PRINTER_MIGRATION_NAME}, ${ORDER_STATUS_MIGRATION_NAME}, ${ORDER_COST_SNAPSHOT_MIGRATION_NAME} e ${ORDER_STORE_MIGRATION_NAME} no Supabase.`;

type PrinterDotDetail = "solid" | "ring" | "core" | "satellite";

type PrinterAccent = {
  dot: string;
  soft: string;
  border: string;
  badge: string;
  mutedText: string;
  strongText: string;
  detail: PrinterDotDetail;
};

const NEUTRAL_PRINTER_ACCENT: PrinterAccent = {
  dot: "bg-slate-400",
  soft: "bg-white/[0.04]",
  border: "border-white/10",
  badge: "border-white/10 bg-white/[0.06] text-slate-200",
  mutedText: "text-slate-400",
  strongText: "text-slate-100",
  detail: "solid",
};

const PRINTER_ACCENTS: Array<Omit<PrinterAccent, "detail">> = [
  {
    dot: "bg-sky-400",
    soft: "bg-sky-500/10",
    border: "border-sky-400/20",
    badge: "border-sky-400/20 bg-sky-500/15 text-sky-100",
    mutedText: "text-sky-200/80",
    strongText: "text-sky-50",
  },
  {
    dot: "bg-emerald-400",
    soft: "bg-emerald-500/10",
    border: "border-emerald-400/20",
    badge: "border-emerald-400/20 bg-emerald-500/15 text-emerald-100",
    mutedText: "text-emerald-200/80",
    strongText: "text-emerald-50",
  },
  {
    dot: "bg-orange-400",
    soft: "bg-orange-500/10",
    border: "border-orange-400/20",
    badge: "border-orange-400/20 bg-orange-500/15 text-orange-100",
    mutedText: "text-orange-200/80",
    strongText: "text-orange-50",
  },
  {
    dot: "bg-fuchsia-400",
    soft: "bg-fuchsia-500/10",
    border: "border-fuchsia-400/20",
    badge: "border-fuchsia-400/20 bg-fuchsia-500/15 text-fuchsia-100",
    mutedText: "text-fuchsia-200/80",
    strongText: "text-fuchsia-50",
  },
  {
    dot: "bg-cyan-400",
    soft: "bg-cyan-500/10",
    border: "border-cyan-400/20",
    badge: "border-cyan-400/20 bg-cyan-500/15 text-cyan-100",
    mutedText: "text-cyan-200/80",
    strongText: "text-cyan-50",
  },
  {
    dot: "bg-lime-400",
    soft: "bg-lime-500/10",
    border: "border-lime-400/20",
    badge: "border-lime-400/20 bg-lime-500/15 text-lime-100",
    mutedText: "text-lime-200/80",
    strongText: "text-lime-50",
  },
];

const PRINTER_DOT_DETAILS: PrinterDotDetail[] = ["solid", "ring", "core", "satellite"];

const hashPrinterSeed = (value: string) =>
  value.split("").reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);

const getPrinterAccentBySlot = (slot: number): PrinterAccent => {
  const palette = PRINTER_ACCENTS[slot % PRINTER_ACCENTS.length];
  const detail = PRINTER_DOT_DETAILS[slot % PRINTER_DOT_DETAILS.length];
  return {
    ...palette,
    detail,
  };
};

const getPrinterOccupancyLabel = (stats: {
  count: number;
  printingCount: number;
}) => {
  if (stats.printingCount > 0) return "Ocupada";
  if (stats.count > 0) return "Em espera";
  return "Livre";
};

const getPieceSearchNames = (piece: Piece) =>
  [piece.name, ...(piece.reference_names || [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

const getStoreName = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const getStoreBadgeLabel = (value?: string | null) => {
  const storeName = getStoreName(value);
  return storeName ? `Loja ${storeName}` : null;
};

const renderPrinterDot = (accent: PrinterAccent, size: "sm" | "md" = "sm") => {
  const boxClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const coreClass = size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5";
  const ringInsetClass = size === "sm" ? "inset-[1px]" : "inset-[1.5px]";
  const satelliteClass =
    size === "sm" ? "-right-0.5 -top-0.5 h-1.5 w-1.5" : "-right-0.5 -top-0.5 h-2 w-2";

  return (
    <span className={`relative inline-flex ${boxClass} shrink-0 items-center justify-center rounded-full ${accent.dot}`}>
      {accent.detail === "ring" ? (
        <span className={`absolute ${ringInsetClass} rounded-full border border-[#050816]`} />
      ) : null}
      {accent.detail === "core" ? (
        <span className={`absolute ${coreClass} rounded-full bg-[#050816] ring-1 ring-white/10`} />
      ) : null}
      {accent.detail === "satellite" ? (
        <span className={`absolute ${satelliteClass} rounded-full border border-[#050816] bg-white/90`} />
      ) : null}
    </span>
  );
};

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

const getPieceSnapshotUnitCost = (
  piece: Pick<
    Piece,
    "cost" | "custo_material" | "custo_energia" | "custo_acessorios"
  >,
) => {
  const compositeCost =
    (piece.custo_material ?? 0) +
    (piece.custo_energia ?? 0) +
    (piece.custo_acessorios ?? 0);

  if (compositeCost > 0) {
    return compositeCost;
  }

  return piece.cost ?? null;
};

const getBaseName = (name: string): string => {
  return name.replace(/\s*-\s*\d+\s*$/, "").trim();
};

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

  // Group orders with similar names together (e.g. "Item - 1", "Item - 2")
  const leftBase = getBaseName(left.pieces.name);
  const rightBase = getBaseName(right.pieces.name);
  const nameCompare = leftBase.localeCompare(rightBase, "pt-BR");
  if (nameCompare !== 0) {
    return nameCompare;
  }

  // Within the same base name, sort by the full name naturally
  const fullNameCompare = left.pieces.name.localeCompare(right.pieces.name, "pt-BR", { numeric: true });
  if (fullNameCompare !== 0) {
    return fullNameCompare;
  }

  return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
};

const QUEUE_TIME_SORT_OPTIONS = [
  { value: "queue", label: "Posicao da fila" },
  { value: "fastest", label: "Mais rapido primeiro" },
  { value: "slowest", label: "Mais demorado primeiro" },
] as const;

type QueueTimeSort = (typeof QUEUE_TIME_SORT_OPTIONS)[number]["value"];

const QUEUE_MAX_TIME_OPTIONS = [
  { value: "all", label: "Sem limite", minutes: null },
  { value: "30", label: "Ate 30min", minutes: 30 },
  { value: "60", label: "Ate 1h", minutes: 60 },
  { value: "120", label: "Ate 2h", minutes: 120 },
  { value: "240", label: "Ate 4h", minutes: 240 },
  { value: "480", label: "Ate 8h", minutes: 480 },
  { value: "720", label: "Ate 12h", minutes: 720 },
] as const;

type QueueMaxTimeFilter = (typeof QUEUE_MAX_TIME_OPTIONS)[number]["value"];

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

const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getOrderCompletedAt = (order: Pick<Order, "printed_at" | "created_at">) =>
  new Date(order.printed_at ?? order.created_at);

const formatDoneDateLabel = (date: Date, referenceDate = new Date()) => {
  const baseLabel = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "long",
  });

  return getLocalDateKey(date) === getLocalDateKey(referenceDate)
    ? `Hoje - ${baseLabel}`
    : baseLabel;
};

const COLOR_SWATCH_MAP: Record<string, string> = {
  preto: "#1f2937",
  branco: "#f8fafc",
  vermelho: "#dc2626",
  azul: "#2563eb",
  verde: "#16a34a",
  amarelo: "#facc15",
  rosa: "#ec4899",
  pink: "#ec4899",
  roxo: "#7c3aed",
  lilas: "#a855f7",
  laranja: "#f97316",
  marrom: "#7c2d12",
  bege: "#d6c1a3",
  cinza: "#6b7280",
  cinzento: "#6b7280",
  prata: "#94a3b8",
  dourado: "#eab308",
  gold: "#eab308",
  nude: "#c4a484",
  offwhite: "#f5f5f4",
  transparente: "#e2e8f0",
  natural: "#d6c1a3",
  madeira: "#8b5a2b",
};

const normalizeColorToken = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#]/g, "");

const getColorSwatchValue = (color: string | null) => {
  if (!color) return null;

  const trimmedColor = color.trim();

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmedColor)) {
    return trimmedColor;
  }

  if (/^(rgb|hsl)a?\(/i.test(trimmedColor)) {
    return trimmedColor;
  }

  const normalizedColor = normalizeColorToken(trimmedColor);

  for (const [token, value] of Object.entries(COLOR_SWATCH_MAP)) {
    if (normalizedColor.includes(token)) {
      return value;
    }
  }

  return null;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_PATTERN = /^rgba?\(([^)]+)\)$/i;

const getColorRgbChannels = (color: string | null) => {
  const swatch = getColorSwatchValue(color);
  if (!swatch) return null;

  if (HEX_COLOR_PATTERN.test(swatch)) {
    const hex = swatch.slice(1);
    const expandedHex =
      hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
    const red = Number.parseInt(expandedHex.slice(0, 2), 16);
    const green = Number.parseInt(expandedHex.slice(2, 4), 16);
    const blue = Number.parseInt(expandedHex.slice(4, 6), 16);
    return [red, green, blue] as const;
  }

  const rgbMatch = swatch.match(RGB_COLOR_PATTERN);
  if (rgbMatch) {
    const [red, green, blue] = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((value) => Number.parseFloat(value.trim()));

    if ([red, green, blue].every((channel) => Number.isFinite(channel))) {
      return [red, green, blue] as const;
    }
  }

  return null;
};

const getColorWithAlpha = (color: string | null, alpha: number) => {
  const rgb = getColorRgbChannels(color);
  if (!rgb) return null;

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
};

const getProductLuminance = (color: string | null) => {
  const rgb = getColorRgbChannels(color);
  if (!rgb) return null;

  const [red, green, blue] = rgb;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
};

const getProductAtmosphereStyle = (color: string | null, isPrintingRow: boolean) => {
  const luminance = getProductLuminance(color);
  if (luminance === null) return undefined;

  const isDarkProduct = luminance < 0.28;
  const isLightProduct = luminance > 0.74;
  const strongTint = isDarkProduct
    ? getColorWithAlpha(color, isPrintingRow ? 0.82 : 0.74)
    : isLightProduct
      ? getColorWithAlpha(color, isPrintingRow ? 0.34 : 0.28)
      : getColorWithAlpha(color, isPrintingRow ? 0.50 : 0.42);
  const midTint = isDarkProduct
    ? getColorWithAlpha(color, isPrintingRow ? 0.54 : 0.44)
    : isLightProduct
      ? getColorWithAlpha(color, isPrintingRow ? 0.20 : 0.15)
      : getColorWithAlpha(color, isPrintingRow ? 0.30 : 0.22);
  const softTint = isDarkProduct
    ? getColorWithAlpha(color, isPrintingRow ? 0.24 : 0.18)
    : isLightProduct
      ? getColorWithAlpha(color, isPrintingRow ? 0.10 : 0.07)
      : getColorWithAlpha(color, isPrintingRow ? 0.14 : 0.10);

  if (!strongTint || !midTint || !softTint) return undefined;

  return {
    backgroundImage: `linear-gradient(100deg, ${strongTint} 0%, ${midTint} 34%, ${softTint} 58%, transparent 78%), radial-gradient(circle at 14% 18%, ${strongTint} 0%, ${midTint} 24%, transparent 48%)`,
  };
};

const getColorDotClassName = (color: string | null, size: "sm" | "md" = "md") => {
  const luminance = getProductLuminance(color);
  const sizeClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const baseClass = `${sizeClass} shrink-0 rounded-full`;

  if (luminance === null) {
    return `${baseClass} border border-white/10 bg-muted shadow-[0_0_0_2px_rgba(148,163,184,0.14)]`;
  }

  if (luminance < 0.28) {
    return `${baseClass} border border-slate-200/75 shadow-[0_0_0_2px_rgba(226,232,240,0.24),0_0_14px_rgba(255,255,255,0.10)]`;
  }

  if (luminance > 0.74) {
    return `${baseClass} border border-slate-950/20 shadow-[0_0_0_2px_rgba(15,23,42,0.30)]`;
  }

  return `${baseClass} border border-white/20 shadow-[0_0_0_2px_rgba(15,23,42,0.34)]`;
};

const toDateTimeLocalValue = (date: Date | string | null | undefined) => {
  if (!date) return "";

  const parsedDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const parseDateTimeLocalValue = (value: string) => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const normalizeSpreadsheetHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildSpreadsheetRowMap = (row: Record<string, unknown>) => {
  const rowMap = new Map<string, unknown>();

  Object.entries(row).forEach(([key, value]) => {
    rowMap.set(normalizeSpreadsheetHeader(key), value);
  });

  return rowMap;
};

const getSpreadsheetCellValue = (rowMap: Map<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = rowMap.get(normalizeSpreadsheetHeader(alias));

    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    return value;
  }

  return undefined;
};

const STORE_NAME_COLUMN_ALIASES = [
  "Loja",
  "Nome da Loja",
  "Conta",
  "Nome da Conta",
  "Store",
  "Shop",
  "Canal",
  "Canal de Venda",
];

function ColorBadge({
  color,
  className = "text-[10px]",
}: {
  color: string;
  className?: string;
}) {
  const swatchValue = getColorSwatchValue(color);
  const badgeBackground = getColorWithAlpha(color, 0.16);
  const badgeBorder = getColorWithAlpha(color, 0.34);

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 border-white/10 text-slate-100 ${className}`}
      style={
        badgeBackground || badgeBorder
          ? {
              backgroundColor: badgeBackground || undefined,
              borderColor: badgeBorder || undefined,
            }
          : undefined
      }
    >
      <span
        className={`${getColorDotClassName(color, "md")} ${swatchValue ? "" : "bg-muted"}`}
        style={swatchValue ? { backgroundColor: swatchValue } : undefined}
      />
      <span>{color}</span>
    </Badge>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [printerSchemaReady, setPrinterSchemaReady] = useState(true);
  const [orderStatusSchemaReady, setOrderStatusSchemaReady] = useState(true);
  const [orderCostSnapshotSchemaReady, setOrderCostSnapshotSchemaReady] = useState(true);
  const [orderStoreSchemaReady, setOrderStoreSchemaReady] = useState(true);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPrinterDialogOpen, setIsPrinterDialogOpen] = useState(false);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [isPersistingQueue, setIsPersistingQueue] = useState(false);
  const [editingStartTimes, setEditingStartTimes] = useState<Record<string, string>>({});
  const [savingStartOrderId, setSavingStartOrderId] = useState<string | null>(null);
  const [newPrinter, setNewPrinter] = useState({ name: "", description: "" });
  const [draggingPrinterTabId, setDraggingPrinterTabId] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState("all");
  const [filterPieceId, setFilterPieceId] = useState("all");
  const [groupByPiece, setGroupByPiece] = useState(false);
  const [queueViewMode, setQueueViewMode] = useState<"list" | "columns">("list");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"queue" | "printing" | "done">("queue");
  const [filterPrinterKey, setFilterPrinterKey] = useState(ALL_PRINTERS_FILTER_KEY);
  const [queueTimeSort, setQueueTimeSort] = useState<QueueTimeSort>("queue");
  const [queueMaxTimeFilter, setQueueMaxTimeFilter] = useState<QueueMaxTimeFilter>("all");
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverOrderId, setDragOverOrderId] = useState<string | null>(null);
  const [dragOverPrinterKey, setDragOverPrinterKey] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAutoCompletingRef = useRef(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const canUsePrinterFeatures = printerSchemaReady;
  const canUseProductionFlow = printerSchemaReady && orderStatusSchemaReady;
  const doneStatusSelectClassName = isMobile ? "h-9 w-full text-xs" : "h-7 w-[130px] text-xs";
  const showSchemaWarningToast = () =>
    toast({
      title: "Banco desatualizado",
      description: schemaWarning ?? FEATURE_MIGRATION_HELP,
      variant: "destructive",
    });

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

      const [
        ordersRes,
        piecesRes,
        printersRes,
        orderFeatureProbeRes,
        orderCostProbeRes,
        orderStoreProbeRes,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "*, pieces(name, tempo_impressao_min, image_url), piece_price_variations(variation_name, tempo_impressao_min)",
          )
          .eq("user_id", user.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("pieces")
          .select(
            "id, name, reference_names, cost, custo_material, custo_energia, custo_acessorios, preco_venda, tempo_impressao_min, image_url, peso_g",
          )
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        supabase
          .from("printers")
          .select("id, name, description, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("orders")
          .select("id, printer_id, status, started_at, expected_finish_at")
          .eq("user_id", user.id)
          .limit(1),
        supabase
          .from("orders")
          .select("id, platform_order_id, source_product_name, snapshot_unit_cost, snapshot_unit_price")
          .eq("user_id", user.id)
          .limit(1),
        supabase
          .from("orders")
          .select("id, store_name")
          .eq("user_id", user.id)
          .limit(1),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (piecesRes.error) throw piecesRes.error;

      const printersAvailable = !printersRes.error;
      const orderStatusAvailable = !orderFeatureProbeRes.error;
      const orderCostSnapshotAvailable = !orderCostProbeRes.error;
      const orderStoreAvailable = !orderStoreProbeRes.error;
      const printersData = printersAvailable
        ? ((printersRes.data as PrinterItem[]) || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [];
      const printersById = new Map(printersData.map((printer) => [printer.id, printer]));
      const warnings: string[] = [];

      if (!printersAvailable) {
        warnings.push("A migration de impressoras ainda nao foi aplicada.");
        console.warn("Printers schema unavailable:", printersRes.error);
      }

      if (!orderStatusAvailable) {
        warnings.push('A migration do fluxo "pendente/fazendo/feito" ainda nao foi aplicada.');
        console.warn("Order status schema unavailable:", orderFeatureProbeRes.error);
      }

      if (!orderCostSnapshotAvailable) {
        warnings.push("A migration que congela custo e preco dos pedidos vendidos ainda nao foi aplicada.");
        console.warn("Order cost snapshot schema unavailable:", orderCostProbeRes.error);
      }

      if (!orderStoreAvailable) {
        warnings.push("A migration que salva a loja de cada pedido ainda nao foi aplicada.");
        console.warn("Order store schema unavailable:", orderStoreProbeRes.error);
      }

      setPrinterSchemaReady(printersAvailable);
      setOrderStatusSchemaReady(orderStatusAvailable);
      setOrderCostSnapshotSchemaReady(orderCostSnapshotAvailable);
      setOrderStoreSchemaReady(orderStoreAvailable);
      setSchemaWarning(warnings.length > 0 ? `${warnings.join(" ")} ${FEATURE_MIGRATION_HELP}` : null);

      const normalizedOrders = ((ordersRes.data as Order[]) || []).map((order) => {
        const printerId = printersAvailable ? order.printer_id ?? null : null;
        const printer = printerId ? printersById.get(printerId) : null;

        return {
          ...order,
          position: order.position ?? 0,
          printer_id: printerId,
          printers: printer ? { name: printer.name } : null,
          status: orderStatusAvailable ? getOrderStatus(order) : (order.is_printed ? "done" : "pending"),
          started_at: orderStatusAvailable ? order.started_at ?? null : null,
          expected_finish_at: orderStatusAvailable ? order.expected_finish_at ?? null : null,
        };
      });

      setOrders(normalizedOrders);
      setPieces((piecesRes.data as Piece[]) || []);
      setPrinters(printersData);
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
    const exactMatch = activePieces.find((piece) =>
      getPieceSearchNames(piece).some((candidateName) => normalizeText(candidateName) === normalized),
    );
    if (exactMatch) return exactMatch;

    const containMatches = activePieces.filter((piece) => {
      return getPieceSearchNames(piece).some((candidateName) => {
        const normalizedPiece = normalizeText(candidateName);
        return normalized.includes(normalizedPiece) || normalizedPiece.includes(normalized);
      });
    });

    if (containMatches.length === 1) return containMatches[0];
    if (containMatches.length > 1) {
      return containMatches.sort((left, right) => right.name.length - left.name.length)[0];
    }

    const words = normalized.split(/\s+/).filter((word) => word.length >= 3);
    let bestScore = 0;
    let bestPiece: Piece | null = null;

    for (const piece of activePieces) {
      for (const candidateName of getPieceSearchNames(piece)) {
        const normalizedPiece = normalizeText(candidateName);
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
          .select(
            "id, name, reference_names, cost, custo_material, custo_energia, custo_acessorios, preco_venda, tempo_impressao_min, image_url",
          )
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

  const handleOrderSpreadsheetUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const parsed: ImportRow[] = [];

      for (const row of rows) {
        const rowMap = buildSpreadsheetRowMap(row);
        const productName = String(
          getSpreadsheetCellValue(rowMap, ["Nome do Anuncio"]) || "",
        ).trim();

        if (!productName) continue;

        const variation = String(
          getSpreadsheetCellValue(rowMap, ["Variacao"]) || "",
        ).trim();
        const colorPart = variation.split(",")[0]?.trim() || "";
        const quantity =
          Number.parseInt(
            String(getSpreadsheetCellValue(rowMap, ["Qtd do Produto", "Quantidade"]) || 1),
            10,
          ) || 1;
        const storeName = String(
          getSpreadsheetCellValue(rowMap, STORE_NAME_COLUMN_ALIASES) || "",
        ).trim();
        const platformOrderId = String(
          getSpreadsheetCellValue(rowMap, [
            "N de Pedido da Plataforma",
            "Numero de Pedido da Plataforma",
          ]) || "",
        ).trim();
        const buyerNotes = String(getSpreadsheetCellValue(rowMap, ["Notas do Comprador"]) || "");
        const shopeeImageUrl = String(
          getSpreadsheetCellValue(rowMap, ["Link da Imagem"]) || "",
        ).replace(/\\/g, "");

        parsed.push({
          platformOrderId,
          productName,
          storeName,
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
          storeName: String(
            row["Loja"] || row["Nome da Loja"] || row["Conta"] || row["Nome da Conta"] || "",
          ).trim(),
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
    if (!orderCostSnapshotSchemaReady) {
      toast({
        title: "Banco desatualizado",
        description: `Aplique a migration ${ORDER_COST_SNAPSHOT_MIGRATION_NAME} para congelar o custo dos pedidos importados.`,
        variant: "destructive",
      });
      return;
    }

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
        const key = `${row.platformOrderId}::${normalizeText(row.storeName || "")}::${row.matchedPieceId}::${row.color}`;
        const existing = consolidatedMap.get(key);

        if (existing) {
          existing.quantity += row.quantity;
        } else {
          consolidatedMap.set(key, { ...row });
        }
      }

      const consolidatedRows = Array.from(consolidatedMap.values());

      const newRows = consolidatedRows.filter((row) => {
        const orderKey = row.platformOrderId || "";
        const rowStoreName = getStoreName(row.storeName);
        if (!orderKey) return true;

        return !orders.some((order) => {
          if (order.piece_id !== row.matchedPieceId) {
            return false;
          }

          if ((order.color || null) !== (row.color || null)) {
            return false;
          }

          const matchesOrderKey =
            (order.platform_order_id || "") === orderKey || (order.notes || "").includes(orderKey);

          if (!matchesOrderKey) {
            return false;
          }

          const orderStoreName = getStoreName(order.store_name);
          if (!rowStoreName || !orderStoreName) {
            return true;
          }

          return normalizeText(orderStoreName) === normalizeText(rowStoreName);
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

      const inserts = newRows.map((row) => {
        const piece = pieces.find((item) => item.id === row.matchedPieceId);
        const snapshotUnitCost = piece ? getPieceSnapshotUnitCost(piece) : null;
        const snapshotUnitPrice = piece?.preco_venda ?? null;
        const storeName = getStoreName(row.storeName);

        return {
          user_id: user.id,
          piece_id: row.matchedPieceId!,
          quantity: row.quantity,
          color: row.color || null,
          notes: row.buyerNotes ? `${row.platformOrderId} - ${row.buyerNotes}` : row.platformOrderId || null,
          platform_order_id: row.platformOrderId || null,
          source_product_name: row.productName || piece?.name || null,
          ...(orderStoreSchemaReady ? { store_name: storeName } : {}),
          snapshot_unit_cost: snapshotUnitCost,
          snapshot_unit_price: snapshotUnitPrice,
          status: "pending",
          position: nextPosition++,
          started_at: null,
          expected_finish_at: null,
        };
      });

      const { error } = await supabase.from("orders").insert(inserts);
      if (error) throw error;

      toast({
        title: "Importacao concluida",
        description:
          skipped > 0
            ? `${newRows.length} novo(s), ${skipped} duplicado(s) ignorado(s)`
            : `${newRows.length} pedido(s) importado(s)!`,
      });

      if (!orderStoreSchemaReady && newRows.some((row) => getStoreName(row.storeName))) {
        toast({
          title: "Loja ainda nao foi salva",
          description: `Aplique a migration ${ORDER_STORE_MIGRATION_NAME} para gravar a loja junto dos pedidos.`,
          variant: "destructive",
        });
      }

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

  const deductFilamentStock = async (order: Order) => {
    try {
      const piece = pieces.find(p => p.id === order.piece_id);
      if (!piece || !piece.peso_g || piece.peso_g <= 0) return;

      const orderColor = order.color?.trim().toLowerCase();
      if (!orderColor) return;

      // Find matching filament by color
      const { data: filaments } = await supabase
        .from("filaments")
        .select("id, color, stock_kg")
        .ilike("color", orderColor);

      if (!filaments || filaments.length === 0) return;

      const filament = filaments[0];
      const deductKg = (piece.peso_g * order.quantity) / 1000;
      const newStock = Math.max(0, filament.stock_kg - deductKg);

      const { error } = await supabase
        .from("filaments")
        .update({ stock_kg: newStock })
        .eq("id", filament.id);

      if (error) {
        console.error("Error deducting filament:", error);
        return;
      }

      toast({
        title: "Filamento descontado",
        description: `${deductKg.toFixed(1)}g de ${filament.color} descontado (restam ${newStock.toFixed(1)} kg)`,
      });
    } catch (err) {
      console.error("Error in filament deduction:", err);
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
    if (!canUsePrinterFeatures) {
      showSchemaWarningToast();
      return;
    }

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
    if (!canUsePrinterFeatures) {
      showSchemaWarningToast();
      return;
    }

    await moveOrderInQueue(orderId, printerId, null, {
      title: "Pedido direcionado",
      description: "A fila foi atualizada para a impressora selecionada.",
    });
  };

  const handleOrderStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    if (!canUseProductionFlow) {
      showSchemaWarningToast();
      return;
    }

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

        // Multiplos pedidos podem estar "fazendo" na mesma impressora simultaneamente
        // (ex: varias pecas no mesmo plate)

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
        const completedAt = new Date().toISOString();

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

        // Auto-deduct filament stock based on piece weight and order color
        await deductFilamentStock(order);
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

  const handleStartTimeDraftChange = (orderId: string, value: string) => {
    setEditingStartTimes((previousDrafts) => ({
      ...previousDrafts,
      [orderId]: value,
    }));
  };

  const handleUpdateOrderStartTime = async (order: Order, value: string) => {
    if (!canUseProductionFlow) {
      showSchemaWarningToast();
      return;
    }

    if (!isOrderPrinting(order)) {
      toast({
        title: "Ajuste disponivel apenas em pedidos fazendo",
        variant: "destructive",
      });
      return;
    }

    const startedAt = parseDateTimeLocalValue(value);

    if (!startedAt) {
      toast({
        title: "Horario invalido",
        description: "Escolha uma data e hora validas para o inicio.",
        variant: "destructive",
      });
      return;
    }

    const expectedFinishAt = new Date(startedAt.getTime() + getPrintTimeMin(order) * 60_000);
    setSavingStartOrderId(order.id);

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          started_at: startedAt.toISOString(),
          expected_finish_at: expectedFinishAt.toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      setEditingStartTimes((previousDrafts) => {
        const nextDrafts = { ...previousDrafts };
        delete nextDrafts[order.id];
        return nextDrafts;
      });

      toast({
        title: "Inicio ajustado",
        description: `Fim recalculado para ${formatHour(expectedFinishAt)}.`,
      });

      await fetchData();
    } catch (error) {
      console.error("Error updating order start time:", error);
      toast({ title: "Erro ao ajustar inicio", variant: "destructive" });
    } finally {
      setSavingStartOrderId(null);
    }
  };

  const handleCreatePrinter = async () => {
    if (!canUsePrinterFeatures) {
      showSchemaWarningToast();
      return;
    }

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

      const { data: insertedPrinter, error } = await supabase
        .from("printers")
        .insert({
          user_id: user.id,
          name: newPrinter.name.trim(),
          description: newPrinter.description.trim() || null,
          position: printers.length,
        })
        .select("id")
        .single();

      if (error) throw error;

      setNewPrinter({ name: "", description: "" });
      setIsPrinterDialogOpen(false);
      toast({ title: "Impressora adicionada!" });
      await fetchData();
      if (insertedPrinter?.id) {
        setFilterPrinterKey(insertedPrinter.id);
      }
    } catch (error) {
      console.error("Error creating printer:", error);
      toast({ title: "Erro ao adicionar impressora", variant: "destructive" });
    } finally {
      setIsSavingPrinter(false);
    }
  };

  const handleReorderPrinter = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const oldIndex = printers.findIndex((p) => p.id === draggedId);
    const newIndex = printers.findIndex((p) => p.id === targetId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...printers];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Optimistic update
    setPrinters(reordered.map((p, i) => ({ ...p, position: i })));

    // Persist
    try {
      await Promise.all(
        reordered.map((p, i) =>
          supabase.from("printers").update({ position: i }).eq("id", p.id)
        )
      );
    } catch (err) {
      console.error("Error reordering printers:", err);
      toast({ title: "Erro ao reordenar impressoras", variant: "destructive" });
      await fetchData();
    }
  };

  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((allIds: string[]) => {
    setSelectedOrderIds((prev) => {
      if (prev.size > 0) return new Set();
      return new Set(allIds);
    });
  }, []);

  const handleBatchStartPrinting = async () => {
    if (selectedOrderIds.size === 0) return;
    const selected = orders.filter((o) => selectedOrderIds.has(o.id));

    let started = 0;
    let skipped = 0;
    const skippedReasons: string[] = [];

    for (const order of selected) {
      if (!order.printer_id) {
        skipped++;
        continue;
      }
      if (!isOrderPending(order)) {
        skipped++;
        continue;
      }
      try {
        await handleOrderStatusChange(order.id, "printing");
        started++;
      } catch (e) {
        skipped++;
        skippedReasons.push((e as Error).message);
      }
    }

    setSelectedOrderIds(new Set());
    toast({
      title: `${started} pedido(s) marcado(s) como fazendo`,
      description: skipped > 0 ? `${skipped} ignorado(s) (sem impressora ou já em produção/concluído)` : undefined,
    });
  };

  const handleBatchAssignPrinter = async (printerId: string | null) => {
    if (selectedOrderIds.size === 0) return;
    const updates = [...selectedOrderIds].map((id) =>
      supabase.from("orders").update({ printer_id: printerId }).eq("id", id)
    );
    await Promise.all(updates);
    setSelectedOrderIds(new Set());
    toast({ title: `${updates.length} pedido(s) direcionado(s)` });
    await fetchData();
  };

  const handleBatchMarkDone = async () => {
    if (selectedOrderIds.size === 0) return;
    let count = 0;
    for (const id of selectedOrderIds) {
      await handleOrderStatusChange(id, "done");
      count++;
    }
    setSelectedOrderIds(new Set());
    toast({ title: `${count} pedido(s) finalizado(s)` });
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const now = new Date();

      // ── Header ──
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatorio de Producao", margin, 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR")}`, pageWidth - margin, 18, { align: "right" });

      let y = 38;

      // ── Data ──
      const queueOrders = orders.filter((o) => !isOrderDone(o));
      const pendingOrders = queueOrders.filter((o) => isOrderPending(o));
      const printingOrders = queueOrders.filter((o) => isOrderPrinting(o));
      const totalQueueMin = queueOrders.reduce((sum, o) => sum + getPrintTimeMin(o), 0);
      
      // Summary cards
      const summaryCards = [
        { label: "Total na Fila", value: String(queueOrders.length) },
        { label: "Pendentes", value: String(pendingOrders.length) },
        { label: "Imprimindo", value: String(printingOrders.length) },
        { label: "Tempo Total", value: formatTime(totalQueueMin) },
      ];

      const cardWidth = (pageWidth - margin * 2 - 12) / 4;
      summaryCards.forEach((card, i) => {
        const x = margin + i * (cardWidth + 4);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x, y, cardWidth, 18, 3, 3, "F");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(card.label, x + cardWidth / 2, y + 6, { align: "center" });
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(card.value, x + cardWidth / 2, y + 14, { align: "center" });
        doc.setFont("helvetica", "normal");
      });
      y += 26;

      // ── By Printer ──
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Distribuicao por Impressora", margin, y);
      y += 6;

      const printerStats: { name: string; count: number; totalMin: number }[] = [];
      const unassigned = queueOrders.filter((o) => !o.printer_id);
      if (unassigned.length > 0) {
        printerStats.push({
          name: "Sem impressora",
          count: unassigned.length,
          totalMin: unassigned.reduce((s, o) => s + getPrintTimeMin(o), 0),
        });
      }
      for (const printer of printers) {
        const pOrders = queueOrders.filter((o) => o.printer_id === printer.id);
        if (pOrders.length > 0) {
          printerStats.push({
            name: printer.name,
            count: pOrders.length,
            totalMin: pOrders.reduce((s, o) => s + getPrintTimeMin(o), 0),
          });
        }
      }

      const maxCount = Math.max(...printerStats.map((p) => p.count), 1);
      const barMaxWidth = pageWidth - margin * 2 - 90;
      const barColors = [[59, 130, 246], [16, 185, 129], [249, 115, 22], [168, 85, 247], [236, 72, 153]];

      printerStats.forEach((stat, i) => {
        const barWidth = (stat.count / maxCount) * barMaxWidth;
        const color = barColors[i % barColors.length];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(margin, y, Math.max(barWidth, 2), 7, 2, 2, "F");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(`${stat.name} — ${stat.count} itens — ${formatTime(stat.totalMin)}`, margin + barWidth + 4, y + 5);
        y += 10;
      });
      y += 4;

      // ── Rankings ──
      const sortedByTime = [...queueOrders].sort((a, b) => getPrintTimeMin(b) - getPrintTimeMin(a));
      const top5Slowest = sortedByTime.slice(0, 5);
      const top5Fastest = [...queueOrders].sort((a, b) => getPrintTimeMin(a) - getPrintTimeMin(b)).slice(0, 5);

      // Duplicates
      const nameCount = new Map<string, number>();
      queueOrders.forEach((o) => {
        const name = o.pieces.name;
        nameCount.set(name, (nameCount.get(name) || 0) + o.quantity);
      });
      const duplicates = [...nameCount.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);

      // Slowest
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Top 5 Mais Demorados", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["#", "Peca", "Tempo", "Impressora"]],
        body: top5Slowest.map((o, i) => [
          String(i + 1),
          o.pieces.name,
          formatTime(getPrintTimeMin(o)),
          o.printers?.name || printerNameById.get(o.printer_id || "") || "Sem impressora",
        ]),
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 25 }, 3: { cellWidth: 40 } },
      });

      y = (doc as any).lastAutoTable.finalY + 8;

      // Fastest
      if (y > pageHeight - 60) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Top 5 Mais Rapidos", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["#", "Peca", "Tempo", "Impressora"]],
        body: top5Fastest.map((o, i) => [
          String(i + 1),
          o.pieces.name,
          formatTime(getPrintTimeMin(o)),
          o.printers?.name || printerNameById.get(o.printer_id || "") || "Sem impressora",
        ]),
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 25 }, 3: { cellWidth: 40 } },
      });

      y = (doc as any).lastAutoTable.finalY + 8;

      // Duplicates
      if (duplicates.length > 0) {
        if (y > pageHeight - 60) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Itens Repetidos (agrupados)", margin, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Peca", "Quantidade Total"]],
          body: duplicates.map(([name, count]) => [name, String(count)]),
          theme: "grid",
          headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── Full list ──
      doc.addPage();
      y = 20;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Lista Completa da Fila", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["#", "Peca", "Cor", "Qtd", "Tempo", "Impressora", "Status"]],
        body: queueOrders.map((o, i) => [
          String(i + 1),
          o.pieces.name,
          o.color || "-",
          String(o.quantity),
          formatTime(getPrintTimeMin(o)),
          o.printers?.name || printerNameById.get(o.printer_id || "") || "Sem",
          isOrderPrinting(o) ? "Imprimindo" : "Pendente",
        ]),
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 20 }, 6: { cellWidth: 22 } },
      });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }

      doc.save(`relatorio-producao-${now.toISOString().slice(0, 10)}.pdf`);
      toast({ title: "PDF exportado com sucesso!" });
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast({ title: "Erro ao exportar PDF", variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };
    

  const handleDeletePrinter = async (printerId: string) => {
    if (!canUsePrinterFeatures) {
      showSchemaWarningToast();
      return;
    }

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
              printed_at: new Date().toISOString(),
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

  useEffect(() => {
    if (filterPrinterKey === ALL_PRINTERS_FILTER_KEY) return;
    if (printers.some((printer) => printer.id === filterPrinterKey)) return;
    setFilterPrinterKey(ALL_PRINTERS_FILTER_KEY);
  }, [filterPrinterKey, printers]);

  const queue = useMemo(
    () => orders.filter((order) => !isOrderDone(order)).sort(sortQueueOrders),
    [orders],
  );
  const done = useMemo(
    () =>
      orders
        .filter((order) => isOrderDone(order))
        .sort((a, b) => getOrderCompletedAt(b).getTime() - getOrderCompletedAt(a).getTime()),
    [orders],
  );
  const printingCount = useMemo(
    () => queue.filter((order) => isOrderPrinting(order)).length,
    [queue],
  );
  const pendingCount = useMemo(
    () => queue.filter((order) => isOrderPending(order)).length,
    [queue],
  );

  const uniqueColors = useMemo(() => {
    const colors = new Set(orders.map((order) => order.color).filter(Boolean) as string[]);
    return Array.from(colors).sort();
  }, [orders]);

  const uniquePieces = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      if (order.piece_id && order.pieces?.name) {
        map.set(order.piece_id, order.pieces.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const filterOrder = (order: Order) => {
    if (filterColor !== "all" && order.color !== filterColor) return false;
    if (filterPieceId !== "all" && order.piece_id !== filterPieceId) return false;
    if (
      filterPrinterKey !== ALL_PRINTERS_FILTER_KEY &&
      getPrinterKey(order.printer_id) !== filterPrinterKey
    ) {
      return false;
    }

    const normalizedSearch = filterSearch.trim().toLowerCase();

    if (normalizedSearch) {
      const searchableValues = [
        order.pieces.name,
        order.source_product_name || "",
        order.platform_order_id || "",
        order.store_name || "",
        order.piece_price_variations?.variation_name || "",
        order.notes || "",
      ];

      if (!searchableValues.some((value) => value.toLowerCase().includes(normalizedSearch))) {
        return false;
      }
    }

    return true;
  };

  const filteredQueue = useMemo(
    () => queue.filter(filterOrder),
    [queue, filterColor, filterPieceId, filterPrinterKey, filterSearch],
  );
  const filteredDone = useMemo(
    () => done.filter(filterOrder),
    [done, filterColor, filterPieceId, filterPrinterKey, filterSearch],
  );

  const getPlatformId = (order: Order) => {
    if (order.platform_order_id?.trim()) {
      return order.platform_order_id.trim();
    }

    const notes = order.notes || "";
    const match = notes.match(/^(\S+)/);
    return match?.[1] || "sem-pedido";
  };

  const groupOrders = (orderList: Order[]) => {
    const groups = new Map<
      string,
      {
        platformId: string;
        storeName: string | null;
        orders: Order[];
      }
    >();

    for (const order of orderList) {
      const platformId = getPlatformId(order);
      const storeName = getStoreName(order.store_name);
      const key = `${platformId}::${normalizeText(storeName || "")}`;
      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.orders.push(order);
        continue;
      }

      groups.set(key, {
        platformId,
        storeName,
        orders: [order],
      });
    }

    return Array.from(groups.values());
  };

  const doneSections = useMemo(
    () =>
      Array.from(
        filteredDone.reduce((sections, order) => {
          const completedAt = getOrderCompletedAt(order);
          const dateKey = getLocalDateKey(completedAt);
          const existingSection = sections.get(dateKey);

          if (existingSection) {
            existingSection.orders.push(order);
            return sections;
          }

          sections.set(dateKey, {
            date: completedAt,
            orders: [order],
          });

          return sections;
        }, new Map<string, { date: Date; orders: Order[] }>()),
      ).map(([dateKey, section]) => ({
        dateKey,
        dateLabel: formatDoneDateLabel(section.date, now),
        orderGroups: groupOrders(section.orders),
        totalOrders: section.orders.length,
      })),
    [filteredDone, now],
  );

  const totalQueueMin = useMemo(
    () => queue.reduce((total, order) => total + getRemainingPrintTimeMin(order), 0),
    [queue],
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
    const allSections = [
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

    const sections =
      filterPrinterKey === ALL_PRINTERS_FILTER_KEY
        ? allSections
        : allSections.filter((section) => getPrinterKey(section.printerId) === filterPrinterKey);

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
      .filter((section) => {
        if (filterPrinterKey !== ALL_PRINTERS_FILTER_KEY) return true;
        return section.orders.length > 0 || section.printerId === null || printers.length === 0;
      });
  }, [filteredQueue, filterPrinterKey, now, printers]);

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

  const isQueueView = filterStatus === "queue";
  const isPrintingView = filterStatus === "printing";
  const isAllPrintersView = filterPrinterKey === ALL_PRINTERS_FILTER_KEY;
  const printerNameById = useMemo(
    () => new Map(printers.map((printer) => [printer.id, printer.name])),
    [printers],
  );
  const activePrinter = useMemo(
    () => printers.find((printer) => printer.id === filterPrinterKey) || null,
    [filterPrinterKey, printers],
  );
  const printerAccentMap = useMemo(() => {
    const accentMap = new Map<string, PrinterAccent>();
    printers.forEach((printer, index) => {
      accentMap.set(printer.id, getPrinterAccentBySlot(index));
    });
    return accentMap;
  }, [printers]);
  const getPrinterAccent = (printerId: string | null) => {
    if (!printerId) return NEUTRAL_PRINTER_ACCENT;
    return printerAccentMap.get(printerId) || getPrinterAccentBySlot(hashPrinterSeed(printerId));
  };
  const activePrinterStats = useMemo(
    () =>
      activePrinter
        ? printerStatsMap.get(activePrinter.id) || {
            count: 0,
            totalMin: 0,
            printingCount: 0,
            busyUntil: null,
          }
        : null,
    [activePrinter, printerStatsMap],
  );
  const activePrinterAccent = getPrinterAccent(activePrinter?.id ?? null);
  const activePrinterLoadLabel = activePrinterStats
    ? getPrinterOccupancyLabel(activePrinterStats)
    : null;
  const activeQueueSection = useMemo(
    () =>
      isAllPrintersView
        ? null
        : queueSections.find((section) => section.printerId === filterPrinterKey) || null,
    [filterPrinterKey, isAllPrintersView, queueSections],
  );
  const allQueueOrders = useMemo(
    () =>
      [...filteredQueue].sort((left, right) => {
        const leftUnassigned = !left.printer_id;
        const rightUnassigned = !right.printer_id;

        if (leftUnassigned !== rightUnassigned) {
          return leftUnassigned ? -1 : 1;
        }

        if (left.printer_id !== right.printer_id) {
          return (printerNameById.get(left.printer_id || "") || "").localeCompare(
            printerNameById.get(right.printer_id || "") || "",
            "pt-BR",
          );
        }

        return sortQueueOrders(left, right);
      }),
    [filteredQueue, printerNameById],
  );
  const queueMaxTimeMinutes = useMemo(() => {
    const option = QUEUE_MAX_TIME_OPTIONS.find((item) => item.value === queueMaxTimeFilter);
    return option?.minutes ?? null;
  }, [queueMaxTimeFilter]);
  const baseVisibleQueueOrders = useMemo(
    () =>
      (isAllPrintersView ? allQueueOrders : activeQueueSection?.orders || []).filter((order) =>
        isPrintingView ? isOrderPrinting(order) : isOrderPending(order),
      ),
    [activeQueueSection, allQueueOrders, isAllPrintersView, isPrintingView],
  );
  const visibleQueueOrders = useMemo(() => {
    if (!isQueueView) return baseVisibleQueueOrders;

    const timeFilteredOrders =
      queueMaxTimeMinutes === null
        ? baseVisibleQueueOrders
        : baseVisibleQueueOrders.filter((order) => getPrintTimeMin(order) <= queueMaxTimeMinutes);

    if (queueTimeSort === "fastest") {
      return [...timeFilteredOrders].sort((left, right) => {
        const diff = getPrintTimeMin(left) - getPrintTimeMin(right);
        return diff !== 0 ? diff : sortQueueOrders(left, right);
      });
    }

    if (queueTimeSort === "slowest") {
      return [...timeFilteredOrders].sort((left, right) => {
        const diff = getPrintTimeMin(right) - getPrintTimeMin(left);
        return diff !== 0 ? diff : sortQueueOrders(left, right);
      });
    }

    return timeFilteredOrders;
  }, [baseVisibleQueueOrders, isQueueView, queueMaxTimeMinutes, queueTimeSort]);
  const visibleQueueTotalMin = useMemo(
    () => visibleQueueOrders.reduce((total, order) => total + getRemainingPrintTimeMin(order, now), 0),
    [now, visibleQueueOrders],
  );
  const visibleQueuePrintingCount = useMemo(
    () => visibleQueueOrders.filter((order) => isOrderPrinting(order)).length,
    [visibleQueueOrders],
  );
  const visibleQueuePendingCount = useMemo(
    () => visibleQueueOrders.filter((order) => isOrderPending(order)).length,
    [visibleQueueOrders],
  );
  const visibleUnassignedCount = useMemo(
    () => visibleQueueOrders.filter((order) => !order.printer_id).length,
    [visibleQueueOrders],
  );
  const hasQueueVisible = visibleQueueOrders.length > 0;
  const activeQueueSections = useMemo(
    () =>
      queueSections.filter((section) =>
        isPrintingView ? section.printingCount > 0 : section.pendingCount > 0,
      ).length,
    [isPrintingView, queueSections],
  );
  const printerTabs = useMemo(
    () => [
      {
        id: ALL_PRINTERS_FILTER_KEY,
        label: "Todas",
        count: isPrintingView ? printingCount : pendingCount,
        accent: NEUTRAL_PRINTER_ACCENT,
      },
      ...printers.map((printer) => ({
        id: printer.id,
        label: printer.name,
        count: isPrintingView
          ? printerStatsMap.get(printer.id)?.printingCount || 0
          : (printerStatsMap.get(printer.id)?.count || 0) -
            (printerStatsMap.get(printer.id)?.printingCount || 0),
        accent: getPrinterAccent(printer.id),
      })),
    ],
    [isPrintingView, pendingCount, printerStatsMap, printers, printingCount],
  );
  const canReorderQueue =
    isQueueView &&
    canUsePrinterFeatures &&
    !isAllPrintersView &&
    filterColor === "all" &&
    !filterSearch.trim() &&
    queueTimeSort === "queue" &&
    queueMaxTimeFilter === "all" &&
    !isPersistingQueue;
  const unassignedQueueCount = useMemo(
    () => queue.filter((order) => !order.printer_id && isOrderPending(order)).length,
    [queue],
  );

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

  const renderQueueOrderCard = (order: Order, queueIndex?: number) => {
    const times = queueTimeMap.get(order.id);
    const totalMin = times?.totalMin || 0;
    const remainingMin = times?.remainingMin || 0;
    const startAt = times?.startAt || now;
    const finishAt = times?.finishAt || now;
    const orderStatus = getOrderStatus(order);
    const isPrintingRow = orderStatus === "printing";
    const platformId = getPlatformId(order);
    const showSourceProductName =
      Boolean(order.source_product_name) &&
      normalizeText(order.source_product_name || "") !== normalizeText(order.pieces.name);
    const currentPrinterName =
      order.printers?.name ||
      (order.printer_id ? printerNameById.get(order.printer_id) || "Impressora" : "Sem impressora");
    const storeBadgeLabel = getStoreBadgeLabel(order.store_name);
    const accent = getPrinterAccent(order.printer_id);
    const isUnassignedCard = !order.printer_id;
    const productAtmosphereStyle = getProductAtmosphereStyle(order.color, isPrintingRow);
    const cardTone = isUnassignedCard && isAllPrintersView
      ? "border-amber-400/20 bg-[#081121]"
      : "border-white/10 bg-[#081121]";
    const printerStripeClass = isUnassignedCard ? "bg-amber-300" : accent.dot;
    const canDragCard = isQueueView && canReorderQueue && isOrderPending(order);
    const isSelected = selectedOrderIds.has(order.id);

    return (
      <div
        key={order.id}
        className={`relative overflow-hidden rounded-2xl border p-3 sm:p-4 backdrop-blur-sm transition-all ${
          isSelected
            ? "ring-2 ring-primary/50 border-primary/30"
            : dragOverOrderId === order.id
              ? "ring-2 ring-primary/60 border-primary/40"
              : "hover:border-white/15 hover:shadow-[0_18px_40px_rgba(2,6,23,0.28)]"
        } ${cardTone}`}
        onDragOver={canDragCard ? (event) => handleOrderDragOver(event, order) : undefined}
        onDrop={canDragCard ? (event) => void handleOrderDrop(event, order) : undefined}
      >
        <div className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${printerStripeClass}`} />
        {productAtmosphereStyle ? (
          <div className="pointer-events-none absolute inset-0" style={productAtmosphereStyle} />
        ) : null}

        <div className="production-order-card-layout relative z-10">
          <div className="production-order-head">
            {/* Checkbox for batch selection */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.id); }}
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isSelected
                  ? "border-primary/50 bg-primary/20 text-primary"
                  : "border-white/10 bg-transparent text-slate-500 hover:border-white/20 hover:text-slate-300"
              }`}
            >
              {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>

            {isAllPrintersView ? (
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-[#0b1628] text-[11px] font-semibold ${
                  isUnassignedCard
                    ? "border-amber-400/20 text-amber-100"
                    : `${accent.border} ${accent.strongText}`
                }`}
              >
                {isUnassignedCard ? "?" : currentPrinterName.slice(0, 2).toUpperCase()}
              </div>
            ) : isQueueView ? (
              <div className="flex items-start gap-2">
                <div
                  draggable={canDragCard}
                  onDragStart={() => handleDragStart(order)}
                  onDragEnd={handleDragEnd}
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed ${
                    canDragCard
                      ? "cursor-grab border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-100"
                      : "cursor-not-allowed border-white/10 text-slate-600"
                  }`}
                  title={
                    canDragCard
                      ? "Arraste para reorganizar a fila"
                      : "Reordenacao disponivel apenas sem busca, cor e filtros de tempo"
                  }
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-[#0b1628] text-sm font-semibold ${accent.border} ${accent.strongText}`}
                >
                  {String((queueIndex || 0) + 1).padStart(2, "0")}
                </div>
              </div>
            ) : (
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-[#0b1628] text-[11px] font-semibold ${accent.border} ${accent.strongText}`}
              >
                {currentPrinterName.slice(0, 2).toUpperCase()}
              </div>
            )}

            {order.pieces.image_url ? (
              <img
                src={order.pieces.image_url}
                alt={order.pieces.name}
                className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10 shadow-[0_10px_30px_rgba(2,6,23,0.35)] sm:h-16 sm:w-16"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] sm:h-16 sm:w-16">
                <Package className="h-5 w-5 text-slate-500" />
              </div>
            )}

            <div className="production-order-summary space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="production-order-title text-sm font-semibold text-slate-50 sm:text-base">
                    {order.pieces.name}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-[0.18em] ${
                      isPrintingRow
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-white/10 bg-white/[0.05] text-slate-200"
                    }`}
                  >
                    {isPrintingRow ? "Imprimindo" : "Pendente"}
                  </Badge>
                  {order.quantity > 1 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      x{order.quantity}
                    </Badge>
                  ) : null}
                  {order.color ? <ColorBadge color={order.color} className="text-[10px]" /> : null}
                  {order.piece_price_variations?.variation_name ? (
                    <Badge variant="outline" className="text-[10px] border-white/10 bg-white/[0.04] text-slate-200">
                      {order.piece_price_variations.variation_name}
                    </Badge>
                  ) : null}
                  {platformId !== "sem-pedido" ? (
                    <Badge variant="outline" className="text-[10px] font-mono border-white/10 bg-white/[0.04] text-slate-200">
                      #{platformId}
                    </Badge>
                  ) : null}
                  {storeBadgeLabel ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-sky-400/20 bg-sky-500/10 text-sky-100"
                    >
                      {storeBadgeLabel}
                    </Badge>
                  ) : null}
                  {isAllPrintersView ? (
                    <Badge className={`text-[10px] ${isUnassignedCard ? "border-amber-400/20 bg-amber-500/10 text-amber-100" : accent.badge}`}>
                      <span className="mr-1 inline-flex">
                        {isUnassignedCard ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
                        ) : (
                          renderPrinterDot(accent, "sm")
                        )}
                      </span>
                      {currentPrinterName}
                    </Badge>
                  ) : null}
                </div>

                {showSourceProductName ? (
                  <p className="production-order-secondary text-xs text-slate-400">
                    Anuncio: {order.source_product_name}
                  </p>
                ) : null}
              </div>

              <div className="production-order-stats">
                <div className="rounded-xl border border-white/10 bg-[#050816]/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Tempo</p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {isPrintingRow ? `Restam ${formatTime(remainingMin)}` : formatTime(totalMin)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#050816]/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    {isPrintingRow ? "Inicio" : "Previsao"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {isPrintingRow ? formatHour(startAt) : formatDateTime(finishAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#050816]/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    {isPrintingRow ? "Termino" : "Entrega da fila"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {formatHour(finishAt)}
                  </p>
                </div>
              </div>

              {isPrintingRow ? (
                <div className="rounded-2xl border border-white/10 bg-[#050816]/72 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                        Ajustar inicio
                      </p>
                      <Input
                        type="datetime-local"
                        step={60}
                        value={
                          editingStartTimes[order.id] ??
                          toDateTimeLocalValue(order.started_at || startAt)
                        }
                        onChange={(event) =>
                          handleStartTimeDraftChange(order.id, event.target.value)
                        }
                        className="production-control border-white/10 bg-[#050816] text-xs text-slate-100"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="production-action-button gap-1.5 sm:w-auto"
                      disabled={savingStartOrderId === order.id}
                      onClick={() =>
                        void handleUpdateOrderStartTime(
                          order,
                          editingStartTimes[order.id] ??
                            toDateTimeLocalValue(order.started_at || startAt),
                        )
                      }
                    >
                      <Check className="h-3.5 w-3.5" />
                      {savingStartOrderId === order.id ? "Salvando..." : "Salvar inicio"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="production-order-actions">
            {isAllPrintersView ? (
              isPrintingView ? (
                <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                    Impressora ativa
                  </p>
                  <div
                    className={`mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isUnassignedCard ? "border-amber-400/20 bg-amber-500/10 text-amber-100" : accent.badge}`}
                  >
                    {isUnassignedCard ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
                    ) : (
                      renderPrinterDot(accent, "sm")
                    )}
                    <span>{currentPrinterName}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                    Direcionar para
                  </p>
                  <Select
                    disabled={isPrintingRow || !canUsePrinterFeatures}
                    value={getPrinterKey(order.printer_id)}
                    onValueChange={(value) => {
                      const nextPrinterId = fromPrinterKey(value);
                      if ((order.printer_id ?? null) === nextPrinterId) return;
                      void handleOrderPrinterChange(order.id, nextPrinterId);
                    }}
                  >
                    <SelectTrigger className="production-control mt-2 border-white/10 bg-[#050816] text-xs text-slate-100">
                      <SelectValue placeholder="Direcionar impressora" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_PRINTER_KEY}>Sem impressora</SelectItem>
                      {printers.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          {printer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            ) : isQueueView ? (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                  {queueTimeSort === "queue" && queueMaxTimeFilter === "all" ? "Fila" : "Ordem visual"}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {queueTimeSort === "queue" && queueMaxTimeFilter === "all" ? "Posicao" : "Item"}{" "}
                  {String((queueIndex || 0) + 1).padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {canDragCard
                    ? "Arraste para reordenar."
                    : "Fila bloqueada durante busca, cor ou filtros de tempo."}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                  Em execucao
                </p>
                <p className="mt-1 text-sm font-medium text-slate-100">{currentPrinterName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Termino previsto {formatHour(finishAt)}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                Status
              </p>
              <Select
                disabled={!canUseProductionFlow}
              value={orderStatus}
              onValueChange={(value) =>
                void handleOrderStatusChange(order.id, value as OrderStatus)
              }
            >
              <SelectTrigger className="production-control mt-2 border-white/10 bg-[#050816] text-xs text-slate-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="printing">Fazendo</SelectItem>
                  <SelectItem value="done">Feito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              className="production-action-button justify-center rounded-2xl border border-white/10 text-slate-400 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void handleDeleteOrder(order.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const operationsEyebrow = isPrintingView
    ? isAllPrintersView
      ? "Producao em andamento"
      : "Maquina em execucao"
    : isAllPrintersView
      ? "Visao da fila"
      : "Fila dedicada";
  const operationsTitle = isPrintingView
    ? isAllPrintersView
      ? "Pedidos fazendo agora"
      : `${activePrinter?.name || "Impressora"} em producao`
    : isAllPrintersView
      ? "Fila pendente"
      : activePrinter?.name || "Fila";
  const operationsDescription = isPrintingView
    ? isAllPrintersView
      ? "Somente pedidos em andamento, separados da proxima fila."
      : "Acompanhe apenas o que ja esta imprimindo nesta maquina."
    : isAllPrintersView
      ? "Pedidos sem impressora aparecem aqui para direcionamento rapido."
      : activePrinter?.description ||
        "Uma fila unica por impressora, desenhada para leitura rapida a distancia.";
  const operationsPrimaryLabel = isPrintingView
    ? isAllPrintersView
      ? "Impressoras rodando"
      : "Execucao"
    : isAllPrintersView
      ? "Impressoras ativas"
      : "Ocupacao";
  const operationsPrimaryValue = isPrintingView
    ? isAllPrintersView
      ? activeQueueSections
      : activePrinterStats?.printingCount
        ? "Imprimindo"
        : "Livre"
    : isAllPrintersView
      ? activeQueueSections
      : activePrinterLoadLabel;
  const operationsSecondaryLabel = isPrintingView ? "Fazendo visivel" : "Fila visivel";
  const operationsTertiaryLabel = isPrintingView
    ? "Tempo restante"
    : isAllPrintersView
      ? "Tempo visivel"
      : "Tempo total";
  const operationalSectionTitle = isPrintingView
    ? isAllPrintersView
      ? `Pedidos em producao (${visibleQueueOrders.length})`
      : `${activePrinter?.name || "Impressora"} fazendo (${visibleQueueOrders.length})`
    : isAllPrintersView
      ? `Fila pendente (${visibleQueueOrders.length})`
      : `${activePrinter?.name || "Fila"} (${visibleQueueOrders.length})`;
  const operationalSectionDescription = isPrintingView
    ? "Pedidos em andamento separados da fila seguinte, com foco no que esta rodando agora."
    : isAllPrintersView
      ? "Atribua impressoras sem sair da lista principal. Cada pedido aparece uma vez so."
      : "Fila unica por impressora, com reordenacao direta e sem cards duplicados.";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="production-queue-page">
      <div className="production-queue-header">
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

        <div className="production-queue-header-actions">
          <Dialog open={isPrinterDialogOpen} onOpenChange={setIsPrinterDialogOpen}>
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
                  <Button
                    onClick={handleCreatePrinter}
                    disabled={isSavingPrinter || !canUsePrinterFeatures}
                    className="production-touch-target"
                  >
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
            onChange={handleOrderSpreadsheetUpload}
            className="hidden"
          />
          <Button
            className="production-touch-target w-full lg:w-auto"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
        </div>
      </div>

      {schemaWarning ? (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">Banco precisa ser atualizado</p>
                <p className="text-sm text-amber-800">{schemaWarning}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                            {row.color ? <ColorBadge color={row.color} /> : null}
                            {row.variation && row.variation !== row.color ? (
                              <Badge variant="outline" className="text-[10px]">
                                {row.variation}
                              </Badge>
                            ) : null}
                            {getStoreBadgeLabel(row.storeName) ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-sky-400/20 bg-sky-500/10 text-sky-100"
                              >
                                {getStoreBadgeLabel(row.storeName)}
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

      <div className="production-metrics-grid mb-6">
        <Card className="border-white/10 bg-[#081121] text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <CardContent className="px-4 pb-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ativos</p>
            <p className="mt-2 text-2xl font-bold">{queue.length}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081121] text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <CardContent className="px-4 pb-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Imprimindo</p>
            <p className="mt-2 text-2xl font-bold text-primary">{printingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081121] text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <CardContent className="px-4 pb-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tempo restante</p>
            <p className="mt-2 text-2xl font-bold">{formatTime(totalQueueMin)}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081121] text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <CardContent className="px-4 pb-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Impressoras</p>
            <p className="mt-2 text-2xl font-bold">{printers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081121] text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <CardContent className="px-4 pb-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sem impressora</p>
            <p className="mt-2 text-2xl font-bold">{unassignedQueueCount}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081121] text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <CardContent className="px-4 pb-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Concluidos</p>
            <p className="mt-2 text-2xl font-bold text-primary">{done.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 border-white/10 bg-[#081121] text-slate-100 shadow-[0_24px_70px_rgba(2,6,23,0.32)]">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="production-panel-layout lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Painel de operacao
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-50">
                {isAllPrintersView ? "Todas as impressoras" : activePrinter?.name || "Fila da impressora"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {isAllPrintersView
                  ? "Atribua pedidos na aba geral e acompanhe a producao sem informacao duplicada."
                  : activePrinter?.description || "Fila unica, limpa e focada na operacao desta impressora."}
              </p>
            </div>

            <div className="production-panel-stats">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Visiveis</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{visibleQueueOrders.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Pendentes</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{visibleQueuePendingCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Imprimindo</p>
                <p className="mt-1 text-base font-semibold text-primary">{visibleQueuePrintingCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  {isAllPrintersView ? "Sem impressora" : "Entrega da fila"}
                </p>
                <p className="mt-1 text-base font-semibold text-slate-100">
                  {isAllPrintersView
                    ? visibleUnassignedCount
                    : activePrinterStats?.busyUntil
                      ? formatHour(activePrinterStats.busyUntil)
                      : "Livre"}
                </p>
              </div>
            </div>
          </div>

          <div className="production-filter-grid">
            <div className="production-filter-search relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar produto, anuncio ou numero do pedido..."
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                className="production-control border-white/10 bg-[#050816] pl-9 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <Select value={filterColor} onValueChange={setFilterColor}>
              <SelectTrigger className="production-control border-white/10 bg-[#050816] text-sm text-slate-100">
                <SelectValue placeholder="Cor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cores</SelectItem>
                {uniqueColors.map((color) => (
                  <SelectItem key={color} value={color}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`${getColorDotClassName(color, "sm")} ${
                          getColorSwatchValue(color) ? "" : "bg-muted"
                        }`}
                        style={
                          getColorSwatchValue(color)
                            ? { backgroundColor: getColorSwatchValue(color) ?? undefined }
                            : undefined
                        }
                      />
                      <span>{color}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPieceId} onValueChange={setFilterPieceId}>
              <SelectTrigger className="production-control border-white/10 bg-[#050816] text-sm text-slate-100">
                <SelectValue placeholder="Peça" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as peças</SelectItem>
                {uniquePieces.map((piece) => (
                  <SelectItem key={piece.id} value={piece.id}>
                    {piece.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isQueueView ? (
              <Button
                variant={groupByPiece ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByPiece((prev) => !prev)}
                className="production-control gap-1.5 border-white/10 bg-[#050816] text-sm text-slate-100 hover:text-slate-50"
                title="Agrupar pedidos pela mesma peça"
              >
                <Package className="h-3.5 w-3.5" />
                {groupByPiece ? "Agrupado" : "Agrupar"}
              </Button>
            ) : null}

            {isQueueView ? (
              <Button
                variant={queueViewMode === "columns" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setQueueViewMode((prev) => (prev === "columns" ? "list" : "columns"))
                }
                className="production-control gap-1.5 border-white/10 bg-[#050816] text-sm text-slate-100 hover:text-slate-50"
                title="Visualizar todas as impressoras lado a lado"
              >
                {queueViewMode === "columns" ? (
                  <LayoutList className="h-3.5 w-3.5" />
                ) : (
                  <Columns3 className="h-3.5 w-3.5" />
                )}
                {queueViewMode === "columns" ? "Lista" : "Colunas"}
              </Button>
            ) : null}

            {isQueueView ? (
              <Select
                value={queueTimeSort}
                onValueChange={(value) => setQueueTimeSort(value as QueueTimeSort)}
              >
                <SelectTrigger className="production-control border-white/10 bg-[#050816] text-sm text-slate-100">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  {QUEUE_TIME_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {isQueueView ? (
              <Select
                value={queueMaxTimeFilter}
                onValueChange={(value) => setQueueMaxTimeFilter(value as QueueMaxTimeFilter)}
              >
                <SelectTrigger className="production-control border-white/10 bg-[#050816] text-sm text-slate-100">
                  <SelectValue placeholder="Tempo maximo" />
                </SelectTrigger>
                <SelectContent>
                  {QUEUE_MAX_TIME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <div className="production-status-tabs">
              {(["queue", "printing", "done"] as const).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className={`production-touch-target border-white/10 px-2 text-xs ${
                    filterStatus === status
                      ? "bg-white/[0.10] text-slate-50 hover:bg-white/[0.10]"
                      : "bg-[#050816] text-slate-400 hover:bg-white/[0.05] hover:text-slate-50"
                  }`}
                  onClick={() => setFilterStatus(status)}
                >
                  {status === "queue"
                    ? "Fila"
                    : status === "printing"
                      ? "Fazendo"
                      : "Concluidos"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 overflow-hidden border-white/10 bg-[#081121] text-slate-100 shadow-[0_24px_70px_rgba(2,6,23,0.32)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto pb-2 pt-4">
            <div className="flex w-max items-center gap-2 px-4 sm:px-5">
              {printerTabs.map((tab) => {
                const isActive = filterPrinterKey === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterPrinterKey(tab.id)}
                    draggable={tab.id !== ALL_PRINTERS_FILTER_KEY}
                    onDragStart={(e) => {
                      if (tab.id === ALL_PRINTERS_FILTER_KEY) return;
                      setDraggingPrinterTabId(tab.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (tab.id === ALL_PRINTERS_FILTER_KEY || !draggingPrinterTabId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (tab.id === ALL_PRINTERS_FILTER_KEY || !draggingPrinterTabId) return;
                      handleReorderPrinter(draggingPrinterTabId, tab.id);
                      setDraggingPrinterTabId(null);
                    }}
                    onDragEnd={() => setDraggingPrinterTabId(null)}
                    className={`flex min-h-[44px] min-w-fit cursor-grab items-center gap-2 rounded-2xl border px-4 py-3 text-left transition-all ${
                      draggingPrinterTabId === tab.id ? "opacity-50" : ""
                    } ${
                      isActive
                        ? `${tab.accent.border} ${tab.accent.soft} text-slate-50 shadow-[0_14px_34px_rgba(2,6,23,0.34)]`
                        : "border-white/10 bg-[#050816] text-slate-400 hover:border-white/20 hover:text-slate-50"
                    }`}
                  >
                    {tab.id === ALL_PRINTERS_FILTER_KEY ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    ) : (
                      renderPrinterDot(tab.accent, "sm")
                    )}
                    <span className="text-sm font-medium">{tab.label}</span>
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-slate-300">
                      {tab.count}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => setIsPrinterDialogOpen(true)}
                className="flex min-h-[44px] min-w-fit items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-[#050816] px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-white/30 hover:text-slate-50"
                disabled={!canUsePrinterFeatures}
                title={!canUsePrinterFeatures ? FEATURE_MIGRATION_HELP : undefined}
              >
                <Plus className="h-4 w-4" />
                Nova impressora
              </button>
            </div>
          </div>

          <div className={`border-t px-4 pb-5 pt-4 sm:px-5 ${isAllPrintersView ? "border-white/10" : activePrinterAccent.border}`}>
            <div
              className={`rounded-[24px] border p-4 sm:p-5 ${
                isAllPrintersView
                  ? "border-white/10 bg-[#050816]"
                  : `${activePrinterAccent.border} ${activePrinterAccent.soft}`
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {isAllPrintersView ? (
                      <span className="h-3 w-3 rounded-full bg-slate-300" />
                    ) : (
                      renderPrinterDot(activePrinterAccent, "md")
                    )}
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      {operationsEyebrow}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-50">
                      {operationsTitle}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {operationsDescription}
                    </p>
                  </div>
                </div>

                <div className="production-order-stats">
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {operationsPrimaryLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {operationsPrimaryValue}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {operationsSecondaryLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{visibleQueueOrders.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {operationsTertiaryLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {formatTime(visibleQueueTotalMin)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {filterStatus !== "done" ? (
        <div className="mb-8">
          <div className="mb-3 flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              {isPrintingView ? (
                <Printer className="h-5 w-5 text-primary" />
              ) : (
                <Timer className="h-5 w-5 text-primary" />
              )}
              {operationalSectionTitle}
            </h2>
            <p className="text-xs text-slate-400">
              {operationalSectionDescription}
            </p>
            {!canReorderQueue && !isAllPrintersView && isQueueView ? (
              <p className="text-xs text-amber-400">
                Limpe a busca, o filtro de cor e os filtros de tempo para reordenar esta fila com drag and drop.
              </p>
            ) : null}
          </div>

          <Card className="overflow-hidden border-white/10 bg-[#081121] text-slate-100 shadow-[0_24px_70px_rgba(2,6,23,0.32)]">
            <CardContent
              className={`p-4 sm:p-5 ${!isAllPrintersView ? "transition-colors" : ""} ${
                isQueueView &&
                !isAllPrintersView &&
                dragOverPrinterKey === getPrinterKey(activePrinter?.id || null) &&
                !dragOverOrderId
                  ? "ring-2 ring-primary/50"
                  : ""
              }`}
              onDragOver={
                isQueueView && !isAllPrintersView
                  ? (event) => handleSectionDragOver(event, activePrinter?.id || null)
                  : undefined
              }
              onDrop={
                isQueueView && !isAllPrintersView
                  ? (event) => void handleSectionDrop(event, activePrinter?.id || null)
                  : undefined
              }
            >
              {!hasQueueVisible && !(queueViewMode === "columns" && isQueueView) ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-[#050816] px-6 py-10 text-center text-slate-400">
                  <Package className="mb-4 h-10 w-10 opacity-40" />
                  <p className="text-base font-medium text-slate-200">Nenhum pedido nesta visualizacao.</p>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    {isPrintingView
                      ? isAllPrintersView
                        ? "Nenhuma impressora esta produzindo agora com os filtros atuais."
                        : "Esta impressora nao esta fazendo nenhum pedido neste momento."
                      : isAllPrintersView
                        ? "Importe novos pedidos ou ajuste os filtros para voltar a operar."
                        : "Esta impressora esta sem fila pendente no momento."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Batch action bar */}
                  {isQueueView && visibleQueueOrders.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#050816] p-3">
                      <button
                        onClick={() => toggleSelectAll(visibleQueueOrders.map((o) => o.id))}
                        className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-slate-50"
                      >
                        {selectedOrderIds.size > 0 && selectedOrderIds.size >= visibleQueueOrders.length ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {selectedOrderIds.size > 0 ? `${selectedOrderIds.size} selecionado(s)` : "Selecionar todos"}
                      </button>

                      {selectedOrderIds.size > 0 && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-white/10 bg-transparent text-xs text-slate-300 hover:border-primary/50 hover:text-primary"
                            onClick={() => void handleBatchStartPrinting()}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Imprimir
                          </Button>

                          <Select onValueChange={(v) => void handleBatchAssignPrinter(fromPrinterKey(v))}>
                            <SelectTrigger className="h-8 w-[160px] border-white/10 bg-transparent text-xs text-slate-300">
                              <SelectValue placeholder="Atribuir impressora" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED_PRINTER_KEY}>Sem impressora</SelectItem>
                              {printers.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-white/10 bg-transparent text-xs text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400"
                            onClick={() => void handleBatchMarkDone()}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Marcar feito
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto text-xs text-slate-500 hover:text-slate-300"
                            onClick={() => setSelectedOrderIds(new Set())}
                          >
                            Limpar
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto gap-1.5 border-white/10 bg-transparent text-xs text-slate-300 hover:border-white/20 hover:text-slate-50"
                        onClick={() => void handleExportPdf()}
                        disabled={isExportingPdf}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        {isExportingPdf ? "Gerando..." : "Exportar PDF"}
                      </Button>
                    </div>
                  )}

                  {queueViewMode === "columns" && isQueueView
                    ? (() => {
                        // Build columns: one per printer + "sem impressora", ignoring printer filter
                        const columnsSource = queue.filter((order) => {
                          if (filterColor !== "all" && order.color !== filterColor) return false;
                          if (filterPieceId !== "all" && order.piece_id !== filterPieceId) return false;
                          const normalizedSearch = filterSearch.trim().toLowerCase();
                          if (normalizedSearch) {
                            const searchableValues = [
                              order.pieces.name,
                              order.source_product_name || "",
                              order.platform_order_id || "",
                              order.store_name || "",
                              order.piece_price_variations?.variation_name || "",
                              order.notes || "",
                            ];
                            if (!searchableValues.some((v) => v.toLowerCase().includes(normalizedSearch))) return false;
                          }
                          return true;
                        });

                        const columnDefs: Array<{
                          key: string;
                          label: string;
                          accent: PrinterAccent;
                          printerId: string | null;
                        }> = [
                          {
                            key: UNASSIGNED_PRINTER_KEY,
                            label: "Sem impressora",
                            accent: NEUTRAL_PRINTER_ACCENT,
                            printerId: null,
                          },
                          ...printers.map((p) => ({
                            key: p.id,
                            label: p.name,
                            accent: getPrinterAccent(p.id),
                            printerId: p.id,
                          })),
                        ];

                        const buckets = new Map<string, Order[]>();
                        columnDefs.forEach((c) => buckets.set(c.key, []));
                        columnsSource.forEach((order) => {
                          const k = getPrinterKey(order.printer_id);
                          (buckets.get(k) || buckets.get(UNASSIGNED_PRINTER_KEY))?.push(order);
                        });
                        // Sort each bucket by position
                        buckets.forEach((arr) =>
                          arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
                        );

                        return (
                          <div className="overflow-x-auto">
                            <div className="flex gap-3 pb-2" style={{ minWidth: "100%" }}>
                              {columnDefs.map((col) => {
                                const colOrders = buckets.get(col.key) || [];
                                const totalQty = colOrders.reduce(
                                  (s, o) => s + (o.quantity || 1),
                                  0,
                                );
                                const totalMin = colOrders.reduce((s, o) => {
                                  const t = queueTimeMap.get(o.id);
                                  return s + (t?.totalMin || 0);
                                }, 0);
                                return (
                                  <div
                                    key={col.key}
                                    className={`flex w-[300px] shrink-0 flex-col gap-2 rounded-2xl border ${col.accent.border} ${col.accent.soft} p-3`}
                                    onDragOver={(e) => handleSectionDragOver(e, col.printerId)}
                                    onDrop={(e) => void handleSectionDrop(e, col.printerId)}
                                  >
                                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                      {col.printerId ? (
                                        renderPrinterDot(col.accent, "sm")
                                      ) : (
                                        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                      )}
                                      <span className="text-sm font-semibold text-slate-100">
                                        {col.label}
                                      </span>
                                      <Badge variant="secondary" className="ml-auto text-[10px]">
                                        {colOrders.length}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
                                      <span>{totalQty} un</span>
                                      <span>{formatTime(totalMin)}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      {colOrders.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-6 text-center text-xs text-slate-500">
                                          Sem pedidos
                                        </div>
                                      ) : (
                                        colOrders.map((order, idx) => renderQueueOrderCard(order, idx))
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    : groupByPiece && isQueueView
                    ? (() => {
                        const groups = new Map<
                          string,
                          { key: string; pieceName: string; color: string | null; orders: Order[] }
                        >();
                        visibleQueueOrders.forEach((order) => {
                          const key = `${order.piece_id}::${order.color || ""}`;
                          if (!groups.has(key)) {
                            groups.set(key, {
                              key,
                              pieceName: order.pieces.name,
                              color: order.color,
                              orders: [],
                            });
                          }
                          groups.get(key)!.orders.push(order);
                        });
                        let runningIndex = 0;
                        return Array.from(groups.values()).map((group) => {
                          const totalQty = group.orders.reduce((sum, o) => sum + (o.quantity || 1), 0);
                          const swatch = getColorSwatchValue(group.color);
                          return (
                            <div key={group.key} className="space-y-2">
                              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                                <Package className="h-3.5 w-3.5 text-primary" />
                                <span className="font-semibold">{group.pieceName}</span>
                                {group.color ? (
                                  <span className="flex items-center gap-1.5 text-slate-400">
                                    <span
                                      className={`${getColorDotClassName(group.color, "sm")} ${swatch ? "" : "bg-muted"}`}
                                      style={swatch ? { backgroundColor: swatch } : undefined}
                                    />
                                    {group.color}
                                  </span>
                                ) : null}
                                <Badge variant="secondary" className="ml-auto text-[10px]">
                                  {group.orders.length} pedido{group.orders.length > 1 ? "s" : ""} · {totalQty} un
                                </Badge>
                              </div>
                              {group.orders.map((order) => renderQueueOrderCard(order, runningIndex++))}
                            </div>
                          );
                        });
                      })()
                    : visibleQueueOrders.map((order, index) => renderQueueOrderCard(order, index))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {filterStatus === "done" && filteredDone.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Concluidos ({filteredDone.length})
          </h2>
          <div className="space-y-5">
            {doneSections.map((section) => (
              <div key={section.dateKey} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {section.dateLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {section.totalOrders} {section.totalOrders === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="space-y-4">
                  {section.orderGroups.map((group) => (
                    <Card
                      key={`${section.dateKey}-${group.platformId}-${group.storeName || "sem-loja"}`}
                      className="overflow-hidden opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <CardHeader className="py-2 px-3 sm:px-4 bg-muted/30 border-b">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold font-mono text-muted-foreground">
                            {group.platformId === "sem-pedido"
                              ? "Sem no de pedido"
                              : group.platformId}
                          </span>
                          {getStoreBadgeLabel(group.storeName) ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-sky-400/20 bg-sky-500/10 text-sky-100"
                            >
                              {getStoreBadgeLabel(group.storeName)}
                            </Badge>
                          ) : null}
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            {group.orders.length} {group.orders.length === 1 ? "item" : "itens"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border">
                          {group.orders.map((order) => {
                            const showSourceProductName =
                              Boolean(order.source_product_name) &&
                              normalizeText(order.source_product_name || "") !==
                                normalizeText(order.pieces.name);

                            return (
                              <div key={order.id} className="py-2 px-3 sm:px-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm line-through text-muted-foreground break-words">
                                        {order.pieces.name}
                                      </span>
                                      {order.quantity > 1 ? (
                                        <Badge variant="secondary" className="text-xs">
                                          x{order.quantity}
                                        </Badge>
                                      ) : null}
                                      {order.color ? (
                                        <ColorBadge color={order.color} className="text-xs" />
                                      ) : null}
                                      {order.printers?.name ? (
                                        <Badge variant="outline" className="text-xs">
                                          {order.printers.name}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {showSourceProductName ? (
                                      <p className="text-xs text-muted-foreground break-words">
                                        Anuncio: {order.source_product_name}
                                      </p>
                                    ) : null}
                                    <span className="block text-xs text-muted-foreground">
                                      Finalizado em {formatDateTime(getOrderCompletedAt(order))}
                                    </span>
                                  </div>
                                  <div className="grid gap-2 sm:ml-auto sm:flex sm:items-center shrink-0">
                                    <Select
                                      disabled={!canUseProductionFlow}
                                      value={getOrderStatus(order)}
                                      onValueChange={(value) =>
                                        void handleOrderStatusChange(order.id, value as OrderStatus)
                                      }
                                    >
                                      <SelectTrigger className={doneStatusSelectClassName}>
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
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isQueueView ? (
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
      ) : null}
    </div>
  );
}
