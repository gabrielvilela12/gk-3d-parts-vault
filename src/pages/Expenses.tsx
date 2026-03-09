import { useEffect, useState } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, DollarSign, TrendingUp, TrendingDown, FileSpreadsheet, Plus, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, CalendarIcon, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths } from "date-fns";
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

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [globalTotals, setGlobalTotals] = useState({ totalReceived: 0, totalProductionCost: 0, totalProfit: 0 });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ExcelRow[]>([]);
  const [deletingAll, setDeletingAll] = useState(false);
  const { toast } = useToast();

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [manualForm, setManualForm] = useState({
    expense_type: "manual" as "manual" | "installment",
    description: "",
    category: "",
    amount: "",
    installments: "1",
    notes: "",
  });

  useEffect(() => {
    fetchExpenses();
  }, [currentPage, filterType, filterSearch, filterDateFrom, filterDateTo]);

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
        .eq("user_id", user.id);

      // Apply filters
      if (filterType !== "all") {
        query = query.eq("expense_type", filterType);
      }
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

  const fetchGlobalTotals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all expenses but only needed columns for totals
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

      // Prefer the sheet named "Renda" (as in Shopee PT-BR export)
      const preferredSheetName = workbook.SheetNames.find((name) => {
        const n = normalize(name);
        return n === "renda" || n.includes("renda");
      });

      const sheetName = preferredSheetName || workbook.SheetNames[3] || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Shopee "Renda" sheet usually has 2 grouping rows before the real header.
      // Detect the header row by searching for required columns.
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
        throw new Error(`Não encontrei o cabeçalho da aba \"${sheetName}\" (esperava colunas como: Ver, ID do pedido, SKU, Nome do produto).`);
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        range: headerRowIndex,
      }) as ExcelRow[];

      // Filter only "Sku" rows (each order has 2 rows: Order + Sku)
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
      // Shopee format: "2026-03-04"
      return dateStr;
    } catch {
      return undefined;
    }
  };

  const handleConfirmImport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Fetch all pieces to match by name/SKU and get production costs
      const { data: piecesData } = await supabase
        .from("pieces")
        .select("id, name, cost, custo_material, custo_energia, custo_acessorios, preco_venda")
        .eq("user_id", user.id);

      const pieces = piecesData || [];

      // Build a lookup: normalize piece name -> piece cost
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

      // Check for duplicates by platform_order_id + SKU
      const existingExpenses = expenses.filter((e) => e.expense_type === "order");
      const existingKeys = new Set(
        existingExpenses.map((e) => `${e.platform_order_id}-${e.sku}`)
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

          // Try to get quantity from Excel column or derive from price
          const rawQty = parseNumericValue(row["Quantidade"]);
          let quantity = rawQty > 0 ? rawQty : 1;
          
          // If no explicit qty column, derive from product price / unit sale price
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

      const entries = [];
      for (let i = 0; i < numInstallments; i++) {
        const dueDate = addMonths(new Date(), i);
        entries.push({
          user_id: user.id,
          expense_type: numInstallments > 1 ? "installment" as const : manualForm.expense_type,
          description: numInstallments > 1
            ? `${manualForm.description} (${i + 1}/${numInstallments})`
            : manualForm.description,
          category: manualForm.category,
          amount: installmentAmount,
          notes: manualForm.notes,
          order_date: dueDate.toISOString(),
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
      });
      setManualDialogOpen(false);
      fetchExpenses();
      fetchGlobalTotals();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar despesa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Despesa excluída!",
      });
      fetchExpenses();
      fetchGlobalTotals();
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
                <Button variant="destructive" className="gap-2" disabled={totalCount === 0 || deletingAll}>
                  <Trash2 className="h-4 w-4" />
                  Apagar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar todas as despesas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação é irreversível. Todos os {totalCount} registros serão removidos permanentemente.
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

                  {parseInt(manualForm.installments) > 1 && manualForm.amount && (
                    <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      {parseInt(manualForm.installments)}x de R$ {(parseFloat(manualForm.amount) / parseInt(manualForm.installments)).toFixed(2)}
                    </div>
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

        {/* Expenses Table */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle>Histórico de Despesas e Pedidos</CardTitle>
            <CardDescription>
              {totalCount} registros no total — Página {currentPage + 1} de {totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-8">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma despesa registrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
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
                          <TableCell>
                            <Badge
                              variant={
                                expense.expense_type === "order"
                                  ? "default"
                                  : expense.expense_type === "installment"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {expense.expense_type === "order"
                                ? "Pedido"
                                : expense.expense_type === "installment"
                                ? "Parcela"
                                : "Manual"}
                            </Badge>
                          </TableCell>
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
                            {new Date(expense.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  {currentPage + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
