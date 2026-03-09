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

interface ExcelRow {
  "Nº de Pedido da Plataforma": string;
  "Nº de Pedido": string;
  "Plataformas": string;
  "Nome da Loja no UpSeller": string;
  "Estado do Pedido": string;
  "Hora do Pedido": string;
  "Hora do Pagamento": string;
  "Prazo de Envio": string;
  "Valor do Pedido": number;
  "Valor Total de Produtos": number;
  "Descontos e Cupons": number;
  "Comissão Total": number;
  "Frete do Comprador": number;
  "Total de Frete": number;
  "Lucro Estimado": number;
  "Nome do Anúncio": string;
  "SKU": string;
  "Variação": string;
  "Link da Imagem": string;
  "Preço de Produto": number;
  "Qtd. do Produto": number;
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
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as ExcelRow[];

      setImportData(jsonData);
      toast({
        title: "Arquivo carregado!",
        description: `${jsonData.length} linhas encontradas. Revise antes de importar.`,
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
    if (!dateStr) return undefined;
    try {
      // Format: "07/03/2026 09:02" or "2026-03-07 09:03:21"
      if (dateStr.includes("/")) {
        const [date, time] = dateStr.split(" ");
        const [day, month, year] = date.split("/");
        return `${year}-${month}-${day}${time ? " " + time : ""}`;
      }
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
          const key = `${row["Nº de Pedido da Plataforma"]}-${row["SKU"]}`;
          return !existingKeys.has(key);
        })
        .map((row) => ({
          user_id: user.id,
          expense_type: "order" as const,
          platform_order_id: row["Nº de Pedido da Plataforma"],
          internal_order_id: row["Nº de Pedido"],
          platform: row["Plataformas"],
          store_name: row["Nome da Loja no UpSeller"],
          order_status: row["Estado do Pedido"],
          order_date: parseExcelDate(row["Hora do Pedido"]),
          payment_date: parseExcelDate(row["Hora do Pagamento"]),
          shipping_deadline: parseExcelDate(row["Prazo de Envio"]),
          order_value: row["Valor do Pedido"] || 0,
          product_value: row["Valor Total de Produtos"] || 0,
          discounts: row["Descontos e Cupons"] || 0,
          commission: row["Comissão Total"] || 0,
          buyer_shipping: row["Frete do Comprador"] || 0,
          total_shipping: row["Total de Frete"] || 0,
          estimated_profit: row["Lucro Estimado"] || 0,
          product_name: row["Nome do Anúncio"],
          sku: row["SKU"],
          variation: row["Variação"],
          image_url: row["Link da Imagem"],
          product_price: row["Preço de Produto"] || 0,
          quantity: row["Qtd. do Produto"] || 1,
        }));

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
        description: `${newExpenses.length} pedidos importados. ${importData.length - newExpenses.length} duplicados ignorados.`,
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
                  <DialogTitle>Importar Pedidos do Excel</DialogTitle>
                  <DialogDescription>
                    Carregue o arquivo de exportação de pedidos. Duplicatas serão automaticamente ignoradas.
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
                          {importData.length} linhas encontradas no arquivo
                        </p>
                      </div>

                      <div className="max-h-60 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Pedido</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead>Qtd</TableHead>
                              <TableHead>Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importData.slice(0, 10).map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">
                                  {row["Nº de Pedido da Plataforma"]}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate text-xs">
                                  {row["Nome do Anúncio"]}
                                </TableCell>
                                <TableCell>{row["Qtd. do Produto"]}</TableCell>
                                <TableCell>R$ {row["Preço de Produto"]?.toFixed(2)}</TableCell>
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
