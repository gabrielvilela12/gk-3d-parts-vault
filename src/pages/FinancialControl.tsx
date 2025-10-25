import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  transaction_date: string;
  notes: string;
}

export default function FinancialControl() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    type: "income" as "income" | "expense",
    amount: "",
    description: "",
    category: "",
    notes: "",
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("financial_transactions").insert({
        user_id: user.id,
        type: formData.type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        notes: formData.notes,
      });

      if (error) throw error;

      toast({
        title: "Transação registrada!",
        description: `${formData.type === "income" ? "Entrada" : "Despesa"} adicionada com sucesso.`,
      });

      setFormData({
        type: "income",
        amount: "",
        description: "",
        category: "",
        notes: "",
      });
      setDialogOpen(false);
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar transação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateBalance = () => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  };

  const { income, expenses, balance } = calculateBalance();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <DollarSign className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando controle financeiro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Controle Financeiro</h1>
            <p className="text-muted-foreground">Gerencie suas entradas e despesas</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <DollarSign className="h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
                <DialogDescription>
                  Registre uma entrada ou despesa
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Tabs
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as "income" | "expense" })}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="income" className="gap-2">
                        <ArrowUpCircle className="h-4 w-4" />
                        Entrada
                      </TabsTrigger>
                      <TabsTrigger value="expense" className="gap-2">
                        <ArrowDownCircle className="h-4 w-4" />
                        Despesa
                      </TabsTrigger>
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
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Ex: Material, Venda..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Descreva a transação..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notas adicionais..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Registrar Transação
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                R$ {income.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                R$ {expenses.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50 glow-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${balance >= 0 ? "text-primary" : "text-red-500"}`}>
                R$ {balance.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>Todas as suas movimentações financeiras</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma transação registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        transaction.type === "income" ? "bg-green-500/10" : "bg-red-500/10"
                      }`}>
                        {transaction.type === "income" ? (
                          <ArrowUpCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <div className="flex gap-2 text-sm text-muted-foreground">
                          {transaction.category && <span>{transaction.category}</span>}
                          <span>•</span>
                          <span>{new Date(transaction.transaction_date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${
                      transaction.type === "income" ? "text-green-500" : "text-red-500"
                    }`}>
                      {transaction.type === "income" ? "+" : "-"} R$ {transaction.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
