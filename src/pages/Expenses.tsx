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
import { Upload, DollarSign, TrendingUp, TrendingDown, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

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
interface ExcelRow {
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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ExcelRow[]>([]);
  const { toast } = useToast();

  const [manualForm, setManualForm] = useState({
    expense_type: "manual" as "manual" | "installment",
    description: "",
    category: "",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExpenses((data || []) as Expense[]);
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
          // Calculate totals
          const totalReleased = parseNumericValue(row["Quantia total lançada (R$)"]);
          const productPrice = parseNumericValue(row["Preço do produto"]);
          const commission = Math.abs(parseNumericValue(row["Taxa de comissão líquida"]));
          const serviceFee = Math.abs(parseNumericValue(row["Taxa de serviço líquida"]));
          const transactionFee = Math.abs(parseNumericValue(row["Taxa de transação"]));
          const buyerShipping = parseNumericValue(row["Taxa de frete paga pelo comprador"]);
          const shopeeShippingDiscount = parseNumericValue(row["Desconto de frete pela Shopee"]);
          const partnerShippingCost = Math.abs(parseNumericValue(row["Frete cobrado pelo parceiro logístico"]));
          
          const totalFees = commission + serviceFee + transactionFee;
          const netShippingCost = partnerShippingCost - shopeeShippingDiscount - buyerShipping;
          
          return {
            user_id: user.id,
            expense_type: "order" as const,
            platform_order_id: String(row["ID do pedido"] || ""),
            platform: "Shopee",
            order_status: "Concluído",
            order_date: parseExcelDate(String(row["Data de criação do pedido"] || "")),
            payment_date: parseExcelDate(String(row["Data de conclusão do pagamento"] || "")),
            order_value: totalReleased,
            product_value: productPrice,
            discounts: Math.abs(parseNumericValue(row["Voucher subsidiado pelo Seller"])),
            commission: totalFees,
            buyer_shipping: buyerShipping,
            total_shipping: netShippingCost,
            estimated_profit: totalReleased,
            product_name: String(row["Nome do produto"] || ""),
            sku: String(row["SKU"] || ""),
            product_price: productPrice,
            quantity: 1,
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

      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        expense_type: manualForm.expense_type,
        description: manualForm.description,
        category: manualForm.category,
        amount: parseFloat(manualForm.amount),
        notes: manualForm.notes,
      });

      if (error) throw error;

      toast({
        title: "Despesa registrada!",
        description: "Despesa manual adicionada com sucesso.",
      });

      setManualForm({
        expense_type: "manual",
        description: "",
        category: "",
        amount: "",
        notes: "",
      });
      setManualDialogOpen(false);
      fetchExpenses();
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
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateTotals = () => {
    const orderExpenses = expenses.filter((e) => e.expense_type === "order");
    const manualExpenses = expenses.filter((e) => e.expense_type !== "order");

    const totalRevenue = orderExpenses.reduce((sum, e) => sum + (e.order_value || 0), 0);
    const totalCosts = orderExpenses.reduce(
      (sum, e) => sum + (e.commission || 0) + (e.total_shipping || 0),
      0
    ) + manualExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalProfit = orderExpenses.reduce((sum, e) => sum + (e.estimated_profit || 0), 0);

    return { totalRevenue, totalCosts, totalProfit, netProfit: totalProfit - totalCosts };
  };

  const { totalRevenue, totalCosts, totalProfit, netProfit } = calculateTotals();

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
                      <Label htmlFor="amount">Valor (R$) *</Label>
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
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">R$ {totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custos Totais</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">R$ {totalCosts.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">R$ {totalProfit.toFixed(2)}</div>
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
                  netProfit >= 0 ? "text-primary" : "text-red-500"
                }`}
              >
                R$ {netProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle>Histórico de Despesas e Pedidos</CardTitle>
            <CardDescription>
              Todas as despesas, pedidos importados e lucros detalhados
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
                      <TableHead>Descrição/Produto</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Frete</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
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
                          <div className="space-y-1">
                            <p className="font-medium text-sm truncate">
                              {expense.product_name || expense.description}
                            </p>
                            {expense.variation && (
                              <p className="text-xs text-muted-foreground">{expense.variation}</p>
                            )}
                            {expense.category && (
                              <Badge variant="outline" className="text-xs">
                                {expense.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {expense.platform_order_id || "-"}
                        </TableCell>
                        <TableCell>{expense.quantity || "-"}</TableCell>
                        <TableCell className="font-medium">
                          R$ {(expense.order_value || expense.amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-red-500">
                          {expense.commission
                            ? `R$ ${expense.commission.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-red-500">
                          {expense.total_shipping
                            ? `R$ ${expense.total_shipping.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="font-bold text-green-500">
                          {expense.estimated_profit
                            ? `R$ ${expense.estimated_profit.toFixed(2)}`
                            : "-"}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
