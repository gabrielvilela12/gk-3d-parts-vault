import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, DollarSign, TrendingUp, TrendingDown, FileSpreadsheet, Plus, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, CalendarIcon, Filter, Check, Eye, Clock, Calendar as CalendarIconLucide, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths, setDate, isBefore, startOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const PAGE_SIZE = 25;

interface Expense {
  id: string;
  expense_type: "order" | "manual" | "installment";
  platform_order_id?: string;
  internal_order_id?: string;
  platform?: string;
  store_name?: string;
  order_status?: string;
  order_date?: string;
  payment_date?: string;
  order_value?: number;
  product_value?: number;
  discounts?: number;
  commission?: number;
  buyer_shipping?: number;
  total_shipping?: number;
  estimated_profit?: number;
  product_name?: string;
  sku?: string;
  variation?: string;
  image_url?: string;
  product_price?: number;
  quantity?: number;
  description?: string;
  category?: string;
  amount?: number;
  notes?: string;
  created_at: string;
}

// Shopee Income Report Format
interface ExcelRow extends Record<string, any> {
  "Número da sequência": number;
  "Ver": string;
  "ID do pedido": string;
  "ID do reembolso": string;
  "SKU": string;
  "Nome do produto": string;
  "Data de criação do pedido": string;
  "Data de conclusão do pagamento": string;
  "Canal de liberação": string;
  "Tipo de pedido": string;
  "Hot Listing": string;
  "Quantia total lançada (R$)": number;
  "Preço do produto": number;
  "Valor do Reembolso": number;
  "Ajuste por pagamento via PIX": number;
  "Taxa de frete paga pelo comprador": number;
  "Frete cobrado pelo parceiro logístico": number;
  "Desconto de frete pela Shopee": number;
  "Taxa de envio reverso": number;
  "Taxa de devolução do vendedor": number;
  "Incentivo Shopee para ação comercial": number;
  "Voucher subsidiado pelo Seller": number;
  "Voucher compartilhado subsidiado pelo Seller": number;
  "Coin Cashback subsidiado pelo Seller": number;
  "Coin Cashback compartilhado subsidiado pelo Seller": number;
  "Taxa de comissão líquida": number;
  "Taxa de serviço líquida": number;
  "Taxa de transação": number;
  "Taxa de comissão Afiliados do Vendedor": number;
  "Nome de usuário (Comprador)": string;
  "Quantia paga pelo comprador": number;
  "Método de Pagamento do Comprador": string;
  "Parcelamento (se aplicável)": string;
  "Promoção de Desconto no Frete": number;
  "Transportadora": string;
  "Nome da Transportadora": string;
  "Tipo de Estoque": string;
  "Taxa de comissão bruta": number;
  "Taxa de serviço bruta": number;
  "Código do Cupom": string;
  "Ajuste por participação em ação comercial": number;
  "Compensação perdida": number;
  "Valor Reembolsado ao Comprador": number;
}

interface MonthGroup {
  key: string;
  label: string;
  year: number;
  month: number;
  expenses: Expense[];
  totalAmount: number;
  paidCount: number;
  pendingCount: number;
  isCurrentMonth: boolean;
  hasNextInstallment: boolean;
  nextInstallment?: Expense;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [globalTotals, setGlobalTotals] = useState({ totalReceived: 0, totalProductionCost: 0, totalProfit: 0 });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ExcelRow[]>([]);
  const [deletingAll, setDeletingAll] = useState(false);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthGroup | null>(null);
  const { toast } = useToast();

  // View mode: pedidos vs despesas
  const [activeView, setActiveView] = useState<"orders" | "expenses">("orders");

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterSubType, setFilterSubType] = useState<string>("all");
  const [filterMonthStatus, setFilterMonthStatus] = useState<string>("all");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [manualForm, setManualForm] = useState({
    expense_type: "manual" as "manual" | "installment",
    description: "",
    category: "",
    amount: "",
    installments: "1",
    notes: "",
    startDate: "",
    dueDay: "10",
  });

  useEffect(() => {
    if (activeView === "orders") {
      fetchExpenses();
    } else {
      fetchAllExpenses();
    }
  }, [currentPage, activeView, filterSearch, filterDateFrom, filterDateTo, filterSubType]);

  useEffect(() => {
    fetchGlobalTotals();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("expenses")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .eq("expense_type", "order");

      if (filterSearch.trim()) {
        query = query.or(`product_name.ilike.%${filterSearch.trim()}%,description.ilike.%${filterSearch.trim()}%`);
      }
      if (filterDateFrom) {
        query = query.gte("created_at", filterDateFrom.toISOString());
      }
      if (filterDateTo) {
        const endOfDay = new Date(filterDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setExpenses((data || []) as Expense[]);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar despesas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let query = supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .in("expense_type", ["manual", "installment"]);

      if (filterSubType === "manual") {
        query = supabase.from("expenses").select("*").eq("user_id", user.id).eq("expense_type", "manual");
      } else if (filterSubType === "installment") {
        query = supabase.from("expenses").select("*").eq("user_id", user.id).eq("expense_type", "installment");
      }

      if (filterSearch.trim()) {
        query = query.or(`product_name.ilike.%${filterSearch.trim()}%,description.ilike.%${filterSearch.trim()}%`);
      }

      const { data, error } = await query.order("order_date", { ascending: true });

      if (error) throw error;
      setAllExpenses((data || []) as Expense[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar despesas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group expenses by month
  const monthGroups = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const groups = new Map<string, MonthGroup>();

    for (const expense of allExpenses) {
      const date = expense.order_date ? new Date(expense.order_date) : new Date(expense.created_at);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;

      if (!groups.has(key)) {
        const label = format(date, "MMMM yyyy", { locale: ptBR });
        groups.set(key, {
          key,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          year,
          month,
          expenses: [],
          totalAmount: 0,
          paidCount: 0,
          pendingCount: 0,
          isCurrentMonth: key === currentMonthKey,
          hasNextInstallment: false,
        });
      }

      const group = groups.get(key)!;
      group.expenses.push(expense);
      group.totalAmount += expense.amount || 0;
      if (expense.order_status === "pago") {
        group.paidCount++;
      } else {
        group.pendingCount++;
      }
    }

    // Find the global next installment
    const nextInstallment = allExpenses
      .filter(e => e.expense_type === "installment" && e.order_status !== "pago")
      .sort((a, b) => {
        const da = a.order_date ? new Date(a.order_date).getTime() : 0;
        const db = b.order_date ? new Date(b.order_date).getTime() : 0;
        return da - db;
      })[0];

    if (nextInstallment) {
      const date = nextInstallment.order_date ? new Date(nextInstallment.order_date) : new Date(nextInstallment.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const group = groups.get(key);
      if (group) {
        group.hasNextInstallment = true;
        group.nextInstallment = nextInstallment;
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [allExpenses]);

  const fetchGlobalTotals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("expenses")
        .select("expense_type, order_value, amount, estimated_profit")
        .eq("user_id", user.id);

      if (!data) return;

      let totalReceived = 0;
      let totalProductionCost = 0;
      let totalProfit = 0;

      for (const e of data) {
        totalReceived += e.order_value || 0;
        totalProductionCost += e.amount || 0;
        totalProfit += e.estimated_profit || 0;
      }

      setGlobalTotals({ totalReceived, totalProductionCost, totalProfit });
    } catch {
      // silent
    }
  };

  const handleDeleteAll = async () => {
    try {
      setDeletingAll(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("expenses").delete().eq("user_id", user.id);
      if (error) throw error;

      toast({ title: "Todas as despesas foram apagadas!" });
      setCurrentPage(0);
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({
        title: "Erro ao apagar despesas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const parseNumericValue = (value: any): number => {
    if (value === undefined || value === null || value === "") return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      const normalize = (v: any) =>
        String(v ?? "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const preferredSheetName = workbook.SheetNames.find((name) => {
        const n = normalize(name);
        return n === "renda" || n.includes("renda");
      });

      const sheetName = preferredSheetName || workbook.SheetNames[3] || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
      }) as any[][];

      const requiredHeaders = ["numero da sequencia", "ver", "id do pedido", "sku", "nome do produto"];
      const headerRowIndex = rows.findIndex((r) => {
        const cells = (r || []).map((c) => normalize(c));
        return requiredHeaders.every((h) => cells.includes(h));
      });

      if (headerRowIndex === -1) {
        throw new Error(`Não encontrei o cabeçalho da aba "${sheetName}" (esperava colunas como: Ver, ID do pedido, SKU, Nome do produto).`);
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        range: headerRowIndex,
      }) as ExcelRow[];

      const skuRows = jsonData.filter((row) => normalize(row["Ver"]) === "sku");

      setImportData(skuRows);
      toast({
        title: "Arquivo carregado!",
        description: `${skuRows.length} produtos encontrados. Revise antes de importar.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const parseExcelDate = (dateStr: string): string | undefined => {
    if (!dateStr || dateStr === "-") return undefined;
    try {
      return dateStr;
    } catch {
      return undefined;
    }
  };

  const handleConfirmImport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: piecesData } = await supabase
        .from("pieces")
        .select("id, name, cost, custo_material, custo_energia, custo_acessorios, preco_venda")
        .eq("user_id", user.id);

      const pieces = piecesData || [];

      const normalizeName = (v: string) =>
        v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const pieceCostMap = new Map<string, { cost: number; price: number }>();
      for (const p of pieces) {
        const totalCost = (p.custo_material || 0) + (p.custo_energia || 0) + (p.custo_acessorios || 0);
        const costToUse = totalCost > 0 ? totalCost : (p.cost || 0);
        if (costToUse > 0) {
          pieceCostMap.set(normalizeName(p.name), { cost: costToUse, price: p.preco_venda || 0 });
        }
      }

      const findPieceInfo = (productName: string): { cost: number; price: number } => {
        const normalized = normalizeName(productName);
        if (pieceCostMap.has(normalized)) return pieceCostMap.get(normalized)!;
        for (const [name, info] of pieceCostMap) {
          if (normalized.includes(name) || name.includes(normalized)) return info;
        }
        return { cost: 0, price: 0 };
      };

      const { data: existingData } = await supabase
        .from("expenses")
        .select("platform_order_id, sku")
        .eq("user_id", user.id)
        .eq("expense_type", "order");

      const existingKeys = new Set(
        (existingData || []).map((e) => `${e.platform_order_id}-${e.sku}`)
      );

      const newExpenses = importData
        .filter((row) => {
          const orderId = String(row["ID do pedido"] || "");
          const sku = String(row["SKU"] || "");
          const key = `${orderId}-${sku}`;
          return !existingKeys.has(key);
        })
        .map((row) => {
          const totalReleased = parseNumericValue(row["Quantia total lançada (R$)"]);
          const productPrice = parseNumericValue(row["Preço do produto"]);

          const productName = String(row["Nome do produto"] || "");
          const pieceInfo = findPieceInfo(productName);

          const rawQty = parseNumericValue(row["Quantidade"]);
          let quantity = rawQty > 0 ? rawQty : 1;

          if (rawQty <= 0 && pieceInfo.price > 0 && productPrice > 0) {
            const derived = Math.round(productPrice / pieceInfo.price);
            if (derived > 1) quantity = derived;
          }

          const productionCost = pieceInfo.cost * quantity;
          const estimatedProfit = totalReleased - productionCost;

          return {
            user_id: user.id,
            expense_type: "order" as const,
            platform_order_id: String(row["ID do pedido"] || ""),
            platform: "Shopee",
            order_status: "Concluído",
            order_date: parseExcelDate(String(row["Data de criação do pedido"] || "")),
            payment_date: parseExcelDate(String(row["Data de conclusão do pagamento"] || "")),
            order_value: totalReleased,
            amount: productionCost,
            estimated_profit: estimatedProfit,
            product_name: productName,
            sku: String(row["SKU"] || ""),
            quantity,
          };
        });

      if (newExpenses.length === 0) {
        toast({
          title: "Nenhuma nova despesa",
          description: "Todos os pedidos já foram importados anteriormente.",
        });
        return;
      }

      const { error } = await supabase.from("expenses").insert(newExpenses);

      if (error) throw error;

      toast({
        title: "Importação concluída!",
        description: `${newExpenses.length} produtos importados. ${importData.length - newExpenses.length} duplicados ignorados.`,
      });

      setImportData([]);
      setUploadDialogOpen(false);
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const totalAmount = parseFloat(manualForm.amount);
      const numInstallments = Math.max(1, parseInt(manualForm.installments) || 1);
      const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;

      const entries: any[] = [];
      const today = startOfDay(new Date());
      const dueDay = 10;

      if (numInstallments > 1) {
        const dueDayCustom = Math.min(28, Math.max(1, parseInt(manualForm.dueDay) || 10));
        let startMonth: Date;
        if (manualForm.startDate) {
          startMonth = new Date(manualForm.startDate + "T00:00:00");
        } else {
          startMonth = new Date();
        }

        for (let i = 0; i < numInstallments; i++) {
          const dueDate = setDate(addMonths(startMonth, i), dueDayCustom);
          const isPast = isBefore(dueDate, today);
          entries.push({
            user_id: user.id,
            expense_type: "installment" as const,
            description: `${manualForm.description} (${i + 1}/${numInstallments})`,
            category: manualForm.category,
            amount: installmentAmount,
            notes: manualForm.notes,
            order_date: dueDate.toISOString(),
            order_status: isPast ? "pago" : "pendente",
            payment_date: isPast ? dueDate.toISOString() : null,
          });
        }
      } else {
        const now = new Date();
        const nextDue = now.getDate() >= dueDay
          ? setDate(addMonths(now, 1), dueDay)
          : setDate(now, dueDay);
        entries.push({
          user_id: user.id,
          expense_type: "manual" as const,
          description: manualForm.description,
          category: manualForm.category,
          amount: installmentAmount,
          notes: manualForm.notes,
          order_date: nextDue.toISOString(),
          order_status: "pendente",
          payment_date: null,
        });
      }

      const { error } = await supabase.from("expenses").insert(entries);
      if (error) throw error;

      toast({
        title: "Despesa registrada!",
        description: numInstallments > 1
          ? `${numInstallments} parcelas de R$ ${installmentAmount.toFixed(2)} criadas.`
          : "Despesa manual adicionada com sucesso.",
      });

      setManualForm({
        expense_type: "manual",
        description: "",
        category: "",
        amount: "",
        installments: "1",
        notes: "",
        startDate: "",
        dueDay: "10",
      });
      setManualDialogOpen(false);
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar despesa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveInstallment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ order_status: "pago", payment_date: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      toast({ title: "Parcela aprovada!", description: "Marcada como paga." });
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    }
  };

  const handleApproveMonth = async (group: MonthGroup) => {
    try {
      const unpaidIds = group.expenses
        .filter(e => e.order_status !== "pago")
        .map(e => e.id);

      if (unpaidIds.length === 0) {
        toast({ title: "Tudo já está pago neste mês!" });
        return;
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("expenses")
        .update({ order_status: "pago", payment_date: now })
        .in("id", unpaidIds);

      if (error) throw error;

      toast({
        title: "Mês pago! ✓",
        description: `${unpaidIds.length} item(s) marcado(s) como pago.`,
      });
      setSelectedMonth(null);
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({ title: "Erro ao pagar mês", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteSelectedMonths = async () => {
    try {
      const idsToDelete = allExpenses
        .filter(e => {
          const date = e.order_date ? new Date(e.order_date) : new Date(e.created_at);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          return selectedMonthKeys.has(key);
        })
        .map(e => e.id);

      if (idsToDelete.length === 0) return;

      const { error } = await supabase.from("expenses").delete().in("id", idsToDelete);
      if (error) throw error;

      toast({ title: "Meses excluídos!", description: `${idsToDelete.length} despesa(s) removida(s).` });
      setSelectedMonthKeys(new Set());
      setSelectMode(false);
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };
  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Despesa excluída!" });
      fetchExpenses();
      fetchAllExpenses();
      fetchGlobalTotals();
      if (selectedMonth) {
        setSelectedMonth(prev => prev ? {
          ...prev,
          expenses: prev.expenses.filter(e => e.id !== id),
        } : null);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const { totalReceived, totalProductionCost, totalProfit } = globalTotals;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <DollarSign className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando despesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Gestão de Despesas</h1>
            <p className="page-subtitle">Controle de pedidos, lucros e custos operacionais</p>
          </div>

          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={totalCount === 0 && allExpenses.length === 0 || deletingAll}>
                  <Trash2 className="h-4 w-4" />
                  Apagar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar todas as despesas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação é irreversível. Todos os registros serão removidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" variant="outline">
                  <Upload className="h-4 w-4" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Importar Relatório de Rendimento Shopee</DialogTitle>
                  <DialogDescription>
                    Carregue o arquivo Excel exportado da Shopee (Income Report). Duplicatas serão ignoradas automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="excel-file">Selecionar Arquivo</Label>
                    <Input
                      id="excel-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {importData.length > 0 && (
                    <>
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm font-medium mb-2">Resumo da Importação</p>
                        <p className="text-sm text-muted-foreground">
                          {importData.length} produtos encontrados no arquivo
                        </p>
                      </div>

                      <div className="max-h-60 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Pedido</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead>SKU</TableHead>
                              <TableHead>Valor Liberado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importData.slice(0, 10).map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">
                                  {row["ID do pedido"]}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate text-xs">
                                  {row["Nome do produto"]}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{row["SKU"]}</TableCell>
                                <TableCell>R$ {parseNumericValue(row["Quantia total lançada (R$)"]).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <Button onClick={handleConfirmImport} className="w-full">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Confirmar Importação
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Despesa Manual</DialogTitle>
                  <DialogDescription>
                    Registre custos de parcelas, materiais, impressoras, etc.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Despesa</Label>
                    <Tabs
                      value={manualForm.expense_type}
                      onValueChange={(value) =>
                        setManualForm({ ...manualForm, expense_type: value as any })
                      }
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="manual">Despesa Geral</TabsTrigger>
                        <TabsTrigger value="installment">Parcela</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor Total (R$) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={manualForm.amount}
                        onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                        required
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="installments">Parcelas</Label>
                      <Input
                        id="installments"
                        type="number"
                        min="1"
                        max="48"
                        value={manualForm.installments}
                        onChange={(e) => setManualForm({ ...manualForm, installments: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  {parseInt(manualForm.installments) > 1 && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Início da 1ª parcela</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !manualForm.startDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {manualForm.startDate
                                  ? format(new Date(manualForm.startDate + "T12:00:00"), "dd/MM/yyyy")
                                  : "Selecionar data"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={manualForm.startDate ? new Date(manualForm.startDate + "T12:00:00") : undefined}
                                onSelect={(d) => setManualForm({ ...manualForm, startDate: d ? format(d, "yyyy-MM-dd") : "" })}
                                className={cn("p-3 pointer-events-auto")}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">Mês da primeira parcela</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dueDay">Dia de vencimento</Label>
                          <Input
                            id="dueDay"
                            type="number"
                            min="1"
                            max="28"
                            value={manualForm.dueDay}
                            onChange={(e) => setManualForm({ ...manualForm, dueDay: e.target.value })}
                            placeholder="10"
                          />
                          <p className="text-xs text-muted-foreground">Todo dia {manualForm.dueDay || "10"} do mês</p>
                        </div>
                      </div>

                      {manualForm.amount && (
                        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                          {parseInt(manualForm.installments)}x de R$ {(parseFloat(manualForm.amount) / parseInt(manualForm.installments)).toFixed(2)}
                          {manualForm.startDate && (
                            <span> — parcelas já vencidas serão marcadas como pagas automaticamente</span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Input
                        id="category"
                        value={manualForm.category}
                        onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                        placeholder="Ex: Filamento, Energia..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Input
                      id="description"
                      value={manualForm.description}
                      onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                      required
                      placeholder="Descreva a despesa..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={manualForm.notes}
                      onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                      placeholder="Notas adicionais..."
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Registrar Despesa
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={activeView} onValueChange={(v) => { setActiveView(v as "orders" | "expenses"); setCurrentPage(0); setFilterSubType("all"); }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="expenses">Despesas / Parcelas</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card className="card-gradient border-border/50">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Produto ou descrição..."
                    value={filterSearch}
                    onChange={(e) => { setFilterSearch(e.target.value); setCurrentPage(0); }}
                    className="pl-9"
                  />
                </div>
              </div>

              {activeView === "expenses" && (
                <div className="w-[150px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
                  <Select value={filterSubType} onValueChange={(v) => { setFilterSubType(v); setCurrentPage(0); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="manual">Despesas</SelectItem>
                      <SelectItem value="installment">Parcelas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeView === "expenses" && (
                <div className="w-[150px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Select value={filterMonthStatus} onValueChange={(v) => setFilterMonthStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pagos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeView === "orders" && (
                <>
                  <div className="w-auto">
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !filterDateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filterDateFrom ? format(filterDateFrom, "dd/MM/yy") : "Início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={filterDateFrom} onSelect={(d) => { setFilterDateFrom(d); setCurrentPage(0); }} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="w-auto">
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !filterDateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filterDateTo ? format(filterDateTo, "dd/MM/yy") : "Fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={filterDateTo} onSelect={(d) => { setFilterDateTo(d); setCurrentPage(0); }} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              {(filterSearch || filterDateFrom || filterDateTo || filterSubType !== "all" || filterMonthStatus !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterSearch(""); setFilterDateFrom(undefined); setFilterDateTo(undefined); setFilterSubType("all"); setFilterMonthStatus("all"); setCurrentPage(0); }}>
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Recebido</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">R$ {totalReceived.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo de Produção</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">R$ {totalProductionCost.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50 glow-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-bold ${
                  totalProfit >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                R$ {totalProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content based on active view */}
        {activeView === "orders" ? (
          /* Orders Table */
          <Card className="card-gradient border-border/50">
            <CardHeader>
              <CardTitle>Pedidos Importados</CardTitle>
              <CardDescription>
                {totalCount} registros — Página {currentPage + 1} de {totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum pedido importado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor Recebido</TableHead>
                        <TableHead>Custo Produção</TableHead>
                        <TableHead>Lucro Líquido</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => {
                        const received = expense.order_value || 0;
                        const productionCost = expense.amount || 0;
                        const profit = expense.estimated_profit ?? (received - productionCost);
                        return (
                          <TableRow key={expense.id}>
                            <TableCell className="max-w-[250px]">
                              <p className="font-medium text-sm truncate">
                                {expense.product_name || expense.description}
                              </p>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {expense.platform_order_id || "-"}
                            </TableCell>
                            <TableCell>{expense.quantity || "-"}</TableCell>
                            <TableCell className="font-medium text-green-500">
                              R$ {received.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-medium text-red-500">
                              {productionCost > 0 ? `R$ ${productionCost.toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell className={`font-bold ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              R$ {profit.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {expense.order_date ? new Date(expense.order_date).toLocaleDateString("pt-BR") : new Date(expense.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteExpense(expense.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Monthly Cards View */
          <div className="space-y-4">
            {monthGroups.length > 0 && (
              <div className="flex items-center justify-between">
                <Button
                  variant={selectMode ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setSelectMode(!selectMode);
                    setSelectedMonthKeys(new Set());
                  }}
                >
                  {selectMode ? "Cancelar seleção" : "Selecionar meses"}
                </Button>
                {selectMode && selectedMonthKeys.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Excluir {selectedMonthKeys.size} mês(es)
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir meses selecionados?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todas as despesas dos {selectedMonthKeys.size} mês(es) selecionado(s) serão removidas permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelectedMonths}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            {monthGroups.length === 0 ? (
              <Card className="card-gradient border-border/50">
                <CardContent className="py-12">
                  <div className="text-center">
                    <CalendarIconLucide className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma despesa ou parcela registrada</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthGroups.filter((group) => {
                  if (filterMonthStatus === "paid") return group.pendingCount === 0;
                  if (filterMonthStatus === "pending") return group.pendingCount > 0;
                  return true;
                }).map((group) => {
                  const allPaid = group.pendingCount === 0;
                  const progressPercent = group.expenses.length > 0
                    ? (group.paidCount / group.expenses.length) * 100
                    : 0;

                  return (
                    <Card
                      key={group.key}
                      className={cn(
                        "card-gradient border-border/50 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                        group.hasNextInstallment && "border-primary/60 ring-1 ring-primary/30",
                        group.isCurrentMonth && !group.hasNextInstallment && "border-accent/60",
                        selectMode && selectedMonthKeys.has(group.key) && "ring-2 ring-destructive border-destructive/60",
                      )}
                      onClick={() => {
                        if (selectMode) {
                          setSelectedMonthKeys(prev => {
                            const next = new Set(prev);
                            if (next.has(group.key)) next.delete(group.key);
                            else next.add(group.key);
                            return next;
                          });
                        } else {
                          setSelectedMonth(group);
                        }
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {selectMode && (
                              <div className={cn(
                                "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                selectedMonthKeys.has(group.key)
                                  ? "bg-destructive border-destructive text-destructive-foreground"
                                  : "border-muted-foreground"
                              )}>
                                {selectedMonthKeys.has(group.key) && <Check className="h-3 w-3" />}
                              </div>
                            )}
                            <CalendarIconLucide className="h-5 w-5 text-muted-foreground" />
                            {group.label}
                          </CardTitle>
                          {group.hasNextInstallment && (
                            <Badge className="bg-primary text-primary-foreground animate-pulse text-xs">
                              ⏳ Próxima
                            </Badge>
                          )}
                          {allPaid && group.expenses.length > 0 && !group.hasNextInstallment && (
                            <Badge variant="outline" className="text-green-500 border-green-500/50 text-xs">
                              ✓ Pago
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-muted-foreground">Total do mês</span>
                          <span className="text-2xl font-bold text-destructive">
                            R$ {group.totalAmount.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{group.expenses.length} item(s)</span>
                          <span>•</span>
                          <span className="text-green-500">{group.paidCount} pago(s)</span>
                          {group.pendingCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-500">{group.pendingCount} pendente(s)</span>
                            </>
                          )}
                        </div>

                        <Progress value={progressPercent} className="h-1.5" />

                        {group.nextInstallment && (
                          <div className="rounded-md bg-primary/10 p-2 mt-2">
                            <p className="text-xs font-medium text-primary truncate">
                              {group.nextInstallment.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Vence em {group.nextInstallment.order_date
                                ? new Date(group.nextInstallment.order_date).toLocaleDateString("pt-BR")
                                : "—"}
                              {" · "}R$ {(group.nextInstallment.amount || 0).toFixed(2)}
                            </p>
                          </div>
                        )}

                        {group.pendingCount > 0 && (() => {
                          const now = new Date();
                          const monthArrived = group.year < now.getFullYear() || (group.year === now.getFullYear() && group.month <= now.getMonth());
                          return monthArrived ? (
                            <Button
                              size="sm"
                              className="w-full gap-1 mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveMonth(group);
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Pagar mês
                            </Button>
                          ) : null;
                        })()}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Month Detail Dialog */}
        <Dialog open={!!selectedMonth} onOpenChange={(open) => !open && setSelectedMonth(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIconLucide className="h-5 w-5 text-primary" />
                {selectedMonth?.label}
              </DialogTitle>
              <DialogDescription>
                {selectedMonth?.expenses.length} item(s) · Total: R$ {(selectedMonth?.totalAmount || 0).toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            {selectedMonth && (() => {
              const unpaidCount = selectedMonth.expenses.filter(e => e.order_status !== "pago").length;
              const nextInstallmentId = selectedMonth.expenses
                .filter(e => e.expense_type === "installment" && e.order_status !== "pago")
                .sort((a, b) => {
                  const da = a.order_date ? new Date(a.order_date).getTime() : 0;
                  const db = b.order_date ? new Date(b.order_date).getTime() : 0;
                  return da - db;
                })[0]?.id;

              return (
                <div className="space-y-3">
                  {unpaidCount > 0 && (() => {
                    const now = new Date();
                    const monthArrived = selectedMonth.year < now.getFullYear() || (selectedMonth.year === now.getFullYear() && selectedMonth.month <= now.getMonth());
                    return monthArrived ? (
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={() => handleApproveMonth(selectedMonth)}
                      >
                        <Check className="h-5 w-5" />
                        Pagar tudo do mês ({unpaidCount} pendente{unpaidCount > 1 ? "s" : ""}) · R$ {selectedMonth.expenses.filter(e => e.order_status !== "pago").reduce((sum, e) => sum + (e.amount || 0), 0).toFixed(2)}
                      </Button>
                    ) : null;
                  })()}
                  {selectedMonth.expenses.map((expense) => {
                    const isPaid = expense.order_status === "pago";
                    const isInstallment = expense.expense_type === "installment";
                    const dueDate = expense.order_date ? new Date(expense.order_date) : null;
                    const isNext = expense.id === nextInstallmentId;
                    const isOverdue = dueDate && !isPaid && !isNext && dueDate <= new Date();
                    const daysUntil = dueDate ? differenceInDays(dueDate, new Date()) : null;

                    return (
                      <Card
                        key={expense.id}
                        className={cn(
                          "border-border/50",
                          isNext && "border-primary ring-1 ring-primary/30 bg-primary/5",
                          isOverdue && "border-destructive/50 bg-destructive/5",
                          isPaid && "opacity-70",
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={isInstallment ? "secondary" : "outline"} className="text-xs shrink-0">
                                  {isInstallment ? "Parcela" : "Manual"}
                                </Badge>
                                {isNext && (
                                  <Badge className="bg-primary text-primary-foreground animate-pulse text-xs shrink-0">
                                    ⏳ Próxima
                                  </Badge>
                                )}
                                {isPaid && (
                                  <Badge variant="outline" className="text-green-500 border-green-500/50 text-xs shrink-0">
                                    ✓ Pago
                                  </Badge>
                                )}
                                {isOverdue && (
                                  <Badge variant="destructive" className="text-xs shrink-0">
                                    Vencida
                                  </Badge>
                                )}
                                {expense.category && (
                                  <Badge variant="outline" className="text-xs shrink-0">{expense.category}</Badge>
                                )}
                              </div>
                              <p className="font-medium text-sm truncate">{expense.description || "—"}</p>
                              {expense.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{expense.notes}</p>}
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>
                                  Vence: {dueDate ? dueDate.toLocaleDateString("pt-BR") : "—"}
                                </span>
                                {daysUntil !== null && !isPaid && (
                                  <span className={cn(
                                    daysUntil <= 0 ? "text-destructive" : daysUntil <= 3 ? "text-amber-500" : "text-muted-foreground"
                                  )}>
                                    {daysUntil <= 0 ? "Vencida!" : daysUntil === 1 ? "Amanhã" : `em ${daysUntil} dias`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-lg text-destructive">
                                R$ {(expense.amount || 0).toFixed(2)}
                              </span>
                              <div className="flex gap-1">
                                {isNext && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDetailExpense(expense);
                                    }}
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-4 w-4 text-primary" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteExpense(expense.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Detail Dialog for next installment */}
        <Dialog open={!!detailExpense} onOpenChange={(open) => !open && setDetailExpense(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Próxima Parcela
              </DialogTitle>
              <DialogDescription>Detalhes da parcela a ser paga</DialogDescription>
            </DialogHeader>
            {detailExpense && (() => {
              const dueDate = detailExpense.order_date ? new Date(detailExpense.order_date) : null;
              const today = new Date();
              const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

              const baseName = detailExpense.description?.replace(/\s*\(\d+\/\d+\)$/, "") || "";
              const allRelated = allExpenses.filter(e =>
                e.expense_type === "installment" && e.description?.startsWith(baseName)
              );
              const paidCount = allRelated.filter(e => e.order_status === "pago").length;
              const totalInstallments = allRelated.length;

              return (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Descrição</span>
                      <span className="font-medium text-sm">{detailExpense.description}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor</span>
                      <span className="font-bold text-lg text-destructive">R$ {(detailExpense.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencimento</span>
                      <span className="font-medium">{dueDate?.toLocaleDateString("pt-BR")}</span>
                    </div>
                    {daysUntil !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Tempo restante</span>
                        <Badge variant={daysUntil <= 0 ? "destructive" : daysUntil <= 3 ? "secondary" : "outline"}>
                          {daysUntil <= 0 ? "Vencida!" : daysUntil === 1 ? "Amanhã" : `${daysUntil} dias`}
                        </Badge>
                      </div>
                    )}
                    {detailExpense.category && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Categoria</span>
                        <Badge variant="outline">{detailExpense.category}</Badge>
                      </div>
                    )}
                  </div>

                  {totalInstallments > 0 && (
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{paidCount}/{totalInstallments} pagas</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-2.5">
                        <div
                          className="bg-primary h-2.5 rounded-full transition-all"
                          style={{ width: `${(paidCount / totalInstallments) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Restam {totalInstallments - paidCount} parcela(s) · Total restante: R$ {((totalInstallments - paidCount) * (detailExpense.amount || 0)).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => {
                      handleApproveInstallment(detailExpense.id);
                      setDetailExpense(null);
                    }}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marcar como Pago
                  </Button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}