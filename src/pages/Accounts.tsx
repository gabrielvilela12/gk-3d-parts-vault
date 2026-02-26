import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, Copy, Mail, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Account {
  id: string;
  title: string;
  email: string;
  encrypted_password: string;
  url: string | null;
  created_at: string;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    email: "",
    password: "",
    url: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts((data || []) as Account[]);
    } catch (error: any) {
      toast({ title: "Erro ao carregar contas", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Encode password to base64 for basic obfuscation in DB
      const encoded = btoa(formData.password);

      const { error } = await supabase.from("accounts").insert({
        user_id: user.id,
        title: formData.title,
        email: formData.email,
        encrypted_password: encoded,
        url: formData.url || null,
      } as any);

      if (error) throw error;

      toast({ title: "Conta adicionada!", description: `Conta "${formData.title}" salva com sucesso.` });
      setFormData({ title: "", email: "", password: "", url: "" });
      setDialogOpen(false);
      fetchAccounts();
    } catch (error: any) {
      toast({ title: "Erro ao salvar conta", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta conta?")) return;
    try {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Conta removida" });
      fetchAccounts();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      // Decode from base64 if copying password
      const decoded = label === "Senha" ? atob(text) : text;
      await navigator.clipboard.writeText(decoded);
      toast({ title: `${label} copiado!`, description: "Copiado para a área de transferência." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <KeyRound className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando contas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Contas</h1>
            <p className="page-subtitle">Gerencie seus acessos de forma segura</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conta</DialogTitle>
                <DialogDescription>Adicione um título, email e senha</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Ex: Gmail, Instagram..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Link (opcional)</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://exemplo.com"
                  />
                </div>
                <Button type="submit" className="w-full">Salvar Conta</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {accounts.length === 0 ? (
          <Card className="card-gradient border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <KeyRound className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma conta salva</h3>
              <p className="text-muted-foreground">Adicione sua primeira conta</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <Card key={account.id} className="card-gradient border-border/50">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{account.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(account.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(account.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* URL row */}
                  {account.url && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                      <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={account.url.startsWith("http") ? account.url : `https://${account.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm truncate text-primary hover:underline"
                      >
                        {account.url}
                      </a>
                    </div>
                  )}

                  {/* Email row */}
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{account.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => copyToClipboard(account.email, "Email")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Password row - masked, copy only */}
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-mono tracking-widest">••••••••</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => copyToClipboard(account.encrypted_password, "Senha")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
